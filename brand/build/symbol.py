"""Na Hora Frota symbol: chevron (N / rota) + 45° arrow. All strokes at 45°. y grows downward.
Master space derived from the original artwork: width 365, height 212, stroke t=50."""
import math
R2 = math.sqrt(2)

def _f(v, fmt='%.2f'):
    return (fmt % v).rstrip('0').rstrip('.')

def symbol_paths(t=50.0, gap=9.0, bar=32.0, head=130.0, base=161.0, apex=(137.0, 20.0), shaft_drop=51.0, xR=365.0, apex_r=11.0):
    w = t * R2
    xa, ya = apex
    cTL = xR - w/2; cBR = xR + w/2
    c_cut = cTL - gap * R2
    xo = (c_cut + xa - ya) / 2; yo = xo - xa + ya
    xi = (c_cut + xa - ya - w) / 2; yi = xi - xa + ya + w
    # chevron with rounded outer apex (radius apex_r): tangent points at distance apex_r along each 45° edge
    k = apex_r / R2
    chev = (f"M{_f(0)},{_f(base)} L{_f(xa-k)},{_f(ya+k)} A{_f(apex_r)},{_f(apex_r)} 0 0 1 {_f(xa+k)},{_f(ya+k)} "
            f"L{_f(xo)},{_f(yo)} L{_f(xi)},{_f(yi)} L{_f(xa)},{_f(ya+w)} L{_f(w)},{_f(base)} Z")
    yb = base + shaft_drop
    xh0 = xR - head; yv = head
    arrow_pts = [
        (cTL - yb, yb), (cTL - bar, bar), (xh0 - bar, bar), (xh0, 0), (xR, 0),
        (xR, yv - bar), (xR - bar, yv), (xR - bar, cBR - (xR - bar)), (cBR - yb, yb),
    ]
    arrow = 'M' + ' L'.join(f'{_f(x)},{_f(y)}' for x, y in arrow_pts) + ' Z'
    return dict(chevron=chev, arrow=arrow, w=w, bbox=(0, 0, xR, yb), valley=(xi, yi), cut=((xo,yo),(xi,yi)))

SYMBOL_W = 365.0
SYMBOL_H = 212.0

def symbol_group(fill, x=0, y=0, scale=1.0, id_='symbol', **kw):
    s = symbol_paths(**kw)
    tr = f'translate({_f(x)},{_f(y)})' + (f' scale({_f(scale, "%.5f")})' if scale != 1 else '')
    return f'<g id="{id_}" transform="{tr}"><path d="{s["chevron"]}" fill="{fill}"/><path d="{s["arrow"]}" fill="{fill}"/></g>'
