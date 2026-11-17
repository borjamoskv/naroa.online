#!/usr/bin/env python3
"""Paridad de las fuentes del catálogo, sin compilar nada.

El catálogo público sale de dos archivos (`catalogo.json` y las obras de
`vaivenes.json`) ordenados por `journey.json`. Este control falla cuando esas
fuentes dejan de coincidir, cuando hay slugs repetidos, cuando una redirección
o una exposición apunta a una obra que no existe, cuando vuelve a escribirse un
recuento a mano en el `index.html` de la SPA, cuando el registro de la SPA
(`src/artworks.ts`) se aleja del catálogo más de lo ya anotado o cuando una
imagen publicable lleva GPS o el pie, el lugar o el enlace de Facebook.
"""
import json
import re
import sys
import zlib
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
    "sardine-tin-collage", "summer-monroe",
}
SPA_SIN_REGISTRAR = {"cantinflowers", "roisin"}
SPA_REPETIDOS = {"la-famiglia"}
SPA_CATEGORIAS = {"rocks", "divinos", "kintsugi", "drawing"}

RECUENTO_A_MANO = re.compile(r"\b\d+\s+(?:obras|retratos|piezas)\b", re.IGNORECASE)

# Carpetas que se publican tal cual: el museo copia de classic/images lo que enlaza
# cada ficha y el lab sube public/ entero. Ninguna imagen de ahí puede llevar la
# ubicación de la cámara ni el pie, el lugar o el enlace que el script de descarga
# de Facebook escribe en cada foto.
IMAGENES_PUBLICADAS = ("classic/images", "classic/assets", "public")
XMP_DE_FACEBOOK = (b"facebook.com", b"photoshop:City", b"<dc:description", b"dc:description=")
XMP_CON_GPS = (b"exif:GPSLatitude", b"exif:GPSLongitude")   # Lightroom y Photoshop la copian aquí


def _xmp(body):
    found = []
    if any(s in body for s in XMP_CON_GPS):
        found.append("GPS en el XMP")
    if any(s in body for s in XMP_DE_FACEBOOK):
        found.append("XMP con pie, lugar o enlace de Facebook")
    return found


def _gps_en_tiff(tiff):
    """True si el bloque EXIF (TIFF) lleva latitud o longitud GPS."""
    if len(tiff) < 8 or tiff[:2] not in (b"II", b"MM"):
        return False
    order = "little" if tiff[:2] == b"II" else "big"
    u16 = lambda o: int.from_bytes(tiff[o:o + 2], order)
    u32 = lambda o: int.from_bytes(tiff[o:o + 4], order)
    ifd = u32(4)
    if ifd + 2 > len(tiff):
        return False
    for k in range(u16(ifd)):
        entry = ifd + 2 + 12 * k
        if entry + 12 > len(tiff):
            break
        if u16(entry) == 0x8825:                      # puntero al bloque GPS
            gps = u32(entry + 8)
            if gps + 2 > len(tiff):
                return False
            tags = {u16(gps + 2 + 12 * j) for j in range(u16(gps)) if gps + 14 + 12 * j <= len(tiff)}
            return bool(tags & {1, 2, 3, 4})          # Ref y valor de latitud/longitud
    return False


def metadatos_privados(path):
    """Motivos por los que una imagen publicada no debería salir así (lista vacía si está limpia)."""
    found = []
    with open(path, "rb") as fh:
        head = fh.read(12)
        if head[:2] == b"\xff\xd8":                   # JPEG: segmentos hasta los datos de imagen
            fh.seek(2)
            while True:
                if fh.read(1) != b"\xff":
                    break
                code = fh.read(1)
                while code == b"\xff":                 # bytes de relleno antes del marcador (B.1.1.2)
                    code = fh.read(1)
                if not code or code[0] in (0xD9, 0xDA):
                    break
                if code[0] == 0x01 or 0xD0 <= code[0] <= 0xD7:
                    continue                            # marcadores sin longitud
                size = int.from_bytes(fh.read(2), "big")
                body = fh.read(max(size - 2, 0))
                if code[0] == 0xE1 and body.startswith(b"Exif\x00\x00") and _gps_en_tiff(body[6:]):
                    found.append("GPS")
                elif code[0] == 0xE1 and b"ns.adobe.com/xap" in body[:64]:
                    found += _xmp(body)
                elif code[0] == 0xED and b"\x1c\x02\x78" in body:
                    found.append("pie IPTC")
        elif head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            while True:
                chunk = fh.read(8)
                if len(chunk) < 8:
                    break
                size = int.from_bytes(chunk[4:], "little")
                if chunk[:4] in (b"EXIF", b"XMP "):
                    body = fh.read(size)
                    if chunk[:4] == b"EXIF" and _gps_en_tiff(body[6:] if body.startswith(b"Exif\x00\x00") else body):
                        found.append("GPS")
                    if chunk[:4] == b"XMP ":
                        found += _xmp(body)
                else:
                    fh.seek(size, 1)
                if size % 2:
                    fh.seek(1, 1)
        elif head[:8] == b"\x89PNG\r\n\x1a\n":
            fh.seek(8)
            while True:
                chunk = fh.read(8)
                if len(chunk) < 8 or chunk[4:] == b"IEND":
                    break
                size = int.from_bytes(chunk[:4], "big")
                if chunk[4:] in (b"eXIf", b"iTXt", b"tEXt", b"zTXt"):
                    body = fh.read(size)
                    if chunk[4:] == b"eXIf" and _gps_en_tiff(body):
                        found.append("GPS")
                    elif chunk[4:] == b"iTXt" and body.startswith(b"XML:com.adobe.xmp\x00"):
                        rest = body[len(b"XML:com.adobe.xmp\x00"):]
                        if rest[:1] == b"\x01":         # XMP comprimido
                            try:
                                rest = zlib.decompress(rest[2:].split(b"\x00", 2)[-1])
                            except zlib.error:
                                rest = b""
                        found += _xmp(rest)
                    fh.seek(4, 1)                       # CRC
                else:
                    fh.seek(size + 4, 1)
    return list(dict.fromkeys(found))


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

    revisadas = 0
    for folder in IMAGENES_PUBLICADAS:
        for path in sorted((REPO / folder).rglob("*")):
            if path.suffix.lower() not in (".jpg", ".jpeg", ".webp", ".png") or not path.is_file():
                continue
            revisadas += 1
            motivos = metadatos_privados(path)
            rel = path.relative_to(REPO)
            need(not motivos, f"{rel} se publica con {', '.join(motivos)}: límpiala con «exiftool -gps:all= -iptc:all= -xmp:all= -overwrite_original {rel}» y pon su sha256 nuevo donde se registre (catalogo.json, vaivenes.json)")
    notes.append(f"{revisadas} imágenes publicables (JPEG, WebP y PNG) sin GPS ni pies de Facebook incrustados")

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
