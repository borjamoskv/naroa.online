#!/usr/bin/env python3
"""Refresca classic/data/blog.json desde la API pública del WordPress de Naroa.

Las seis entradas más recientes van a `posts`; el resto, a `archive`.
Lo ya revisado a mano (resumen, destacada, imagen local) no se toca: solo se
añaden las entradas que falten y se actualizan título, enlace y fecha.

    python3 tools/sync_blog.py            # escribe blog.json y descarga carteles nuevos
    python3 tools/sync_blog.py --check    # solo informa; no escribe nada
"""
import argparse
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DATA = REPO / "classic/data/blog.json"
IMAGES = REPO / "classic/images/cuaderno"
SITE = "naroagutierrez.wordpress.com"
LIST_API = (
    f"https://public-api.wordpress.com/rest/v1.1/sites/{SITE}/posts/"
    "?number=100&fields=ID,date,title,URL,excerpt,featured_image"
)
FEATURED_COUNT = 6
MONTHS = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split()


def plain(value):
    text = html.unescape(re.sub(r"<[^>]+>", "", value or ""))
    return re.sub(r"\s+", " ", text).strip()


def date_label(iso):
    year, month, day = (int(part) for part in iso.split("-"))
    return f"{day} de {MONTHS[month - 1]} de {year}"


def trusted(url, image=False):
    parts = urllib.parse.urlsplit(url or "")
    ok = parts.scheme == "https" and parts.hostname == SITE
    return ok and (not image or parts.path.startswith("/wp-content/uploads/"))


def fetch_posts():
    request = urllib.request.Request(LIST_API, headers={"User-Agent": "blog-sync"})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    posts = [p for p in payload.get("posts", []) if trusted(p.get("URL")) and plain(p.get("title"))]
    if len(posts) < FEATURED_COUNT:
        raise SystemExit(f"La API devolvió {len(posts)} entradas válidas; no se toca blog.json.")
    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts, int(payload.get("found") or len(posts))


def download_poster(post):
    """Guarda el cartel de una entrada nueva y devuelve su ficha de imagen."""
    src = post.get("featured_image") or ""
    if not trusted(src, image=True):
        return None
    from PIL import Image  # misma dependencia que el compilador del sitio

    suffix = Path(urllib.parse.urlsplit(src).path).suffix.lower() or ".jpg"
    target = IMAGES / f"post-{post['ID']}{suffix}"
    if not target.exists():
        IMAGES.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(src, headers={"User-Agent": "blog-sync"})
        with urllib.request.urlopen(request, timeout=60) as response:
            target.write_bytes(response.read())
    with Image.open(target) as image:
        width, height = image.size
    return {"src": src, "width": width, "height": height, "alt": plain(post["title"]),
            "local": f"/images/cuaderno/{target.name}"}


def summary_from(post):
    text = re.sub(r"\s*\[(…|\.\.\.)\]\s*$", "…", plain(post.get("excerpt")))
    return text


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="Informa de las diferencias sin escribir")
    args = parser.parse_args()

    current = json.loads(DATA.read_text())
    known = {post["id"]: post for post in current.get("posts", [])}
    remote, total = fetch_posts()

    posts, added = [], []
    for item in remote[:FEATURED_COUNT]:
        iso = item["date"][:10]
        fresh = {"id": item["ID"], "title": plain(item["title"]), "url": item["URL"],
                 "date": iso, "date_label": date_label(iso)}
        if item["ID"] in known:
            posts.append({**known[item["ID"]], **fresh})
            continue
        added.append(fresh["title"])
        entry = {**fresh, "category": "Del cuaderno de Naroa", "summary": summary_from(item), "featured": False}
        if not args.check:
            image = download_poster(item)
            if image:
                entry["image"] = image
        posts.append(entry)
    # La destacada es siempre la más reciente.
    for index, post in enumerate(posts):
        post["featured"] = index == 0

    archive = [{"id": item["ID"], "title": plain(item["title"]), "url": item["URL"], "date": item["date"][:10]}
               for item in remote[FEATURED_COUNT:]]

    result = {
        "source": current.get("source", f"https://{SITE}/"),
        "api": current["api"],
        "synced": datetime.now(timezone.utc).isoformat(),
        "total": total,
        "posts": posts,
        "archive": archive,
    }
    comparable = lambda data: {key: value for key, value in data.items() if key != "synced"}
    changed = comparable(result) != comparable(current)

    print(f"{total} entradas en el blog · {len(posts)} en portada · {len(archive)} en el archivo")
    for title in added:
        print(f"  nueva: {title}")
    if args.check:
        print("Hay cambios pendientes." if changed else "blog.json está al día.")
        return 1 if changed else 0
    if not changed:
        print("blog.json ya estaba al día; solo se renueva la fecha de comprobación.")
    DATA.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"Escrito {DATA.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
