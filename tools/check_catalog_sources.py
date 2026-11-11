#!/usr/bin/env python3
"""Paridad de las fuentes del catálogo, sin compilar nada.

El catálogo público sale de dos archivos (`catalogo.json` y las obras de
`vaivenes.json`) ordenados por `journey.json`. Este control falla cuando esas
fuentes dejan de coincidir, cuando hay slugs repetidos, cuando una redirección
o una exposición apunta a una obra que no existe, cuando vuelve a escribirse un
recuento a mano en el `index.html` de la SPA o cuando el registro de la SPA
(`src/artworks.ts`) se aleja del catálogo más de lo ya anotado.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DATA = REPO / "classic" / "data"

# Deuda conocida del registro de la SPA a 2026-11-11. No es una lista de permisos:
# solo impide que la diferencia crezca. Al resolver una entrada, se borra de aquí.
SPA_FUERA_DE_CATALOGO = {
    "asucar-celia-cruz", "autorretrato-naroa", "cantinflas-i", "cantinflas-kintsugi",
    "divinos-amy", "divinos-johnny", "divinos-marilyn", "divinos-vaivenes-politena",
    "en-caja", "espejo-del-alma", "hacer-el-indio", "hammock-in-tin",
    "marian-de-miranda-luciendo-la-pantorrilla", "paul-rocks", "roisin-tartan",
    "sardine-tin-collage", "soy-un-amor-y-tengo-alas", "summer-monroe", "tedas-queen",
}
SPA_SIN_REGISTRAR = {"cantinflowers", "roisin"}
SPA_REPETIDOS = {"la-famiglia"}
SPA_CATEGORIAS = {"rocks", "divinos", "kintsugi", "drawing"}

RECUENTO_A_MANO = re.compile(r"\b\d+\s+(?:obras|retratos|piezas)\b", re.IGNORECASE)


def read(name):
    return json.loads((DATA / f"{name}.json").read_text())


def repeated(values):
    return sorted(value for value, n in Counter(values).items() if n > 1)


def catalogue_slugs():
    """Slugs de obra del catálogo público, en el orden en que los reúne el build."""
    slugs = [p["slug"] for p in read("catalogo")["projects"]]
    for image in read("vaivenes")["images"]:
        slug = image.get("work_slug", image.get("slug"))
        if slug not in slugs:
            slugs.append(slug)
    return slugs


def check():
    errors = []
    notes = []

    def need(ok, message):
        if not ok:
            errors.append(message)

    reviewed = [p["slug"] for p in read("catalogo")["projects"]]
    need(not repeated(reviewed), f"catalogo.json repite slugs: {repeated(reviewed)}")
    works = catalogue_slugs()
    known = set(works)

    journey = read("journey")
    scenes = journey["scenes"]
    order = [scene["slug"] for scene in scenes]
    need(not repeated(order), f"journey.json repite escenas: {repeated(order)}")
    need(set(order) == known, f"journey.json y catálogo no cubren las mismas obras: sobran en el recorrido {sorted(set(order) - known)}, faltan {sorted(known - set(order))}")
    need(all(scene["mode"] in journey["durations"] for scene in scenes), "journey.json usa un modo de cámara sin duración")
    need(bool(scenes) and scenes[0].get("hold") == 45, "la escena inicial del recorrido debe llevar hold: 45")
    need(all(scene.get("hold") == 25 for scene in scenes[1:]), "todas las escenas tras la inicial deben llevar hold: 25")
    lost = sorted({scene["target"] for scene in scenes if scene.get("target")} - known)
    need(not lost, f"journey.json apunta (target) a obras inexistentes: {lost}")

    for show in read("exhibitions")["exhibitions"]:
        lost = sorted(set(show.get("artworks", [])) - known)
        need(not lost, f"exhibitions.json · «{show.get('title')}» cita obras inexistentes: {lost}")

    for rule in json.loads((REPO / "vercel.json").read_text()).get("redirects", []):
        source = re.fullmatch(r"/obra/([^/()*:]+)/?", rule["source"])
        if source:
            need(source.group(1) not in known, f"vercel.json redirige una obra que existe: {rule['source']}")
        target = re.fullmatch(r"/obra/([^/$]+)/?", rule["destination"])
        if target:
            need(target.group(1) in known, f"vercel.json redirige a una obra inexistente: {rule['source']} → {rule['destination']}")

    root_html = (REPO / "index.html").read_text()
    by_hand = sorted(set(match.group(0) for match in RECUENTO_A_MANO.finditer(root_html)))
    need(not by_hand, f"index.html lleva recuentos escritos a mano {by_hand}: usa %OBRAS_TOTAL% (lo rellena vite.config.ts)")
    need("%OBRAS_TOTAL%" in root_html, "index.html ya no usa %OBRAS_TOTAL%")

    registry = (REPO / "src" / "artworks.ts").read_text()
    spa = re.findall(r"^\s*slug:\s*'([^']+)'", registry, flags=re.MULTILINE)
    categories = set(re.findall(r"^\s*category:\s*'([^']+)'", registry, flags=re.MULTILINE))
    need(categories <= SPA_CATEGORIAS, f"src/artworks.ts usa categorías fuera de las cuatro admitidas: {sorted(categories - SPA_CATEGORIAS)}")
    extra = set(spa) - known
    missing = known - set(spa)
    twice = set(repeated(spa))
    need(extra <= SPA_FUERA_DE_CATALOGO, f"src/artworks.ts registra obras que no están en el catálogo: {sorted(extra - SPA_FUERA_DE_CATALOGO)}")
    need(missing <= SPA_SIN_REGISTRAR, f"src/artworks.ts no registra obras del catálogo: {sorted(missing - SPA_SIN_REGISTRAR)}")
    need(twice <= SPA_REPETIDOS, f"src/artworks.ts repite slugs: {sorted(twice - SPA_REPETIDOS)}")
    for label, noted, live in (("fuera de catálogo", SPA_FUERA_DE_CATALOGO, extra), ("sin registrar", SPA_SIN_REGISTRAR, missing), ("repetidos", SPA_REPETIDOS, twice)):
        need(noted <= live, f"la deuda anotada «{label}» ya está resuelta para {sorted(noted - live)}: bórrala de tools/check_catalog_sources.py")
    if extra or missing or twice:
        notes.append(f"deuda del registro de la SPA: {len(extra)} obras fuera de catálogo, {len(missing)} sin registrar, {len(twice)} slug repetido")

    if errors:
        print("FAIL: fuentes del catálogo")
        for message in errors:
            print("  ·", message)
        sys.exit(1)
    print(f"PASS: {len(works)} obras; catálogo, recorrido, exposiciones y redirecciones coinciden, y el registro de la SPA no se aleja más de lo anotado.")
    for message in notes:
        print("  nota:", message)


if __name__ == "__main__":
    check()
