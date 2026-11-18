#!/usr/bin/env python3
"""Guarda en una caché las variantes de imagen que cita la compilación.

Uso: media_cache.py <compilación> <caché>

`deploy.sh` lo llama en Vercel tras compilar: copia a la caché (con enlaces duros
si se puede) cada archivo de `<compilación>/immersive/media/` cuyo nombre aparece
en algún HTML, JS, CSS, JSON o XML de la compilación, o comparte huella de fuente
(las 12 cifras del nombre) con uno que aparece: las variantes por ancho
(`-w1024.avif`…) las compone el navegador a partir de la `-view.webp`. Lo que
nadie cita no se guarda, así que la caché no crece con fotos retiradas.
"""
import os
import re
import shutil
import sys
from pathlib import Path

TEXT = {".html", ".js", ".css", ".json", ".xml", ".txt", ".webmanifest"}
NAME = re.compile(r"/immersive/media/([\w.\-]+)")
HASH = re.compile(r"-([0-9a-f]{12})(?=-|\.)")


def main(output, cache):
    media = output / "immersive" / "media"
    cited = set()
    for path in output.rglob("*"):
        if path.suffix in TEXT and path.is_file():
            cited.update(NAME.findall(path.read_text(errors="ignore")))
    cache.mkdir(parents=True, exist_ok=True)
    hashes = {m.group(1) for name in cited for m in [HASH.search(name)] if m}
    kept = 0
    for src in sorted(media.iterdir()) if media.is_dir() else []:
        name = src.name
        m = HASH.search(name)
        if not src.is_file() or (name not in cited and not (m and m.group(1) in hashes)):
            continue
        dest = cache / name
        try:
            os.link(src, dest)
        except OSError:
            shutil.copy2(src, dest)
        kept += 1
    total = sum(1 for p in media.iterdir() if p.is_file()) if media.is_dir() else 0
    print(f"Caché de imágenes: {kept} de {total} variantes guardadas para el próximo build")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
