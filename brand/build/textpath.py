"""Text -> SVG path (outlined) using HarfBuzz shaping + fontTools glyph outlines."""
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

_cache = {}
def _load(font_path):
    if font_path not in _cache:
        blob = hb.Blob.from_file_path(font_path)
        face = hb.Face(blob)
        font = hb.Font(face)
        tt = TTFont(font_path)
        _cache[font_path] = (face, font, tt, tt.getGlyphSet(), tt.getGlyphOrder())
    return _cache[font_path]

def text_path(font_path, text, size, x=0.0, y=0.0, tracking=0.0, features=None, fmt='%.2f'):
    """Returns (path_d, advance_width, bbox) with baseline at y, left origin x. y grows downward."""
    face, font, tt, glyphset, order = _load(font_path)
    upem = face.upem
    scale = size / upem
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font, buf, features or {})
    parts = []; cx = x
    xmin=ymin=1e9; xmax=ymax=-1e9
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        gname = order[info.codepoint]
        gx = cx + pos.x_offset * scale
        gy = y - pos.y_offset * scale
        spen = SVGPathPen(glyphset, ntos=lambda v: (fmt % v).rstrip('0').rstrip('.'))
        tpen = TransformPen(spen, (scale, 0, 0, -scale, gx, gy))
        glyphset[gname].draw(tpen)
        d = spen.getCommands()
        if d:
            parts.append(d)
            bp = BoundsPen(glyphset); TransformPen(bp, (scale,0,0,-scale,gx,gy)); 
            bp2 = BoundsPen(glyphset); glyphset[gname].draw(TransformPen(bp2,(scale,0,0,-scale,gx,gy)))
            if bp2.bounds:
                bx0,by0,bx1,by1 = bp2.bounds
                xmin=min(xmin,bx0); xmax=max(xmax,bx1); ymin=min(ymin,by0); ymax=max(ymax,by1)
        cx += pos.x_advance * scale + tracking
    cx -= tracking
    return ' '.join(parts), cx - x, (xmin, ymin, xmax, ymax)

def metrics(font_path, size):
    face, font, tt, glyphset, order = _load(font_path)
    upem = face.upem; s = size/upem
    os2 = tt['OS/2']
    cap = getattr(os2, 'sCapHeight', 0) * s
    xh = getattr(os2, 'sxHeight', 0) * s
    asc = tt['hhea'].ascent * s; desc = tt['hhea'].descent * s
    return dict(cap=cap, xh=xh, asc=asc, desc=desc)
