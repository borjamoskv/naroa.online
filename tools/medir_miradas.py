#!/usr/bin/env python3
"""Mide la mirada y el rostro de las obras del índice (AGENTS.md §15) y los anota en classic/data/miradas.json.

Solo toca las obras sin medida o cuya portada ha cambiado; lo marcado «a ojo» se respeta.
Usa Vision de macOS (pyobjc), en el propio equipo y sin red. Lo que no resuelve (pizarras en
perspectiva, perfiles, objetos) queda en la lista de pendientes para marcarlo a mano.

    python3 tools/medir_miradas.py            mide lo que falta
    python3 tools/medir_miradas.py --lista    solo dice qué falta
"""
import argparse
import json
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parents[1]
DATA = REPO / "classic" / "data"


def covers():
    """Portada de cada obra pública, con el mismo criterio que tools/build_immersive_site.py."""
    found = {}
    for p in json.loads((DATA / "catalogo.json").read_text())["projects"]:
        found[p["slug"]] = p["images"][2 if p["slug"] == "marilyn-rocks" else 0]["src"]
    for im in json.loads((DATA / "vaivenes.json").read_text())["images"]:
        found.setdefault(im.get("work_slug", im.get("slug")), im["src"])
    return found


def measure(path):
    """Pupilas y boca de la cara más grande de la foto, de 0 a 1, o None si Vision no ve ninguna."""
    import Vision
    from Foundation import NSURL

    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    im.thumbnail((2400, 2400))
    with tempfile.NamedTemporaryFile(suffix=".jpg") as probe:
        im.save(probe.name, quality=92)
        handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(NSURL.fileURLWithPath_(probe.name), {})
        request = Vision.VNDetectFaceLandmarksRequest.alloc().init()
        handler.performRequests_error_([request], None)
        best = None
        for face in request.results() or []:
            box, marks = face.boundingBox(), face.landmarks()
            if not marks:
                continue

            def centre(region):
                if region is None or region.pointCount() == 0:
                    return None
                points, n = region.normalizedPoints(), region.pointCount()
                x = sum(points[i].x for i in range(n)) / n
                y = sum(points[i].y for i in range(n)) / n
                return [round(box.origin.x + x * box.size.width, 4), round(1 - (box.origin.y + y * box.size.height), 4)]

            a, b = centre(marks.leftPupil()) or centre(marks.leftEye()), centre(marks.rightPupil()) or centre(marks.rightEye())
            area = box.size.width * box.size.height
            if a and b and (best is None or area > best[0]):
                best = (area, sorted([a, b]), centre(marks.outerLips()))
        return best


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--lista", action="store_true", help="solo dice qué obras faltan por medir")
    args = parser.parse_args()
    path = DATA / "miradas.json"
    data = json.loads(path.read_text()) if path.is_file() else {"nota": "", "obras": {}}
    works = covers()
    pending = [slug for slug, photo in works.items() if data["obras"].get(slug, {}).get("foto") != photo]
    gone = [slug for slug in data["obras"] if slug not in works]
    if gone:
        print("Medidas de obras que ya no están en el catálogo:", ", ".join(gone))
    if not pending:
        print(f"Las {len(works)} obras tienen la mirada medida sobre su portada.")
        return 0
    if args.lista:
        print("Sin medir sobre su portada:", ", ".join(pending))
        return 1
    try:
        import Vision  # noqa: F401
    except ImportError:
        print("Hace falta pyobjc con Vision (macOS). Sin medir:", ", ".join(pending))
        return 1
    unsolved = []
    for slug in pending:
        if data["obras"].get(slug, {}).get("por") == "a ojo":
            unsolved.append(slug)      # la portada cambió y la marca era manual: hay que volver a mirarla
            continue
        found = measure(DATA.parent / works[slug].lstrip("/"))
        if not found:
            unsolved.append(slug)
            continue
        entry = {"foto": works[slug], "ojos": found[1], "por": "vision"}
        if found[2]:
            entry.update(rostro="cara", boca=found[2])
        data["obras"][slug] = entry
        print(f"{slug}: medida ({'cara' if found[2] else 'solo mirada'}). Comprueba el recorte en el índice.")
    data["obras"] = dict(sorted(data["obras"].items()))
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    if unsolved:
        print("A mano (sin cara detectable o marcadas a ojo):", ", ".join(unsolved))
    return 1 if unsolved else 0


if __name__ == "__main__":
    sys.exit(main())
