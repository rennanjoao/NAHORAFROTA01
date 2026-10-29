import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from symbol import symbol_paths, symbol_group, SYMBOL_W, SYMBOL_H, _f
from textpath import text_path, metrics

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts') + os.sep
WM_FONT = FONTS + 'ChakraPetch-700.ttf'
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GREEN = '#04E8A4'; BLACK = '#080808'; WHITE = '#FFFFFF'

# ---- wordmark metrics: 2-line block height == symbol height (212)
CAP = 94.0; LINE_GAP = 24.0
m = metrics(WM_FONT, 100.0)
FS = 100.0 * CAP / m['cap']            # font size giving cap height 94
TRACK = -0.015 * FS

def wordmark_lines(x, y_top, colors):
    """Two lines: 'Na Hora' / 'Frota'. y_top = cap top of line 1. Returns (svg, width)."""
    b1 = y_top + CAP; b2 = b1 + LINE_GAP + CAP
    d1, w1, bb1 = text_path(WM_FONT, 'Na Hora', FS, x, b1, tracking=TRACK)
    d2, w2, bb2 = text_path(WM_FONT, 'Frota', FS, x, b2, tracking=TRACK)
    # left-align on actual ink: shift so ink xmin == x
    dx1 = x - bb1[0]; dx2 = x - bb2[0]
    d1, w1, bb1 = text_path(WM_FONT, 'Na Hora', FS, x + dx1, b1, tracking=TRACK)
    d2, w2, bb2 = text_path(WM_FONT, 'Frota', FS, x + dx2, b2, tracking=TRACK)
    width = max(bb1[2], bb2[2]) - x
    svg = (f'<g id="wordmark"><path id="wm-line1" d="{d1}" fill="{colors[0]}"/>'
           f'<path id="wm-line2" d="{d2}" fill="{colors[1]}"/></g>')
    return svg, width, (bb1, bb2)

def wordmark_inline(x, y_top, colors, cap=CAP):
    fs = FS * cap / CAP; tr = -0.015 * fs
    b = y_top + cap
    d1, w1, bb1 = text_path(WM_FONT, 'Na Hora', fs, x, b, tracking=tr)
    dx = x - bb1[0]
    d1, w1, bb1 = text_path(WM_FONT, 'Na Hora', fs, x + dx, b, tracking=tr)
    space = fs * 0.28
    x2 = bb1[2] + space
    d2, w2, bb2 = text_path(WM_FONT, 'Frota', fs, x2, b, tracking=tr)
    dx2 = x2 - bb2[0]
    d2, w2, bb2 = text_path(WM_FONT, 'Frota', fs, x2 + dx2, b, tracking=tr)
    width = bb2[2] - x
    svg = (f'<g id="wordmark"><path id="wm-line1" d="{d1}" fill="{colors[0]}"/>'
           f'<path id="wm-line2" d="{d2}" fill="{colors[1]}"/></g>')
    return svg, width

def svg_doc(w, h, body, title, bg=None):
    bgrect = f'<rect width="{_f(w)}" height="{_f(h)}" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_f(w)} {_f(h)}" width="{_f(w)}" height="{_f(h)}">'
            f'<title>{title}</title>{bgrect}{body}</svg>')

SCHEMES = {
    # name: (symbol, line1, line2)
    'cor-fundo-escuro': (GREEN, WHITE, GREEN),
    'cor-fundo-claro':  (GREEN, BLACK, GREEN),
    'mono-branco':      (WHITE, WHITE, WHITE),
    'mono-preto':       (BLACK, BLACK, BLACK),
    'mono-verde':       (GREEN, GREEN, GREEN),
}
SYMBOL_SCHEMES = {'verde': GREEN, 'branco': WHITE, 'preto': BLACK}

GAP_H = 57.0   # symbol -> wordmark gap in horizontal lockup

def build_horizontal(scheme):
    sym, c1, c2 = SCHEMES[scheme]
    wm, wmw, _ = wordmark_lines(SYMBOL_W + GAP_H, 0, (c1, c2))
    body = symbol_group(sym) + wm
    W = SYMBOL_W + GAP_H + wmw; H = SYMBOL_H
    return svg_doc(W, H, body, f'Na Hora Frota — logo horizontal ({scheme})'), (W, H)

def build_inline(scheme):
    sym, c1, c2 = SCHEMES[scheme]
    cap = 150.0
    gap = 60.0
    wm, wmw = wordmark_inline(SYMBOL_W + gap, (SYMBOL_H - cap)/2, (c1, c2), cap=cap)
    body = symbol_group(sym) + wm
    W = SYMBOL_W + gap + wmw; H = SYMBOL_H
    return svg_doc(W, H, body, f'Na Hora Frota — logo em linha ({scheme})'), (W, H)

def build_vertical(scheme):
    sym, c1, c2 = SCHEMES[scheme]
    # symbol on top, centered; two-line wordmark centered below
    wm_tmp, wmw, (bb1, bb2) = wordmark_lines(0, 0, (c1, c2))
    gap = 56.0
    W = max(SYMBOL_W, wmw)
    # center each line individually
    y_top = SYMBOL_H + gap
    b1 = y_top + CAP; b2 = b1 + LINE_GAP + CAP
    parts = []
    for text, b, col in (('Na Hora', b1, c1), ('Frota', b2, c2)):
        d, w, bb = text_path(WM_FONT, text, FS, 0, b, tracking=TRACK)
        ink = bb[2] - bb[0]; x = (W - ink)/2 - bb[0]
        d, w, bb = text_path(WM_FONT, text, FS, x, b, tracking=TRACK)
        parts.append(f'<path d="{d}" fill="{col}"/>')
    body = symbol_group(sym, x=(W - SYMBOL_W)/2) + '<g id="wordmark">' + ''.join(parts) + '</g>'
    H = b2
    return svg_doc(W, H, body, f'Na Hora Frota — logo vertical ({scheme})'), (W, H)

def build_wordmark(scheme):
    _, c1, c2 = SCHEMES[scheme]
    wm, wmw, _ = wordmark_lines(0, 0, (c1, c2))
    return svg_doc(wmw, SYMBOL_H, wm, f'Na Hora Frota — wordmark ({scheme})'), (wmw, SYMBOL_H)

def build_wordmark_inline(scheme):
    _, c1, c2 = SCHEMES[scheme]
    cap = 150.0
    wm, wmw = wordmark_inline(0, 0, (c1, c2), cap=cap)
    return svg_doc(wmw, cap, wm, f'Na Hora Frota — wordmark em linha ({scheme})'), (wmw, cap)

def build_symbol(color_name):
    col = SYMBOL_SCHEMES[color_name]
    return svg_doc(SYMBOL_W, SYMBOL_H, symbol_group(col), f'Na Hora Frota — símbolo ({color_name})'), (SYMBOL_W, SYMBOL_H)

def build_app_icon(variant, size=1024.0, maskable=False):
    # safe zone: symbol width = 62% of icon (maskable: 50%)
    frac = 0.52 if maskable else 0.62
    sc = size * frac / SYMBOL_W
    sx = (size - SYMBOL_W*sc)/2; sy = (size - SYMBOL_H*sc)/2
    r = 0 if maskable else size * 0.2237  # iOS-like superellipse approximated by rounded rect
    if variant == 'escuro':
        bg, fg = BLACK, GREEN
    elif variant == 'verde':
        bg, fg = GREEN, BLACK
    else:
        bg, fg = WHITE, BLACK
    body = f'<rect width="{_f(size)}" height="{_f(size)}" rx="{_f(r)}" fill="{bg}"/>' + symbol_group(fg, sx, sy, sc)
    return svg_doc(size, size, body, f'Na Hora Frota — ícone de app ({variant}{" maskable" if maskable else ""})'), (size, size)

def build_avatar(variant, size=1024.0):
    bg, fg = (BLACK, GREEN) if variant == 'escuro' else (GREEN, BLACK)
    sc = size * 0.56 / SYMBOL_W
    sx = (size - SYMBOL_W*sc)/2; sy = (size - SYMBOL_H*sc)/2
    body = f'<circle cx="{_f(size/2)}" cy="{_f(size/2)}" r="{_f(size/2)}" fill="{bg}"/>' + symbol_group(fg, sx, sy, sc)
    return svg_doc(size, size, body, f'Na Hora Frota — avatar ({variant})'), (size, size)

def build_favicon():
    # symbol only, padded square, transparent
    size = 64.0
    sc = size * 0.92 / SYMBOL_W
    sx = (size - SYMBOL_W*sc)/2; sy = (size - SYMBOL_H*sc)/2
    return svg_doc(size, size, symbol_group(GREEN, sx, sy, sc), 'Na Hora Frota — favicon'), (size, size)

def build_pattern_chevron(fg=GREEN, bg=BLACK, opacity=0.18):
    # tile of symbols in staggered rows
    tw, th = 1200.0, 800.0
    sc = 0.5; sw = SYMBOL_W*sc; sh = SYMBOL_H*sc
    body = f'<rect width="{_f(tw)}" height="{_f(th)}" fill="{bg}"/>'
    row = 0; y = -sh/2
    while y < th + sh:
        off = (sw + 60)/2 if row % 2 else 0
        x = -sw + off
        while x < tw + sw:
            body += symbol_group(fg, x, y, sc, id_=f's{row}') .replace('id="s%d"'%row, f'opacity="{opacity}"')
            x += sw + 60
        y += sh + 40; row += 1
    return svg_doc(tw, th, body, 'Na Hora Frota — padrão chevron'), (tw, th)

def build_pattern_routes(fg=GREEN, bg=BLACK):
    # thin 45° route lines with nodes, BRIVANT-like structural lines
    tw, th = 1200.0, 800.0
    body = f'<rect width="{_f(tw)}" height="{_f(th)}" fill="{bg}"/><g stroke="{fg}" stroke-width="2" fill="none" opacity="0.55">'
    import random
    random.seed(7)
    for i in range(-8, 14):
        x0 = i*160
        body += f'<path d="M{x0},{th} L{x0+th},0"/>'
    body += '</g><g stroke="%s" stroke-width="2" fill="none" opacity="0.35">' % fg
    for i in range(0, 7):
        y0 = 60 + i*120
        body += f'<path d="M0,{y0} H{tw}"/>'
    body += f'</g><g fill="{fg}">'
    for i in range(-8, 14):
        for j in range(0, 7):
            x0 = i*160; y0 = 60 + j*120
            # intersection of diagonal (x0 + (th - y)) with horizontal y0
            x = x0 + (th - y0)
            if 0 <= x <= tw and random.random() < 0.35:
                body += f'<circle cx="{_f(x)}" cy="{y0}" r="6"/>'
    body += '</g>'
    return svg_doc(tw, th, body, 'Na Hora Frota — padrão rotas'), (tw, th)

def write(path, svg):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f: f.write(svg)

manifest = []
def emit(rel, svg, dims, png_widths=()):
    path = os.path.join(OUT, rel); write(path, svg)
    manifest.append(dict(file=rel, w=dims[0], h=dims[1], png=list(png_widths)))

if __name__ == '__main__':
    for scheme in SCHEMES:
        s, d = build_horizontal(scheme); emit(f'logo/svg/nhf-logo-horizontal-{scheme}.svg', s, d, (1200, 2400))
        s, d = build_vertical(scheme);   emit(f'logo/svg/nhf-logo-vertical-{scheme}.svg', s, d, (800, 1600))
        s, d = build_inline(scheme);     emit(f'logo/svg/nhf-logo-linha-{scheme}.svg', s, d, (1600, 3200))
        s, d = build_wordmark(scheme);   emit(f'logo/svg/nhf-wordmark-{scheme}.svg', s, d, (1000,))
        s, d = build_wordmark_inline(scheme); emit(f'logo/svg/nhf-wordmark-linha-{scheme}.svg', s, d, (1600,))
    for c in SYMBOL_SCHEMES:
        s, d = build_symbol(c); emit(f'logo/svg/nhf-simbolo-{c}.svg', s, d, (512, 1024))
    for v in ('escuro', 'verde', 'claro'):
        s, d = build_app_icon(v); emit(f'icones/nhf-app-icon-{v}.svg', s, d, (1024, 512, 192))
    s, d = build_app_icon('escuro', maskable=True); emit('icones/nhf-app-icon-maskable.svg', s, d, (512,))
    for v in ('escuro', 'verde'):
        s, d = build_avatar(v); emit(f'icones/nhf-avatar-{v}.svg', s, d, (1024, 400))
    s, d = build_favicon(); emit('icones/nhf-favicon.svg', s, d, (64, 32))
    s, d = build_pattern_chevron(); emit('padroes/nhf-padrao-chevron-escuro.svg', s, d, (1200,))
    s, d = build_pattern_chevron(fg=BLACK, bg=GREEN, opacity=0.14); emit('padroes/nhf-padrao-chevron-verde.svg', s, d, (1200,))
    s, d = build_pattern_routes(); emit('padroes/nhf-padrao-rotas-escuro.svg', s, d, (1200,))
    s, d = build_pattern_routes(fg=BLACK, bg=WHITE); emit('padroes/nhf-padrao-rotas-claro.svg', s, d, (1200,))
    json.dump(manifest, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'manifest.json'), 'w'), indent=1)
    print('files:', len(manifest), 'font size', round(FS,2), 'cap', CAP)
