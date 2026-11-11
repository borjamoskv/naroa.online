#!/usr/bin/env python3
"""Texturas del muro de Trayectoria: pared, muro, callejón y túnel subterráneo.

Las cuatro son paredes de ciudad, una por tipo de encuentro:
- pared     (individual)       enlucido viejo con desconchones que enseñan el ladrillo
- muro      (colectiva)        ladrillo visto, con sus sales y sus piezas recocidas
- callejon  (arte en la calle) revoco húmedo, una bajante y carteles arrancados
- tunel     (mercado de arte)  azulejo de metro, junta sucia y una cenefa roja

Cada capa apila teselas SVG procedurales incrustadas como data-URI en las reglas
`.career-wall-stage>i[data-wall-layer=…]` de `classic/immersive/app.css`. Este
script es su fuente: se retoca aquí y se vuelve a volcar, nunca a mano en el CSS.

    python3 tools/wall_textures.py            # reescribe las cuatro reglas
    python3 tools/wall_textures.py --svg DIR  # además deja los SVG sueltos en DIR

Reglas de la casa para que la tesela no delate su costura:
- el ruido usa `stitchTiles` con la región del filtro igual a la tesela;
- lo que mira a sus vecinos (bisel, desenfoque) trabaja sobre geometría repetida
  más allá del borde, no sobre ruido;
- lo grande y escaso (desconchones, bajante, carteles) va en una tesela aparte, ancha
  y sin filtros: no se repite a lo ancho de la página y no encarece el pintado;
- `--wall-period` es la altura de repetición de la capa (múltiplo común de las alturas
  de sus teselas): el CSS la usa para mover la pared con `transform` en vez de
  repintarla en cada fotograma.
"""
import argparse, math, pathlib, random, re

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

def enlucido_llana():
    # Paños de llana: ondulación ancha y blanda, algo más tendida en horizontal.
    f = f"<filter id='f' {FULL}>" + plain('.0065 .0085', 4, 11, 9, 225, UMBER, WARM, 1.6, 1.9) + merge('rs', 'rl') + "</filter>"
    return svg(620, 620, f + "<rect width='100%' height='100%' filter='url(#f)'/>")
def enlucido_grano():
    # Diente fino del enlucido y, encima, las pasadas de brocha de la pintura.
    f = (f"<filter id='f' {FULL}>" + plain('.8', 2, 4, 1.3, 225, UMBER, WARM, .9, 1)
         + "<feTurbulence type='fractalNoise' baseFrequency='.018 .1' numOctaves='3' seed='27' stitchTiles='stitch' result='b'/>"
         + light('b', 1, 250, 'bl') + relief('bl', UMBER, WARM, .42, .46, 'q')
         + merge('rs', 'rl', 'qs', 'ql') + "</filter>")
    return svg(330, 310, f + "<rect width='100%' height='100%' filter='url(#f)'/>")

def poly(pts):
    return 'M' + 'L'.join(f"{x:.0f} {y:.0f}" for x, y in pts) + 'Z'

def pared_desconchones():
    # Donde el enlucido se ha caído asoma la fábrica. El canto del yeso da sombra arriba a la
    # izquierda y coge luz abajo a la derecha, como el resto de la pared; de cada herida salen grietas.
    rnd = random.Random(31)
    W, H = 1180, 1240
    brick = ("<pattern id='k' width='112' height='112' patternUnits='userSpaceOnUse'><rect width='112' height='112' fill='#8a7a62'/>"
             "<rect x='3' y='3' width='106' height='50' rx='2' fill='#b0563a'/>"
             "<rect x='-53' y='59' width='106' height='50' rx='2' fill='#9c4a31'/><rect x='59' y='59' width='106' height='50' rx='2' fill='#b86244'/></pattern>")
    def blob(cx, cy, rx, ry, n):
        return [(cx + rx * (1 + rnd.uniform(-.24, .24)) * math.cos(2 * math.pi * i / n), cy + ry * (1 + rnd.uniform(-.24, .24)) * math.sin(2 * math.pi * i / n)) for i in range(n)]
    def crack(x, y, ang, n):
        pts = [(x, y)]
        for _ in range(n):
            ang += rnd.uniform(-.55, .55); step = rnd.uniform(14, 30)
            x += math.cos(ang) * step; y += math.sin(ang) * step
            pts.append((x, y))
        d = 'M' + 'L'.join(f"{px:.0f} {py:.0f}" for px, py in pts)
        return (f"<path d='{d}' fill='none' stroke='#fffaf0' stroke-opacity='.5' stroke-width='1' transform='translate(1.2 1.2)'/>"
                f"<path d='{d}' fill='none' stroke='#3a2a16' stroke-opacity='.42' stroke-width='1.2'/>")
    out = brick + ("<filter id='g' x='-5%' y='-5%' width='110%' height='110%' color-interpolation-filters='sRGB'>"
                   "<feTurbulence type='fractalNoise' baseFrequency='.5' numOctaves='3' seed='5' result='n'/>" + light('n', 1.8, 225, 'l') + relief('l', (.2, .08, .03), WARM, 1.1, 1, 'r')
                   + "<feTurbulence type='fractalNoise' baseFrequency='.03 .06' numOctaves='3' seed='9'/><feColorMatrix values='0 0 0 0 .2 0 0 0 0 .08 0 0 0 0 .04 0 0 0 1.5 -.62' result='t'/>"
                   + merge('t', 'rs', 'rl').replace('<feMerge>', "<feMerge result='x'>") + "<feComposite in='x' in2='SourceAlpha' operator='in' result='y'/>" + merge('SourceGraphic', 'y') + "</filter>")
    wounds = [(300, 260, 150, 96, 26), (910, 520, 92, 62, 20), (520, 880, 58, 40, 15), (1010, 1050, 118, 70, 22), (130, 720, 44, 30, 13), (700, 130, 70, 46, 16), (240, 1090, 84, 52, 18)]
    for i, (cx, cy, rx, ry, n) in enumerate(wounds):
        pts = blob(cx, cy, rx, ry, n); d = poly(pts)
        out += (f"<clipPath id='c{i}'><path d='{d}'/></clipPath>"
                f"<path d='{d}' fill='#fffaf0' fill-opacity='.85' transform='translate(2.5 3)'/>"
                f"<path d='{d}' fill='#24160c' fill-opacity='.7'/>"
                f"<g clip-path='url(#c{i})'><path d='{d}' fill='url(#k)' fill-opacity='.9' transform='translate(4 5)' filter='url(#g)'/></g>")
        for _ in range(2 if rx > 60 else 1):
            k = rnd.randrange(n); px, py = pts[k]
            out += crack(px, py, math.atan2(py - cy, px - cx), rnd.randint(5, 9))
    return svg(W, H, out)

def muro():
    rnd = random.Random(7)
    W, H, bw, bh, j = 448, 448, 112, 56, 7
    tones = [(176, 78, 40), (188, 92, 48), (164, 70, 38), (196, 104, 58), (150, 62, 36), (182, 86, 52)]
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
            r, g, b = rnd.choice(tones)
            a = rnd.uniform(.36, .54) if rnd.random() > .14 else rnd.uniform(.62, .74)   # alguno más cocido
            x = col * bw + (bw / 2 if row % 2 else 0) + j / 2 + rnd.uniform(-1.2, 1.2)
            y = row * bh + j / 2 + rnd.uniform(-.8, .8)
            paths.append(f"<path d='{brick(x, y, bw - j + rnd.uniform(-1.6, 1.6), bh - j + rnd.uniform(-1, 1))}' fill='rgb({r},{g},{b})' fill-opacity='{a:.2f}'/>")
    # la tesela se repite alrededor para que bisel y desenfoque vean a sus vecinos en el borde
    wrap = ''.join(f"<use href='#b' x='{ox}' y='{oy}'/>" for oy in (-H, 0, H) for ox in (-W, 0, W) if ox or oy)
    TILE = f"x='0' y='0' width='{W}' height='{H}'"
    f = (f"<filter id='f' filterUnits='userSpaceOnUse' x='-24' y='-24' width='{W + 48}' height='{H + 48}' color-interpolation-filters='sRGB'>"
         "<feColorMatrix in='SourceAlpha' values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 9 0' result='m'/>"
         "<feGaussianBlur in='m' stdDeviation='1.5' result='a'/>"
         + light('a', 3.6, 225, 'l') + relief('l', (.22, .12, .07), WARM, 1.2, 1.25, 'r')
         # poros y desportillados de la cara
         + f"<feTurbulence {TILE} type='fractalNoise' baseFrequency='.24 .3' numOctaves='2' seed='33' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .2 0 0 0 0 .08 0 0 0 0 .04 0 0 0 7 -5'/>"
         "<feComposite in2='m' operator='in' result='o'/>"
         # manchas de cocción: tono ancho, solo sobre el ladrillo
         + f"<feTurbulence {TILE} type='fractalNoise' baseFrequency='.018 .04' numOctaves='3' seed='21' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .38 0 0 0 0 .14 0 0 0 0 .06 0 0 0 1.4 -.62'/>"
         "<feComposite in2='m' operator='in' result='t'/>"
         # salitre: velos blancos que suben por la fábrica
         + f"<feTurbulence {TILE} type='fractalNoise' baseFrequency='.022 .011' numOctaves='4' seed='40' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 1 0 0 0 0 .97 0 0 0 0 .9 0 0 0 1.6 -.86' result='e'/>"
         + merge('SourceGraphic', 't', 'o', 'e', 'rs', 'rl') + "</filter>")
    # arena: grano común a ladrillo y mortero
    g = f"<filter id='s' {FULL}>" + plain('.62', 3, 9, 1.5, 225, (.28, .14, .06), WARM, .88, .92) + merge('rs', 'rl') + "</filter>"
    return svg(W, H, f + g + "<g filter='url(#f)'><g id='b'>" + ''.join(paths) + "</g>" + wrap + "</g><rect width='100%' height='100%' filter='url(#s)'/>")

def callejon_revoco():
    # Revoco tirado a mano, frío y húmedo: grumo gordo, nubes de humedad y churretes largos.
    GRIS = (.17, .17, .15)
    f = (f"<filter id='f' {FULL}>"
         "<feTurbulence type='fractalNoise' baseFrequency='.011 .016' numOctaves='5' seed='2' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .2 0 0 0 0 .2 0 0 0 0 .18 0 0 0 1.05 -.44' result='c'/>"
         "<feTurbulence type='fractalNoise' baseFrequency='.05 .0028' numOctaves='3' seed='8' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .16 0 0 0 0 .17 0 0 0 0 .15 0 0 0 1.1 -.5' result='v'/>"
         + plain('.085 .11', 4, 13, 3.2, 225, GRIS, (1, 1, .96), 1.05, 1)
         + "<feTurbulence type='fractalNoise' baseFrequency='.3' numOctaves='2' seed='31' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .14 0 0 0 0 .14 0 0 0 0 .12 0 0 0 9 -6.5' result='p'/>"
         + merge('c', 'v', 'rs', 'rl', 'p') + "</filter>")
    return svg(640, 480, f + "<rect width='100%' height='100%' filter='url(#f)'/>")

def callejon_cosas():
    # Lo que cuelga de la pared del callejón: la bajante pegada al canto y carteles a medio arrancar.
    rnd = random.Random(12)
    W, H = 1300, 960
    out = ("<linearGradient id='p' gradientUnits='userSpaceOnUse' x1='14' x2='34'><stop offset='0' stop-color='#22211d'/><stop offset='.32' stop-color='#9a978c'/>"
           "<stop offset='.55' stop-color='#55534b'/><stop offset='1' stop-color='#161512'/></linearGradient>"
           "<linearGradient id='q' gradientUnits='userSpaceOnUse' x1='34' x2='50'><stop offset='0' stop-color='#14130f' stop-opacity='.42'/><stop offset='1' stop-color='#14130f' stop-opacity='0'/></linearGradient>"
           "<linearGradient id='o' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#7a3d14' stop-opacity='.4'/><stop offset='1' stop-color='#7a3d14' stop-opacity='0'/></linearGradient>"
           f"<rect x='34' width='16' height='{H}' fill='url(#q)'/><rect x='14' width='20' height='{H}' fill='url(#p)' fill-opacity='.8'/>")
    for y in (150, 630):   # abrazaderas, con su reguero de óxido
        out += (f"<rect x='16' y='{y + 9}' width='16' height='150' fill='url(#o)'/><rect x='8' y='{y}' width='32' height='10' rx='2' fill='#1b1a16' fill-opacity='.82'/>"
                f"<rect x='8' y='{y}' width='32' height='2' fill='#b9b6aa' fill-opacity='.5'/><circle cx='11.500' cy='{y + 5}' r='1.6' fill='#d2cfc2' fill-opacity='.7'/><circle cx='36.500' cy='{y + 5}' r='1.6' fill='#d2cfc2' fill-opacity='.7'/>")
    out += "<rect x='12' y='400' width='24' height='15' rx='2' fill='#2c2b26' fill-opacity='.85'/><rect x='12' y='400' width='24' height='2.500' fill='#b9b6aa' fill-opacity='.45'/>"
    def torn(x, y, w, h, bite):
        corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        if bite:   # le falta la esquina de abajo a la derecha, arrancada en diagonal
            corners = [(x, y), (x + w, y), (x + w, y + h * bite[0]), (x + w * bite[1], y + h), (x, y + h)]
        pts = []
        for (x0, y0), (x1, y1) in zip(corners, corners[1:] + corners[:1]):
            n = max(2, int(math.hypot(x1 - x0, y1 - y0) / 18))
            pts += [(x0 + (x1 - x0) * i / n + rnd.uniform(-3.4, 3.4), y0 + (y1 - y0) * i / n + rnd.uniform(-3.4, 3.4)) for i in range(n)]
        return poly(pts)
    out += ("<filter id='w' x='-6%' y='-6%' width='112%' height='112%' color-interpolation-filters='sRGB'>"
            # desgaste: el cartel se pierde a calvas
            "<feTurbulence type='fractalNoise' baseFrequency='.03 .04' numOctaves='4' seed='3'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3.6 -.95' result='k'/>"
            "<feComposite in='SourceGraphic' in2='k' operator='in' result='g'/>"
            # arrugas y bolsas de la cola
            "<feTurbulence type='fractalNoise' baseFrequency='.022 .045' numOctaves='4' seed='14' result='n'/>" + light('n', 5, 225, 'l') + relief('l', (.16, .14, .1), (1, 1, .97), 1.5, 1.3, 'r')
            + merge('rs', 'rl').replace('<feMerge>', "<feMerge result='x'>") + "<feComposite in='x' in2='g' operator='in' result='y'/>" + merge('g', 'y') + "</filter>")
    PAPEL, HUESO, ROSA, AZUL = '#efe6cf', '#e2d6b9', '#d7a29a', '#9db1b8'
    carteles = [(180, 84, 150, 212, -3, PAPEL, '#b3261e', None), (262, 262, 132, 124, 5, ROSA, '#5b2a44', (.5, .35)), (58, 566, 112, 152, 2, HUESO, '#2f5d6b', (.55, .4)),
                (1132, 372, 150, 214, 3, PAPEL, '#2f5d6b', None), (1004, 716, 142, 96, -5, AZUL, '#2b2a26', (.6, .5)), (640, 70, 156, 64, 2, HUESO, '#b3261e', None),
                (700, 560, 136, 190, -2, PAPEL, '#c98a1b', (.7, .55))]
    for i, (x, y, w, h, rot, paper, ink, bite) in enumerate(carteles):
        d = torn(x, y, w, h, bite)
        lines = ''.join(f"<rect x='{x + 14}' y='{y + h * .62 + k * 13:.0f}' width='{(w - 28) * rnd.uniform(.5, 1):.0f}' height='5' fill='#2b2a26' fill-opacity='.3'/>" for k in range(int(h * .3 // 13)))
        out += (f"<g transform='rotate({rot} {x + w / 2:.0f} {y + h / 2:.0f})' filter='url(#w)'><clipPath id='c{i}'><path d='{d}'/></clipPath>"
                f"<path d='{d}' fill='#12110e' fill-opacity='.34' transform='translate(2.5 3.5)'/><path d='{d}' fill='{paper}' fill-opacity='.74'/>"
                f"<g clip-path='url(#c{i})'><rect x='{x + 12}' y='{y + 12}' width='{w - 24}' height='{h * .46:.0f}' fill='{ink}' fill-opacity='.36'/>{lines}</g></g>")
    return svg(W, H, out)

def tunel():
    # Azulejo de metro: pieza plana con un bisel fino, esmalte que refleja la luz a manchas, junta
    # estrecha y sucia, una cenefa granate cada dieciséis hiladas, una pieza caída y regueros de filtración.
    rnd = random.Random(44)
    W, B, tw, th, j = 416, 416, 104, 52, 3
    H = B * 2
    def pieza(row, col, fill, a):
        x = col * tw + (tw / 2 if row % 2 else 0) + j / 2; y = row * th + j / 2
        return f"<rect x='{x:g}' y='{y:g}' width='{tw - j}' height='{th - j}' rx='2' fill='{fill}' fill-opacity='{a:.2f}'/>"
    falta = (6, 3)
    block = ''
    for row in range(B // th):
        for col in range(W // tw):
            if (row, col) == falta: continue
            block += pieza(row, col, rnd.choice(['#fbf8ee', '#f7f3e6', '#f3eedf', '#f9f5ea', '#eee6cf']), rnd.uniform(.9, .97))
    cenefa = ''.join(pieza(5, col, '#8f2219', .9) for col in range(-1, W // tw + 1))
    wrap = ''.join(f"<use href='#b' x='{ox}' y='{oy}'/>" for oy in (-B, 0, B, H) for ox in (-W, 0, W) if ox or oy)
    wrap += ''.join(f"<use href='#r' y='{oy}'/>" for oy in (-H, H))
    TILE = f"x='0' y='0' width='{W}' height='{H}'"
    f = (f"<filter id='f' filterUnits='userSpaceOnUse' x='-24' y='-24' width='{W + 48}' height='{H + 48}' color-interpolation-filters='sRGB'>"
         "<feColorMatrix in='SourceAlpha' values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 9 0' result='m'/>"
         "<feGaussianBlur in='m' stdDeviation='.9' result='a'/>"
         + light('a', 2.4, 225, 'l') + relief('l', (.2, .18, .14), (1, 1, 1), .85, 1.1, 'r')
         # el esmalte: un filo de brillo en el bisel y reflejos anchos, desiguales de una pieza a otra
         + "<feSpecularLighting in='a' surfaceScale='3' specularConstant='1' specularExponent='44' lighting-color='#fff' result='sp'><feDistantLight azimuth='225' elevation='52'/></feSpecularLighting>"
         f"<feTurbulence {TILE} type='fractalNoise' baseFrequency='.009 .0035' numOctaves='2' seed='52' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1.5 -.62' result='hz'/>"
         + merge('sp', 'hz').replace('<feMerge>', "<feMerge result='gl'>") + "<feComposite in='gl' in2='m' operator='in' result='g'/>"
         # tono desigual del esmalte, pieza a pieza amarillea distinto
         + f"<feTurbulence {TILE} type='fractalNoise' baseFrequency='.02 .034' numOctaves='2' seed='71' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .62 0 0 0 0 .52 0 0 0 0 .3 0 0 0 .7 -.3'/><feComposite in2='m' operator='in' result='y'/>"
         # mugre: regueros de filtración y hollín
         + f"<feTurbulence {TILE} type='fractalNoise' baseFrequency='.018 .0028' numOctaves='3' seed='17' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .26 0 0 0 0 .2 0 0 0 0 .11 0 0 0 1.05 -.54' result='v'/>"
         + f"<feTurbulence {TILE} type='fractalNoise' baseFrequency='.006 .012' numOctaves='3' seed='6' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .2 0 0 0 0 .18 0 0 0 0 .13 0 0 0 .6 -.25' result='c'/>"
         + merge('SourceGraphic', 'y', 'rs', 'rl', 'g', 'v', 'c') + "</filter>")
    # el hueco de la pieza caída: mortero de agarre peinado con la llana dentada
    hx = falta[1] * tw + (tw / 2 if falta[0] % 2 else 0); hy = falta[0] * th
    hueco = ''
    for oy in (0, B):
        hueco += f"<rect x='{hx + 1}' y='{hy + oy + 1}' width='{tw - 2}' height='{th - 2}' fill='#857a66' fill-opacity='.8'/>"
        hueco += ''.join(f"<path d='M{hx + 4} {hy + oy + 6 + k * 6}h{tw - 8}' stroke='#3f382c' stroke-opacity='.5' stroke-width='1.6'/><path d='M{hx + 4} {hy + oy + 7.6 + k * 6:.1f}h{tw - 8}' stroke='#c9bda3' stroke-opacity='.5' stroke-width='1'/>" for k in range(8))
    def grieta(x, y, n):
        pts = [(x, y)]
        for _ in range(n):
            x += rnd.uniform(8, 19); y += rnd.uniform(-10, 12); pts.append((x, y))
        d = 'M' + 'L'.join(f"{px:.0f} {py:.0f}" for px, py in pts)
        return f"<path d='{d}' fill='none' stroke='#fff' stroke-opacity='.5' stroke-width='.8' transform='translate(.8 .9)'/><path d='{d}' fill='none' stroke='#191713' stroke-opacity='.55' stroke-width='.8'/>"
    grietas = grieta(114, 62, 6) + grieta(246, 484, 4) + grieta(22, 668, 7)
    return svg(W, H, f + hueco + "<g filter='url(#f)'><g id='b'>" + block + "</g><g id='r'>" + cenefa + "</g>" + wrap + "</g>" + grietas)

def uri(s):
    assert '"' not in s
    return 'url("data:image/svg+xml,' + s.replace('%', '%25').replace('#', '%23').replace('<', '%3C').replace('>', '%3E') + '")'

# (color de base, teselas de arriba abajo, altura de repetición de la capa)
WALLS = {
    'pared': ('rgba(255,250,236,.2)', (enlucido_grano, enlucido_llana, pared_desconchones), 1240),
    'muro': ('rgba(150,138,118,.36)', (muro,), 448),
    'callejon': ('rgba(98,98,90,.3)', (callejon_cosas, callejon_revoco), 960),
    'tunel': ('rgba(46,42,36,.66)', (tunel,), 832),
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
        for fn in dict.fromkeys(t for _, tiles, _ in WALLS.values() for t in tiles):
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
