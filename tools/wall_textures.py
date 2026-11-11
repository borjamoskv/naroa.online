#!/usr/bin/env python3
"""Paredes de fondo de Trayectoria: pared, muro, callejón y túnel subterráneo.

Cada tipo de encuentro tiene detrás la fotografía de una pared real:
- pared     (individual)       enlucido ocre roto, con sus desconchones
- muro      (colectiva)        ladrillo rojo con el mortero viejo
- callejon  (arte en la calle) revoco manchado de humedad y moho
- tunel     (mercado de arte)  azulejo blanco alargado, el de los pasillos de metro

Las fotos son texturas sin costura de Poly Haven (polyhaven.com), de dominio público
(CC0): no exigen firma, pero la procedencia se anota aquí. De cada una se usan tres
mapas (JPG de 2K, entre 0,5 y 3 MB) que no viven en el repositorio; se descargan de

    https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/<id>/<id>_<mapa>_2k.jpg

con <mapa> = diff (color), nor_gl (normales, con la Y hacia arriba) y ao (oclusión).

Este script las revela y escribe las teselas de `classic/assets/walls/` y las reglas
`.career-wall-stage>i[data-wall-layer=…]` de `classic/immersive/app.css`, que no se
retocan a mano.

    python3 tools/wall_textures.py               # reescribe las reglas CSS
    python3 tools/wall_textures.py --fotos DIR   # además rehace las teselas desde los JPG de DIR

El revelado (solo con --fotos; pide numpy y un Pillow con AVIF) hace cuatro cosas:
- luz: el mapa de color de un escaneo viene sin sombras y queda plano. Se ilumina con su
  mapa de normales, con la luz arriba a la izquierda como el brillo que la página pone encima, y se
  oscurecen los huecos con su mapa de oclusión. Las juntas se hunden y el grano se levanta;
- un poco de contraste local, para rematar el volumen;
- craquelado: una red de grietas de pintura cuarteada, calculada y fundida en la foto.
  Es periódica como la tesela y tiene de uno a tres tamaños de escama según la pared. La grieta
  lleva su sombra y, en el labio de abajo a la derecha, un filo de luz; cada escama, abarquillada,
  clarea hacia su canto de abajo a la derecha, el que mira a la luz;
- tres archivos por pared: AVIF y WebP de 1280 px, y un AVIF de 2048 px para pantallas
  densas de escritorio. El WebP es la reserva de los navegadores sin AVIF.

Las teselas llevan -vN en el nombre y se sirven con caché inmutable de un año: si una cambia,
sube VERSION.
La foto de cada pared solo se pide cuando esa pared aparece (`.is-on` o `data-seen`).
"""
import argparse, pathlib

REPO = pathlib.Path(__file__).resolve().parent.parent
CSS = REPO / 'classic' / 'immersive' / 'app.css'
OUT = REPO / 'classic' / 'assets' / 'walls'
VERSION = 3
LADO, LADO_DENSO = 1280, 2048     # píxeles de la tesela normal y de la de pantalla densa
CLARIDAD = 25                     # contraste local, en % de máscara de enfoque de radio ancho
# Luz del revelado: elevación sobre la pared (más baja = más rasante), parte de luz ambiente
# y cuánto pesa la oclusión. RELIEVE exagera la pendiente del mapa de normales de cada pared.
LUZ_ELEVACION, LUZ_AMBIENTE, LUZ_OCLUSION = 42, .38, 1.1
RELIEVE = {'pared': 2.2, 'muro': 1.6, 'callejon': 1.4, 'tunel': 1.3}

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

# Craquelado de cada pared: (semilla, capas, abarquillado, dónde).
# Cada capa es (escamas por lado, grosor de grieta en px a 1280, fuerza 0–1, umbral de zona):
# con umbral 0 la red cubre toda la pared; con más, solo aparece a rodales.
# «dónde» limita el craquelado a una parte de la foto: 'claro' = solo la cara del azulejo, no la
# junta; 'rojo' = solo el ladrillo, no el mortero; None = en todas partes.
CRAQUELADO = {
    'pared': (11, [(13, 2.4, 1, 0), (40, 1.2, .85, .3), (92, .8, .6, .52)], .07, None),
    'muro': (5, [(34, 1, .5, .5)], .03, 'rojo'),
    'callejon': (23, [(11, 2.1, .9, 0), (36, 1.1, .75, .42)], .05, None),
    'tunel': (37, [(46, .9, .6, .44)], 0, 'claro'),
}

def _ruido(np, Image, lado, celdas, rng):
    """Ruido suave y periódico en 0..1: rejilla aleatoria ampliada con interpolación cúbica envolvente."""
    paso = -(-lado // celdas)
    grid = np.pad(rng.random((celdas, celdas)).astype(np.float32), 2, mode='wrap')
    big = np.asarray(Image.fromarray(grid).resize(((celdas + 4) * paso, (celdas + 4) * paso), Image.BICUBIC))
    cut = big[2 * paso:(celdas + 2) * paso, 2 * paso:(celdas + 2) * paso]
    if cut.shape[0] != lado:
        cut = np.asarray(Image.fromarray(cut).resize((lado, lado), Image.BICUBIC))
    return np.clip(cut, 0, 1)

def _suave(np, x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def _red(np, Image, lado, n, rng):
    """Celdas de Voronoi periódicas con los bordes alabeados, para que la grieta no sea una recta.
    Devuelve la distancia al borde de la escama y el vector a su centro, todo en tamaños de escama."""
    cs = lado / n
    seeds = (np.indices((n, n)).transpose(1, 2, 0) + .5 + .9 * (rng.random((n, n, 2)) - .5)).astype(np.float32)
    yy, xx = np.mgrid[0:lado, 0:lado].astype(np.float32)
    ancho, fino, muy_fino = max(4, n // 3), max(8, n * 2), max(16, n * 5)
    warp = lambda: (_ruido(np, Image, lado, ancho, rng) - .5) * .6 + (_ruido(np, Image, lado, fino, rng) - .5) * .26 + (_ruido(np, Image, lado, min(muy_fino, lado // 4), rng) - .5) * .08
    py = yy / cs + warp(); px = xx / cs + warp()
    iy = np.floor(py).astype(np.int32); ix = np.floor(px).astype(np.int32)
    d1 = np.full((lado, lado), 9e9, np.float32); d2 = d1.copy(); vy = np.zeros_like(d1); vx = np.zeros_like(d1)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            cy = iy + dy; cx = ix + dx
            s = seeds[cy % n, cx % n]
            oy = cy - cy % n + s[..., 0] - py; ox = cx - cx % n + s[..., 1] - px
            d = oy * oy + ox * ox
            closer = d < d1
            d2 = np.where(closer, d1, np.minimum(d2, d)); vy = np.where(closer, oy, vy); vx = np.where(closer, ox, vx); d1 = np.where(closer, d, d1)
    return np.sqrt(d2) - np.sqrt(d1), vy, vx

def craquelar(im, name):
    import numpy as np
    from PIL import Image
    semilla, capas, abarquillado, donde = CRAQUELADO[name]
    lado = im.width; rng = np.random.default_rng(semilla); esc = lado / 1280
    foto = np.asarray(im).astype(np.float32) / 255
    oscuro = np.zeros((lado, lado), np.float32); luz = np.zeros_like(oscuro); sombra = np.zeros_like(oscuro)
    limite = 1
    if donde == 'claro':    # la cara esmaltada, no la junta
        limite = _suave(np, foto.mean(axis=2), .66, .78)
    elif donde == 'rojo':   # el ladrillo, no el mortero
        limite = _suave(np, foto[..., 0] - foto[..., 2], .1, .2)
    for n, grosor, fuerza, umbral in capas:
        borde, vy, vx = _red(np, Image, lado, n, rng)
        # la grieta se abre y se cierra a lo largo de su recorrido
        ancho = grosor * esc / (lado / n) * (.45 + 1.3 * _ruido(np, Image, lado, max(4, n // 2), rng))
        zona = (_suave(np, _ruido(np, Image, lado, max(3, n // 5), rng), umbral - .12, umbral + .12) if umbral else 1) * limite
        grieta = np.clip(1 - borde / ancho, 0, 1) ** 1.4 * zona
        s = max(1, round(1.4 * esc))
        # la luz viene de arriba a la izquierda: el labio de abajo a la derecha de la grieta la recibe
        luz = np.maximum(luz, np.clip(np.roll(grieta, (s, s), (0, 1)) - grieta, 0, 1) * fuerza)
        oscuro = np.maximum(oscuro, grieta * fuerza)
        # cada escama, algo abarquillada, clarea hacia su canto de abajo a la derecha
        sombra += np.clip(-(vy + vx), -1, 1) * abarquillado * fuerza * zona * _suave(np, borde, 0, .5)
    out = foto * (1 + sombra[..., None]) * (1 - .62 * oscuro[..., None]) + .2 * luz[..., None]
    return Image.fromarray((np.clip(out, 0, 1) * 255 + .5).astype(np.uint8))

def _mapa(name, fotos, mapa, lado):
    """Un mapa de la textura, girado como la pared y reducido sin costura (sobre un mosaico 3×3)."""
    from PIL import Image
    ident, giro, *_ = WALLS[name]
    im = Image.open(fotos / f'{ident}_{mapa}_2k.jpg').convert('RGB')
    if giro:
        im = im.rotate(giro, expand=True)
    if im.width == lado:
        return im
    big = Image.new('RGB', (im.width * 3, im.height * 3))
    for i in range(3):
        for j in range(3):
            big.paste(im, (i * im.width, j * im.height))
    return big.resize((lado * 3, lado * 3), Image.LANCZOS).crop((lado, lado, lado * 2, lado * 2))

def iluminar(name, fotos, lado):
    """El color, iluminado con su relieve: difusa por el mapa de normales y huecos por la oclusión."""
    import math
    import numpy as np
    from PIL import Image
    arr = lambda mapa: np.asarray(_mapa(name, fotos, mapa, lado)).astype(np.float32) / 255
    color, ao = arr('diff'), arr('ao').mean(axis=2)
    n = arr('nor_gl') * 2 - 1
    if WALLS[name][1] == 90:     # al girar la foto giran también sus vectores: (x, y) → (−y, x)
        n = np.stack([-n[..., 1], n[..., 0], n[..., 2]], axis=-1)
    elif WALLS[name][1]:
        raise ValueError('solo sé girar las normales 90°')
    n[..., :2] *= RELIEVE[name]
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    el = math.radians(LUZ_ELEVACION); c = math.cos(el) * math.sqrt(.5)
    luz_dir = np.array([-c, c, math.sin(el)], np.float32)     # de arriba a la izquierda; la Y del mapa va hacia arriba
    difusa = np.clip(n @ luz_dir, 0, None) / luz_dir[2]        # 1 = superficie plana: la pared no cambia de tono
    luz = (LUZ_AMBIENTE + (1 - LUZ_AMBIENTE) * difusa) * ao ** LUZ_OCLUSION
    lineal = np.where(color <= .04045, color / 12.92, ((color + .055) / 1.055) ** 2.4) * luz[..., None]
    srgb = np.where(lineal <= .0031308, lineal * 12.92, 1.055 * np.clip(lineal, 0, None) ** (1 / 2.4) - .055)
    return Image.fromarray((np.clip(srgb, 0, 1) * 255 + .5).astype(np.uint8))

def revelar(name, fotos, lado):
    from PIL import Image, ImageFilter
    im = iluminar(name, fotos, lado)
    # El contraste local mira a los vecinos: sobre un mosaico 3×3 para que no deje costura.
    big = Image.new('RGB', (lado * 3, lado * 3))
    for i in range(3):
        for j in range(3):
            big.paste(im, (i * lado, j * lado))
    big = big.filter(ImageFilter.UnsharpMask(radius=lado / 70, percent=CLARIDAD, threshold=0))
    return craquelar(big.crop((lado, lado, lado * 2, lado * 2)), name)

def archivos(name):
    base = f'{name}-v{VERSION}'
    return {'webp': f'{base}.webp', 'avif': f'{base}.avif', 'denso': f'{name}-2x-v{VERSION}.avif'}

def teselas(name, fotos):
    OUT.mkdir(parents=True, exist_ok=True)
    f = archivos(name)
    normal = revelar(name, fotos, LADO)
    normal.save(OUT / f['webp'], 'WEBP', quality=50, method=6)
    normal.save(OUT / f['avif'], 'AVIF', quality=45, speed=3)
    revelar(name, fotos, LADO_DENSO).save(OUT / f['denso'], 'AVIF', quality=40, speed=3)
    for viejo in OUT.glob(f'{name}-*'):          # fuera las versiones anteriores
        if viejo.name not in f.values():
            viejo.unlink()
    return {k: (OUT / v).stat().st_size / 1024 for k, v in f.items()}

def color_medio(name):
    from PIL import Image
    r, g, b = Image.open(OUT / archivos(name)['webp']).convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0))
    return f'#{r:02x}{g:02x}{b:02x}'

def rules(name):
    _, _, lado, movil, velo = WALLS[name]
    f = {k: f'url("/assets/walls/{v}")' for k, v in archivos(name).items()}
    sel = f'.career-wall-stage>i[data-wall-layer={name}]'
    visto = f'{sel}:is(.is-on,[data-seen])'
    # el velo va como degradado plano por encima de la foto
    capa = f'linear-gradient(rgba(255,250,236,{velo:g}),rgba(255,250,236,{velo:g})),' if velo else ''
    elegir = lambda avif: f'{capa}image-set({avif} type("image/avif"),{f["webp"]} type("image/webp"))'
    # Mientras la foto llega, la capa lleva su color medio: la pared aparece ya en su tono.
    # La primera declaración es la reserva de quien no entiende image-set() con type().
    return (f'{sel}{{--wall-tile:{lado}px;--wall-tile-s:{movil}px;background-color:{color_medio(name)}}}'
            f'{visto}{{background-image:{capa}{f["webp"]};background-image:{elegir(f["avif"])}}}'
            f'@media(min-width:761px) and (min-resolution:1.5dppx){{{visto}{{background-image:{elegir(f["denso"])}}}}}')

if __name__ == '__main__':
    import re
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--fotos', type=pathlib.Path, help='carpeta con los JPG originales de Poly Haven; rehace las teselas')
    ap.add_argument('--css', type=pathlib.Path, default=CSS, help='hoja de estilos a reescribir')
    ap.add_argument('--out', type=pathlib.Path, help='escribir aquí en vez de sobre --css')
    args = ap.parse_args()
    if args.fotos:
        for name in WALLS:
            kb = teselas(name, args.fotos)
            print(f'{name:9} ' + ' · '.join(f'{k} {v:4.0f} kB' for k, v in kb.items()))
    css = args.css.read_text()
    for name in WALLS:
        pat = re.compile(r'\.career-wall-stage>i\[data-wall-layer=' + name + r'\]\{[^\n]*\}\n')
        body = rules(name) + '\n'
        css, n = pat.subn(lambda m: body, css)
        assert n == 1, f'no encuentro la regla de {name}'
    (args.out or args.css).write_text(css)
    print(f'4 paredes escritas en {(args.out or args.css).name}')
