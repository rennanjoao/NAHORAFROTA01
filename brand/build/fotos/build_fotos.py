"""Monta os mockups fotográficos do manual: cena limpa gerada no Higgsfield (brand/mockups/cenas/)
+ arte da marca aplicada em perspectiva, com a luz, as dobras e a textura da superfície.

Uso:
  node brand/build/fotos/render_faces.cjs      # faces impressas (cartões, crachá, placa, lateral do baú)
  python3 brand/build/fotos/build_fotos.py     # gera brand/mockups/fotos/*.jpg

Modos de aplicação (calculados em luz linear):
  pintura  tinta sobre superfície clara (baú branco, cartão branco, crachá): multiplica pela superfície.
  tinta    tinta clara sobre superfície escura (camiseta, boné, van, cartão preto, placa): soma a reflexão
           da tinta à do suporte, modulada pela luz local e pela textura do tecido/papel.
"""
import os, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from compose_mockup import find_coeffs

BRAND = os.path.dirname(os.path.dirname(HERE))
CENAS, ARTES, FACES = os.path.join(BRAND, 'mockups', 'cenas'), os.path.join(BRAND, 'mockups', 'artes'), os.path.join(HERE, 'faces')
OUT = os.path.join(BRAND, 'mockups', 'fotos')
MAX_W = 1800

# ---------- cor
def lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def srgb(c): c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
def luma(c): return c @ np.array([0.2126, 0.7152, 0.0722])

def blur(a, r):
    """Desfoque gaussiano aproximado (3 passadas de caixa), 2D ou 3D."""
    r = max(1, int(round(r)))
    for _ in range(3):
        for ax in (0, 1):
            p = [(0, 0)] * a.ndim; p[ax] = (r + 1, r)
            c = np.cumsum(np.pad(a, p, mode='edge'), axis=ax)
            hi = np.take(c, range(2 * r + 1, c.shape[ax]), axis=ax); lo = np.take(c, range(0, c.shape[ax] - 2 * r - 1), axis=ax)
            a = (hi - lo) / (2 * r + 1)
    return a

def rgb_hsv(c):
    mx, mn = c.max(-1), c.min(-1); d = mx - mn + 1e-9; r, g, b = c[..., 0], c[..., 1], c[..., 2]
    h = np.where(mx == r, (g - b) / d % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    return h, np.where(mx > 0, (mx - mn) / (mx + 1e-9), 0), mx

def hsv_rgb(h, s, v):
    i = np.floor(h * 6) % 6; f = h * 6 - np.floor(h * 6); p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    sel = [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    return np.stack([np.select([i == k for k in range(6)], [s_[ch] for s_ in sel]) for ch in range(3)], -1)

# ---------- geometria
def homog(art_wh, quad):
    """Mapa inverso imagem -> arte (coeficientes de find_coeffs) para a arte inteira cair no quadrilátero."""
    w, h = art_wh
    return find_coeffs([(0, 0), (w, 0), (w, h), (0, h)], quad)

def apply_h(c, x, y):
    a, b, cc, d, e, f, g, h = c; den = g * x + h * y + 1
    return (a * x + b * y + cc) / den, (d * x + e * y + f) / den

def surface(quad, w, h):
    """Função que leva coordenadas (x, y) de uma superfície plana w×h para a imagem (inversa de homog)."""
    H = np.linalg.inv(np.array(list(homog((w, h), quad)) + [1.0]).reshape(3, 3))
    def to_img(x, y):
        p = H @ np.array([x, y, 1.0]); return (p[0] / p[2], p[1] / p[2])
    return to_img

def place(to_img, x, y, w, h, rot=0.0):
    """Quadrilátero na imagem de um retângulo (x, y, w, h) da superfície, girado rot graus em torno do centro."""
    cx, cy = x + w / 2, y + h / 2; c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    pts = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    return [to_img(cx + px * c - py * s, cy + px * s + py * c) for px, py in pts]

def load_art(path, target_w=None):
    im = Image.open(path).convert('RGBA')
    if target_w and im.width > target_w * 1.6:  # reduz antes de amostrar, para não serrilhar
        im = im.resize((int(target_w * 1.6), round(im.height * target_w * 1.6 / im.width)), Image.LANCZOS)
    a = np.asarray(im).astype(float) / 255
    a = np.pad(a, ((2, 2), (2, 2), (0, 0)))  # borda transparente: o contorno sai suave
    a[..., :3] *= a[..., 3:]
    return a

def warp(art, inv, bbox):
    """Amostra a arte (pré-multiplicada) com mapa inverso inv(x, y) -> (u, v) dentro de bbox. Devolve rgb, alpha."""
    x0, y0, x1, y1 = bbox
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(float) + 0.5
    u, v = inv(xs, ys); u, v = u + 2, v + 2
    H, W = art.shape[:2]
    ok = (u >= 0) & (v >= 0) & (u < W - 1) & (v < H - 1)
    u, v = np.clip(u, 0, W - 1.001), np.clip(v, 0, H - 1.001)
    xi, yi = u.astype(int), v.astype(int); fx, fy = (u - xi)[..., None], (v - yi)[..., None]
    s = (art[yi, xi] * (1 - fx) * (1 - fy) + art[yi, xi + 1] * fx * (1 - fy) + art[yi + 1, xi] * (1 - fx) * fy + art[yi + 1, xi + 1] * fx * fy)
    s *= ok[..., None]
    a = s[..., 3]; rgb = s[..., :3] / np.maximum(a, 1e-6)[..., None]
    return rgb, a

def quad_bbox(quad, shape, m=40):
    xs, ys = [p[0] for p in quad], [p[1] for p in quad]
    return (max(0, int(min(xs)) - m), max(0, int(min(ys)) - m), min(shape[1], int(max(xs)) + m + 1), min(shape[0], int(max(ys)) + m + 1))

# ---------- aplicação
def aplicar(img, rgb, a, bbox, modo, ganho=1.15, luz=0.5, textura=0.3, sombra_r=8, sombra=1.0, nitidez=0.6, bordado=None, mascara=None):
    x0, y0, x1, y1 = bbox
    base = lin(img[y0:y1, x0:x1]); al = lin(rgb)
    if nitidez:  # a câmera nunca é perfeitamente nítida: suaviza a borda da arte (0 = recorte seco, 1 = 1 px de desfoque)
        a = a * (1 - nitidez) + blur(a, 1) * nitidez
    if mascara is not None: a = a * mascara[y0:y1, x0:x1]
    if bordado:
        per, ang = bordado
        ys, xs = np.mgrid[y0:y1, x0:x1].astype(float)
        fio = 1 + 0.22 * np.sin((xs * math.cos(math.radians(ang)) + ys * math.sin(math.radians(ang))) * 2 * math.pi / per)
        al = al * fio[..., None]
        sh = np.roll(a, (3, 2), (0, 1)); sh = blur(sh, 3) * (1 - a)
        base = base * (1 - 0.55 * sh)[..., None]  # o bordado levanta do tecido e faz sombra
        top = np.clip(a - np.roll(a, 2, 0), 0, 1); al = al * (1 + 0.35 * top)[..., None]
    L = luma(base)
    if modo == 'pintura':
        mix = base * al * ganho
    else:
        ref = np.median(L[a > 0.5]) if (a > 0.5).any() else L.mean()
        S = np.clip(blur(L, sombra_r) / (ref + 1e-4), 0.35, 2.4) ** sombra
        b2 = blur(L, 2); T = 1 + textura * np.clip((L - b2) / (b2 + 2e-3), -0.7, 0.7)
        mix = base + al * luz * (S * T)[..., None]
    out = base * (1 - a[..., None]) + mix * a[..., None]
    img[y0:y1, x0:x1] = srgb(out)

def aplicar_quad(img, art_path, quad, modo, **kw):
    top_w = math.dist(quad[0], quad[1])
    art = load_art(art_path, top_w)
    h, w = art.shape[0] - 4, art.shape[1] - 4
    c = homog((w, h), quad); bbox = quad_bbox(quad, img.shape)
    rgb, a = warp(art, lambda x, y: apply_h(c, x, y), bbox)
    aplicar(img, rgb, a, bbox, modo, **kw)

def aplicar_cilindro(img, art_path, centro, largura, eixo_x, raio, inclinacao=0.0, modo='tinta', **kw):
    """Arte enrolada num cilindro vertical (frente do boné), centrada em `centro`, com `largura` medida no tecido."""
    art = load_art(art_path, largura)
    h, w = art.shape[0] - 4, art.shape[1] - 4; alt = largura * h / w
    cx, cy = centro; phi0 = math.asin((cx - eixo_x) / raio)
    def inv(x, y):
        phi = np.arcsin(np.clip((x - eixo_x) / raio, -1, 1))
        u = ((phi - phi0) * raio / largura + 0.5) * w
        yt = cy - alt / 2 + (x - cx) * math.tan(math.radians(inclinacao))
        return u, (y - yt) / alt * h
    bbox = (int(cx - largura), int(cy - alt), int(cx + largura), int(cy + alt))
    rgb, a = warp(art, inv, bbox)
    aplicar(img, rgb, a, bbox, modo, **kw)

# ---------- retoque (textos falsos que o gerador deixa na cena)
def _pena(h, w, f):
    r = np.minimum.outer(np.minimum(np.arange(h), np.arange(h)[::-1]), np.minimum(np.arange(w), np.arange(w)[::-1]))
    return np.clip(r / f, 0, 1)

def clonar(img, box, dx, dy, pena=6):
    x0, y0, x1, y1 = box; src = img[y0 + dy:y1 + dy, x0 + dx:x1 + dx].copy(); dst = img[y0:y1, x0:x1]
    anel = lambda r: np.concatenate([r[:4].reshape(-1, 3), r[-4:].reshape(-1, 3), r[:, :4].reshape(-1, 3), r[:, -4:].reshape(-1, 3)]).mean(0)
    src = np.clip(src * anel(dst) / np.maximum(anel(src), 1e-3), 0, 1)
    m = _pena(y1 - y0, x1 - x0, pena)[..., None]; img[y0:y1, x0:x1] = dst * (1 - m) + src * m

def mediana(img, box, tam=31, pena=8):
    x0, y0, x1, y1 = box
    reg = Image.fromarray((img[y0:y1, x0:x1] * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(tam))
    m = _pena(y1 - y0, x1 - x0, pena)[..., None]; img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - m) + np.asarray(reg) / 255 * m

def menta(img, box):
    """Leva reflexos verde-limão para o verde-menta da marca (#04E8A4, matiz 162°)."""
    x0, y0, x1, y1 = box; c = img[y0:y1, x0:x1]
    w = np.clip((c[..., 1] - np.maximum(c[..., 0], c[..., 2])) / 0.2, 0, 1)
    h, s, v = rgb_hsv(c); h = h + (162 / 360 - h) * w
    img[y0:y1, x0:x1] = c * (1 - w[..., None]) + hsv_rgb(h, s, v) * w[..., None]

def salvar(img, nome, corte):
    im = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).crop(corte)
    if im.width > MAX_W: im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True); im.save(os.path.join(OUT, nome + '.jpg'), quality=86, optimize=True, progressive=True)
    print('ok', nome, im.size)

def cena(nome): return np.asarray(Image.open(os.path.join(CENAS, nome + '.jpg')).convert('RGB')).astype(float) / 255
A = lambda f: os.path.join(ARTES, f)
F = lambda f: os.path.join(FACES, f)

# ---------- peças
def caminhao():
    img = cena('caminhao-bau')
    clonar(img, (1215, 585, 1326, 612), 0, -42); clonar(img, (1335, 710, 1500, 752), 0, -55); clonar(img, (1415, 858, 1495, 892), 0, -40)
    # lateral do baú entre os frisos (detectada na foto); face 3,5 : 1 com logo, assinatura e faixa a 45°
    aplicar_quad(img, F('bau.png'), [(142, 384), (1068, 85), (1068, 785), (142, 719)], 'pintura', ganho=1.25, nitidez=0.8)
    salvar(img, 'caminhao-bau', (0, 0, 2048, 1152))

def van():
    img = cena('van')
    mediana(img, (800, 35, 1160, 82))
    painel = surface([(469, 240), (1804, 221), (1820, 544), (471, 559)], 4150, 1000)  # painel lateral, 4,15 : 1
    lw = 4150 * 0.62; lh = lw * 581 / 4800
    aplicar_quad(img, A('van-faixa-logo-linha-1200mm.png'), place(painel, (4150 - lw) / 2, (1000 - lh) / 2, lw, lh), 'tinta', luz=0.42, textura=0.15, sombra_r=30, sombra=0.8)
    salvar(img, 'van', (0, 0, 2048, 1152))

def camiseta_frente():
    img = cena('camiseta-frente')
    menta(img, (420, 1250, 1100, 1800))
    w = 136; h = w * 412 / 709  # bordado 60 mm no peito esquerdo
    aplicar_quad(img, A('camiseta-peito-simbolo-verde-60mm.png'), place(lambda x, y: (x, y), 955 - w / 2, 530 - h / 2, w, h, rot=-1.5), 'tinta', luz=0.55, textura=0.55, sombra_r=10, bordado=(2.6, -45), nitidez=0.6)
    salvar(img, 'camiseta-frente', (0, 40, 1536, 1960))

def camiseta_costas():
    img = cena('camiseta-costas')
    mediana(img, (1148, 782, 1232, 828), tam=25, pena=6)
    w = 600; h = w * 1249 / 2835  # estampa 240 mm, 10 cm abaixo da gola
    aplicar_quad(img, A('camiseta-costas-wordmark-240mm.png'), place(lambda x, y: (x, y), 810 - w / 2, 1045, w, h, rot=1.5), 'tinta', luz=0.42, textura=0.6, sombra_r=14, sombra=1.1)
    salvar(img, 'camiseta-costas', (0, 0, 1536, 1920))

def bone():
    img = cena('bone')
    aplicar_cilindro(img, A('bone-frente-simbolo-70mm.png'), (1000, 875), 250, eixo_x=905, raio=495, inclinacao=-2.5, luz=0.5, textura=0.5, sombra_r=10, bordado=(2.8, -45), nitidez=0.6)
    salvar(img, 'bone', (0, 0, 2048, 2048))

def cartao():
    img = cena('cartao')
    clonar(img, (930, 1312, 1285, 1410), 0, -105, pena=10)
    branco = [(458, 905), (1340, 977), (1301, 1462), (418, 1391)]
    m = Image.new('L', (img.shape[1], img.shape[0]), 255)
    ImageDraw.Draw(m).polygon([(x - 2 if i in (0, 3) else x + 2, y - 2 if i < 2 else y + 2) for i, (x, y) in enumerate(branco)], fill=0)
    fora_do_branco = np.asarray(m.filter(ImageFilter.GaussianBlur(1))).astype(float) / 255
    aplicar_quad(img, F('cartao-frente.png'), [(207, 586), (1087, 570), (1096, 1059), (216, 1075)], 'tinta', luz=0.5, textura=0.2, sombra_r=30, sombra=0.6, mascara=fora_do_branco)
    aplicar_quad(img, F('cartao-verso.png'), branco, 'pintura', ganho=1.1)
    salvar(img, 'cartao', (0, 44, 1536, 1964))

def cracha():
    img = cena('cracha')
    aplicar_quad(img, F('cracha.png'), [(434, 755), (1101, 755), (1101, 1692), (434, 1692)], 'pintura', ganho=1.08)
    salvar(img, 'cracha', (0, 0, 1536, 1920))

def placa():
    img = cena('placa-patio')
    aplicar_quad(img, F('placa.png'), [(697, 344), (1364, 344), (1364, 796), (697, 796)], 'tinta', luz=0.46, textura=0.08, sombra=0, nitidez=0.3)
    salvar(img, 'placa-patio', (0, 229, 2048, 912))

if __name__ == '__main__':
    pecas = {'caminhao': caminhao, 'van': van, 'camiseta-frente': camiseta_frente, 'camiseta-costas': camiseta_costas,
             'bone': bone, 'cartao': cartao, 'cracha': cracha, 'placa': placa}
    for n in (sys.argv[1:] or pecas): pecas[n]()
