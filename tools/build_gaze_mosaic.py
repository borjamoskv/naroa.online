#!/usr/bin/env python3
"""Compone el fondo del índice de obra (AGENTS.md §15): el retrato de Naroa hecho con las miradas de sus obras.

Cada celda del retrato elige la franja de ojos cuya luz se le parece más; después cada franja se aclara u
oscurece para hacer su papel y todo se pasa a una rampa de rojos mates. Lee los recortes de mirada de una
compilación (`…-mirada-thumb.webp`), así que primero hay que compilar. Solo necesita Pillow.

    python3 tools/build_gaze_mosaic.py                 lee .deploy y escribe classic/images/indice/rostro-de-miradas.webp
    python3 tools/build_gaze_mosaic.py --output <dir>  lee otra compilación
"""
import argparse
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps, ImageStat

REPO = Path(__file__).resolve().parents[1]
PORTRAIT = REPO / "classic" / "images" / "sobre-mi" / "naroa-monoculo.jpg"
DEST = REPO / "classic" / "images" / "indice" / "rostro-de-miradas.webp"
BOX = (0.22, 0.16, 0.86, 0.64)        # chistera, monóculo y rostro
COLS, TILE, SAMPLES = 30, (64, 20), (4, 2)
ADJUST, SHAPE, FAIR = 0.75, 0.55, 60   # cuánto se corrige la luz de cada franja; peso del dibujo; reparto entre obras
RAMP = [(0.0, (176, 20, 13)), (0.5, (229, 38, 27)), (1.0, (242, 84, 70))]   # del rojo hondo al claro; en medio, el de la pared


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output", type=Path, default=REPO / ".deploy", help="compilación de la que salen los recortes de mirada")
    args = parser.parse_args()
    strips = sorted((args.output / "immersive" / "media").glob("*-mirada-thumb.webp"))
    if not strips:
        raise SystemExit(f"No hay recortes de mirada en {args.output}: compila antes el sitio.")
    tw, th = TILE
    sx, sy = SAMPLES
    bands, desc, means = [], [], []
    for path in strips:
        full = Image.open(path).convert("RGB")
        band = full.crop((0, full.height // 4, full.width, full.height * 3 // 4)).resize(TILE, Image.Resampling.LANCZOS)
        grey = band.convert("L")
        bands.append(band)
        desc.append(list(grey.resize(SAMPLES, Image.Resampling.BOX).tobytes()))
        means.append(ImageStat.Stat(grey).mean[0])
    n = len(bands)
    target = ImageOps.exif_transpose(Image.open(PORTRAIT)).convert("L")
    w, h = target.size
    target = ImageOps.autocontrast(target.crop((round(BOX[0] * w), round(BOX[1] * h), round(BOX[2] * w), round(BOX[3] * h))), cutoff=1)
    rows = round(COLS * tw * target.height / target.width / th)
    half = sx // 2
    cells = target.resize(((2 * COLS + 1) * half, rows * sy), Image.Resampling.BOX)
    px = cells.load()
    order = [(r, c) for r in range(rows) for c in range(COLS + (r % 2))]      # en ladrillo: las filas impares, media franja corridas

    def want(r, c):
        x0 = min(max((2 * c - (r % 2)) * half, 0), cells.width - sx)
        return [px[x0 + i, r * sy + j] for j in range(sy) for i in range(sx)]

    wants = [want(r, c) for r, c in order]
    wmean = [sum(v) / len(v) for v in wants]
    # reparto por cuantiles: la celda más oscura pide la franja más oscura, y así hasta la más clara
    ranked = sorted(range(len(order)), key=lambda k: wmean[k])
    ladder = sorted(means)
    mapped = [0.0] * len(order)
    for pos, k in enumerate(ranked):
        mapped[k] = ladder[min(pos * n // len(order), n - 1)]
    tshape = [[v - means[i] for v in desc[i]] for i in range(n)]
    fair = len(order) / n
    used = [0] * n
    grid, assign = {}, [0] * len(order)

    def near(r, c):
        side = 1 if r % 2 == 0 else -1
        return {grid.get(key) for key in ((r, c - 1), (r, c + 1), (r - 1, c), (r + 1, c), (r - 1, c + side), (r + 1, c + side), (r - 2, c), (r + 2, c), (r, c - 2), (r, c + 2))}

    def base(i, k):
        shape = [v - wmean[k] for v in wants[k]]
        return (means[i] - mapped[k]) ** 2 + SHAPE * sum((a - b) ** 2 for a, b in zip(tshape[i], shape)) / len(shape)

    for k, (r, c) in enumerate(order):
        taken = near(r, c)
        best, cost = 0, float("inf")
        for i in range(n):
            if i in taken:
                continue
            value = base(i, k) + FAIR * max(used[i] / fair - 0.5, 0) ** 2
            if value < cost:
                best, cost = i, value
        used[best] += 1
        assign[k] = best
        grid[(r, c)] = best
    # ninguna obra se queda fuera: las poco usadas entran donde mejor encajan, en el sitio de una que sobra
    least = max(6, int(fair * 0.35))
    for i in sorted(range(n), key=lambda i: used[i]):
        if used[i] >= least:
            break
        for k in sorted(range(len(order)), key=lambda k: base(i, k)):
            if used[i] >= least:
                break
            r, c = order[k]
            old = assign[k]
            if old == i or used[old] <= fair * 0.8 or i in near(r, c):
                continue
            used[old] -= 1
            used[i] += 1
            assign[k] = i
            grid[(r, c)] = i
    sheet = Image.new("RGB", (COLS * tw, rows * th), "#888888")
    for k, (r, c) in enumerate(order):
        i = assign[k]
        gain = min(max(1 + ADJUST * (wmean[k] - means[i]) / max(means[i], 24), 0.35), 2.1)
        sheet.paste(ImageEnhance.Brightness(bands[i]).enhance(gain), (c * tw - (tw // 2 if r % 2 else 0), r * th))
    grey = ImageOps.autocontrast(sheet.convert("L"), cutoff=1)
    lut = {"r": [], "g": [], "b": []}
    for v in range(256):
        t = min(max((v / 255 - 0.5) * 1.15 + 0.5, 0), 1)
        (t0, c0), (t1, c1) = (RAMP[0], RAMP[1]) if t <= 0.5 else (RAMP[1], RAMP[2])
        f = (t - t0) / (t1 - t0)
        for key, a, b in zip("rgb", c0, c1):
            lut[key].append(round(a * (1 - f) + b * f))
    red = Image.merge("RGB", [grey.point(lut[key]) for key in "rgb"])
    red = red.resize((1500, round(1500 * red.height / red.width)), Image.Resampling.LANCZOS)
    DEST.parent.mkdir(parents=True, exist_ok=True)
    red.save(DEST, "WEBP", quality=62, method=6)
    print(f"{DEST.relative_to(REPO)}: {len(order)} franjas de {n} obras (cada una entre {min(used)} y {max(used)} veces), {DEST.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
