import sys, os, re, json, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_brand as B
from symbol import symbol_paths, SYMBOL_W, SYMBOL_H, _f
from textpath import text_path
HERE = os.path.dirname(os.path.abspath(__file__)); M = os.path.join(HERE, 'manual')
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GREEN, BLACK, WHITE = B.GREEN, B.BLACK, B.WHITE

# ---------- symbol defs (colors via CSS custom props --cs/--c1/--c2)
sp = symbol_paths()
wm2_svg, wm2_w, _ = B.wordmark_lines(0, 0, ('var(--c1)', 'var(--c2)'))
wm1_svg, wm1_w = B.wordmark_inline(0, 0, ('var(--c1)', 'var(--c2)'), cap=150.0)
dims = {'sym': (SYMBOL_W, SYMBOL_H), 'wm2': (wm2_w, SYMBOL_H), 'wm1': (wm1_w, 150.0)}
# horizontal
hW = SYMBOL_W + B.GAP_H + wm2_w; dims['logoH'] = (hW, SYMBOL_H)
# inline
lW = SYMBOL_W + 60 + wm1_w; dims['logoL'] = (lW, SYMBOL_H)
# vertical (centered lines)
vW = max(SYMBOL_W, wm2_w); gap = 56.0; y_top = SYMBOL_H + gap; b1 = y_top + B.CAP; b2 = b1 + B.LINE_GAP + B.CAP
vparts = []
for text, b, col in (('Na Hora', b1, 'var(--c1)'), ('Frota', b2, 'var(--c2)')):
    d, w, bb = text_path(B.WM_FONT, text, B.FS, 0, b, tracking=B.TRACK)
    ink = bb[2] - bb[0]; x = (vW - ink) / 2 - bb[0]
    d, w, bb = text_path(B.WM_FONT, text, B.FS, x, b, tracking=B.TRACK)
    vparts.append(f'<path d="{d}" fill="{col}"/>')
dims['logoV'] = (vW, b2)
sym_inner = f'<path d="{sp["chevron"]}" fill="var(--cs)"/><path d="{sp["arrow"]}" fill="var(--cs)"/>'
DEFS = ('<svg width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true" focusable="false"><defs>'
        f'<symbol id="sym" viewBox="0 0 {_f(SYMBOL_W)} {_f(SYMBOL_H)}">{sym_inner}</symbol>'
        f'<symbol id="wm2" viewBox="0 0 {_f(wm2_w)} {_f(SYMBOL_H)}">{wm2_svg}</symbol>'
        f'<symbol id="wm1" viewBox="0 0 {_f(wm1_w)} 150">{wm1_svg}</symbol>'
        f'<symbol id="logoH" viewBox="0 0 {_f(hW)} {_f(SYMBOL_H)}">{sym_inner}<g transform="translate({_f(SYMBOL_W + B.GAP_H)},0)">{wm2_svg}</g></symbol>'
        f'<symbol id="logoL" viewBox="0 0 {_f(lW)} {_f(SYMBOL_H)}">{sym_inner}<g transform="translate({_f(SYMBOL_W + 60)},{_f((SYMBOL_H - 150) / 2)})">{wm1_svg}</g></symbol>'
        f'<symbol id="logoV" viewBox="0 0 {_f(vW)} {_f(b2)}"><g transform="translate({_f((vW - SYMBOL_W) / 2)},0)">{sym_inner}</g>{"".join(vparts)}</symbol>'
        '</defs></svg>')
LABELS = {'sym': 'Símbolo Na Hora Frota', 'wm2': 'Wordmark Na Hora Frota', 'wm1': 'Wordmark Na Hora Frota em linha', 'logoH': 'Logo Na Hora Frota', 'logoL': 'Logo Na Hora Frota em linha', 'logoV': 'Logo Na Hora Frota vertical'}

def use(id_, cs, c1, c2, w=None, extra_style=''):
    W, H = dims[id_]
    st = f'--cs:{cs};--c1:{c1};--c2:{c2};' + (f'width:{w}px;height:auto;' if w else '') + extra_style
    return f'<svg class="u" viewBox="0 0 {_f(W)} {_f(H)}" style="{st}" role="img" aria-label="{LABELS[id_]}"><use href="#{id_}"/></svg>'

def use_in_svg(id_, x, y, w, cs, c1, c2):
    W, H = dims[id_]; h = w * H / W
    return f'<use href="#{id_}" x="{_f(x)}" y="{_f(y)}" width="{_f(w)}" height="{_f(h)}" style="--cs:{cs};--c1:{c1};--c2:{c2}"/>', h

# ---------- construction grid
def grid_svg():
    vb = (-78, -70, SYMBOL_W + 150, SYMBOL_H + 140)
    x0, y0, vw, vh = vb; x1, y1 = x0 + vw, y0 + vh
    pts = re.findall(r'[-\d.]+,[-\d.]+', sp['chevron'] + ' ' + sp['arrow'])
    verts = [tuple(map(float, p.split(','))) for p in pts]
    # polygon edges for construction lines
    def poly(d):
        return [tuple(map(float, p.split(','))) for p in re.findall(r'[-\d.]+,[-\d.]+', d)]
    lines = set()
    for d in (sp['chevron'], sp['arrow']):
        P = poly(d)
        for i in range(len(P)):
            (ax, ay), (bx, by) = P[i], P[(i + 1) % len(P)]
            dx, dy = bx - ax, by - ay
            if abs(dx) < .5 and abs(dy) < .5: continue
            if abs(dy) < .5: lines.add(('h', round(ay, 1)))
            elif abs(dx) < .5: lines.add(('v', round(ax, 1)))
            elif abs(abs(dx) - abs(dy)) < 1:
                if dx * dy > 0: lines.add(('d1', round(ay - ax, 1)))   # y = x + c
                else: lines.add(('d2', round(ax + ay, 1)))            # x + y = c
    L = []
    for kind, c in sorted(lines):
        if kind == 'h': L.append(f'<line x1="{x0}" y1="{c}" x2="{x1}" y2="{c}"/>')
        elif kind == 'v': L.append(f'<line x1="{c}" y1="{y0}" x2="{c}" y2="{y1}"/>')
        elif kind == 'd1': L.append(f'<line x1="{x0}" y1="{x0 + c}" x2="{x1}" y2="{x1 + c}"/>')
        else: L.append(f'<line x1="{x0}" y1="{c - x0}" x2="{x1}" y2="{c - x1}"/>')
    circles = ''.join(f'<circle cx="{_f(x)}" cy="{_f(y)}" r="3.2"/>' for x, y in verts)
    mono = 'font-family="Space Grotesk, Inter, sans-serif" font-weight="500" font-size="11" fill="#8A9199" letter-spacing="1"'
    dim = []
    # width
    dim.append(f'<line x1="0" y1="-44" x2="{_f(SYMBOL_W)}" y2="-44" stroke="#8A9199" stroke-width="1"/><line x1="0" y1="-50" x2="0" y2="-38" stroke="#8A9199"/><line x1="{_f(SYMBOL_W)}" y1="-50" x2="{_f(SYMBOL_W)}" y2="-38" stroke="#8A9199"/><text x="{_f(SYMBOL_W/2)}" y="-52" text-anchor="middle" {mono}>L = 7,30 t</text>')
    # height
    dim.append(f'<line x1="-44" y1="0" x2="-44" y2="{_f(SYMBOL_H)}" stroke="#8A9199" stroke-width="1"/><line x1="-50" y1="0" x2="-38" y2="0" stroke="#8A9199"/><line x1="-50" y1="{_f(SYMBOL_H)}" x2="-38" y2="{_f(SYMBOL_H)}" stroke="#8A9199"/><text transform="translate(-54,{_f(SYMBOL_H/2)}) rotate(-90)" text-anchor="middle" {mono}>H = 4,24 t</text>')
    # t (horizontal width of the upstroke at the base = t*sqrt2)
    w = sp['w']
    dim.append(f'<line x1="0" y1="{_f(161+36)}" x2="{_f(w)}" y2="{_f(161+36)}" stroke="#04E8A4" stroke-width="1"/><text x="{_f(w/2)}" y="{_f(161+52)}" text-anchor="middle" {mono.replace("#8A9199","#04E8A4")}>t·√2</text>')
    # bars
    dim.append(f'<line x1="{_f(SYMBOL_W+14)}" y1="0" x2="{_f(SYMBOL_W+14)}" y2="32" stroke="#04E8A4" stroke-width="1"/><text x="{_f(SYMBOL_W+22)}" y="22" {mono.replace("#8A9199","#04E8A4")}>0,64 t</text>')
    # head
    dim.append(f'<line x1="{_f(SYMBOL_W-130)}" y1="-16" x2="{_f(SYMBOL_W)}" y2="-16" stroke="#04E8A4" stroke-width="1"/><text x="{_f(SYMBOL_W-65)}" y="-22" text-anchor="middle" {mono.replace("#8A9199","#04E8A4")}>2,60 t</text>')
    # angle
    dim.append(f'<text x="{_f(SYMBOL_W+22)}" y="{_f(SYMBOL_H-10)}" {mono}>45°</text><path d="M{_f(SYMBOL_W+14)},{_f(SYMBOL_H)} l24,-24" stroke="#8A9199" fill="none"/><path d="M{_f(SYMBOL_W+14)},{_f(SYMBOL_H)} h26" stroke="#8A9199" fill="none"/>')
    # shaft drop
    dim.append(f'<line x1="-14" y1="161" x2="-14" y2="212" stroke="#04E8A4" stroke-width="1"/><text transform="translate(-20,186) rotate(-90)" text-anchor="middle" {mono.replace("#8A9199","#04E8A4")}>1 t</text>')
    return (f'<svg viewBox="{x0} {y0} {vw} {vh}" role="img" aria-label="Grade de construção do símbolo">'
            f'<g stroke="#8A9199" stroke-width=".6" opacity=".55">{"".join(L)}</g>'
            f'<g fill="#04E8A4" fill-opacity=".22" stroke="#04E8A4" stroke-width="1.2"><path d="{sp["chevron"]}"/><path d="{sp["arrow"]}"/></g>'
            f'<g fill="none" stroke="#fff" stroke-width="1">{circles}</g>{"".join(dim)}</svg>')

def clear_svg():
    W, H = dims['logoH']; x = 53.0
    u, _ = use_in_svg('logoH', 0, 0, W, GREEN, WHITE, GREEN)
    mono = 'font-family="Space Grotesk, Inter, sans-serif" font-weight="500" font-size="13" fill="#8A9199" letter-spacing="1"'
    sq = lambda cx, cy: f'<rect x="{_f(cx)}" y="{_f(cy)}" width="{_f(x)}" height="{_f(x)}" fill="#04E8A4" fill-opacity=".18" stroke="#04E8A4" stroke-width="1"/><text x="{_f(cx + x/2)}" y="{_f(cy + x/2 + 5)}" text-anchor="middle" {mono.replace("#8A9199","#04E8A4")}>x</text>'
    return (f'<svg viewBox="{-2*x-10} {-2*x-10} {W + 4*x + 20} {H + 4*x + 20}" role="img" aria-label="Área de proteção do logo">'
            f'<rect x="{-x}" y="{-x}" width="{W + 2*x}" height="{H + 2*x}" fill="none" stroke="#8A9199" stroke-dasharray="6 6" stroke-width="1"/>'
            f'<rect x="{-2*x}" y="{-2*x}" width="{W + 4*x}" height="{H + 4*x}" fill="none" stroke="#8A9199" stroke-dasharray="2 8" stroke-width="1" opacity=".5"/>'
            + sq(-x, -x) + sq(W, -x) + sq(-x, H) + sq(W, H) + sq(0, -x) + sq(-x, 0) +
            f'<text x="{_f(W + 2*x + 6)}" y="{_f(H + 2*x + 6)}" text-anchor="end" {mono}>2x recomendado</text>' + u + '</svg>')

def wheel(cx, cy, r=52):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#0B0C0D"/><circle cx="{cx}" cy="{cy}" r="{int(r*.58)}" fill="#2A2D30"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{int(r*.23)}" fill="#8A9199"/><circle cx="{cx}" cy="{cy}" r="{int(r*.08)}" fill="#0B0C0D"/>')

def truck_svg(dark=False):
    box = '#0E1012' if dark else '#F2F4F5'
    cs, c1, c2 = (GREEN, WHITE, GREEN) if dark else (GREEN, BLACK, GREEN)
    logo, h = use_in_svg('logoH', 390, 0, 560, cs, c1, c2)
    y = 96 + (344 - h) / 2 - 18
    logo = logo.replace('y="0"', f'y="{_f(y)}"', 1)
    pattern = ''
    if dark:
        cells = []
        sc = 0.22; sw = SYMBOL_W * sc; sh = SYMBOL_H * sc; row = 0; yy = 100
        while yy < 440:
            off = (sw + 16) / 2 if row % 2 else 0
            xx = 900 + off
            while xx < 1150:
                cells.append(f'<g transform="translate({_f(xx)},{_f(yy)}) scale({sc})" fill="#04E8A4" opacity=".14"><path d="{sp["chevron"]}"/><path d="{sp["arrow"]}"/></g>')
                xx += sw + 16
            yy += sh + 12; row += 1
        pattern = f'<clipPath id="boxclip{int(dark)}"><rect x="900" y="96" width="250" height="344" rx="8"/></clipPath><g clip-path="url(#boxclip{int(dark)})">{"".join(cells)}</g>'
    url_fill = '#8A9199' if dark else '#5B6168'
    band = '' if dark else '<polygon points="1030,440 1150,320 1150,392 1102,440" fill="#04E8A4"/>'
    return (f'<svg viewBox="0 0 1200 560" role="img" aria-label="Caminhão baú com a identidade Na Hora Frota">'
            f'<ellipse cx="640" cy="484" rx="560" ry="16" fill="#000" opacity=".45"/>'
            f'<rect x="150" y="430" width="1000" height="26" fill="#1C1F22"/>'
            f'<rect x="330" y="96" width="820" height="344" rx="8" fill="{box}"/>{pattern}{band}'
            f'<rect x="1142" y="96" width="8" height="344" rx="3" fill="#2A2D30" opacity=".55"/>'
            f'<path d="M112,440 V262 Q112,152 212,152 H330 V440 Z" fill="#0E1012"/>'
            f'<path d="M136,246 Q140,176 208,176 H258 V246 Z" fill="#2A2D30"/><rect x="268" y="176" width="54" height="70" fill="#2A2D30"/>'
            f'<rect x="100" y="396" width="40" height="44" rx="4" fill="#1C1F22"/><rect x="112" y="300" width="8" height="36" rx="2" fill="#F2F4F5" opacity=".9"/>'
            f'<line x1="262" y1="176" x2="262" y2="430" stroke="#2A2D30" stroke-width="2"/>'
            f'<use href="#sym" x="276" y="292" width="40" height="23.2" style="--cs:#04E8A4"/>'
            + wheel(215, 448) + wheel(905, 448) + wheel(1015, 448) + logo +
            f'<text x="390" y="408" font-family="Space Grotesk, Inter, sans-serif" font-weight="500" font-size="15" letter-spacing="2.5" fill="{url_fill}">SEMPRE NA HORA · NAHORAFROTA.COM.BR</text></svg>')

def van_svg():
    sym, h = use_in_svg('sym', 118, 184, 250, GREEN, GREEN, GREEN)
    wm, h2 = use_in_svg('wm1', 118, 348, 236, GREEN, WHITE, GREEN)
    return (f'<svg viewBox="0 0 900 460" role="img" aria-label="Van com a identidade Na Hora Frota">'
            f'<ellipse cx="450" cy="416" rx="400" ry="14" fill="#000" opacity=".45"/>'
            f'<path d="M60,392 V210 Q60,160 110,158 H560 L700,166 Q760,172 792,236 L838,336 Q846,356 846,376 V392 Z" fill="#0E1012"/>'
            f'<path d="M612,180 H702 Q742,186 764,240 L792,300 H612 Z" fill="#2A2D30"/><rect x="500" y="180" width="100" height="112" rx="4" fill="#2A2D30"/>'
            f'<line x1="490" y1="178" x2="490" y2="380" stroke="#2A2D30" stroke-width="2"/>'
            f'<path d="M802,304 L840,344 V362 H822 Z" fill="#F2F4F5" opacity=".85"/>'
            f'<rect x="60" y="392" width="786" height="10" fill="#1C1F22"/>'
            + wheel(210, 398, 46) + wheel(690, 398, 46) + sym + wm +
            f'<text x="520" y="372" font-family="Space Grotesk, Inter, sans-serif" font-weight="500" font-size="11" letter-spacing="2" fill="#8A9199">NAHORAFROTA.COM.BR</text></svg>')

def tee_svg():
    shape = 'M60,60 L185,22 Q230,70 275,22 L400,60 L455,150 L395,195 L355,165 L355,600 L105,600 L105,165 L65,195 L5,150 Z'
    collar = 'M185,22 Q230,70 275,22 Q230,46 185,22 Z'
    front_sym, _ = use_in_svg('sym', 262, 118, 72, GREEN, GREEN, GREEN)
    back_wm, bh = use_in_svg('wm2', 130, 150, 200, GREEN, WHITE, GREEN)
    mono = 'font-family="Space Grotesk, Inter, sans-serif" font-weight="500" font-size="12" letter-spacing="3" fill="#8A9199"'
    return (f'<svg viewBox="0 0 1000 640" role="img" aria-label="Camiseta com a identidade Na Hora Frota">'
            f'<g><path d="{shape}" fill="#0E1012"/><path d="{collar}" fill="#1C1F22"/>{front_sym}<text x="230" y="628" text-anchor="middle" {mono}>FRENTE</text></g>'
            f'<g transform="translate(540,0)"><path d="{shape}" fill="#0E1012"/><path d="M185,22 Q230,40 275,22 Q230,36 185,22 Z" fill="#1C1F22"/>{back_wm}<text x="230" y="{_f(150 + bh + 30)}" text-anchor="middle" {mono}>SEMPRE NA HORA</text><text x="230" y="628" text-anchor="middle" {mono}>COSTAS</text></g></svg>')

def pattern_chevron_inline(fg=GREEN, opacity=.16, tw=820, th=300):
    cells = []; sc = .32; sw = SYMBOL_W * sc; sh = SYMBOL_H * sc; row = 0; y = -sh/2
    while y < th + sh:
        off = (sw + 40) / 2 if row % 2 else 0; x = -sw + off
        while x < tw + sw:
            cells.append(f'<g transform="translate({_f(x)},{_f(y)}) scale({sc})"><path d="{sp["chevron"]}"/><path d="{sp["arrow"]}"/></g>')
            x += sw + 40
        y += sh + 26; row += 1
    return f'<svg viewBox="0 0 {tw} {th}" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block" aria-hidden="true"><g fill="{fg}" opacity="{opacity}">{"".join(cells)}</g></svg>'

def pattern_routes_inline(fg=GREEN, tw=820, th=300, hero=False):
    import random; random.seed(3)
    L = []
    for i in range(-4, 12):
        x0 = i * 110; L.append(f'<path d="M{x0},{th} L{x0 + th},0"/>')
    Hh = []
    for j in range(0, 6):
        y0 = 30 + j * 56; Hh.append(f'<path d="M0,{y0} H{tw}"/>')
    dots = []
    for i in range(-4, 12):
        for j in range(0, 6):
            x0 = i * 110; y0 = 30 + j * 56; x = x0 + (th - y0)
            if 0 <= x <= tw and random.random() < .3: dots.append(f'<circle cx="{_f(x)}" cy="{y0}" r="3.2"/>')
    op = '.35' if hero else '.55'
    style = 'position:absolute;inset:0;width:100%;height:100%' if hero else 'width:100%;height:100%;display:block'
    return (f'<svg viewBox="0 0 {tw} {th}" preserveAspectRatio="xMidYMid slice" style="{style}" aria-hidden="true">'
            f'<g stroke="{fg}" stroke-width="1" fill="none" opacity="{op}">{"".join(L)}</g><g stroke="{fg}" stroke-width="1" fill="none" opacity=".22">{"".join(Hh)}</g><g fill="{fg}" opacity=".9">{"".join(dots)}</g></svg>')

# ---------- assemble
body = open(os.path.join(M, 'body.html'), encoding='utf-8').read()
css = open(os.path.join(M, 'style.css'), encoding='utf-8').read()
def rep_use(m):
    parts = m.group(1).split(); id_, cs, c1, c2 = parts[:4]; w = None
    for p in parts[4:]:
        if p.startswith('w='): w = p[2:]
    return use(id_, cs, c1, c2, w)
body = re.sub(r'\{\{USE ([^}]+)\}\}', rep_use, body)
repl = {
    '{{DEFS}}': DEFS, '{{GRID_SVG}}': grid_svg(), '{{CLEAR_SVG}}': clear_svg(),
    '{{TRUCK_SVG}}': truck_svg(False), '{{TRUCK_DARK_SVG}}': truck_svg(True), '{{VAN_SVG}}': van_svg(), '{{TEE_SVG}}': tee_svg(),
    '{{PATTERN_CHEVRON}}': pattern_chevron_inline(), '{{PATTERN_ROUTES}}': pattern_routes_inline(),
    '{{ROUTES_HERO}}': pattern_routes_inline(tw=1400, th=620, hero=True),
}
for k, v in repl.items():
    assert k in body, k
    body = body.replace(k, v)
assert '{{' not in body, re.findall(r'\{\{[^}]*\}\}', body)[:5]
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=Chakra+Petch:wght@700&display=swap">'
TITLE = 'Manual da Marca Na Hora Frota'
head_artifact = f'<title>{TITLE}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n{FONTS}\n<style>\n{css}\n</style>\n'
artifact = head_artifact + body
standalone = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
              f'<title>{TITLE}</title>\n{FONTS}\n<style>\n{css}\n</style>\n</head>\n<body>\n{body}\n</body>\n</html>\n')
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'manual-da-marca.html'), 'w', encoding='utf-8').write(standalone)
if len(sys.argv) > 1:
    open(sys.argv[1], 'w', encoding='utf-8').write(artifact)
print('artifact bytes', len(artifact.encode()), 'standalone bytes', len(standalone.encode()))
print('dims', {k: (round(v[0]), round(v[1])) for k, v in dims.items()})
