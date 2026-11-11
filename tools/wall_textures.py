#!/usr/bin/env python3
"""Texturas del muro de Trayectoria (yeso, ladrillo, madera, hormigón).

Cada pared es una tesela SVG procedural incrustada como data-URI en las reglas
`.career-wall-stage>i[data-wall-layer=…]` de `classic/immersive/app.css`. Este
script es su fuente: se retoca aquí y se vuelve a volcar, nunca a mano en el CSS.

    python3 tools/wall_textures.py            # reescribe las cuatro reglas
    python3 tools/wall_textures.py --svg DIR  # además deja los SVG sueltos en DIR

Reglas de la casa para que la tesela no delate su costura:
- el ruido usa `stitchTiles` con la región del filtro igual a la tesela;
- lo que mira a sus vecinos (bisel, desenfoque) trabaja sobre geometría repetida
  más allá del borde, no sobre ruido;
- `--wall-period` es la altura de repetición de la capa: el CSS la usa para mover
  la pared con `transform` en vez de repintarla en cada fotograma.
"""
import argparse, pathlib, random, re

CSS = pathlib.Path(__file__).resolve().parent.parent / 'classic' / 'immersive' / 'app.css'

# Luz rasante desde arriba a la izquierda. Con elevación 45° una superficie plana da 0,707:
# por debajo es sombra (sombra tostada), por encima es brillo (blanco cálido).
FLAT = .7071
def relief(src, shadow, light, gs, gl, res):
    sr, sg, sb = shadow; lr, lg, lb = light
    return (f"<feColorMatrix in='{src}' values='0 0 0 0 {sr} 0 0 0 0 {sg} 0 0 0 0 {sb} {-gs:g} 0 0 0 {gs*FLAT:.3f}' result='{res}s'/>"
            f"<feColorMatrix in='{src}' values='0 0 0 0 {lr} 0 0 0 0 {lg} 0 0 0 0 {lb} {gl:g} 0 0 0 {-gl*FLAT:.3f}' result='{res}l'/>")
def light(src, scale, az, res, el=45):
    return (f"<feDiffuseLighting in='{src}' surfaceScale='{scale}' diffuseConstant='1' lighting-color='#fff' result='{res}'>"
            f"<feDistantLight azimuth='{az}' elevation='{el}'/></feDiffuseLighting>")
def merge(*names):
    return '<feMerge>' + ''.join(f"<feMergeNode in='{n}'/>" for n in names) + '</feMerge>'
def svg(w, h, body):
    return f"<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}'>{body}</svg>"
FULL = "x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'"
UMBER = (.36, .24, .08); WARM = (1, .99, .93)

def plain(freq, octaves, seed, scale, az, shadow, lightc, gs, gl):
    return (f"<feTurbulence type='fractalNoise' baseFrequency='{freq}' numOctaves='{octaves}' seed='{seed}' stitchTiles='stitch' result='n'/>"
            + light('n', scale, az, 'l') + relief('l', shadow, lightc, gs, gl, 'r'))

def yeso_llana():
    # Paños de llana: ondulación ancha y blanda, algo más tendida en horizontal.
    f = f"<filter id='f' {FULL}>" + plain('.0065 .0085', 4, 11, 9, 225, UMBER, WARM, 1.6, 1.9) + merge('rs', 'rl') + "</filter>"
    return svg(620, 620, f + "<rect width='100%' height='100%' filter='url(#f)'/>")
def yeso_grano():
    # Diente fino del enlucido y, encima, las pasadas de brocha de la pintura.
    f = (f"<filter id='f' {FULL}>" + plain('.8', 2, 4, 1.3, 225, UMBER, WARM, .9, 1)
         + "<feTurbulence type='fractalNoise' baseFrequency='.018 .1' numOctaves='3' seed='27' stitchTiles='stitch' result='b'/>"
         + light('b', 1, 250, 'bl') + relief('bl', UMBER, WARM, .42, .46, 'q')
         + merge('rs', 'rl', 'qs', 'ql') + "</filter>")
    return svg(330, 310, f + "<rect width='100%' height='100%' filter='url(#f)'/>")

def ladrillo():
    rnd = random.Random(7)
    W, H, bw, bh, j = 448, 448, 112, 56, 7
    tones = [(176, 78, 40), (188, 92, 48), (164, 70, 38), (196, 104, 58), (150, 62, 36), (182, 86, 52)]
    cells = {}
    for row in range(H // bh):
        for col in range(W // bw):
            r, g, b = rnd.choice(tones)
            a = rnd.uniform(.34, .52) if rnd.random() > .12 else rnd.uniform(.58, .68)   # alguno más cocido
            cells[(row, col)] = (r, g, b, a, rnd.uniform(-1.2, 1.2), rnd.uniform(-.8, .8), rnd.uniform(-1.6, 1.6), rnd.uniform(-1, 1))
    def brick(x, y, w, h):
        # contorno a mano: vértices cada ~26 px con un temblor de ±1,2 px y esquinas matadas
        k = 2.6; jt = lambda: rnd.uniform(-1.2, 1.2)
        pts = [(x + k, y)] + [(x + w * t, y + jt()) for t in (.25, .5, .75)] + [(x + w - k, y), (x + w, y + k)]
        pts += [(x + w + jt(), y + h * .5), (x + w, y + h - k), (x + w - k, y + h)]
        pts += [(x + w * t, y + h + jt()) for t in (.75, .5, .25)] + [(x + k, y + h), (x, y + h - k), (x + jt(), y + h * .5), (x, y + k)]
        return 'M' + 'L'.join(f"{px:.1f} {py:.1f}" for px, py in pts) + 'Z'
    paths = []
    for row in range(H // bh):
        for col in range(W // bw):
            r, g, b, a, dx, dy, dw, dh = cells[(row, col)]
            x = col * bw + (bw / 2 if row % 2 else 0) + j / 2 + dx
            y = row * bh + j / 2 + dy
            paths.append(f"<path d='{brick(x, y, bw - j + dw, bh - j + dh)}' fill='rgb({r},{g},{b})' fill-opacity='{a:.2f}'/>")
    # la tesela se repite alrededor para que bisel y desenfoque vean a sus vecinos en el borde
    wrap = ''.join(f"<use href='#b' x='{ox}' y='{oy}'/>" for oy in (-H, 0, H) for ox in (-W, 0, W) if ox or oy)
    TILE = f"x='0' y='0' width='{W}' height='{H}'"
    f = (f"<filter id='f' filterUnits='userSpaceOnUse' x='-24' y='-24' width='{W + 48}' height='{H + 48}' color-interpolation-filters='sRGB'>"
         "<feColorMatrix in='SourceAlpha' values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 9 0' result='m'/>"
         "<feGaussianBlur in='m' stdDeviation='1.1' result='a'/>"
         + light('a', 3.2, 225, 'l') + relief('l', (.28, .12, .05), WARM, 1.5, 1.7, 'r')
         # manchas de cocción: tono ancho, solo sobre el ladrillo
         + f"<feTurbulence {TILE} type='fractalNoise' baseFrequency='.018 .04' numOctaves='3' seed='21' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .42 0 0 0 0 .16 0 0 0 0 .07 0 0 0 1.3 -.58'/>"
         "<feComposite in2='m' operator='in' result='t'/>"
         + merge('SourceGraphic', 't', 'rs', 'rl') + "</filter>")
    # arena: grano común a ladrillo y mortero
    g = f"<filter id='s' {FULL}>" + plain('.62', 3, 9, 1.5, 225, (.28, .14, .06), WARM, .88, .92) + merge('rs', 'rl') + "</filter>"
    return svg(W, H, f + g + "<g filter='url(#f)'><g id='b'>" + ''.join(paths) + "</g>" + wrap + "</g><rect width='100%' height='100%' filter='url(#s)'/>")

def madera():
    rnd = random.Random(23)
    W, H = 528, 760
    widths = [124, 140, 128, 136]
    tones = [(150, 98, 40), (162, 108, 48), (138, 88, 36), (170, 116, 56), (128, 80, 34)]
    groups = {'a': [], 'b': []}
    joints, nails = [], ''
    x = 0
    for i, w in enumerate(widths):
        # dos tablas por columna; ninguna testa cae en el borde de la tesela
        c1 = rnd.uniform(.08, .4) * H; c2 = c1 + rnd.uniform(.38, .55) * H
        joints.append((x, w, (c1, c2)))
        segs = [(c1, c2, 'ab'[i % 2])] + [(c2 + k * H, c1 + (k + 1) * H, 'ba'[i % 2]) for k in (-1, 0)]
        tone = {'a': (rnd.choice(tones), rnd.uniform(.22, .42)), 'b': (rnd.choice(tones), rnd.uniform(.22, .42))}
        for y0, y1, gname in segs:
            (r, g, b), a = tone[gname]
            groups[gname].append(f"<rect x='{x + .8:.1f}' y='{y0 + .8:.1f}' width='{w - 1.6:.1f}' height='{y1 - y0 - 1.6:.1f}' fill='rgb({r},{g},{b})' fill-opacity='{a:.2f}'/>")
        for c in (c1, c2):
            for nx in (x + 16, x + w - 16):
                for ny in (c - 13, c + 13):
                    nails += (f"<circle cx='{nx}' cy='{ny:.1f}' r='2.3' fill='#2a1a08' fill-opacity='.42'/>"
                              f"<circle cx='{nx - .7}' cy='{ny - .7:.1f}' r='.8' fill='#fff3d2' fill-opacity='.5'/>")
        x += w
    def grain(fid, seed, freq):
        return (f"<filter id='{fid}' filterUnits='userSpaceOnUse' x='0' y='0' width='{W}' height='{H}' color-interpolation-filters='sRGB'>"
                + plain(freq, 3, seed, 2, 180, (.29, .17, .04), (1, .97, .86), 1, 1)
                # aguas: bandas anchas de veta
                + f"<feTurbulence type='fractalNoise' baseFrequency='.028 .0026' numOctaves='2' seed='{seed + 30}' stitchTiles='stitch'/>"
                "<feColorMatrix values='0 0 0 0 .34 0 0 0 0 .19 0 0 0 0 .05 0 0 0 1.15 -.52' result='w'/>"
                "<feColorMatrix in='SourceAlpha' values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 12 0' result='m'/>"
                + merge('w', 'rs', 'rl').replace('<feMerge>', "<feMerge result='g'>")
                + "<feComposite in='g' in2='m' operator='in' result='gm'/>" + merge('SourceGraphic', 'gm') + "</filter>")
    ld, ll = [], []
    for (px, w, cuts) in joints:
        ld.append(f"M{px} 0V{H}"); ll.append(f"M{px + 1.6} 0V{H}")
        for c in cuts:
            ld.append(f"M{px} {c:.1f}h{w}"); ll.append(f"M{px} {c + 1.6:.1f}h{w}")
    ld.append(f"M{W} 0V{H}")
    body = (grain('a', 5, '.24 .0052') + grain('b', 14, '.19 .0044')
            + "<g filter='url(#a)'>" + ''.join(groups['a']) + "</g><g filter='url(#b)'>" + ''.join(groups['b']) + "</g>"
            + f"<path d='{''.join(ld)}' fill='none' stroke='#3d2408' stroke-opacity='.58' stroke-width='1.8'/>"
            + f"<path d='{''.join(ll)}' fill='none' stroke='#fff6dc' stroke-opacity='.3' stroke-width='1'/>" + nails)
    return svg(W, H, body)

def hormigon():
    rnd = random.Random(5)
    W, H, pw, ph = 640, 480, 320, 240
    panels = ''.join(f"<rect x='{c * pw}' y='{r * ph}' width='{pw}' height='{ph}' fill='#55524a' fill-opacity='{rnd.uniform(0, .13):.3f}'/>" for r in range(2) for c in range(2))
    f = (f"<filter id='f' {FULL}>"
         # nubes del fraguado
         "<feTurbulence type='fractalNoise' baseFrequency='.011 .016' numOctaves='5' seed='2' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .27 0 0 0 0 .26 0 0 0 0 .23 0 0 0 .82 -.36' result='c'/>"
         # churretes verticales de agua
         "<feTurbulence type='fractalNoise' baseFrequency='.045 .003' numOctaves='3' seed='8' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .25 0 0 0 0 .24 0 0 0 0 .2 0 0 0 .78 -.36' result='v'/>"
         # piel del encofrado
         + plain('.34', 3, 13, 1.4, 225, (.2, .19, .16), (1, 1, .97), .66, .7)
         # coqueras: poros dispersos
         + "<feTurbulence type='fractalNoise' baseFrequency='.3' numOctaves='2' seed='31' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .22 0 0 0 0 .21 0 0 0 0 .19 0 0 0 9 -6.6' result='p'/>"
         + merge('c', 'v', 'rs', 'rl', 'p') + "</filter>")
    jd = ''.join(f"M0 {y}H{W}" for y in (0, ph, H)) + ''.join(f"M{x} 0V{H}" for x in (0, pw, W))
    jl = ''.join(f"M0 {y + 1.5}H{W}" for y in (0, ph)) + ''.join(f"M{x + 1.5} 0V{H}" for x in (0, pw))
    holes = "<linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#3a372f' stop-opacity='.27'/><stop offset='1' stop-color='#3a372f' stop-opacity='0'/></linearGradient>"
    for r in range(2):
        for c in range(2):
            for (hx, hy) in ((40, 40), (pw - 40, 40), (40, ph - 40), (pw - 40, ph - 40)):
                cx, cy = c * pw + hx, r * ph + hy
                dl = rnd.uniform(26, 64)
                holes += (f"<rect x='{cx - 3}' y='{cy + 3}' width='6' height='{dl:.0f}' rx='3' fill='url(#g)'/>"
                          f"<circle cx='{cx}' cy='{cy}' r='5' fill='#2f2d28' fill-opacity='.36'/>"
                          f"<path d='M{cx - 3.9} {cy + 3.9}a5.5 5.5 0 0 0 7.8 -7.8' fill='none' stroke='#fffdf2' stroke-opacity='.5' stroke-width='1.1'/>"
                          f"<path d='M{cx + 3.5} {cy - 3.5}a5 5 0 0 0 -7 7' fill='none' stroke='#1f1d19' stroke-opacity='.3' stroke-width='1.1'/>")
    body = (f + panels + "<rect width='100%' height='100%' filter='url(#f)'/>"
            + f"<path d='{jd}' fill='none' stroke='#33312b' stroke-opacity='.44' stroke-width='1.6'/>"
            + f"<path d='{jl}' fill='none' stroke='#fffdf2' stroke-opacity='.32' stroke-width='1'/>" + holes)
    return svg(W, H, body)

def uri(s):
    assert '"' not in s
    return 'url("data:image/svg+xml,' + s.replace('%', '%25').replace('#', '%23').replace('<', '%3C').replace('>', '%3E') + '")'

# (color de base, teselas, altura de repetición de la capa)
WALLS = {
    'yeso': ('rgba(255,250,236,.2)', (yeso_grano, yeso_llana), 620),
    'ladrillo': ('rgba(206,176,140,.24)', (ladrillo,), 448),
    'madera': ('rgba(150,98,40,.1)', (madera,), 760),
    'hormigon': ('rgba(112,110,102,.22)', (hormigon,), 480),
}
def rule(name):
    color, tiles, period = WALLS[name]
    return f"--wall-period:{period}px;background-color:{color};background-image:{','.join(uri(t()) for t in tiles)}"

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--css', type=pathlib.Path, default=CSS, help='hoja de estilos a reescribir')
    ap.add_argument('--out', type=pathlib.Path, help='escribir aquí en vez de sobre --css')
    ap.add_argument('--svg', type=pathlib.Path, help='carpeta donde dejar los SVG sueltos')
    args = ap.parse_args()
    if args.svg:
        args.svg.mkdir(parents=True, exist_ok=True)
        for fn in (yeso_llana, yeso_grano, ladrillo, madera, hormigon):
            (args.svg / f'{fn.__name__}.svg').write_text(fn())
    css = args.css.read_text()
    total = 0
    for name in WALLS:
        pat = re.compile(r'(\.career-wall-stage>i\[data-wall-layer=' + name + r'\]\{)[^\n]*?(\}\n)')
        body = rule(name)
        css, n = pat.subn(lambda m: m.group(1) + body + m.group(2), css)
        assert n == 1, f'no encuentro la regla de {name}'
        total += len(body)
    (args.out or args.css).write_text(css)
    print(f'4 paredes · {total / 1024:.1f} kB de texturas en {(args.out or args.css).name}')
