#!/usr/bin/env python3
"""Paredes de fondo de Trayectoria: pared, muro, callejón y túnel subterráneo.

Cada tipo de encuentro tiene detrás la fotografía de una pared real:
- pared     (individual)       enlucido ocre roto, con sus desconchones
- muro      (colectiva)        ladrillo rojo con el mortero viejo
- callejon  (arte en la calle) revoco manchado de humedad y moho
- tunel     (mercado de arte)  azulejo blanco alargado, el de los pasillos de metro

Las fotos son texturas sin costura de Poly Haven (polyhaven.com), de dominio público
(CC0): no exigen firma, pero la procedencia se anota aquí. Los originales (JPG de 2K,
entre 1 y 3 MB) no viven en el repositorio; se descargan de

    https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/<id>/<id>_diff_2k.jpg

y este script los convierte en las teselas WebP de `classic/assets/walls/` y escribe
las reglas `.career-wall-stage>i[data-wall-layer=…]` de `classic/immersive/app.css`.
Esas reglas no se retocan a mano.

    python3 tools/wall_textures.py               # reescribe las reglas CSS
    python3 tools/wall_textures.py --fotos DIR   # además rehace las teselas desde los JPG de DIR

`/assets/` se sirve con caché inmutable de un año: si una tesela cambia, sube VERSION.
La foto de cada pared solo se pide cuando esa pared aparece (`.is-on` o `data-seen`).
"""
import argparse, pathlib

REPO = pathlib.Path(__file__).resolve().parent.parent
CSS = REPO / 'classic' / 'immersive' / 'app.css'
OUT = REPO / 'classic' / 'assets' / 'walls'
VERSION = 1
LADO = 1280      # píxeles de la tesela
CALIDAD = 60

# capa → (id en Poly Haven, giro en grados, lado en pantalla, lado en móvil, velo crema 0–1)
# El lado en pantalla decide la escala del material (con 900 px un ladrillo mide unos 100 px) y cuánto
# se repite: el muro mide como mucho 1280 px de ancho, así que cuanto más se acerque el lado a eso,
# menos veces se ve la misma mancha a la vez.
# El velo acerca la foto al crema de la página para que el texto de encima se lea sin esfuerzo.
WALLS = {
    'pared': ('rough_plaster_broken', 0, 1150, 600, .2),
    'muro': ('brick_4', 0, 900, 560, .12),
    'callejon': ('concrete_wall_003', 0, 1150, 600, .0),
    'tunel': ('long_white_tiles', 90, 820, 520, .0),
}

def tesela(name, fotos):
    from PIL import Image
    ident, giro, *_ = WALLS[name]
    im = Image.open(fotos / f'{ident}_diff_2k.jpg').convert('RGB')
    if giro:
        im = im.rotate(giro, expand=True)
    # Se reduce sobre un mosaico 3×3 para que el remuestreo vea a sus vecinos y no deje costura.
    big = Image.new('RGB', (im.width * 3, im.height * 3))
    for i in range(3):
        for j in range(3):
            big.paste(im, (i * im.width, j * im.height))
    small = big.resize((LADO * 3, LADO * 3), Image.LANCZOS).crop((LADO, LADO, LADO * 2, LADO * 2))
    OUT.mkdir(parents=True, exist_ok=True)
    small.save(OUT / f'{name}-v{VERSION}.webp', 'WEBP', quality=CALIDAD, method=6)

def color_medio(name):
    from PIL import Image
    r, g, b = Image.open(OUT / f'{name}-v{VERSION}.webp').convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0))
    return f'#{r:02x}{g:02x}{b:02x}'

def rules(name):
    _, _, lado, movil, velo = WALLS[name]
    sel = f'.career-wall-stage>i[data-wall-layer={name}]'
    foto = f'url("/assets/walls/{name}-v{VERSION}.webp")'
    if velo:   # el velo va como degradado plano por encima de la foto
        foto = f'linear-gradient(rgba(255,250,236,{velo:g}),rgba(255,250,236,{velo:g})),{foto}'
    # Mientras la foto llega, la capa lleva su color medio: la pared aparece ya en su tono.
    return (f'{sel}{{--wall-tile:{lado}px;--wall-tile-s:{movil}px;background-color:{color_medio(name)}}}'
            f'{sel}:is(.is-on,[data-seen]){{background-image:{foto}}}')

if __name__ == '__main__':
    import re
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--fotos', type=pathlib.Path, help='carpeta con los JPG originales de Poly Haven; rehace las teselas')
    ap.add_argument('--css', type=pathlib.Path, default=CSS, help='hoja de estilos a reescribir')
    ap.add_argument('--out', type=pathlib.Path, help='escribir aquí en vez de sobre --css')
    args = ap.parse_args()
    if args.fotos:
        for name in WALLS:
            tesela(name, args.fotos)
            print(f'{name:9} {(OUT / f"{name}-v{VERSION}.webp").stat().st_size / 1024:4.0f} kB')
    css = args.css.read_text()
    for name in WALLS:
        pat = re.compile(r'\.career-wall-stage>i\[data-wall-layer=' + name + r'\]\{[^\n]*\}\n')
        body = rules(name) + '\n'
        css, n = pat.subn(lambda m: body, css)
        assert n == 1, f'no encuentro la regla de {name}'
    (args.out or args.css).write_text(css)
    print(f'4 paredes escritas en {(args.out or args.css).name}')
