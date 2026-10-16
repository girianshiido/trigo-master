"""Generate the outlined title mark using the bundled Manrope font (fontTools)."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
import math
ROOT = Path(__file__).resolve().parents[1]
font = TTFont(ROOT / 'public/fonts/manrope-800.ttf')
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
units = font['head'].unitsPerEm

def word(text, x, y, size, color, spacing=0):
    scale = size / units
    result = []
    for c in text:
        name = cmap[ord(c)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        result.append(f'<path d="{pen.getCommands()}" transform="translate({x:.3f} {y}) scale({scale:.7f} {-scale:.7f})" fill="{color}"/>')
        x += font['hmtx'][name][0] * scale + spacing
    return ''.join(result)

mark = '''<defs><linearGradient id="mint" x2="1" y2="1"><stop stop-color="#c2f7e4"/><stop offset="1" stop-color="#6fcfbd"/></linearGradient><linearGradient id="gold"><stop stop-color="#ffe5ae"/><stop offset="1" stop-color="#dcae60"/></linearGradient></defs><g transform="translate(105 110)"><circle r="82" fill="#14323f" stroke="#7ed6c52a"/><circle r="69" fill="none" stroke="#8ce7ce25" stroke-width="1"/><circle r="57" fill="none" stroke="url(#mint)" stroke-width="2"/><path d="M-72 0H72M0-72V72" stroke="#80c5c464" stroke-width="1"/><path d="M0 0L40-40M0 0H57" stroke="url(#gold)" stroke-width="2"/><path d="M22 0A22 22 0 0 0 15.556-15.556" fill="none" stroke="#efca80" stroke-width="2"/><circle r="3" fill="#8ce7ce"/><circle cx="40.305" cy="-40.305" r="7" fill="url(#gold)"/><circle cx="40.305" cy="-40.305" r="12" fill="none" stroke="#efca8045"/><path d="M-10-19H12M-5-19V13M7-19V13" fill="none" stroke="url(#mint)" stroke-width="4" stroke-linecap="round" transform="translate(-16 20) scale(.68)"/></g>'''
for n in [0,2,3,4,6,8,9,10,12,14,15,16,18,20,21,22]:
    x=105+57*math.cos(n*math.pi/12); y=110-57*math.sin(n*math.pi/12)
    mark += f'<circle cx="{x:.3f}" cy="{y:.3f}" r="2.2" fill="#a7e8d8"/>'
svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 220" role="img" aria-label="Trigo Master">'+mark+word('TRIGO',211,116,82,'url(#mint)',1.7)+word('MASTER',216,163,31,'url(#gold)',9.4)+'<path d="M215 184H567" stroke="#8ce7ce24"/></svg>\n'
(ROOT/'public/logo.svg').write_text(svg)
