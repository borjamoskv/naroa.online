#!/usr/bin/env python3
"""Dibuja el puntero de pincel de Naroa: su pincel fino de mango amarillo flúor.

Modelo: pincel de pelo castaño en punta, virola plateada larga, mango amarillo flúor
y punzón metálico en el otro extremo. A 45°, con la punta del pelo en la esquina superior
izquierda (punto activo 3,3 a 48 px). Lleva contorno claro y sombra suave para que no se
pierda sobre obras oscuras ni páginas claras. El grosor está exagerado respecto al pincel
real para que se lea a tamaño de puntero.

Dos variantes: reposo, y punta cargada de rojo con destello (sobre lo pulsable).
Salida: classic/assets/cursors/naroa-brocha[-pointer]-{48,96}.png
"""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "classic/assets/cursors"
SS = 6                      # supermuestreo
TIP = 3.0                   # punto activo en px a tamaño 48
U = (math.sqrt(.5), math.sqrt(.5))   # eje del pincel
N = (-U[1], U[0])                    # normal

# Semianchura a lo largo del eje (t en px a tamaño 48)
BRISTLE = [(0, .3), (2.4, 1.5), (5.2, 2.5), (8.2, 2.8)]
FERRULE = [(8.2, 2.5), (10.2, 2.2), (15, 2.3), (21.5, 2.7)]
HANDLE = [(21.5, 2.9), (27, 3.2), (44, 3.1), (49.5, 2.9), (51.5, 2.0)]
STYLUS = [(51.5, .75), (56.6, .6)]

HAIR, HAIR_LIGHT, HAIR_TIP = (150, 84, 42), (196, 122, 66), (44, 26, 18)
STEEL, STEEL_LIGHT, STEEL_SHINE, STEEL_DARK = (150, 152, 160), (212, 214, 222), (252, 252, 255), (92, 94, 104)
NEON, NEON_LIGHT, NEON_SHINE, NEON_SHADE = (226, 236, 44), (242, 250, 104), (255, 255, 214), (182, 194, 24)
RED, RED_LIGHT = (213, 33, 37), (240, 78, 70)
PAPER = (255, 252, 244, 255)


def pt(t, w, s):
    return ((TIP + U[0] * t + N[0] * w) * s, (TIP + U[1] * t + N[1] * w) * s)


def outline(profile, s, grow=0.0, lo=-1.0, hi=1.0):
    """Polígono del tramo entre las fracciones lo..hi de su anchura."""
    left = [pt(t, (w + grow) * lo, s) for t, w in profile]
    right = [pt(t, (w + grow) * hi, s) for t, w in reversed(profile)]
    return left + right


def dense(profile, step=.5):
    out = []
    for (t0, w0), (t1, w1) in zip(profile, profile[1:]):
        n = max(1, int((t1 - t0) / step))
        for i in range(n):
            k = i / n
            k = k * k * (3 - 2 * k)          # transición suave entre puntos
            out.append((t0 + (t1 - t0) * i / n, w0 + (w1 - w0) * k))
    out.append(profile[-1])
    return out


def dot(d, t, w, radius, s, fill):
    c = pt(t, w, s)
    r = radius * s
    d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=fill)


def render(size, loaded):
    s = size / 48 * SS
    dim = size * SS
    bristle, ferrule, handle, stylus = dense(BRISTLE), dense(FERRULE), dense(HANDLE), dense(STYLUS)
    body = bristle + ferrule + handle
    ball = 57.2

    # Sombra y contorno claro
    shadow = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for poly in (outline(body, s, 1.3), outline(stylus, s, 1.3)):
        sd.polygon([(x + 1.2 * s, y + 1.8 * s) for x, y in poly], fill=(10, 6, 2, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(1.4 * s))
    im = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    im.alpha_composite(shadow)
    d = ImageDraw.Draw(im)
    d.polygon(outline(body, s, 1.4), fill=PAPER)
    d.polygon(outline(stylus, s, 1.3), fill=PAPER)
    dot(d, ball, 0, 1.05 + 1.3, s, PAPER)

    # Punzón metálico
    d.polygon(outline(stylus, s), fill=STEEL + (255,))
    d.polygon(outline(stylus, s, lo=-1.0, hi=-.1), fill=STEEL_LIGHT + (255,))
    dot(d, ball, 0, 1.05, s, STEEL + (255,))
    dot(d, ball - .25, -.3, .45, s, STEEL_SHINE + (255,))

    # Mango amarillo flúor
    d.polygon(outline(handle, s), fill=NEON_SHADE + (255,))
    d.polygon(outline(handle, s, lo=-1.0, hi=.35), fill=NEON + (255,))
    d.polygon(outline(handle, s, lo=-.82, hi=-.25), fill=NEON_LIGHT + (255,))
    d.polygon(outline(handle[3:-6], s, lo=-.62, hi=-.42), fill=NEON_SHINE + (255,))

    # Virola plateada larga, con su engaste junto al pelo
    d.polygon(outline(ferrule, s), fill=STEEL + (255,))
    d.polygon(outline(ferrule, s, lo=-1.0, hi=.1), fill=STEEL_LIGHT + (255,))
    d.polygon(outline(ferrule, s, lo=-.7, hi=-.3), fill=STEEL_SHINE + (255,))
    for t in (10.4, 20.6):
        d.line([pt(t, -2.7, s), pt(t, 2.7, s)], fill=STEEL_DARK + (255,), width=max(1, round(.5 * s)))

    # Pelo castaño en punta, más oscuro en el extremo
    d.polygon(outline(bristle, s), fill=HAIR + (255,))
    d.polygon(outline(bristle, s, lo=-1.0, hi=-.15), fill=HAIR_LIGHT + (255,))
    for w in (-.4, .3):
        d.line([pt(2.6, w * 1.2, s), pt(8.0, w * 2.6, s)], fill=HAIR_TIP + (255,), width=max(1, round(.35 * s)))
    tip = [(t, w) for t, w in bristle if t <= 2.6]
    d.polygon(outline(tip, s), fill=HAIR_TIP + (255,))

    if loaded:
        paint = [(t, w) for t, w in bristle if t <= 5.4]
        d.polygon(outline(paint, s), fill=RED + (255,))
        d.polygon(outline(paint, s, lo=-1.0, hi=-.25), fill=RED_LIGHT + (255,))
        for w, t in ((-1.5, 5.9), (0.3, 6.5), (1.7, 5.7)):   # borde irregular de la pintura
            dot(d, t, w, .95, s, RED + (255,))
        c = pt(11.5, -7.6, s)                                  # destello
        for a, b in ((3.0, .55), (.55, 3.0)):
            d.polygon([(c[0] - a * s, c[1]), (c[0], c[1] - b * s), (c[0] + a * s, c[1]), (c[0], c[1] + b * s)], fill=PAPER)
        d.polygon([(c[0] - 1.6 * s, c[1]), (c[0], c[1] - 1.6 * s), (c[0] + 1.6 * s, c[1]), (c[0], c[1] + 1.6 * s)], fill=(247, 213, 148, 255))

    return im.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (48, 96):
        render(size, False).save(OUT / f"naroa-brocha-{size}.png", optimize=True)
        render(size, True).save(OUT / f"naroa-brocha-pointer-{size}.png", optimize=True)
    print("Pincel generado en", OUT)


if __name__ == "__main__":
    main()
