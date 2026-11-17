#!/usr/bin/env python3
"""Hojas de miniaturas para la ráfaga de llegada de la portada (AGENTS.md §7).

La ráfaga pasa a gran velocidad las fotos de obra de Naroa antes del retrato del
umbral. Las fotos salen de dos sitios:

  1. el catálogo revisado (classic/data/catalogo.json y vaivenes.json), primero;
  2. los álbumes públicos de su Facebook ya descargados en
     raw_artworks_facebook/albumes/ (fuera de git; ver descargar_albumes_facebook.py),
     solo los álbumes que su registro de privacidad da por obra (ALLOWED).

Como esa carpeta no está en el repositorio, las hojas no se pueden componer al
compilar en Vercel: se componen aquí y se guardan en classic/images/rafaga/, con
su ficha en classic/data/rafaga.json. El generador solo las copia.

Cada hoja es una rejilla de celdas 4:5 muy pequeñas: nada se publica a un tamaño
en que se pueda mirar con detalle. No llevan credenciales C2PA (§12): no son la
foto de una obra, igual que las miniaturas.

uso: build_burst_atlas.py [--albums DIR] [--max N]   (por defecto, 1600 fotos)
"""
import argparse
import json
import random
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "classic"
SHEETS = SOURCE / "images" / "rafaga"
MANIFEST = SOURCE / "data" / "rafaga.json"
TILE = (72, 90)
COLS, ROWS = 25, 16
QUALITY = 50
# Cuatro hojas llenas: más pesa demasiado para una entrada que dura tres segundos.
LIMIT = 1600
MIN_SIDE = 320
# Solo entran los álbumes que el registro de privacidad del archivo (fuera de git) da por obra: obra propia, retratos
# y encargos que Naroa ya publicó, y álbumes mixtos sin las fotos que el registro manda excluir. Lo privado, lo de
# autoría ajena, los actos con público y lo que está sin revisar no entra. Sin registro, solo va el catálogo.
REGISTER = "clasificacion/analisis/privacidad-archivo-registro.json"
ALLOWED = {"obra", "solo_con_permiso", "mixto"}


def catalogue_photos():
    out = []
    for p in json.loads((SOURCE / "data" / "catalogo.json").read_text())["projects"]:
        out += [SOURCE / im["src"].lstrip("/") for im in p["images"]]
    for im in json.loads((SOURCE / "data" / "vaivenes.json").read_text())["images"]:
        out += [SOURCE / ph["src"].lstrip("/") for ph in im.get("images", [im])]
    seen, unique = set(), []
    for path in out:
        if path not in seen and path.is_file():
            seen.add(path)
            unique.append(path)
    return unique


def album_photos(folder):
    index, register = folder / "indice.json", folder / REGISTER
    if not index.is_file() or not register.is_file():
        return [], {}
    albums = {a["pos"]: a for a in json.loads(register.read_text())["albumes"]}
    photos, left_out = [], {}
    for row in json.loads(index.read_text()):
        album = albums.get(row["album_pos"])
        level = album["nivel"] if album else "sin_registro"
        if level in ALLOWED and row["orden"] in set(album.get("fotos_excluir") or []):
            level = "foto_excluida"
        if level not in ALLOWED:
            left_out[level] = left_out.get(level, 0) + 1
            continue
        if min(row.get("ancho") or 0, row.get("alto") or 0) < MIN_SIDE:
            continue
        path = folder / row["ruta"]
        if path.is_file():
            photos.append(path)
    return photos, left_out


def tile(path):
    try:
        with Image.open(path) as im:
            im.draft("RGB", (TILE[0] * 4, TILE[1] * 4))
            im = ImageOps.exif_transpose(im).convert("RGB")
            return ImageOps.fit(im, TILE, Image.Resampling.LANCZOS, centering=(0.5, 0.42))
    except Exception as error:  # una foto rota no para la hoja
        print(f"  sin miniatura: {path.name} ({error})", file=sys.stderr)
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--albums", default=str(REPO / "raw_artworks_facebook" / "albumes"))
    ap.add_argument("--max", type=int, default=LIMIT, help="tope de fotos (0 = todas)")
    a = ap.parse_args()

    reviewed = catalogue_photos()
    extra, skipped = album_photos(Path(a.albums))
    random.Random(20261117).shuffle(extra)  # cada hoja mezcla épocas; el orden es estable entre ejecuciones
    paths = reviewed + extra
    if a.max:
        paths = paths[: a.max]
    with ThreadPoolExecutor(max_workers=8) as pool:
        tiles = [t for t in pool.map(tile, paths) if t is not None]

    SHEETS.mkdir(parents=True, exist_ok=True)
    for old in SHEETS.glob("rafaga-*.webp"):
        old.unlink()
    per = COLS * ROWS
    sheets = []
    for n in range(0, len(tiles), per):
        chunk = tiles[n : n + per]
        rows = -(-len(chunk) // COLS)
        sheet = Image.new("RGB", (COLS * TILE[0], rows * TILE[1]), (13, 14, 11))
        for i, t in enumerate(chunk):
            sheet.paste(t, ((i % COLS) * TILE[0], (i // COLS) * TILE[1]))
        name = f"rafaga-{len(sheets) + 1:02d}.webp"
        sheet.save(SHEETS / name, "WEBP", quality=QUALITY, method=6)
        sheets.append({"src": f"/images/rafaga/{name}", "count": len(chunk), "bytes": (SHEETS / name).stat().st_size})
    MANIFEST.write_text(json.dumps({
        "tile": list(TILE), "cols": COLS, "count": len(tiles), "reviewed": len(reviewed),
        "sheets": sheets, "left_out": skipped,
    }, ensure_ascii=False, indent=2) + "\n")
    total = sum(s["bytes"] for s in sheets)
    print(f"{len(tiles)} fotos ({len(reviewed)} del catálogo) en {len(sheets)} hojas, {total / 1024:.0f} KB. "
          f"Fotos de Facebook fuera: {skipped}.")


if __name__ == "__main__":
    main()
