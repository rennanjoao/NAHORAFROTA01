"""Aplica uma arte (PNG transparente) sobre uma foto/cena, com perspectiva e modo de mesclagem.

Uso:
  python3 compose_mockup.py BASE.png ARTE.png SAIDA.png --quad x1,y1 x2,y2 x3,y3 x4,y4 [--blend multiply|screen|normal] [--opacity 0.95]

--quad: os 4 cantos onde a arte deve cair, na ordem superior-esquerdo, superior-direito,
        inferior-direito, inferior-esquerdo (pixels da imagem base). A arte é deformada
        para encaixar nesse quadrilátero, mantendo a proporção dentro dele.
--blend: multiply para fundos claros (tecido branco, baú branco), screen para artes claras em
         fundos escuros (camiseta preta), normal para sobrepor sem mesclar.
"""
import sys, argparse
from PIL import Image, ImageChops

def find_coeffs(src, dst):
    import numpy as np
    A = []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    A = np.array(A, dtype=float); B = np.array([c for p in src for c in p], dtype=float)
    return tuple(np.linalg.solve(A, B))

def fit_quad(art_w, art_h, quad):
    """Shrinks the target quad so the art keeps its aspect ratio (centered)."""
    import numpy as np
    q = np.array(quad, dtype=float)
    w = (np.linalg.norm(q[1]-q[0]) + np.linalg.norm(q[2]-q[3])) / 2
    h = (np.linalg.norm(q[3]-q[0]) + np.linalg.norm(q[2]-q[1])) / 2
    ar = art_w / art_h
    if w / h > ar:   # too wide: shrink horizontally
        k = (w - h * ar) / (2 * w)
        q0 = q[0] + (q[1]-q[0]) * k; q1 = q[1] - (q[1]-q[0]) * k
        q3 = q[3] + (q[2]-q[3]) * k; q2 = q[2] - (q[2]-q[3]) * k
    else:            # too tall: shrink vertically
        k = (h - w / ar) / (2 * h)
        q0 = q[0] + (q[3]-q[0]) * k; q3 = q[3] - (q[3]-q[0]) * k
        q1 = q[1] + (q[2]-q[1]) * k; q2 = q[2] - (q[2]-q[1]) * k
    return [tuple(q0), tuple(q1), tuple(q2), tuple(q3)]

def compose(base_path, art_path, out_path, quad, blend='normal', opacity=1.0):
    base = Image.open(base_path).convert('RGBA'); art = Image.open(art_path).convert('RGBA')
    quad = fit_quad(art.width, art.height, quad)
    src = [(0, 0), (art.width, 0), (art.width, art.height), (0, art.height)]
    coeffs = find_coeffs(src, quad)
    warped = art.transform(base.size, Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    a = warped.getchannel('A').point(lambda v: int(v * opacity))
    rgb = warped.convert('RGB'); base_rgb = base.convert('RGB')
    if blend == 'multiply':
        mixed = ImageChops.multiply(base_rgb, rgb)
    elif blend == 'screen':
        mixed = ImageChops.screen(base_rgb, rgb)
    else:
        mixed = rgb
    out = Image.composite(mixed, base_rgb, a)
    out.save(out_path, quality=95); return out

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('base'); ap.add_argument('art'); ap.add_argument('out')
    ap.add_argument('--quad', nargs=4, required=True); ap.add_argument('--blend', default='normal'); ap.add_argument('--opacity', type=float, default=1.0)
    a = ap.parse_args()
    quad = [tuple(float(v) for v in p.split(',')) for p in a.quad]
    compose(a.base, a.art, a.out, quad, a.blend, a.opacity); print('ok', a.out)
