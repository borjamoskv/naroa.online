#!/usr/bin/env python3
"""Build the complete immersive portfolio from the reviewed local catalogue.

No network calls, no edits to reviewed data or original photographs.
"""
import argparse
import base64
import hashlib
import json
import re
import shutil
from concurrent.futures import ThreadPoolExecutor
from html import escape as esc
from pathlib import Path
from urllib.parse import quote

from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "classic"
ORIGIN = "https://naroagutierrezgil.com"
LABELS = {"pizarra": "Pizarra · DiviNos", "collage": "Dibujo y collage", "objetos": "Retratos y objetos", "caracterizacion": "Caracterización"}
CURATED = ["marilyn-rocks", "rara-avis", "amor-en-conserva", "amy-rocks", "entre-tantas-flores-de-dia", "johnny-rocks", "rockagipsy", "hugo-box"]


def read_data(name):
    return json.loads((SOURCE / "data" / f"{name}.json").read_text())


def data_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_text() != text:
        path.write_text(text)


def build(output):
    output.mkdir(parents=True, exist_ok=True)
    media = output / "immersive" / "media"
    media.mkdir(parents=True, exist_ok=True)
    jobs = {}
    originals = set()

    def derivative(src, limit=1800, thumb=False):
        source = SOURCE / src.lstrip("/")
        if not source.is_file():
            raise FileNotFoundError(f"Reviewed image missing: {src}")
        digest = hashlib.sha256(source.read_bytes()).hexdigest()[:12]
        variant = "thumb" if thumb else "view" if limit == 1800 else f"view-{limit}"
        name = f"{source.stem}-{digest}-{variant}.webp"
        dest = media / name
        jobs[dest] = (source, limit, 72 if thumb else 80)
        originals.add(src)
        return "/immersive/media/" + name

    catalogue = read_data("catalogo")
    series = read_data("vaivenes")
    sha_by_src = {}
    source_by_src = {}
    for p in catalogue["projects"]:
        for im in p["images"]:
            if im.get("sha256"):
                sha_by_src[im["src"]] = im["sha256"]
            if im.get("source"):
                source_by_src[im["src"]] = im["source"]
    for im in series["images"]:
        for photo in im.get("images", [im]):
            if photo.get("sha256"):
                sha_by_src[photo["src"]] = photo["sha256"]
            if photo.get("source"):
                source_by_src[photo["src"]] = photo["source"]
    image_meta_cache = {}

    def image_info(src):
        if src not in image_meta_cache:
            with Image.open(SOURCE / src.lstrip("/")) as im:
                image_meta_cache[src] = (im.width, im.height, Image.MIME.get(im.format, "image/jpeg"))
        return image_meta_cache[src]

    projects = []
    series_slugs = {im.get("work_slug", im.get("slug")) for im in series["images"]}
    for p in catalogue["projects"]:
        photographs = [{"src": derivative(im["src"]), "original": im["src"], "caption": im["caption"], "width": im["width"], "height": im["height"]} for im in p["images"]]
        cover_index = 2 if p["slug"] == "marilyn-rocks" else 0
        projects.append({"slug": p["slug"], "title": p["title"], "category": p["category"], "label": LABELS[p["category"]], "story": p["story"], "technique": p["technique"], "support": p["support"], "dimensions": p["dimensions"], "materials": p.get("materials"), "interaction": p.get("interaction"), "year": p["year"], "series": "Vaivenes" if p["slug"] in series_slugs else p["series"], "credit": p["credit"], "source": p["source"], "kind": p["kind"], "cover": photographs[cover_index]["src"], "thumb": derivative(p["images"][0]["src"], 480, True), "photos": photographs, "stage": "obra"})
    known = {p["slug"] for p in projects}
    for im in series["images"]:
        slug = im.get("work_slug", im.get("slug"))
        if slug in known:
            continue
        known.add(slug)
        stage = im.get("stage", "obra")
        photos = im.get("images", [im])
        projects.append({"slug": slug, "title": im["title"], "category": "collage", "label": "Vaivenes" + (" · Detalle" if stage == "detalle" else " · Dibujo" if stage == "dibujo" else ""), "story": im["caption"], "technique": im.get("technique", "Pintura y collage" if stage != "dibujo" else "Dibujo"), "support": im.get("support"), "dimensions": im.get("dimensions"), "materials": im.get("materials"), "year": None, "series": "Vaivenes", "credit": None, "source": im["source"], "kind": "obra", "cover": derivative(im["src"]), "thumb": derivative(im["src"], 480, True), "photos": [{"src": derivative(photo["src"]), "original": photo["src"], "caption": photo["caption"], "width": photo["width"], "height": photo["height"]} for photo in photos], "stage": stage})
    # The non-curated order follows the reviewed files, independently of hash seed.
    first = {slug: i for i, slug in enumerate(CURATED)}
    original_order = {p["slug"]: i for i, p in enumerate(catalogue["projects"])}
    for i, im in enumerate(series["images"]):
        original_order.setdefault(im.get("work_slug", im.get("slug")), len(catalogue["projects"]) + i)
    projects.sort(key=lambda p: (0, first[p["slug"]]) if p["slug"] in first else (1, original_order[p["slug"]]))
    assert len(projects) == len(known)
    portrait = derivative("/images/sobre-mi/naroa-monoculo.jpg", 3468)
    portrait_wink = derivative("/images/sobre-mi/naroa-monoculo-guino.png")
    cantinflowers = derivative("/images/trayectoria/cantinflowers.jpg")
    journey = read_data("journey")
    assert [scene["slug"] for scene in journey["scenes"]] == [p["slug"] for p in projects], "Camera score must cover the ordered catalogue exactly"
    assert all(scene["mode"] in journey["durations"] for scene in journey["scenes"])
    content = {"journey": journey, "projects": projects, "reviewed": catalogue["reviewed"], "labels": LABELS}
    amy = next(p for p in projects if p["slug"] == "amy-rocks")
    icon_viewbox = "131 56 223 223"
    icon_hash = hashlib.sha256((SOURCE / amy["photos"][0]["original"].lstrip("/")).read_bytes() + icon_viewbox.encode()).hexdigest()[:12]
    favicon_path = f"/immersive/favicon-amy-{icon_hash}.svg"
    menu_portrait = derivative("/images/sobre-mi/naroa-monoculo.jpg", 900)
    menu_portrait_wink = derivative("/images/sobre-mi/naroa-monoculo-guino.png", 900)
    menu_flowers = derivative("/images/trayectoria/cantinflowers.jpg", 900)
    assets = {}
    for name in ("app.css", "app.js", "journey.js", "soundscape.js"):
        src = SOURCE / "immersive" / name
        digest = hashlib.sha256(src.read_bytes()).hexdigest()[:12]
        dest = output / "immersive" / f"{src.stem}-{digest}{src.suffix}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        assets[name] = "/" + str(dest.relative_to(output))
    for name in ("naroa-naturaleza.mp3", "naroa-iris.mp3", "naroa-caja-musica.mp3", "we-can-be-heroes.mp3", "just-for-one-day.mp3", "sound-of-silence.mp3", "asucar-celia.mp3", "deltoya.mp3"):
        src = SOURCE / "audio" / name
        digest = hashlib.sha256(src.read_bytes()).hexdigest()[:12]
        dest = output / "immersive/audio" / f"{src.stem}-{digest}{src.suffix}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        assets[name] = "/" + str(dest.relative_to(output))
    shutil.copy2(SOURCE / "audio/CREDITS.md", output / "immersive/audio/creditos.txt")
    encoded = "window.NAROA_CATALOG=" + data_json(content) + ";\n"
    digest = hashlib.sha256(encoded.encode()).hexdigest()[:12]
    catalog_path = f"/immersive/catalog-{digest}.js"
    write(output / catalog_path.lstrip("/"), encoded)

    def links():
        work = {p["slug"]: p for p in projects}
        vaivenes_list = [p for p in projects if p["series"] == "Vaivenes"]
        vaiven = vaivenes_list[0]
        obras_reel = [work[s] for s in ("amy-rocks", "marilyn-rocks", "rara-avis", "johnny-rocks") if s in work]
        vaivenes_reel = vaivenes_list[:4]
        def reel_attr(seq):
            if not seq:
                return ""
            payload = [{"src": p["thumb"], "title": p["title"], "meta": p["label"], "href": f"/obra/{p['slug']}/"} for p in seq]
            return f' data-preview-reel="{esc(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))}"'
        items = [
            ("/obra/", "Obras", f"{len(projects)} retratos · Un viaje", amy["thumb"], "Amy Rocks", "Mirar es entrar.", f"Pizarra, collage y objetos · {len(projects)} obras", False, obras_reel),
            ("/series/vaivenes/", "Vaivenes", "Dibujo, materia y transformación", vaiven["thumb"], vaiven["title"], "Todo va y viene.", f"Collage y transformación · {len(vaivenes_list)} obras", False, vaivenes_reel),
            ("/sobre-mi/", "Naroa", "La artista", menu_portrait, "Naroa Gutiérrez Gil", "Me encontré a mí en los demás.", "Retratista y artista plástica · Bilbao", False, None),
            ("/trayectoria/", "Trayectoria", "Exposiciones y encuentros", menu_flowers, "Cantinflowers", "El arte también sale de paseo.", "Exposiciones colectivas e individuales", False, None),
            ("/cuaderno/", "Cuaderno", "Historias desde el estudio", work["rara-avis"]["thumb"], "Rara Avis", "Apuntes desde el estudio.", "Proceso creativo y textos de estudio", False, None),
            ("/retratos-por-encargo-bilbao/", "Encargos", "Un retrato con tu historia", work["amor-en-conserva"]["thumb"], "Amor en Conserva", "Cada rostro guarda un mundo.", "Retrato personalizado a medida · Bilbao", False, None),
            ("/contacto/", "Contacto", "Hablemos de tu idea", menu_portrait, "Naroa Gutiérrez Gil", "¿Qué historia retratamos?", "Estudio en Bilbao · Consulta directa", True, None),
        ]
        return ''.join(f'''<a href="{href}" data-menu-item data-menu-index="{i-1}" data-preview-src="{src}" data-preview-title="{esc(title)}" data-preview-label="{esc(label)}" data-preview-quote="{esc(quote_text)}" data-preview-meta="{esc(meta_text)}"{' data-preview-wink="true"' if wink else ''}{reel_attr(reel)}><span class="menu-number" aria-hidden="true">{i:02}</span><span class="menu-name">{label}<small>{detail}</small></span><span class="menu-arrow" aria-hidden="true">↗</span></a>''' for i, (href, label, detail, src, title, quote_text, meta_text, wink, reel) in enumerate(items, 1))

    def header(gallery=False):
        return f'''<header class="site-nav"><a class="signature" href="/" aria-label="Naroa Gutiérrez Gil, inicio"><span>Naroa</span><small>GUTIÉRREZ GIL</small></a><nav aria-label="Principal"><a href="/obra/#indice" data-open-index>Obras</a><a class="desktop-link" href="/retratos-por-encargo-bilbao/">Encargos</a>{'<button type="button" data-quiet>Solo obra</button>' if gallery else '<a class="desktop-link" href="/sobre-mi/">La artista</a>'}<button type="button" class="sound-toggle" data-sound data-nature-src="{assets['naroa-naturaleza.mp3']}" data-iris-src="{assets['naroa-iris.mp3']}" data-musicbox-src="{assets['naroa-caja-musica.mp3']}" data-hero-src="{assets['we-can-be-heroes.mp3']}" data-denbora-src="{assets['just-for-one-day.mp3']}" data-silence-src="{assets['sound-of-silence.mp3']}" data-asucar-src="{assets['asucar-celia.mp3']}" data-deltoya-src="{assets['deltoya.mp3']}" aria-label="Activar caja de música reactiva" title="Caja de música: desplázate para tocar" aria-pressed="false"><svg viewBox="0 0 18 20" aria-hidden="true"><path d="M3 7v6M9 3v14M15 6v8"/></svg><span>Sonido</span></button><button type="button" data-open-menu aria-haspopup="dialog" aria-controls="menu-dialog" aria-expanded="false">Menú <span aria-hidden="true">+</span></button></nav><span class="sound-status" data-sound-status role="status" hidden></span></header>'''

    def dialogs():
        index = ''.join(f'''<a class="index-work" href="/obra/{p['slug']}/" data-work="{p['slug']}" data-category="{p['category']}" data-series="{esc(p['series'] or '')}" data-search="{esc(' '.join(str(p[k] or '') for k in ['title','technique','support','series','story','materials']))}"><img src="{p['thumb']}" width="92" height="100" alt="{esc(p['title'])}" loading="lazy"><span><small>{esc(p['label'])}</small><strong>{esc(p['title'])}</strong><em>{esc(p['support'] or p['technique'] or '')}</em></span><span aria-hidden="true">↗</span></a>''' for p in projects)
        return f'''<dialog id="menu-dialog" class="menu-dialog" aria-labelledby="menu-heading"><div class="dialog-top menu-top"><a class="signature" href="/" aria-label="Naroa Gutiérrez Gil, inicio"><span>Naroa</span><small>GUTIÉRREZ GIL</small></a><span id="menu-heading">Otra manera de mirar</span><button type="button" data-close-dialog autofocus>Cerrar <span aria-hidden="true">×</span></button></div><div class="menu-layout"><figure class="menu-preview"><div class="menu-preview-picture" data-menu-picture><img data-menu-image alt="Amy Rocks" aria-hidden="true" width="480" height="360"><img data-menu-image alt="Amy Rocks" aria-hidden="true" width="480" height="360"><img class="menu-preview-wink" data-menu-wink src="{menu_portrait_wink}" alt="Guiño de Naroa Gutiérrez Gil" aria-hidden="true" width="480" height="360"><div class="menu-preview-loupe" data-menu-loupe aria-hidden="true"></div><span class="menu-preview-hand" data-menu-quote aria-hidden="true">Mirar es entrar.</span><div class="menu-preview-reel" data-menu-reel hidden aria-hidden="true"></div></div><figcaption><span data-menu-preview-label>Obras</span><span class="menu-preview-meta" data-menu-preview-meta>Pizarra, collage y objetos · {len(projects)} obras</span><span data-menu-preview-title>Amy Rocks</span><button type="button" class="menu-index-trigger" data-menu-open-index title="Atajo: pulsa / o I">Buscar en las {len(projects)} obras ⌕</button></figcaption></figure><nav class="menu-pages" aria-label="Todas las páginas">{links()}</nav></div><div class="menu-foot"><span>Desde Bilbao, con otra mirada.</span><a href="mailto:naroa@naroa.eu">naroa@naroa.eu ↗</a><a href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://instagram.com/naroa_art/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="/immersive/audio/creditos.txt">Créditos del sonido ↗</a></div></dialog>
<dialog id="index-dialog" class="index-dialog" aria-labelledby="index-heading"><div class="dialog-top"><h2 id="index-heading">La obra</h2><button type="button" data-close-dialog>Cerrar ×</button></div><div class="index-controls"><label>Buscar obra<input type="search" id="art-search" placeholder="Título, material o retratado…" autocomplete="off"></label><div class="index-filters" role="group" aria-label="Filtrar obras"><button type="button" data-filter="all" aria-pressed="true">Todas</button><button type="button" data-filter="pizarra" aria-pressed="false">Pizarra</button><button type="button" data-filter="collage" aria-pressed="false">Collage</button><button type="button" data-filter="objetos" aria-pressed="false">Objetos</button><button type="button" data-filter="caracterizacion" aria-pressed="false">Caracterización</button><button type="button" data-filter="Vaivenes" aria-pressed="false">Vaivenes</button></div></div><p class="index-count" role="status" aria-live="polite">{len(projects)} proyectos</p><div class="index-list">{index}</div><p class="index-empty" hidden>No hay obras que coincidan con esta búsqueda. <button type="button" data-reset-index>Ver todas</button></p></dialog>'''

    def footer():
        return '''<footer class="site-footer"><a class="signature" href="/">Naroa</a><a href="mailto:naroa@naroa.eu">naroa@naroa.eu ↗</a><a href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://instagram.com/naroa_art/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="/contacto/">¿Hablamos? ↗</a><span>Bilbao · © 2026</span></footer>'''

    pages = []

    artist_same_as = [
        "https://www.facebook.com/naroa.artista.plastica",
        "https://instagram.com/naroa_art/",
        "https://naroagutierrez.wordpress.com/",
        "https://www.deia.eus/bizkaia/vida-social/2026/06/05/bwall-collective-inaugura-exposicion-ocho-11159371.html",
        "https://gara.naiz.eus/paperezkoa/20100305/186538/eu/Agenda",
    ]
    bilbao_place = {
        "@type": "Place",
        "name": "Bilbao, Bizkaia",
        "address": {
            "@type": "PostalAddress",
            "addressLocality": "Bilbao",
            "addressRegion": "Bizkaia",
            "addressCountry": "ES",
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": 43.2630,
            "longitude": -2.9350,
        },
        "hasMap": "https://www.google.com/maps?q=Bilbao,+Bizkaia",
    }

    def page(path, title, description, body, image, gallery=False, schema=None, not_found=False, image_alt=None):
        canonical = ORIGIN + path
        im_w, im_h, im_mime = image_info(image)
        im_alt = image_alt or f"{title} · Naroa Gutiérrez Gil"
        structured = dict(schema or {"@context": "https://schema.org", "@type": "WebPage", "name": title, "url": canonical, "description": description})
        structured.setdefault("inLanguage", "es-ES")
        structured.setdefault("dateModified", catalogue["reviewed"])
        if not not_found:
            structured.setdefault(
                "primaryImageOfPage",
                {
                    "@type": "ImageObject",
                    "contentUrl": f"{ORIGIN}{image}",
                    "width": im_w,
                    "height": im_h,
                    "encodingFormat": im_mime,
                    "caption": im_alt,
                },
            )
        breadcrumb = None
        if not not_found and path != "/":
            section_name = "Obras" if path.startswith("/obra/") else "Vaivenes" if path.startswith("/series/vaivenes/") else title.split("·")[0].strip()
            items = [{"@type": "ListItem", "position": 1, "name": "Inicio", "item": ORIGIN + "/"}]
            if path.startswith("/obra/") and path != "/obra/":
                items.append({"@type": "ListItem", "position": 2, "name": "Obras", "item": ORIGIN + "/obra/"})
                items.append({"@type": "ListItem", "position": 3, "name": title.split("·")[0].strip(), "item": canonical})
            elif path.startswith("/series/vaivenes/") and path != "/series/vaivenes/":
                items.append({"@type": "ListItem", "position": 2, "name": "Vaivenes", "item": ORIGIN + "/series/vaivenes/"})
                items.append({"@type": "ListItem", "position": 3, "name": title.split("·")[0].strip(), "item": canonical})
            else:
                items.append({"@type": "ListItem", "position": 2, "name": section_name, "item": canonical})
            breadcrumb = {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": items
            }
        breadcrumb_tag = f'<script type="application/ld+json" id="seo-breadcrumb">{data_json(breadcrumb)}</script>' if breadcrumb else ''
        html = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{esc(title)} · Naroa Gutiérrez Gil</title><meta name="description" content="{esc(description)}"><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="{canonical}"><meta property="og:site_name" content="Naroa Gutiérrez Gil"><meta property="og:locale" content="es_ES"><meta property="og:title" content="{esc(title)} · Naroa Gutiérrez Gil"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{canonical}"><meta property="og:type" content="{'article' if gallery else 'website'}"><meta property="og:image" content="{ORIGIN}{image}"><meta property="og:image:secure_url" content="{ORIGIN}{image}"><meta property="og:image:width" content="{im_w}"><meta property="og:image:height" content="{im_h}"><meta property="og:image:type" content="{im_mime}"><meta property="og:image:alt" content="{esc(im_alt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(title)} · Naroa Gutiérrez Gil"><meta name="twitter:description" content="{esc(description)}"><meta name="twitter:image" content="{ORIGIN}{image}"><meta name="twitter:image:alt" content="{esc(im_alt)}"><link rel="icon" href="{favicon_path}" type="image/svg+xml" sizes="any"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"><link rel="stylesheet" href="{assets['app.css']}"><script type="application/ld+json" id="page-schema">{data_json(structured)}</script>{breadcrumb_tag}<script defer src="{catalog_path}"></script><script defer src="{assets['soundscape.js']}"></script><script defer src="{assets['journey.js']}"></script><script defer src="{assets['app.js']}"></script></head><body class="{'gallery-page' if gallery else 'editorial-page'}"><a class="skip-link" href="#main">Ir al contenido</a>{header(gallery)}{body}{'' if gallery else footer()}{dialogs()}</body></html>'''
        dest = output / ("404.html" if not_found else path.lstrip("/") + "index.html")
        write(dest, html)
        if not not_found:
            pages.append((path, image, title, im_alt))

    def work_alt(q, caption=None):
        medium = " · ".join(filter(None, [q.get("technique"), q.get("support")])) or q["label"]
        detail = f" ({caption})" if caption else ""
        return f"{q['title']}{detail} — {medium}, retrato artístico original de Naroa Gutiérrez Gil"

    def gallery(path, initial=0, subset="all", title=None, description=None, schema=None):
        selected = [p for p in projects if subset != "Vaivenes" or p["series"] == "Vaivenes"]
        p = selected[initial]
        stages = ''.join(f'''<div class="art-scene{' is-current' if q['slug']==p['slug'] else ''}" data-scene="{i}" data-work="{q['slug']}"{' aria-hidden="true"' if q['slug']!=p['slug'] else ''}><div class="art-pan"><img {'src' if q['slug']==p['slug'] else 'data-src'}="{q['cover']}" alt="{esc(work_alt(q))}" decoding="async" draggable="false"{' fetchpriority="high"' if q['slug']==p['slug'] else ''}></div></div>''' for i, q in enumerate(selected))
        nav = ''.join(f'<button type="button" data-select="{i}" aria-label="Ver {esc(q["title"])}" aria-pressed="{str(i==initial).lower()}"{ " hidden" if abs(i-initial)>2 else ""}>{i+1:02d}</button>' for i, q in enumerate(selected))
        facts_items = [
            ("Técnica", p["technique"]),
            ("Soporte", p["support"]),
            ("Medidas", p["dimensions"]),
            ("Materiales", p.get("materials")),
            ("Serie", p.get("series")),
            ("Año", p.get("year")),
        ]
        facts_html = "".join(
            f"<div><dt>{esc(label)}</dt><dd>{esc(str(val))}</dd></div>"
            for label, val in facts_items
            if val
        )
        body = f'''<main id="main" class="art-scroll" style="--steps:{len(selected)-1}"><section class="art-stage" data-gallery data-initial="{initial}" data-subset="{subset}"><div class="art-layers">{stages}</div><div class="art-shade" aria-hidden="true"></div><div class="kinetic-title" data-kinetic-title aria-hidden="true"></div><nav class="art-index" aria-label="Recorrido de obras">{nav}</nav><div class="art-bottom"><div><div data-art-copy aria-live="polite"><p class="art-counter"><span data-counter>{initial+1:02d} / {len(selected):02d}</span><small data-journey-cue>Desplázate para recorrer ↕</small></p><h1 data-art-title>{esc(p['title'])}</h1><p class="art-material" data-art-material>{esc(p['label'])}</p></div><button type="button" class="art-story-link" data-open-story>Sobre esta obra <span aria-hidden="true">+</span></button></div><div class="art-controls"><div class="art-view-actions"><button type="button" data-effects aria-pressed="false">Activar efectos</button><button type="button" data-fit aria-pressed="false">Ver imagen completa ↗</button><button type="button" data-open-photos>Otras miradas ↗</button><button type="button" class="ouroboros-loop-btn" data-ouroboros hidden aria-label="Volver al origen de la exposición">Volver al origen ↺</button></div><div class="art-arrows"><button type="button" data-prev aria-label="Obra anterior"{' disabled' if initial==0 else ''}>←</button><button type="button" data-next aria-label="Obra siguiente"{' disabled' if initial==len(selected)-1 else ''}>→</button></div></div></div><button type="button" class="restore-ui" data-restore hidden>Volver a la navegación ↙</button><div class="art-progress" aria-hidden="true"><span></span></div></section></main>
<dialog id="story-dialog" class="story-dialog" aria-labelledby="story-title"><div class="dialog-top"><span data-story-category>{esc(p['label'])}</span><button type="button" data-close-dialog>Cerrar ×</button></div><div class="story-body"><h2 id="story-title">{esc(p['title'])}</h2><p data-story>{esc(p['story'])}</p><dl data-facts>{facts_html}</dl><p class="art-credit" data-credit>{esc(p['credit'] or '')}</p><div class="story-actions"><a class="text-link" data-art-email href="mailto:naroa@naroa.eu?subject={quote('Consulta sobre '+p['title'])}">Consultar por email ↗</a><a class="text-link" data-art-whatsapp href="https://wa.me/34636060609?text={quote('Hola Naroa, me gustaría consultar sobre la obra ' + p['title'])}" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp ↗</a><button type="button" class="text-link" data-share-link>Compartir enlace directo ↗</button></div><a class="source-link" data-art-source{' hidden' if not p['source'] else ''} href="{esc(p['source'] or '')}" target="_blank" rel="noopener noreferrer">Ver publicación de la artista ↗</a></div><a class="story-footer" href="/retratos-por-encargo-bilbao/">Tu propio retrato empieza aquí ↗</a></dialog>
<dialog id="photos-dialog" class="photos-dialog" aria-labelledby="photos-heading"><div class="dialog-top"><span id="photos-heading">{esc(p['title'])}</span><button type="button" data-close-dialog>Cerrar ×</button></div><div class="photo-view"><button type="button" data-photo-prev aria-label="Fotografía anterior">←</button><img data-photo-image data-src="{p['photos'][0]['src']}" alt="{esc(work_alt(p, p['photos'][0]['caption']))}" decoding="async"><button type="button" data-photo-next aria-label="Fotografía siguiente">→</button></div><p data-photo-caption aria-live="polite"></p></dialog>'''
        artwork_photos = []
        for idx, ph in enumerate(p["photos"]):
            _, _, ph_mime = image_info(ph["original"])
            img_obj = {
                "@type": "ImageObject",
                "contentUrl": ORIGIN + ph["original"],
                "caption": ph.get("caption") or f"{p['title']} — {p.get('technique', '')} de Naroa Gutiérrez Gil",
                "width": ph.get("width"),
                "height": ph.get("height"),
                "encodingFormat": ph_mime,
                "representativeOfPage": idx == 0,
                "creator": {
                    "@type": "Person",
                    "@id": ORIGIN + "/#artist",
                    "name": "Naroa Gutiérrez Gil",
                },
                "creditText": "Naroa Gutiérrez Gil",
                "copyrightNotice": "© Naroa Gutiérrez Gil",
                "acquireLicensePage": ORIGIN + "/retratos-por-encargo-bilbao/",
            }
            if sha_by_src.get(ph["original"]):
                img_obj["identifier"] = f"sha256:{sha_by_src[ph['original']]}"
            if source_by_src.get(ph["original"]):
                img_obj["isBasedOn"] = source_by_src[ph["original"]]
            artwork_photos.append(img_obj)
        default_schema = {
            "@context": "https://schema.org",
            "@type": "VisualArtwork",
            "@id": ORIGIN + "/obra/" + p["slug"] + "/#artwork",
            "name": p["title"],
            "url": ORIGIN + "/obra/" + p["slug"] + "/",
            "inLanguage": "es-ES",
            "dateModified": catalogue["reviewed"],
            "image": [ORIGIN + ph["original"] for ph in p["photos"]],
            "subjectOf": {
                "@type": "ImageGallery",
                "name": f"Galería fotográfica de {p['title']}",
                "image": artwork_photos,
            },
            "description": p["story"],
            "creator": {
                "@type": "Person",
                "@id": ORIGIN + "/#artist",
                "name": "Naroa Gutiérrez Gil",
                "jobTitle": "Artista plástica y retratista",
                "url": ORIGIN + "/",
                "sameAs": artist_same_as,
            },
            "locationCreated": bilbao_place,
            "artMedium": p.get("technique"),
            "artworkSurface": p.get("support"),
            "material": p.get("materials"),
            "artform": "VisualArtwork",
            "offers": {
                "@type": "Offer",
                "availability": "https://schema.org/InStock",
                "priceCurrency": "EUR",
                "url": ORIGIN + "/obra/" + p["slug"] + "/",
                "description": "Obra original de catálogo y encargos personalizados basados en esta técnica. Consulta directa con la artista.",
                "seller": {
                    "@type": "Person",
                    "@id": ORIGIN + "/#artist",
                    "name": "Naroa Gutiérrez Gil",
                },
            },
        }
        if p.get("source"):
            default_schema["isBasedOn"] = p["source"]
        if p.get("year"):
            default_schema["dateCreated"] = str(p["year"])
        if p.get("dimensions"):
            default_schema["size"] = p["dimensions"]
        page(path, title or p["title"], description or p["story"], body, p["photos"][0]["original"], True, schema or default_schema, image_alt=work_alt(p, p["photos"][0]["caption"]))

    def hero(image, eyebrow, heading, lead="", link=None, alt="Obra de Naroa Gutiérrez Gil", position="50% 45%"):
        return f'''<section class="page-hero" data-parallax><div class="page-hero-image"><img src="{image}" alt="{esc(alt)}" fetchpriority="high" style="object-position:{position}"></div><div class="page-hero-shade"></div><div class="page-hero-copy"><p class="eyebrow">{esc(eyebrow)}</p><h1>{heading}</h1>{f'<p class="hero-lead">{lead}</p>' if lead else ''}{f'<a class="text-link" href="{link[0]}">{link[1]} ↗</a>' if link else ''}</div><a class="hero-down" href="#contenido" aria-label="Seguir leyendo">↓</a></section>'''

    home_schema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": ORIGIN + "/#website",
        "name": "Naroa Gutiérrez Gil · Retratista en Bilbao y Bizkaia",
        "url": ORIGIN + "/",
        "description": f"Obra de Naroa Gutiérrez Gil, artista plástica y retratista en Bilbao y Bizkaia. {len(projects)} retratos sobre pizarra, collage, dibujo y objetos intervenidos.",
        "publisher": {
            "@type": "Person",
            "@id": ORIGIN + "/#artist",
            "name": "Naroa Gutiérrez Gil",
            "jobTitle": "Artista plástica y retratista",
            "url": ORIGIN + "/",
            "homeLocation": bilbao_place,
            "image": ORIGIN + "/images/sobre-mi/naroa-monoculo.jpg",
            "email": "naroa@naroa.eu",
            "telephone": "+34636060609",
            "sameAs": artist_same_as,
            "knowsAbout": [
                "Retratos artísticos personalizados",
                "Pintura sobre pizarra natural",
                "Collage y objetos intervenidos",
                "Walking Gallery Bilbao",
                "Arte figurativo contemporáneo",
            ],
        },
        "mainEntity": {
            "@type": "Person",
            "@id": ORIGIN + "/#artist",
        },
    }
    catalogue_schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": f"Obra · {len(projects)} retratos, collage y objetos · Naroa Gutiérrez Gil",
        "url": ORIGIN + "/obra/",
        "description": f"Catálogo completo de {len(projects)} obras y retratos de Naroa Gutiérrez Gil: pizarra, collage, dibujo y objetos intervenidos.",
        "mainEntity": {
            "@type": "ItemList",
            "name": f"{len(projects)} retratos y obras de Naroa Gutiérrez Gil",
            "numberOfItems": len(projects),
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": i + 1,
                    "item": {
                        "@type": "VisualArtwork",
                        "name": p["title"],
                        "url": ORIGIN + "/obra/" + p["slug"] + "/",
                        "image": ORIGIN + p["photos"][0]["original"],
                        "artMedium": p.get("technique"),
                        "artworkSurface": p.get("support"),
                    },
                }
                for i, p in enumerate(projects)
            ],
        },
    }
    vaivenes_projects = [p for p in projects if p["series"] == "Vaivenes"]
    vaivenes_schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Serie Vaivenes · Dibujo, materia y transformación · Naroa Gutiérrez Gil",
        "url": ORIGIN + "/series/vaivenes/",
        "description": "Serie Vaivenes de Naroa Gutiérrez Gil: retratos y piezas donde el collage, el dibujo y los materiales reutilizados exploran emociones y contrastes.",
        "creator": {
            "@type": "Person",
            "@id": ORIGIN + "/#artist",
            "name": "Naroa Gutiérrez Gil",
        },
        "mainEntity": {
            "@type": "ItemList",
            "name": "Obras de la serie Vaivenes",
            "numberOfItems": len(vaivenes_projects),
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": i + 1,
                    "item": {
                        "@type": "VisualArtwork",
                        "name": p["title"],
                        "url": ORIGIN + "/obra/" + p["slug"] + "/",
                        "image": ORIGIN + p["photos"][0]["original"],
                    },
                }
                for i, p in enumerate(vaivenes_projects)
            ],
        },
    }
    gallery("/", 0, title="Retratista en Bilbao y Bizkaia · Retratos, collage y objetos", description=f"Obra de Naroa Gutiérrez Gil, artista plástica y retratista en Bilbao y Bizkaia. {len(projects)} retratos sobre pizarra, collage, dibujo y objetos intervenidos.", schema=home_schema)
    gallery("/obra/", 0, title=f"Obra · {len(projects)} retratos, collage y objetos", schema=catalogue_schema)
    for i, p in enumerate(projects):
        gallery(f"/obra/{p['slug']}/", i)
    gallery("/series/vaivenes/", 0, "Vaivenes", "Vaivenes", schema=vaivenes_schema)
    rara = next(p for p in projects if p["slug"] == "rara-avis")
    portal_work = derivative(rara["photos"][0]["original"], 4080)
    # Only the artist portrait gets this native, pinned scroll sequence. The
    # decorative eyelid is a feathered photographic animation layer; the
    # original photograph remains untouched and is the no-JS fallback.
    about = f'''<div class="portrait-scroll" data-portrait-scroll style="--portrait-steps:{len(projects)-1}">
<section class="page-hero portrait-hero" data-eye-portrait>
<div class="portrait-frame"><div class="portrait-plane" data-portrait-plane>
<img src="{portrait}" width="2201" height="3468" alt="Naroa Gutiérrez Gil con chistera y un monóculo ante un ojo" fetchpriority="high">
<svg class="portrait-wink" viewBox="0 0 1248 1966" aria-hidden="true" focusable="false">
<defs><radialGradient id="portrait-wink-feather"><stop offset=".66" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient>
<mask id="portrait-wink-mask" maskUnits="userSpaceOnUse" x="480" y="712" width="190" height="132"><ellipse cx="575" cy="778" rx="89" ry="62" fill="url(#portrait-wink-feather)"/></mask></defs>
<g data-portrait-wink opacity="0" mask="url(#portrait-wink-mask)"><image href="{portrait_wink}" width="1248" height="1966" preserveAspectRatio="none"/></g></svg></div>
<div class="portrait-artwork" data-portrait-artwork aria-hidden="true"><img src="{portal_work}" width="4080" height="3072" alt="Rara Avis, autorretrato de Naroa a pastel y collage" decoding="async"></div></div>
<div class="page-hero-shade"></div>
<div class="page-hero-copy"><p class="eyebrow">La artista · Bilbao</p><h1>Naroa<br><span>Gutiérrez Gil.</span></h1><p class="hero-lead">Rostros, materia y ganas de jugar.</p></div>
<div class="portrait-work-copy" data-portrait-work-copy inert><p class="eyebrow" data-portrait-label>Del rostro al autorretrato · 01 / {len(projects)}</p><h2 data-portrait-title>Rara Avis</h2><a class="text-link" data-portrait-link href="/obra/rara-avis/">Explorar la obra ↗</a></div>
<nav class="portrait-travel-controls" data-portrait-controls aria-label="Continuar por las obras" inert><a href="#contenido">Biografía ↓</a><button type="button" data-portrait-prev aria-label="Obra anterior" disabled>←</button><button type="button" data-portrait-next aria-label="Obra siguiente">→</button></nav>
<a class="hero-down" href="#contenido" aria-label="Una mirada cómplice · Desplázate para entrar en su ojo" title="Una mirada cómplice · Desplázate para entrar en su ojo">↓</a>
</section></div>'''
    about += '''<article id="contenido" class="editorial"><section class="chapter"><p class="eyebrow">La mirada</p><div><h2>Mirar a los demás.<br><span>Encontrarse en ellos.</span></h2><p class="lead">Naroa Gutiérrez Gil trabaja con rostros. Los dibuja, los pinta y los reconstruye con papeles, texturas y objetos. En cada retrato hay también una pregunta por quien lo mira.</p><p>En sus textos, crear y conocerse aparecen una y otra vez de la mano. Las figuras del cine, la música o la televisión son el punto de partida para hablar de emociones, de identidad y de aquello que reconocemos en otras personas.</p></div></section><blockquote>«Me encontré a mí en los demás».<cite>Naroa · <a href="https://naroagutierrez.wordpress.com/2020/09/27/iconos-pop-muestra-colectiva-de-retratos/" target="_blank" rel="noopener noreferrer">Iconos Pop, 2020 ↗</a></cite></blockquote><section class="chapter"><p class="eyebrow">01 · La materia</p><div><h2>Lo que cuenta<br>cada material.</h2><p>Una pizarra, un plato de madera, un recorte o una lata pueden convertirse en parte del retrato. El soporte aporta significado: la pintura convive con las huellas, las capas y las posibilidades de cada objeto.</p><p>En Vaivenes, el collage y los materiales reutilizados dan forma a vivencias y estados de ánimo. En DiviNos, los rostros sobre pizarra incorporan pintura, lápices de colores y mica.</p><div class="chapter-links"><a class="text-link" href="/series/vaivenes/">Descubrir Vaivenes ↗</a><a class="text-link" href="https://naroagutierrez.wordpress.com/2017/04/02/madera-papel-y-tijera-en-ambigu/" target="_blank" rel="noopener noreferrer">Madera, Papel y Tijera ↗</a></div></div></section>'''
    amor = next(p for p in projects if p["slug"] == "amor-en-conserva")
    jaio = next(p for p in projects if p["slug"] == "custom-jaio")
    about += f'''<figure class="full-figure" data-parallax><a href="/obra/amor-en-conserva/"><img src="{amor['cover']}" alt="Amor en Conserva, retratos y objetos reunidos en una lata abierta" loading="lazy"></a><figcaption>Amor en Conserva · <a href="/obra/amor-en-conserva/">Entrar en la obra ↗</a></figcaption></figure><section class="chapter"><p class="eyebrow">02 · La propia mirada</p><div><h2>Al otro lado<br>del espejo.</h2><p>Después de años retratando a otras personas, Naroa cuenta que dibujarse directamente ante un espejo supuso un reto nuevo. En 2025 participó en el taller de autorretrato de Ana Rosa Arroyo, en la asociación Mujeres en la Diversidad.</p><p>Rara Avis reúne esa exploración en un autorretrato de pastel y collage. Mirarse se convierte, otra vez, en una oportunidad para experimentar.</p><div class="chapter-links"><a class="text-link" href="/obra/rara-avis/">Descubrir Rara Avis ↗</a><a class="text-link" href="https://naroagutierrez.wordpress.com/2026/05/14/autorretratos-mujeres-a-traves-del-espejo/" target="_blank" rel="noopener noreferrer">Leer cómo nació Rara Avis ↗</a></div></div></section><figure class="full-figure" data-parallax><a href="/obra/rara-avis/"><img src="{rara['cover']}" alt="Rara Avis: autorretrato entre marcos, papeles y reflejos" loading="lazy"></a><figcaption>Rara Avis · Pastel y collage</figcaption></figure><section class="chapter"><p class="eyebrow">03 · Compartir</p><div><h2>Crear también<br>es encontrarse.</h2><p>En Bilbao, sus convocatorias de Walking Gallery invitan a sacar las creaciones a la calle y conversar mientras se camina con ellas.</p><p>En 2024 presentó El ReCreo, un espacio de experimentación para personas de distintas edades. La curiosidad, el respeto y el disfrute del proceso atraviesan esta otra faceta de su práctica.</p><div class="chapter-links"><a class="text-link" href="/trayectoria/">Recorrer su trayectoria ↗</a><a class="text-link" href="https://naroagutierrez.wordpress.com/2022/10/04/walking-gallery-bilbao-octubre-2022-por-amor-al-arte/" target="_blank" rel="noopener noreferrer">Walking Gallery ↗</a><a class="text-link" href="https://naroagutierrez.wordpress.com/2024/01/12/el-recreo-espacio-de-creacion-para-recrearte/" target="_blank" rel="noopener noreferrer">Conocer El ReCreo ↗</a></div></div></section></article>'''
    about_schema = {"@context": "https://schema.org", "@type": "ProfilePage", "name": "Sobre mí · Artista plástica y retratista en Bilbao y Bizkaia", "url": ORIGIN + "/sobre-mi/", "mainEntity": {"@type": "Person", "@id": ORIGIN + "/#artist", "name": "Naroa Gutiérrez Gil", "jobTitle": "Artista plástica y retratista", "url": ORIGIN + "/", "homeLocation": bilbao_place, "sameAs": artist_same_as}}
    page("/sobre-mi/", "Sobre mí · Artista plástica y retratista en Bilbao", "Rostros, materia y ganas de jugar. La mirada y el proceso creativo de Naroa Gutiérrez Gil, artista plástica y retratista en Bilbao y Bizkaia.", '<main id="main">' + about + '</main>', "/images/sobre-mi/naroa-monoculo.jpg", schema=about_schema)

    exhibitions = read_data("exhibitions")["exhibitions"]
    years = sorted({x["year"] for x in exhibitions}, reverse=True)
    career = hero(cantinflowers, "Exposiciones y encuentros", "El arte también<br><span>sale de paseo.</span>", "De sala en sala. Entre otras personas.", alt="Cantinflowers, pintura y collage en torno a Mario Moreno")
    career += '<section id="contenido" class="career editorial"><div class="section-opening"><p class="eyebrow">Trayectoria documentada</p><h2>El camino<br>de las obras.</h2><p>Una selección de exposiciones, encuentros y espacios compartidos. Las fechas corresponden a las muestras; cada entrada conserva sus fuentes.</p></div><div class="year-filters" role="group" aria-label="Filtrar exposiciones por año"><button type="button" data-year="all" aria-pressed="true">Todos</button>' + ''.join(f'<button type="button" data-year="{y}" aria-pressed="false">{y}</button>' for y in years) + '</div><p class="career-count" role="status" aria-live="polite">' + str(len(exhibitions)) + ' encuentros documentados</p><div class="timeline">'
    for x in exhibitions:
        sources = ''.join(f'<a href="{esc(s["url"])}" target="_blank" rel="noopener noreferrer">{esc(s["label"])} ↗</a>' for s in x["sources"])
        career += f'''<article class="timeline-entry" data-exhibition-year="{x['year']}"><p>{esc(x['dateLabel'])}</p><div><h3>{esc(x['title'])}</h3><p class="timeline-location">{esc(x['location'])}</p><p>{esc(x['description'])}</p><div class="timeline-sources">{sources}</div></div></article>'''
    career += '</div></section>'
    exhibition_events = []
    for ex in exhibitions:
        loc = ex.get("location", "")
        city = "Bilbao" if "Bilbao" in loc else loc.split("·")[-1].strip() if "·" in loc else "Bizkaia"
        ev = {
            "@type": "ExhibitionEvent",
            "name": ex["title"],
            "startDate": ex["date"],
            "location": {
                "@type": "Place",
                "name": loc,
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": city,
                    "addressRegion": "Bizkaia",
                    "addressCountry": "ES",
                },
            },
            "description": ex["description"],
            "organizer": {
                "@type": "Person",
                "@id": ORIGIN + "/#artist",
                "name": "Naroa Gutiérrez Gil",
            },
        }
        if ex.get("endDate"):
            ev["endDate"] = ex["endDate"]
        if ex.get("sources"):
            ev["subjectOf"] = [
                {"@type": "WebPage", "name": s["label"], "url": s["url"]}
                for s in ex["sources"]
            ]
        exhibition_events.append(ev)
    career_schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Trayectoria documentada · Naroa Gutiérrez Gil",
        "url": ORIGIN + "/trayectoria/",
        "description": "Exposiciones, encuentros y espacios compartidos de Naroa Gutiérrez Gil en Bilbao y Bizkaia.",
        "mainEntity": {
            "@type": "ItemList",
            "name": "Exposiciones y encuentros de Naroa Gutiérrez Gil",
            "numberOfItems": len(exhibition_events),
            "itemListElement": [
                {"@type": "ListItem", "position": i + 1, "item": ev}
                for i, ev in enumerate(exhibition_events)
            ],
        },
    }
    page("/trayectoria/", "Trayectoria", "Exposiciones, encuentros y espacios compartidos de Naroa Gutiérrez Gil. Una selección documentada de su trayectoria.", '<main id="main">' + career + '</main>', "/images/trayectoria/cantinflowers.jpg", schema=career_schema)

    blog_data = read_data("blog")
    posts = blog_data["posts"]
    notebook = hero(rara["cover"], "El cuaderno de Naroa", "Entre una obra<br><span>y la siguiente.</span>", "Historias, procesos y encuentros. Contados por Naroa, a su manera.", alt="Rara Avis, autorretrato de Naroa")
    notebook += f'<section class="editorial notebook" id="contenido" data-notebook-sync="{esc(blog_data.get("api", ""))}"><div class="section-opening"><p class="eyebrow">Cuaderno abierto · Sincronizado con su blog</p><h2>Lo que ocurre<br>alrededor de una obra.</h2><p>Seis publicaciones ilustradas del cuaderno de Naroa, conectadas directamente con sus textos originales.</p></div><div class="notebook-posts" data-notebook-posts>'
    for x in posts:
        im = x.get("image") or {}
        local_src = im.get("local")
        img_src = derivative(local_src, 960) if local_src else im.get("src", "")
        photo_html = f'''<a class="notebook-photo" href="{esc(x['url'])}" target="_blank" rel="noopener noreferrer"><img src="{esc(img_src)}" width="{im.get('width', 1080)}" height="{im.get('height', 1080)}" alt="{esc(im.get('alt') or x['title'])}" loading="lazy" decoding="async"></a>''' if img_src else ""
        notebook += f'''<article class="notebook-card" data-notebook-entry>{photo_html}<div class="notebook-card-body"><p class="eyebrow"><span>{esc(x.get('category', 'Del cuaderno de Naroa'))}</span> · <time datetime="{esc(x['date'])}">{esc(x['date_label'])}</time></p><h3><a href="{esc(x['url'])}" target="_blank" rel="noopener noreferrer">{esc(x['title'])} ↗</a></h3><p>{esc(x['summary'])}</p><a class="text-link" href="{esc(x['url'])}" target="_blank" rel="noopener noreferrer">Leer en el cuaderno de Naroa ↗</a></div></article>'''
    notebook += '</div><div class="notebook-actions"><a class="text-link" href="https://naroagutierrez.wordpress.com/" target="_blank" rel="noopener noreferrer">Seguir leyendo su cuaderno en WordPress ↗</a><a class="text-link" href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Publicaciones en Facebook ↗</a></div></section>'
    blog_schema = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "name": "El cuaderno de Naroa",
        "url": ORIGIN + "/cuaderno/",
        "description": "Historias de obras, procesos y encuentros. El cuaderno de la artista Naroa Gutiérrez Gil.",
        "author": {
            "@type": "Person",
            "@id": ORIGIN + "/#artist",
            "name": "Naroa Gutiérrez Gil",
        },
        "blogPost": [
            {
                "@type": "BlogPosting",
                "headline": post["title"],
                "url": post["url"],
                "datePublished": post["date"],
                "description": post["summary"],
                "author": {
                    "@type": "Person",
                    "@id": ORIGIN + "/#artist",
                    "name": "Naroa Gutiérrez Gil",
                },
            }
            for post in posts
        ],
    }
    page("/cuaderno/", "Cuaderno", "Historias de obras, procesos y encuentros. El cuaderno de la artista Naroa Gutiérrez Gil.", '<main id="main">' + notebook + '</main>', rara["photos"][0]["original"], schema=blog_schema)

    commission_examples = [
        (amy, "Retrato sobre pizarra", "Acrílico, lápices, rotuladores y mica sobre el contorno natural de la piedra."),
        (jaio, "Dibujo, textil y collage", "Retrato sobre tela vaquera o papel intervenido con costuras, botones y capas."),
        (amor, "Objetos con historia", "Cajas de madera, latas o soportes cotidianos transformados en piezas tridimensionales."),
    ]
    commission_faqs = [
        ("¿Cómo encargar un retrato personalizado a partir de fotografías?", "Puedes enviar una o varias fotografías de referencia (incluso tomadas con el móvil) para estudiar la pose, la iluminación y el carácter. Naroa no realiza una reproducción fotomecánica, sino una reinterpretación artística de autor que integra la personalidad, anécdotas y memoria de quien recibe la obra."),
        ("¿Cuánto cuesta un retrato personalizado por encargo?", "El presupuesto se calcula con total transparencia según el soporte y las dimensiones: piezas en pizarra natural (medidas habituales de 20 × 30 cm a 40 × 50 cm), obras mixtas con dibujo y collage sobre madera o tela, y cajas de recuerdos tridimensionales. Siempre se elabora una propuesta formal con presupuesto cerrado y por escrito antes de comenzar, sin compromiso previo."),
        ("¿Cuáles son los plazos de entrega en Bilbao y mediante envío?", "El plazo habitual de ejecución se sitúa entre 2 y 4 semanas, condicionado por los tiempos de secado de los óleos, esmaltes y fijación de mica mineral. Para fechas señaladas (aniversarios, bodas, homenajes) es posible concertar plazos prioritarios con aviso previo. La entrega se realiza en mano en Bilbao y Bizkaia, o mediante envío protegido y asegurado a cualquier destino."),
        ("¿Qué técnicas y soportes se pueden elegir para el encargo?", "Se puede elegir entre pizarra natural de cantera con aristas rústicas vistas, técnica mixta con escamas de mica y pigmentos luminosos, dibujo clásico a grafito o pastel combinado con collage textil sobre madera noble, o cajas y latas cotidianas transformadas en esculturas de memoria personal."),
    ]
    examples_html = ''.join(f'''<article class="commission-example"><a class="commission-example-photo" href="/obra/{ex['slug']}/"><img src="{ex['cover']}" width="{ex['photos'][0]['width']}" height="{ex['photos'][0]['height']}" alt="{esc(work_alt(ex))}" loading="lazy" decoding="async"></a><div class="commission-example-copy"><p class="eyebrow">{esc(kind_label)}</p><h3><a href="/obra/{ex['slug']}/">{esc(ex['title'])} ↗</a></h3><p>{esc(note)}</p><small>{esc(ex['technique'])} · {esc(ex['support'])}</small></div></article>''' for ex, kind_label, note in commission_examples)
    faq_html = ''.join(f'''<details class="commission-faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>''' for q, a in commission_faqs)
    specs_rows = [
        ("Soportes de autor", "Pizarra natural de cantera con borde irregular, madera noble intervenida, collage textil sobre tela vaquera o papel de algodón y cajas tridimensionales."),
        ("Formatos habituales", "Piezas en pizarra de 20 × 30 cm a 40 × 50 cm; composiciones en madera, papel y objetos con medidas adaptadas a cada proyecto."),
        ("Técnicas plásticas", "Acrílico, óleo, grafito, pastel Conté, rotuladores acrílicos, escamas de mica mineral, esmalte con brillantina y ensamblaje de objetos."),
        ("Plazo de ejecución", "Entre 2 y 4 semanas según complejidad y tiempos de secado de materiales (posibilidad de plazos prioritarios para aniversarios o regalos con aviso previo)."),
        ("Presupuesto y reserva", "Propuesta personalizada y presupuesto cerrado por escrito antes de iniciar la obra, sin compromiso previo."),
        ("Entrega y envíos", "Entrega en mano en Bilbao y Bizkaia, o envío protegido y asegurado a cualquier punto de España e internacional."),
    ]
    specs_html = "".join(f"<p><strong>{esc(k)}:</strong> {esc(v)}</p>" for k, v in specs_rows)
    commissions = hero(amor["cover"], "Retratos personalizados por encargo · Bilbao", "No retrato solo tu cara.<br><span>Retrato tu historia.</span>", "Tu historia convertida en una obra de arte original sobre pizarra, collage, madera u objetos con vida propia.", ("/contacto/", "Solicitar un retrato"), alt=work_alt(amor))
    commissions += f'''<article class="editorial" id="contenido"><section class="chapter"><p class="eyebrow">Retrato de autor a partir de tu historia</p><div><h2>Más allá de<br>una fotografía.</h2><p class="lead">Encarga un retrato personalizado en Bilbao con Naroa Gutiérrez Gil a partir de tu historia o fotografías. Obras originales de autor sobre pizarra natural, collage, madera y objetos intervenidos, con presupuesto cerrado previo y entrega local en mano o envío protegido.</p><p>Puedes partir de una fotografía, un recuerdo o un objeto con significado para encargar una pieza hecha a mano y pensada para quien la recibe. En el taller valoramos el soporte que mejor cuente esa historia: pizarra con contornos naturales, composiciones de dibujo y tela vaquera, o cajas de madera personalizadas.</p></div></section><section class="commission-examples-section" aria-labelledby="commission-examples-heading"><div class="section-opening"><p class="eyebrow">Soportes reales del catálogo</p><h2 id="commission-examples-heading">Tres maneras de dar<br>forma a un retrato.</h2><p>Cada pieza cuenta con fotografías de conjunto, ángulo y detalle real del soporte en el archivo de Naroa.</p></div><div class="commission-examples">{examples_html}</div></section><section class="chapter" aria-labelledby="commission-specs-heading"><p class="eyebrow">Ficha técnica de encargos</p><div><h2 id="commission-specs-heading">Materiales, formatos<br>y condiciones reales.</h2>{specs_html}</div></section><section class="commission-steps" aria-label="Proceso de encargo"><article><span>01</span><h3>Me cuentas tu idea y tu foto.</h3><p>A quién quieres retratar, si es para regalar y qué historia u objetos le definen. Puedes adjuntar fotografías de referencia.</p></article><article><span>02</span><h3>Propuesta, materiales y presupuesto.</h3><p>Acordamos técnica, formato, orientación de precio y plazo de entrega antes de comenzar la obra.</p></article><article><span>03</span><h3>El retrato cobra vida en el estudio.</h3><p>Compartimos imágenes del proceso mientras el dibujo, la pizarra o el collage van tomando forma.</p></article><article><span>04</span><h3>Entrega en Bilbao o envío.</h3><p>Acordamos la entrega en mano en Bilbao y Bizkaia o el envío preparado según el soporte y los materiales.</p></article></section><section class="commission-faq" aria-labelledby="commission-faq-heading"><div class="section-opening"><p class="eyebrow">Dudas frecuentes antes de encargar</p><h2 id="commission-faq-heading">Precios, fotos<br>y plazos.</h2></div><div class="commission-faq-list">{faq_html}</div></section><div class="closing"><p class="hand">¿A quién te gustaría retratar?</p><a class="text-link" href="https://wa.me/34636060609?text=Hola%20Naroa%2C%20me%20gustar%C3%ADa%20consultar%20un%20retrato%20personalizado%20por%20encargo." target="_blank" rel="noopener noreferrer">Hablar por WhatsApp directo ↗</a><a class="text-link" href="mailto:naroa@naroa.eu?subject=Solicitud%20de%20presupuesto%20para%20retrato%20por%20encargo">Solicitar presupuesto por email ↗</a><a class="text-link" href="/obra/#indice">Explorar las {len(projects)} obras del catálogo ↗</a></div></article>'''
    commissions_schema = {
        "@context": "https://schema.org",
        "@type": ["Service", "ProfessionalService"],
        "@id": ORIGIN + "/retratos-por-encargo-bilbao/#service",
        "name": "Retratos personalizados por encargo en Bilbao y Bizkaia",
        "serviceType": "Retratos artísticos de autor sobre pizarra, collage, madera y objetos",
        "url": ORIGIN + "/retratos-por-encargo-bilbao/",
        "inLanguage": "es-ES",
        "dateModified": catalogue["reviewed"],
        "description": "Encarga un retrato personalizado en Bilbao con Naroa Gutiérrez Gil. Piezas originales hechas a mano a partir de fotografía e historia personal: pizarra natural, collage, madera y técnica mixta con presupuesto cerrado previo.",
        "image": [ORIGIN + ex["photos"][0]["original"] for ex, _, _ in commission_examples],
        "provider": {
            "@type": "Person",
            "@id": ORIGIN + "/#artist",
            "name": "Naroa Gutiérrez Gil",
            "jobTitle": "Artista plástica y retratista",
            "url": ORIGIN + "/",
            "sameAs": artist_same_as,
            "homeLocation": bilbao_place,
        },
        "providerMobility": "dynamic",
        "address": {
            "@type": "PostalAddress",
            "addressLocality": "Bilbao",
            "addressRegion": "Bizkaia",
            "addressCountry": "ES",
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": 43.2630,
            "longitude": -2.9350,
        },
        "hasMap": "https://www.google.com/maps?q=Bilbao,+Bizkaia",
        "areaServed": [
            {"@type": "City", "name": "Bilbao", "sameAs": "https://es.wikipedia.org/wiki/Bilbao"},
            {"@type": "AdministrativeArea", "name": "Bizkaia", "sameAs": "https://es.wikipedia.org/wiki/Vizcaya"},
            {"@type": "Country", "name": "España", "sameAs": "https://es.wikipedia.org/wiki/Espa%C3%B1a"},
        ],
        "knowsAbout": [
            "Retrato sobre pizarra natural rústica",
            "Técnica mixta con escamas de mica mineral y esmalte",
            "Collage contemporáneo y textil sobre madera",
            "Retrato al óleo y dibujo a lápiz",
            "Cajas personalizadas y objetos intervenidos",
        ],
        "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Formatos y técnicas de retratos personalizados",
            "itemListElement": [
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Retrato sobre pizarra natural de cantera",
                        "description": "Retrato artístico en técnica mixta (acrílico, mica y esmaltes) sobre plato rústico de pizarra natural (formatos habituales de 20×30 cm a 40×50 cm).",
                    },
                },
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Retrato en dibujo, textil y collage",
                        "description": "Composición de autor con dibujo a grafito/pastel, telas, costuras y elementos biográficos sobre madera noble o soporte rígido.",
                    },
                },
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Caja personalizada u objeto intervenido",
                        "description": "Objeto tridimensional de recuerdo con retrato integrado y elementos de memoria familiar en madera tratada.",
                    },
                },
            ],
        },
        "termsOfService": "Propuesta y presupuesto cerrado previo por escrito sin compromiso. Plazo habitual de 2 a 4 semanas según secado de materiales. Entrega en mano en Bilbao o envío asegurado.",
        "potentialAction": [
            {
                "@type": "CommunicateAction",
                "name": "Solicitar presupuesto de retrato por email",
                "target": "mailto:naroa@naroa.eu?subject=Solicitud%20de%20presupuesto%20para%20retrato%20por%20encargo",
            },
            {
                "@type": "CommunicateAction",
                "name": "Consultar encargo por WhatsApp directo",
                "target": "https://wa.me/34636060609?text=Hola%20Naroa%2C%20me%20gustar%C3%ADa%20consultar%20un%20retrato%20personalizado%20por%20encargo.",
            },
        ],
    }
    page("/retratos-por-encargo-bilbao/", "Retratos personalizados por encargo en Bilbao · Precios, fotos y proceso", "Encarga un retrato personalizado en Bilbao con Naroa Gutiérrez Gil. Retratos hechos a mano a partir de tu historia y fotografía sobre pizarra, collage, madera y objetos.", '<main id="main">' + commissions + '</main>', amor["photos"][0]["original"], schema=commissions_schema, image_alt=work_alt(amor))

    contact = f'''<main id="main" class="contact-page"><div class="contact-background" data-parallax><img src="{rara['cover']}" alt="Rara Avis, composición de retratos y reflejos" fetchpriority="high"></div><div class="contact-shade"></div><section class="contact-copy"><p class="eyebrow">Naroa Gutiérrez Gil · Bilbao</p><h1 class="hand">¿Hablamos?</h1><p>Una persona. Una historia. Una idea a medio hacer.<br>No hace falta traerlo todo pensado.</p><a class="contact-email" href="mailto:naroa@naroa.eu?subject=Retrato%20por%20encargo">naroa@naroa.eu ↗</a><div class="contact-channels" aria-label="Vías de contacto diferenciadas"><article class="contact-channel"><span class="eyebrow">Encargos y obra</span><a class="text-link" href="mailto:naroa@naroa.eu?subject=Consulta%20sobre%20obra%20o%20encargo">Escribir por correo ↗</a><p>Consultas sobre obras del catálogo, formatos y encargos personalizados.</p></article><article class="contact-channel"><span class="eyebrow">Trato directo</span><a class="text-link" href="https://wa.me/34636060609?text=Hola%20Naroa%2C%20me%20gustar%C3%ADa%20hablar%20sobre%20un%20encargo." target="_blank" rel="noopener noreferrer">También por WhatsApp ↗</a><p>Conversación ágil para comentar una idea inicial o concertar llamada.</p></article><article class="contact-channel"><span class="eyebrow">Redes y archivo</span><a class="text-link" href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Facebook · Naroa Artista Plástica ↗</a><p>Álbumes de proceso, exposiciones y archivo fotográfico de cada serie.</p></article></div><div class="contact-details"><a href="tel:+34636060609">+34 636 060 609</a><a href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://instagram.com/naroa_art/" target="_blank" rel="noopener noreferrer">@naroa_art ↗</a><a href="https://naroagutierrez.wordpress.com/" target="_blank" rel="noopener noreferrer">Cuaderno WordPress ↗</a><span>Bilbao · País Vasco</span></div></section></main>'''
    contact_schema = {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        "name": "Contacto · Naroa Gutiérrez Gil",
        "url": ORIGIN + "/contacto/",
        "description": "Habla con Naroa Gutiérrez Gil sobre una obra o un retrato por encargo. Bilbao. Email, WhatsApp e Instagram.",
        "mainEntity": {
            "@type": "Person",
            "@id": ORIGIN + "/#artist",
            "name": "Naroa Gutiérrez Gil",
            "email": "naroa@naroa.eu",
            "telephone": "+34636060609",
            "homeLocation": bilbao_place,
            "sameAs": artist_same_as,
        },
    }
    page("/contacto/", "Contacto", "Habla con Naroa Gutiérrez Gil sobre una obra o un retrato por encargo. Bilbao. Email, WhatsApp e Instagram.", contact, rara["photos"][0]["original"], schema=contact_schema)
    page("/404/", "Esta página se ha ido de paseo", "Vuelve a la obra de Naroa Gutiérrez Gil.", '<main id="main" class="not-found"><p class="eyebrow">404</p><h1>Esta página<br>se ha ido de paseo.</h1><a class="text-link" href="/">Volver a la obra ↗</a></main>', amor["photos"][0]["original"], not_found=True)
    aliases = {"/bio/": "/sobre-mi/", "/exposiciones/": "/trayectoria/", "/encargos/": "/retratos-por-encargo-bilbao/", "/retratos-por-encargo/": "/retratos-por-encargo-bilbao/", "/prensa/": "/cuaderno/", "/blog/": "/cuaderno/"}
    for src, dest in aliases.items():
        write(output / src.lstrip("/") / "index.html", f'<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={dest}"><link rel="canonical" href="{ORIGIN}{dest}"><title>Naroa Gutiérrez Gil</title></head><body><a href="{dest}">Continuar →</a></body></html>')

    def optimize(job):
        dest, (src, limit, quality) = job
        if dest.exists():
            return
        with Image.open(src) as original:
            im = ImageOps.exif_transpose(original).convert("RGB")
            im.thumbnail((limit, limit), Image.Resampling.LANCZOS)
            im.save(dest, "WEBP", quality=quality, method=6)
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(optimize, jobs.items()))
    for src in originals:
        dest = output / src.lstrip("/")
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            shutil.copy2(SOURCE / src.lstrip("/"), dest)
    # Reframe the existing thumbnail inside SVG; the reviewed artwork is untouched.
    icon_image = base64.b64encode((output / amy["thumb"].lstrip("/")).read_bytes()).decode("ascii")
    icon = f'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="{icon_viewbox}"><title>Amy Rocks · Naroa</title><image width="480" height="360" href="data:image/webp;base64,{icon_image}"/></svg>'
    write(output / favicon_path.lstrip("/"), icon)
    write(output / "favicon.svg", icon)

    work_by_route = {f"/obra/{p['slug']}/": p for p in projects}
    sitemap_entries = []
    for path, image, page_title, page_alt in pages:
        if path in work_by_route:
            w = work_by_route[path]
            imgs = ''.join(f'<image:image><image:loc>{ORIGIN}{esc(ph["original"])}</image:loc><image:title>{esc(w["title"])} · {esc(ph["caption"])}</image:title><image:caption>{esc(work_alt(w, ph["caption"]))}</image:caption></image:image>' for ph in w["photos"])
        elif path == "/retratos-por-encargo-bilbao/":
            imgs = ''.join(f'<image:image><image:loc>{ORIGIN}{esc(ex["photos"][0]["original"])}</image:loc><image:title>{esc(ex["title"])} · {esc(kind_label)}</image:title><image:caption>{esc(work_alt(ex, kind_label))}</image:caption></image:image>' for ex, kind_label, _ in commission_examples)
        else:
            imgs = f'<image:image><image:loc>{ORIGIN}{esc(image)}</image:loc><image:title>{esc(page_title)} · Naroa Gutiérrez Gil</image:title><image:caption>{esc(page_alt)}</image:caption></image:image>' if image else ''
        sitemap_entries.append(f'<url><loc>{ORIGIN}{path}</loc><lastmod>{catalogue["reviewed"]}</lastmod>{imgs}</url>')
    robots_content = (
        "User-agent: OAI-SearchBot\n"
        "Allow: /\n\n"
        "User-agent: PerplexityBot\n"
        "Allow: /\n\n"
        "User-agent: Googlebot\n"
        "Allow: /\n\n"
        "User-agent: Bingbot\n"
        "Allow: /\n\n"
        "User-agent: ClaudeBot\n"
        "Allow: /\n\n"
        "User-agent: Applebot-Extended\n"
        "Allow: /\n\n"
        "User-agent: GPTBot\n"
        "Disallow: /\n\n"
        "User-agent: CCBot\n"
        "Disallow: /\n\n"
        "User-agent: Google-Extended\n"
        "Disallow: /\n\n"
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /test/\n"
        "Disallow: /assets/backup_pre4k/\n\n"
        "Sitemap: " + ORIGIN + "/sitemap.xml\n"
    )
    sitemap_xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' + ''.join(sitemap_entries) + '</urlset>\n'
    write(output / "robots.txt", robots_content)
    write(output / "sitemap.xml", sitemap_xml)
    write(REPO / "public" / "sitemap.xml", sitemap_xml)
    indexnow_key = "6621e1f1c138eeb14922f7804f61ae34"
    write(output / f"{indexnow_key}.txt", indexnow_key + "\n")
    write(output / "indexnow.json", json.dumps({"host": "naroagutierrezgil.com", "key": indexnow_key, "keyLocation": f"{ORIGIN}/{indexnow_key}.txt", "urlList": [ORIGIN + p[0] for p in pages]}, indent=2) + "\n")

    catalog_api = {
        "version": "1.0",
        "artist": {
            "name": "Naroa Gutiérrez Gil",
            "role": "Artista plástica y retratista",
            "location": "Bilbao, Bizkaia, España",
            "url": ORIGIN + "/",
            "contact": {
                "email": "naroa@naroa.eu",
                "whatsapp": "+34636060609",
                "inquiry_form": ORIGIN + "/contacto/",
            },
            "commission_service": {
                "url": ORIGIN + "/retratos-por-encargo-bilbao/",
                "supports": [
                    "Pizarra natural de cantera con contorno irregular",
                    "Collage y técnica mixta textil sobre madera",
                    "Cajas tridimensionales y objetos intervenidos",
                    "Retrato al óleo y dibujo a grafito/pastel",
                ],
                "pricing_policy": "Presupuesto cerrado previo por escrito sin compromiso",
                "turnaround": "2 a 4 semanas según secado de materiales y fijación de mica mineral",
                "delivery": "Entrega en mano en Bilbao y Bizkaia o envío asegurado nacional e internacional",
            },
        },
        "artworks_count": len(projects),
        "reviewed": catalogue["reviewed"],
        "artworks": [
            {
                "slug": p["slug"],
                "title": p["title"],
                "category": p["category"],
                "series": p.get("series"),
                "technique": p.get("technique"),
                "support": p.get("support"),
                "dimensions": p.get("dimensions"),
                "materials": p.get("materials"),
                "year": p.get("year"),
                "story": p["story"],
                "url": ORIGIN + "/obra/" + p["slug"] + "/",
                "cover_url": ORIGIN + p["cover"],
                "photos": [
                    {
                        "url": ORIGIN + ph["original"],
                        "width": ph.get("width"),
                        "height": ph.get("height"),
                        "caption": ph.get("caption") or p["title"],
                        "sha256": sha_by_src.get(ph["original"]),
                    }
                    for ph in p["photos"]
                ],
                "inquire_email": f"mailto:naroa@naroa.eu?subject={quote('Consulta sobre '+p['title'])}",
                "inquire_whatsapp": f"https://wa.me/34636060609?text={quote('Hola Naroa, me gustaría consultar sobre la obra ' + p['title'])}",
            }
            for p in projects
        ],
    }
    write(output / "api" / "catalog.json", json.dumps(catalog_api, ensure_ascii=False, indent=2) + "\n")

    llms_txt = (
        "# Naroa Gutiérrez Gil · Artista Plástica y Retratista (Bilbao)\n\n"
        "> Catálogo oficial de obra plástica, servicio de retratos personalizados por encargo y archivo de exposiciones.\n\n"
        "## Resumen del Sitio\n"
        f"- Dominio Canónico: {ORIGIN}\n"
        "- Ubicación del Estudio: Bilbao, Bizkaia, España (43.2630 N, -2.9350 W)\n"
        "- Contacto Directo: naroa@naroa.eu | WhatsApp: +34 636 060 609\n"
        "- Especialidad: Retratos de autor sobre pizarra natural, técnica mixta con escamas de mica mineral, collage textil sobre madera y objetos intervenidos.\n\n"
        "## Secciones Principales\n"
        f"- [Inicio e Inmersión]({ORIGIN}/): Experiencia inmersiva y catálogo de {len(projects)} obras.\n"
        f"- [Retratos por Encargo en Bilbao]({ORIGIN}/retratos-por-encargo-bilbao/): Condiciones técnicas, formatos (20×30 cm a 40×50 cm), plazos de 2 a 4 semanas, presupuesto cerrado y galería de ejemplos reales.\n"
        f"- [Catálogo Completo]({ORIGIN}/obra/): Ficha detallada de las {len(projects)} piezas de la colección con fotografías de detalle y relato.\n"
        f"- [Serie Vaivenes]({ORIGIN}/series/vaivenes/): Retratos en técnica mixta, collage textil y objetos de memoria.\n"
        f"- [Sobre Mí]({ORIGIN}/sobre-mi/): Biografía, técnica, proceso creativo y proyectos comunitarios (Walking Gallery Bilbao, El ReCreo).\n"
        f"- [Trayectoria]({ORIGIN}/trayectoria/): Archivo cronológico de exposiciones documentadas desde 2010 (DEIA, GARA, Politena, Dock Bilbao).\n"
        f"- [Cuaderno]({ORIGIN}/cuaderno/): Relatos de proceso, vivencias del taller y artículos de prensa.\n"
        f"- [Contacto]({ORIGIN}/contacto/): Canales directos de consulta para obra y encargos.\n\n"
        "## Recursos Machine-to-Machine y GEO\n"
        f"- [Catálogo JSON Estructurado]({ORIGIN}/api/catalog.json): Endpoint con especificaciones completas de las {len(projects)} obras.\n"
        f"- [Índice Extendido llms-full.txt]({ORIGIN}/llms-full.txt): Desglose exhaustivo de todas las piezas y condiciones de encargo.\n"
    )
    write(output / "llms.txt", llms_txt)
    write(REPO / "public" / "llms.txt", llms_txt)

    artworks_md = "\n".join(
        f"### {p['title']} ({p.get('year', 's/f')})\n"
        f"- **URL Canónica:** {ORIGIN}/obra/{p['slug']}/\n"
        f"- **Técnica:** {p.get('technique', 'Técnica mixta')}\n"
        f"- **Soporte:** {p.get('support', 'Soporte rígido')}\n"
        f"- **Medidas:** {p.get('dimensions', 'Medidas variables')}\n"
        f"- **Materiales:** {p.get('materials', 'Acrílico, mica y pigmentos')}\n"
        f"- **Serie:** {p.get('series') or 'Colección general'}\n"
        f"- **Relato:** {p['story']}\n"
        f"- **Contacto Obra:** mailto:naroa@naroa.eu?subject={quote('Consulta sobre '+p['title'])}\n"
        for p in projects
    )
    llms_full_txt = (
        f"{llms_txt}\n"
        f"## Catálogo Exhaustivo de Obras ({len(projects)} Piezas Documentadas)\n\n"
        f"{artworks_md}\n\n"
        "## Condiciones del Servicio de Encargos en Bilbao\n\n"
        "- **Soportes:** Pizarra natural de cantera con contorno irregular, madera noble, collage textil sobre tela vaquera o papel de algodón, y cajas tridimensionales.\n"
        "- **Formatos habituales:** Pizarra de 20×30 cm a 40×50 cm; piezas especiales adaptadas al espacio.\n"
        "- **Técnicas:** Acrílico, óleo, grafito, pastel Conté, rotuladores acrílicos, escamas de mica mineral y ensamblaje de objetos.\n"
        "- **Plazos:** 2 a 4 semanas según complejidad y secado de capas de óleo/barniz.\n"
        "- **Presupuesto:** Presupuesto cerrado por escrito antes de comenzar, sin compromiso previo.\n"
        "- **Entrega:** En mano en Bilbao y comarca de Bizkaia; envíos asegurados a nivel nacional e internacional.\n"
    )
    write(output / "llms-full.txt", llms_full_txt)
    write(REPO / "public" / "llms-full.txt", llms_full_txt)

    headers_content = (
        "/*\n"
        "  X-Frame-Options: DENY\n"
        "  X-Content-Type-Options: nosniff\n"
        "  Referrer-Policy: strict-origin-when-cross-origin\n"
        "  Permissions-Policy: camera=(), microphone=(), geolocation=()\n"
        "  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\n"
        "  Cache-Control: public, max-age=0, must-revalidate\n"
        "/api/*\n"
        "  Content-Type: application/json; charset=utf-8\n"
        "  Access-Control-Allow-Origin: *\n"
        "  Cache-Control: public, max-age=3600, stale-while-revalidate=86400\n"
        "/llms.txt\n"
        "  Content-Type: text/markdown; charset=utf-8\n"
        "  Cache-Control: public, max-age=3600, stale-while-revalidate=86400\n"
        "/llms-full.txt\n"
        "  Content-Type: text/markdown; charset=utf-8\n"
        "  Cache-Control: public, max-age=3600, stale-while-revalidate=86400\n"
        "/immersive/*\n"
        "  Cache-Control: public, max-age=31536000, immutable\n"
    )
    write(output / "_headers", headers_content)
    write(output / "_redirects", ''.join(f'{src.rstrip("/")} {dest} 301\n' for src, dest in aliases.items()) + '/landing-bilbao /retratos-por-encargo-bilbao/ 301\n')
    write(output / "immersive" / "build-manifest.json", json.dumps({"reviewed": catalogue["reviewed"], "projects": len(projects), "canonical_routes": [p[0] for p in pages], "media_files": len(jobs), "originals": len(originals), "assets": assets}, ensure_ascii=False, indent=2) + '\n')
    print(f'Built {len(projects)} artworks, {len(pages)} canonical routes, {len(jobs)} optimized images → {output}')


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=REPO / ".deploy")
    args = parser.parse_args()
    build(args.output.resolve())
