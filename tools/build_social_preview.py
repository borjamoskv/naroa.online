#!/usr/bin/env python3
"""Three complete original works, with a quiet artist signature.
Landscape card 1200 × 630; editable generator and 4800 × 2520 PNG master.
Palette: ink #0c0b0b, ivory #f4eedf; colour belongs to the artworks.
Typeface: real Schoolbell Regular. Eye path: portraits, Naroa, artist name.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'classic/images/social'
OUT.mkdir(parents=True, exist_ok=True)
S = 4
canvas = Image.new('RGB', (1200*S, 630*S), '#0c0b0b')
draw = ImageDraw.Draw(canvas)
font_file = ROOT / 'classic/assets/fonts/Schoolbell-Regular.ttf'
assert font_file.is_file(), 'The real Schoolbell font is required'
def text(x,y,copy,size,colour='#f4eedf'):
    font=ImageFont.truetype(str(font_file),size*S)
    draw.text((x*S,y*S),copy,font=font,fill=colour,anchor='lt')
photos = [
    ('johnny-rocks-hq-01.webp',16),
    ('marilyn-rocks-hq-01.webp',410),
    ('entre-tantas-flores-de-dia-hq-01.webp',804),
]
for name,x in photos:
    source=Image.open(ROOT/'classic/images/catalogo'/name).convert('RGB')
    art=ImageOps.contain(source,(380*S,484*S),Image.Resampling.LANCZOS)
    assert art.width<=source.width and art.height<=source.height, 'Never enlarge an original'
    canvas.paste(art,(int(x*S+(380*S-art.width)/2),16*S))
# One small signature area; no slogan competing with the three artworks.
text(38,524,'Naroa',76)
text(255,553,'Gutiérrez Gil',31)
text(1023,557,'Bilbao',26)
canvas.save(OUT/'naroa-obras-compartir-v2.png',optimize=True)
canvas.resize((1200,630),Image.Resampling.LANCZOS).save(OUT/'naroa-obras-compartir-v2.jpg',quality=93,optimize=True,progressive=True)
print('Built social preview v2: three complete original works, 4800 × 2520 PNG and 1200 × 630 JPEG.')
