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
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import format_datetime
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

    def derivative(src, limit=1800, thumb=False, quality=None):
        source = SOURCE / src.lstrip("/")
        if not source.is_file():
            raise FileNotFoundError(f"Reviewed image missing: {src}")
        digest = hashlib.sha256(source.read_bytes()).hexdigest()[:12]
        variant = "thumb" if thumb else "view" if limit == 1800 else f"view-{limit}"
        name = f"{source.stem}-{digest}-{variant}.webp"
        dest = media / name
        q = quality if quality is not None else (72 if thumb else 88)
        jobs[dest] = (source, limit, q)
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
        projects.append({"slug": p["slug"], "title": p["title"], "category": p["category"], "label": LABELS[p["category"]], "story": p["story"], "technique": p["technique"], "support": p["support"], "dimensions": p["dimensions"], "materials": p.get("materials"), "interaction": p.get("interaction"), "year": p["year"], "series": "Vaivenes" if p["slug"] in series_slugs else p["series"], "credit": p["credit"], "source": p["source"], "video": p.get("video"), "kind": p["kind"], "cover": photographs[cover_index]["src"], "thumb": derivative(p["images"][0]["src"], 480, True), "photos": photographs, "stage": "obra"})
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
    portrait = derivative("/images/sobre-mi/naroa-monoculo.jpg", 3468, quality=94)
    portrait_wink = derivative("/images/sobre-mi/naroa-monoculo-guino.png", 3468, quality=94)
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

    for icon_name in ("naroa-icon-180-v1.png", "naroa-icon-64-v1.png", "naroa-icon-32-v1.png"):
        icon_src = SOURCE / "assets" / icon_name
        if icon_src.exists():
            dest_asset = output / "assets" / icon_name
            dest_asset.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(icon_src, dest_asset)
    apple_touch_src = SOURCE / "assets" / "naroa-icon-180-v1.png"
    if apple_touch_src.exists():
        shutil.copy2(apple_touch_src, output / "apple-touch-icon.png")

    manifest_data = {
        "name": "Naroa Gutiérrez Gil · Arte y Retratos",
        "short_name": "Naroa",
        "description": "Catálogo de obra plástica y servicio de retratos personalizados en Bilbao por Naroa Gutiérrez Gil.",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "background_color": "#11120f",
        "theme_color": "#11120f",
        "icons": [
            {
                "src": "/assets/naroa-icon-180-v1.png",
                "sizes": "180x180",
                "type": "image/png",
                "purpose": "any maskable"
            },
            {
                "src": "/assets/naroa-icon-64-v1.png",
                "sizes": "64x64",
                "type": "image/png"
            },
            {
                "src": "/assets/naroa-icon-32-v1.png",
                "sizes": "32x32",
                "type": "image/png"
            },
            {
                "src": "/favicon.svg",
                "sizes": "any",
                "type": "image/svg+xml"
            }
        ]
    }
    manifest_json = json.dumps(manifest_data, ensure_ascii=False, indent=2) + "\n"
    write(output / "manifest.webmanifest", manifest_json)
    write(REPO / "public" / "manifest.webmanifest", manifest_json)

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
            ("/obra/", "Obras", f"{len(projects)} retratos · Un viaje", amy["thumb"], "Amy Rocks", "Otra manera de mirar.", f"Pizarra, collage y objetos · {len(projects)} obras", False, obras_reel),
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
        return f'''<dialog id="menu-dialog" class="menu-dialog" aria-labelledby="menu-heading"><div class="dialog-top menu-top"><a class="signature" href="/" aria-label="Naroa Gutiérrez Gil, inicio"><span>Naroa</span><small>GUTIÉRREZ GIL</small></a><span id="menu-heading">Otra manera de mirar</span><button type="button" data-close-dialog autofocus>Cerrar <span aria-hidden="true">×</span></button></div><div class="menu-layout"><figure class="menu-preview"><div class="menu-preview-picture" data-menu-picture><img data-menu-image alt="Amy Rocks" aria-hidden="true" width="480" height="360"><img data-menu-image alt="Amy Rocks" aria-hidden="true" width="480" height="360"><img class="menu-preview-wink" data-menu-wink src="{menu_portrait_wink}" alt="Guiño de Naroa Gutiérrez Gil" aria-hidden="true" width="480" height="360"><div class="menu-preview-loupe" data-menu-loupe aria-hidden="true"></div><span class="menu-preview-hand" data-menu-quote aria-hidden="true">Otra manera de mirar.</span><div class="menu-preview-reel" data-menu-reel hidden aria-hidden="true"></div></div><figcaption class="menu-preview-caption"><div class="menu-caption-main"><span data-menu-preview-label>Obras</span><span data-menu-preview-title>Amy Rocks</span></div><div class="menu-caption-sub"><span class="menu-preview-meta" data-menu-preview-meta>Pizarra, collage y objetos · {len(projects)} obras</span><button type="button" class="menu-index-pill" data-menu-open-index title="Abrir catálogo completo (atajo: / o I)"><span>Índice</span><span aria-hidden="true">⌕</span><kbd aria-hidden="true">/</kbd></button></div></figcaption></figure><nav class="menu-pages" aria-label="Todas las páginas">{links()}</nav></div><div class="menu-foot"><span>Desde Bilbao, con otra mirada.</span><a href="mailto:naroa@naroa.eu">naroa@naroa.eu ↗</a><a href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://instagram.com/naroa_art/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="/immersive/audio/creditos.txt">Créditos del sonido ↗</a></div></dialog>
<dialog id="index-dialog" class="index-dialog" aria-labelledby="index-heading"><div class="dialog-top"><h2 id="index-heading">La obra</h2><button type="button" data-close-dialog>Cerrar ×</button></div><div class="index-controls"><label for="art-search">Buscar obra<input type="search" id="art-search" placeholder="Título, material o retratado…" autocomplete="off"></label><div class="index-filters" role="group" aria-label="Filtrar obras"><button type="button" data-filter="all" aria-pressed="true">Todas</button><button type="button" data-filter="pizarra" aria-pressed="false">Pizarra</button><button type="button" data-filter="collage" aria-pressed="false">Collage</button><button type="button" data-filter="objetos" aria-pressed="false">Objetos</button><button type="button" data-filter="caracterizacion" aria-pressed="false">Caracterización</button><button type="button" data-filter="Vaivenes" aria-pressed="false">Vaivenes</button></div></div><p class="index-count" role="status" aria-live="polite">{len(projects)} proyectos</p><div class="index-list">{index}</div><p class="index-empty" hidden>No hay obras que coincidan con esta búsqueda. <button type="button" data-reset-index>Ver todas</button></p></dialog>'''

    def footer():
        return '''<footer class="site-footer"><a class="signature" href="/">Naroa</a><a href="mailto:naroa@naroa.eu">naroa@naroa.eu ↗</a><a href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://instagram.com/naroa_art/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="/contacto/">¿Hablamos? ↗</a><span>Bilbao · © 2026</span></footer>'''

    pages = []

    artist_same_as = [
        "https://www.facebook.com/naroa.artista.plastica",
        "https://instagram.com/naroa_art/",
        "https://naroagutierrez.wordpress.com/",
        "https://www.deia.eus/bizkaia/vida-social/2026/06/05/bwall-collective-inaugura-exposicion-ocho-11159371.html",
        "https://gara.naiz.eus/paperezkoa/20100305/186538/eu/Agenda",
        "https://agenda.elcorreo.com/evento/naroa-gutierrez-gil-espejos-del-alma-476343.html",
        "https://www.youtube.com/@naroagutierrezgil",
    ]
    bilbao_place = {
        "@type": "Place",
        "@id": ORIGIN + "/#studio",
        "name": "Estudio Naroa Gutiérrez Gil · Bilbao",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Bilbao, Bizkaia",
            "addressLocality": "Bilbao",
            "addressRegion": "Bizkaia",
            "postalCode": "48001",
            "addressCountry": "ES",
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": 43.2630,
            "longitude": -2.9350,
        },
        "hasMap": "https://www.google.com/maps?q=Bilbao,+Bizkaia",
    }
    canonical_artist_entity = {
        "@type": "Person",
        "@id": ORIGIN + "/#artist",
        "name": "Naroa Gutiérrez Gil",
        "jobTitle": "Artista plástica y retratista",
        "url": ORIGIN + "/",
        "image": ORIGIN + "/images/sobre-mi/naroa-monoculo.jpg",
        "email": "naroa@naroa.eu",
        "telephone": "+34636060609",
        "sameAs": artist_same_as,
        "homeLocation": bilbao_place,
        "workLocation": bilbao_place,
        "gender": "Female",
        "nationality": {
            "@type": "Country",
            "name": "España",
            "sameAs": "https://es.wikipedia.org/wiki/Espa%C3%B1a",
        },
        "description": "Artista plástica y retratista en Bilbao y Bizkaia. Obra figurativa y retrato de autor en dibujo, pintura, collage contemporáneo, madera y objetos intervenidos, con exploraciones recientes sobre pizarra natural.",
        "knowsAbout": [
            "Retratos artísticos personalizados",
            "Retrato al óleo, grafito y pastel Conté",
            "Collage contemporáneo y textil sobre madera",
            "Cajas tridimensionales y objetos de memoria",
            "Arte figurativo contemporáneo",
            "Walking Gallery Bilbao",
            "Pintura y técnica mixta sobre pizarra natural",
        ],
    }
    artist_ref = {
        "@type": "Person",
        "@id": ORIGIN + "/#artist",
        "name": "Naroa Gutiérrez Gil",
        "jobTitle": "Artista plástica y retratista",
        "url": ORIGIN + "/",
        "sameAs": artist_same_as,
    }

    webmcp_manifest = {
        "$schema": "https://modelcontextprotocol.io/schema/2024-11-05/server.json",
        "name": "naroa-online-webmcp",
        "version": "1.3.0",
        "description": "Servidor WebMCP oficial de Naroa Gutiérrez Gil: catálogo de obras de arte, Evidence Graph, perfiles canónicos de creador y orquestación de consultas de encargos en Bilbao.",
        "homepage": ORIGIN,
        "author": {
            "name": "Naroa Gutiérrez Gil",
            "url": ORIGIN + "/",
            "email": "naroa@naroa.eu",
            "telephone": "+34636060609",
            "sameAs": artist_same_as,
        },
        "publisher": {
            "name": "Naroa Gutiérrez Gil",
            "url": ORIGIN + "/",
            "sameAs": artist_same_as,
        },
        "canonicalLocations": {
            "studio": {
                "name": "Estudio Naroa Gutiérrez Gil · Bilbao",
                "locality": "Bilbao",
                "region": "Bizkaia",
                "postalCode": "48001",
                "country": "ES",
                "geo": {"latitude": 43.2630, "longitude": -2.9350},
                "mapUrl": "https://www.google.com/maps?q=Bilbao,+Bizkaia",
            }
        },
        "capabilities": {
            "tools": {
                "listChanged": False,
            },
            "resources": {
                "subscribe": False,
                "listChanged": False,
            },
        },
        "endpoints": {
            "catalog_api": f"{ORIGIN}/api/catalog.json",
            "rss_feed": f"{ORIGIN}/feed.xml",
            "llms_index": f"{ORIGIN}/llms.txt",
            "llms_full": f"{ORIGIN}/llms-full.txt",
        },
        "resources": [
            {
                "uri": f"{ORIGIN}/api/catalog.json",
                "name": "Catálogo Estructurado Completo",
                "description": "Especificaciones técnicas, descripciones y Evidence Graph de las obras.",
                "mimeType": "application/json",
            },
            {
                "uri": f"{ORIGIN}/feed.xml",
                "name": "Feed RSS de Publicaciones y Obras",
                "description": "Feed RSS 2.0 sindicado con novedades del estudio.",
                "mimeType": "application/rss+xml",
            },
            {
                "uri": f"{ORIGIN}/llms.txt",
                "name": "Índice Factual LLMs",
                "description": "Evidence Graph condensado y respuestas directas para agentes.",
                "mimeType": "text/plain",
            },
        ],
        "tools": [
            {
                "name": "search_catalogue",
                "description": "Busca obras en el catálogo de Naroa Gutiérrez Gil filtrando por término clave, técnica o serie.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Palabra clave a buscar en título, materiales, soporte o relato de la obra.",
                        },
                        "category": {
                            "type": "string",
                            "enum": ["all", "pizarra", "collage", "objetos", "caracterizacion", "Vaivenes"],
                            "description": "Categoría o serie plástica.",
                        },
                    },
                },
            },
            {
                "name": "get_artwork_details",
                "description": "Obtiene la ficha técnica verificada completa de una obra concreta por su slug canónico.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "slug": {
                            "type": "string",
                            "description": "Slug canónico de la obra (ej. 'amy-rocks', 'el-gran-dakari', 'amor-en-conserva').",
                        },
                    },
                    "required": ["slug"],
                },
            },
            {
                "name": "configure_commission_inquiry",
                "description": "Valida las opciones para encargar un retrato personalizado y devuelve los enlaces directos en O(1) para WhatsApp y correo electrónico.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "support": {
                            "type": "string",
                            "enum": [
                                "Pizarra natural rústica",
                                "Collage textil sobre madera",
                                "Caja personalizada u objeto",
                                "Retrato al óleo o grafito",
                                "Asesoramiento en estudio",
                            ],
                            "description": "Soporte plástico preferido para el retrato.",
                        },
                        "motif": {
                            "type": "string",
                            "enum": [
                                "Retrato individual",
                                "Pareja o familia",
                                "Mascota",
                                "Homenaje o recuerdo",
                            ],
                            "description": "Motivo del retrato.",
                        },
                        "timing": {
                            "type": "string",
                            "enum": [
                                "Sin prisa (2 a 4 semanas)",
                                "Fecha señalada próxima",
                            ],
                            "description": "Plazo estimado de entrega deseado.",
                        },
                    },
                    "required": ["support", "motif"],
                },
            },
            {
                "name": "answer_commission_faq",
                "description": "Resuelve en O(1) las subconsultas del grafo Query Fan-Out sobre encargos de retratos (precios, plazos, fotos, soportes, entregas y comparativas).",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "topic": {
                            "type": "string",
                            "enum": ["precios", "plazos", "fotos", "soportes", "envios", "todos"],
                            "description": "Dimensión factual a consultar en el Evidence Graph.",
                        }
                    },
                },
            },
            {
                "name": "get_artist_profile",
                "description": "Devuelve la información de biografía verificada, exposiciones históricas y canales directos de contacto.",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                },
            },
        ],
    }

    def page(path, title, description, body, image, gallery=False, schema=None, not_found=False, image_alt=None):
        canonical = ORIGIN + path
        im_w, im_h, im_mime = image_info(image)
        im_alt = image_alt or f"{title} · Naroa Gutiérrez Gil"
        structured = dict(schema or {"@context": "https://schema.org", "@type": "WebPage", "name": title, "url": canonical, "description": description})
        structured.setdefault("inLanguage", "es-ES")
        structured.setdefault("dateModified", catalogue["reviewed"])
        if not not_found:
            primary_img = {
                "@type": "ImageObject",
                "contentUrl": f"{ORIGIN}{image}",
                "width": im_w,
                "height": im_h,
                "encodingFormat": im_mime,
                "caption": im_alt,
            }
            structured.setdefault("primaryImageOfPage", primary_img)
            if "@graph" in structured and len(structured["@graph"]) > 0:
                structured["@graph"][0].setdefault("primaryImageOfPage", primary_img)
                structured["@graph"][0].setdefault("inLanguage", "es-ES")
                structured["@graph"][0].setdefault("dateModified", catalogue["reviewed"])
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
        html = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{esc(title)} · Naroa Gutiérrez Gil</title><meta name="description" content="{esc(description)}"><meta name="robots" content="index, follow, max-image-preview:large"><meta name="theme-color" content="#11120f"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Naroa"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/assets/naroa-icon-180-v1.png"><link rel="alternate" type="application/rss+xml" title="Naroa Gutiérrez Gil · Obras y Cuaderno" href="{ORIGIN}/feed.xml"><link rel="mcp" type="application/json" href="{ORIGIN}/.well-known/mcp.json" title="WebMCP Model Context Protocol"><link rel="canonical" href="{canonical}"><meta property="og:site_name" content="Naroa Gutiérrez Gil"><meta property="og:locale" content="es_ES"><meta property="og:title" content="{esc(title)} · Naroa Gutiérrez Gil"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{canonical}"><meta property="og:type" content="{'article' if gallery else 'website'}"><meta property="og:image" content="{ORIGIN}{image}"><meta property="og:image:secure_url" content="{ORIGIN}{image}"><meta property="og:image:width" content="{im_w}"><meta property="og:image:height" content="{im_h}"><meta property="og:image:type" content="{im_mime}"><meta property="og:image:alt" content="{esc(im_alt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(title)} · Naroa Gutiérrez Gil"><meta name="twitter:description" content="{esc(description)}"><meta name="twitter:image" content="{ORIGIN}{image}"><meta name="twitter:image:alt" content="{esc(im_alt)}"><link rel="icon" href="{favicon_path}" type="image/svg+xml" sizes="any"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"><link rel="stylesheet" href="{assets['app.css']}"><script type="application/ld+json" id="page-schema">{data_json(structured)}</script>{breadcrumb_tag}<script type="application/vnd.mcp+json" id="webmcp-schema">{data_json(webmcp_manifest)}</script><script defer src="{catalog_path}"></script><script defer src="{assets['soundscape.js']}"></script><script defer src="{assets['journey.js']}"></script><script defer src="{assets['app.js']}"></script></head><body class="{'gallery-page' if gallery else 'editorial-page'}"><a class="skip-link" href="#main">Ir al contenido</a>{header(gallery)}{body}{'' if gallery else footer()}{dialogs()}</body></html>'''
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
        threshold_html = ""
        if path == "/" and initial == 0:
            threshold_html = f'''<div class="hero-threshold" data-hero-threshold data-threshold-enter aria-hidden="true"><div class="hero-threshold-plane" data-threshold-plane><img class="hero-threshold-portrait" src="{portrait}" srcset="{menu_portrait} 900w, {portrait} 2201w" sizes="100vw" width="2201" height="3468" alt="Naroa Gutiérrez Gil con chistera y monóculo en el umbral del estudio" fetchpriority="high" decoding="sync"><img class="hero-threshold-wink" data-threshold-wink src="{portrait_wink}" srcset="{menu_portrait_wink} 900w, {portrait_wink} 2201w" sizes="100vw" width="2201" height="3468" alt="Guiño de bienvenida de Naroa Gutiérrez Gil" decoding="async"></div><div class="hero-threshold-shade"></div></div>'''
        body = f'''<main id="main" class="art-scroll" style="--steps:{len(selected)-1}"><section class="art-stage" data-gallery data-initial="{initial}" data-subset="{subset}"><div class="art-layers">{stages}</div>{threshold_html}<div class="art-shade" aria-hidden="true"></div><div class="kinetic-title" data-kinetic-title aria-hidden="true"></div><nav class="art-index" aria-label="Recorrido de obras">{nav}</nav><div class="art-bottom"><div><div data-art-copy aria-live="polite"><p class="art-counter"><span data-counter>{initial+1:02d} / {len(selected):02d}</span><small data-journey-cue>Desplázate para recorrer ↕</small></p><h1 data-art-title>{esc(p['title'])}</h1><p class="art-material" data-art-material>{esc(p['label'])}</p></div><button type="button" class="art-story-link" data-open-story>Sobre esta obra <span aria-hidden="true">+</span></button></div><div class="art-controls"><div class="art-view-actions"><button type="button" data-effects aria-pressed="false">Activar efectos</button><button type="button" data-fit aria-pressed="false">Ver imagen completa ↗</button><button type="button" data-open-photos>Otras miradas ↗</button><button type="button" class="ouroboros-loop-btn" data-ouroboros hidden aria-label="Volver al origen de la exposición">Volver al origen ↺</button></div><div class="art-arrows"><button type="button" data-prev aria-label="Obra anterior"{' disabled' if initial==0 else ''}>←</button><button type="button" data-next aria-label="Obra siguiente"{' disabled' if initial==len(selected)-1 else ''}>→</button></div></div></div><button type="button" class="restore-ui" data-restore hidden>Volver a la navegación ↙</button><div class="art-progress" aria-hidden="true"><span></span></div></section></main>
<dialog id="story-dialog" class="story-dialog" aria-labelledby="story-title"><div class="dialog-top"><span data-story-category>{esc(p['label'])}</span><button type="button" data-close-dialog>Cerrar ×</button></div><div class="story-body"><h2 id="story-title">{esc(p['title'])}</h2><p data-story>{esc(p['story'])}</p><dl data-facts>{facts_html}</dl><p class="art-credit" data-credit>{esc(p['credit'] or '')}</p><div class="story-actions"><a class="text-link" data-art-email href="mailto:naroa@naroa.eu?subject={quote('Consulta sobre '+p['title'])}">Consultar por email ↗</a><a class="text-link" data-art-whatsapp href="https://wa.me/34636060609?text={quote('Hola Naroa, me gustaría consultar sobre la obra ' + p['title'])}" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp ↗</a><button type="button" class="text-link" data-share-link>Compartir enlace directo ↗</button></div><a class="source-link" data-art-video{' hidden' if not p.get('video') else ''} href="{esc(p.get('video') or '')}" target="_blank" rel="noopener noreferrer">Ver proceso en YouTube ↗</a><a class="source-link" data-art-source{' hidden' if not p['source'] else ''} href="{esc(p['source'] or '')}" target="_blank" rel="noopener noreferrer">Ver publicación de la artista ↗</a></div><a class="story-footer" href="/retratos-por-encargo-bilbao/">Tu propio retrato empieza aquí ↗</a></dialog>
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
                "creator": artist_ref,
                "author": artist_ref,
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
            "creator": canonical_artist_entity,
            "author": artist_ref,
            "isPartOf": {
                "@type": "CollectionPage",
                "@id": ORIGIN + "/obra/#catalogue",
                "name": "Catálogo completo de obras de Naroa Gutiérrez Gil",
                "url": ORIGIN + "/obra/",
            },
            "locationCreated": bilbao_place,
            "artMedium": p.get("technique"),
            "artworkSurface": p.get("support"),
            "material": p.get("materials"),
            "artform": "VisualArtwork",
            "offers": {
                "@type": "Offer",
                "@id": ORIGIN + "/obra/" + p["slug"] + "/#offer",
                "availability": "https://schema.org/InStock",
                "priceCurrency": "EUR",
                "url": ORIGIN + "/obra/" + p["slug"] + "/",
                "description": "Obra original de catálogo y encargos personalizados basados en esta técnica. Consulta directa con la artista.",
                "seller": artist_ref,
                "itemOffered": ORIGIN + "/obra/" + p["slug"] + "/#artwork",
            },
        }
        if p.get("series") == "Vaivenes":
            default_schema["partOfSeries"] = {
                "@type": "CreativeWorkSeries",
                "@id": ORIGIN + "/series/vaivenes/#series",
                "name": "Serie Vaivenes",
                "url": ORIGIN + "/series/vaivenes/",
            }
        if p.get("source"):
            default_schema["isBasedOn"] = p["source"]
        if p.get("video"):
            default_schema["video"] = {
                "@type": "VideoObject",
                "name": f"Proceso creativo de {p['title']}",
                "description": p["story"],
                "contentUrl": p["video"],
                "url": p["video"],
                "thumbnailUrl": ORIGIN + p["photos"][0]["original"],
            }
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
        "description": f"Obra de Naroa Gutiérrez Gil, artista plástica y retratista en Bilbao y Bizkaia. {len(projects)} retratos en dibujo, pintura, collage, objetos intervenidos y pizarra.",
        "publisher": canonical_artist_entity,
        "creator": canonical_artist_entity,
        "author": artist_ref,
        "mainEntity": {
            "@type": "Person",
            "@id": ORIGIN + "/#artist",
        },
    }
    catalogue_schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": ORIGIN + "/obra/#catalogue",
        "name": f"Obra · {len(projects)} retratos, collage y objetos · Naroa Gutiérrez Gil",
        "url": ORIGIN + "/obra/",
        "description": f"Catálogo completo de {len(projects)} obras y retratos de Naroa Gutiérrez Gil: dibujo, pintura, collage, objetos intervenidos y pizarra.",
        "creator": canonical_artist_entity,
        "author": artist_ref,
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
                        "@id": ORIGIN + "/obra/" + p["slug"] + "/#artwork",
                        "name": p["title"],
                        "url": ORIGIN + "/obra/" + p["slug"] + "/",
                        "image": ORIGIN + p["photos"][0]["original"],
                        "artMedium": p.get("technique"),
                        "artworkSurface": p.get("support"),
                        "creator": artist_ref,
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
        "@id": ORIGIN + "/series/vaivenes/#series",
        "name": "Serie Vaivenes · Dibujo, materia y transformación · Naroa Gutiérrez Gil",
        "url": ORIGIN + "/series/vaivenes/",
        "description": "Serie Vaivenes de Naroa Gutiérrez Gil: retratos y piezas donde el collage, el dibujo y los materiales reutilizados exploran emociones y contrastes.",
        "creator": canonical_artist_entity,
        "author": artist_ref,
        "isPartOf": {
            "@type": "CollectionPage",
            "@id": ORIGIN + "/obra/#catalogue",
            "name": "Catálogo completo de obras de Naroa Gutiérrez Gil",
            "url": ORIGIN + "/obra/",
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
    gallery("/", 0, title="Retratista en Bilbao y Bizkaia · Retratos, collage y objetos", description=f"Obra de Naroa Gutiérrez Gil, artista plástica y retratista en Bilbao y Bizkaia. {len(projects)} retratos en dibujo, pintura, collage, objetos intervenidos y pizarra.", schema=home_schema)
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
<mask id="portrait-wink-mask" maskUnits="userSpaceOnUse" x="664" y="736" width="190" height="132"><ellipse cx="759" cy="802" rx="89" ry="62" fill="url(#portrait-wink-feather)"/></mask></defs>
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
    about_schema = {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "@id": ORIGIN + "/sobre-mi/#profile",
        "name": "Sobre mí · Artista plástica y retratista en Bilbao y Bizkaia",
        "url": ORIGIN + "/sobre-mi/",
        "mainEntity": canonical_artist_entity,
    }
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
            "organizer": artist_ref,
            "performer": artist_ref,
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
        "@id": ORIGIN + "/trayectoria/#career",
        "name": "Trayectoria documentada · Naroa Gutiérrez Gil",
        "url": ORIGIN + "/trayectoria/",
        "description": "Exposiciones, encuentros y espacios compartidos de Naroa Gutiérrez Gil en Bilbao y Bizkaia.",
        "creator": artist_ref,
        "about": canonical_artist_entity,
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
        "@id": ORIGIN + "/cuaderno/#blog",
        "name": "El cuaderno de Naroa",
        "url": ORIGIN + "/cuaderno/",
        "description": "Historias de obras, procesos y encuentros. El cuaderno de la artista Naroa Gutiérrez Gil.",
        "author": canonical_artist_entity,
        "publisher": artist_ref,
        "blogPost": [
            {
                "@type": "BlogPosting",
                "headline": post["title"],
                "url": post["url"],
                "datePublished": post["date"],
                "description": post["summary"],
                "author": artist_ref,
                "publisher": artist_ref,
            }
            for post in posts
        ],
    }
    page("/cuaderno/", "Cuaderno", "Historias de obras, procesos y encuentros. El cuaderno de la artista Naroa Gutiérrez Gil.", '<main id="main">' + notebook + '</main>', rara["photos"][0]["original"], schema=blog_schema)

    commission_examples = [
        (jaio, "Dibujo, textil y collage", "Retrato sobre tela vaquera o papel intervenido con costuras, botones y capas."),
        (amor, "Objetos con historia", "Cajas de madera, latas o soportes cotidianos transformados en piezas tridimensionales."),
        (amy, "Retrato sobre pizarra", "Acrílico, lápices, rotuladores y mica sobre el contorno natural de la piedra."),
    ]
    commission_faqs = [
        ("¿Cómo encargar un retrato personalizado a partir de fotografías?", "Puedes enviar una o varias fotografías de referencia (incluso tomadas con el móvil) para estudiar la pose, la iluminación y el carácter. Naroa no realiza una reproducción fotomecánica, sino una reinterpretación artística de autor que integra la personalidad, anécdotas y memoria de quien recibe la obra."),
        ("¿Cuánto cuesta un retrato personalizado por encargo?", "El presupuesto se calcula con total transparencia según la técnica, el soporte y las dimensiones: obras en dibujo, óleo y collage sobre madera o tela, cajas de recuerdos tridimensionales o exploraciones recientes en pizarra natural (medidas habituales de 20 × 30 cm a 40 × 50 cm). Siempre se elabora una propuesta formal con presupuesto cerrado y por escrito antes de comenzar, sin compromiso previo."),
        ("¿Cuáles son los plazos de entrega en Bilbao y mediante envío?", "El plazo habitual de ejecución se sitúa entre 2 y 4 semanas, condicionado por la complejidad de la composición y los tiempos de secado de óleos, acrílicos y barnices. Para fechas señaladas (aniversarios, bodas, homenajes) es posible concertar plazos prioritarios con aviso previo. La entrega se realiza en mano en Bilbao y Bizkaia, o mediante envío protegido y asegurado a cualquier destino."),
        ("¿Qué técnicas y soportes se pueden elegir para el encargo?", "Se puede elegir entre dibujo a grafito o pastel combinado con collage textil sobre madera noble, pintura al óleo o acrílico, cajas y objetos cotidianos transformados en piezas de memoria personal, o soportes minerales explorados recientemente como la pizarra natural con detalles de mica."),
    ]
    examples_html = ''.join(f'''<article class="commission-example"><a class="commission-example-photo" href="/obra/{ex['slug']}/"><img src="{ex['cover']}" width="{ex['photos'][0]['width']}" height="{ex['photos'][0]['height']}" alt="{esc(work_alt(ex))}" loading="lazy" decoding="async"></a><div class="commission-example-copy"><p class="eyebrow">{esc(kind_label)}</p><h3><a href="/obra/{ex['slug']}/">{esc(ex['title'])} ↗</a></h3><p>{esc(note)}</p><small>{esc(ex['technique'])} · {esc(ex['support'])}</small></div></article>''' for ex, kind_label, note in commission_examples)
    faq_html = ''.join(f'''<details class="commission-faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>''' for q, a in commission_faqs)
    specs_rows = [
        ("Soportes de autor", "Madera noble intervenida, collage textil sobre tela vaquera o papel de algodón, cajas tridimensionales y exploraciones sobre pizarra natural."),
        ("Formatos habituales", "Composiciones en madera, papel y objetos con medidas adaptadas a cada proyecto (formatos de 20 × 30 cm a 40 × 50 cm y medidas especiales)."),
        ("Técnicas plásticas", "Dibujo a grafito y pastel Conté, óleo, acrílico, collage, ensamblaje de objetos y detalles matéricos o minerales."),
        ("Plazo de ejecución", "Entre 2 y 4 semanas según complejidad y tiempos de secado de materiales (posibilidad de plazos prioritarios para aniversarios o regalos con aviso previo)."),
        ("Presupuesto y reserva", "Propuesta personalizada y presupuesto cerrado por escrito antes de iniciar la obra, sin compromiso previo."),
        ("Entrega y envíos", "Entrega en mano en Bilbao y Bizkaia, o envío protegido y asegurado a cualquier punto de España e internacional."),
    ]
    specs_html = "".join(f"<p><strong>{esc(k)}:</strong> {esc(v)}</p>" for k, v in specs_rows)
    compare_rows = [
        ("Collage textil y dibujo sobre madera", "20 × 30 cm a 40 × 50 cm (medidas adaptables)", "Grafito, pastel Conté, tela vaquera, costuras y madera noble", "2 a 4 semanas", "Custom Jaio · Entre Tantas Flores"),
        ("Cajas tridimensionales y objetos", "Formatos de caja o lata intervenida a medida", "Madera tratada, pintura acrílica, ensamblaje y objetos de memoria", "2 a 4 semanas", "Amor en Conserva · Hugo Box"),
        ("Pizarra natural de cantera", "20 × 30 cm a 40 × 50 cm (contorno rústico irregular)", "Acrílico, lápices, rotuladores, escamas de mica mineral y esmalte", "2 a 3 semanas", "Amy Rocks · Marilyn Rocks"),
        ("Retrato al óleo o grafito clásico", "A partir de 20 × 30 cm sobre tabla o papel de algodón", "Óleo sobre tabla, grafito o carboncillo con fijación protectora", "2 a 4 semanas", "El Gran Dakari · Rara Avis"),
    ]
    compare_tbody = "".join(
        f"<tr><th scope=\"row\">{esc(sup)}</th><td>{esc(dim)}</td><td>{esc(tech)}</td><td>{esc(turn)}</td><td>{esc(ex_ref)}</td></tr>"
        for sup, dim, tech, turn, ex_ref in compare_rows
    )
    compare_table_html = (
        '<div class="commission-compare-wrap">'
        '<table class="commission-compare-table">'
        '<caption>Comparativa técnica de soportes, plazos y obras de referencia</caption>'
        '<thead><tr><th scope="col">Soporte plástico</th><th scope="col">Formatos habituales</th><th scope="col">Técnica y materiales</th><th scope="col">Plazo estimado</th><th scope="col">Ejemplos del archivo</th></tr></thead>'
        f'<tbody>{compare_tbody}</tbody>'
        '</table>'
        '</div>'
    )
    specs_html += compare_table_html
    default_cfg_msg = "Hola Naroa, me gustaría consultar un encargo de retrato sobre Collage textil sobre madera para Retrato individual con plazo Sin prisa (2 a 4 semanas)."
    configurator_html = (
        '<section class="commission-configurator" aria-labelledby="configurator-heading" data-commission-configurator>'
        '<div class="section-opening">'
        '<p class="eyebrow">Configura tu consulta directa</p>'
        '<h2 id="configurator-heading">¿Qué retrato imaginas?</h2>'
        '<p>Elige soporte, motivo y ocasión para preparar un mensaje directo y personalizado a Naroa por WhatsApp o correo electrónico.</p>'
        '</div>'
        '<div class="configurator-grid">'
        '<div class="configurator-field">'
        '<label for="cfg-support">Soporte preferido</label>'
        '<select id="cfg-support" class="configurator-select">'
        '<option value="Collage textil sobre madera">Collage textil y dibujo sobre madera</option>'
        '<option value="Retrato al óleo o grafito">Retrato al óleo, acrílico o grafito</option>'
        '<option value="Caja personalizada u objeto">Caja de memoria tridimensional u objeto</option>'
        '<option value="Pizarra natural rústica">Pizarra natural (exploración reciente)</option>'
        '<option value="Asesoramiento en estudio">Por definir (asesoramiento con Naroa)</option>'
        '</select>'
        '</div>'
        '<div class="configurator-field">'
        '<label for="cfg-motif">Motivo del retrato</label>'
        '<select id="cfg-motif" class="configurator-select">'
        '<option value="Retrato individual">Retrato individual (persona)</option>'
        '<option value="Pareja o familia">Pareja o familia</option>'
        '<option value="Mascota">Mascota (perro, gato u otro animal)</option>'
        '<option value="Homenaje o recuerdo">Homenaje / recuerdo especial</option>'
        '</select>'
        '</div>'
        '<div class="configurator-field">'
        '<label for="cfg-timing">Plazo estimado</label>'
        '<select id="cfg-timing" class="configurator-select">'
        '<option value="Sin prisa (2 a 4 semanas)">Plazo habitual (2 a 4 semanas)</option>'
        '<option value="Fecha señalada próxima">Fecha especial próxima (cumpleaños, aniversario)</option>'
        '</select>'
        '</div>'
        '</div>'
        f'<p id="cfg-preview" class="configurator-preview" aria-live="polite">{esc(default_cfg_msg)}</p>'
        '<div class="configurator-action">'
        f'<a id="cfg-whatsapp-btn" class="commission-cta-btn" href="https://wa.me/34636060609?text={quote(default_cfg_msg)}" target="_blank" rel="noopener noreferrer">'
        '<span>Consultar esta idea por WhatsApp ↗</span>'
        '</a>'
        f'<a id="cfg-email-btn" class="commission-cta-secondary" href="mailto:naroa@naroa.eu?subject={quote("Consulta encargo: Collage textil sobre madera")}&body={quote(default_cfg_msg)}">'
        '<span>Solicitar propuesta por email ↗</span>'
        '</a>'
        '</div>'
        '</section>'
    )
    commissions = hero(amor["cover"], "Retratos personalizados por encargo · Bilbao", "No retrato solo tu cara.<br><span>Retrato tu historia.</span>", "Tu historia convertida en una obra de arte original en dibujo, pintura, collage, madera u objetos con vida propia.", ("/contacto/", "Solicitar un retrato"), alt=work_alt(amor))
    commissions += f'''<article class="editorial" id="contenido"><section class="chapter"><p class="eyebrow">Retrato de autor a partir de tu historia</p><div><h2>Más allá de<br>una fotografía.</h2><p class="lead">Encarga un retrato personalizado en Bilbao con Naroa Gutiérrez Gil a partir de tu historia o fotografías. Obras originales de autor en dibujo, pintura, collage, madera y objetos intervenidos, con presupuesto cerrado previo y entrega local en mano o envío protegido.</p><p>Puedes partir de una fotografía, un recuerdo o un objeto con significado para encargar una pieza hecha a mano y pensada para quien la recibe. Es una práctica de retrato que continúa la exploración iniciada en muestras individuales en Bilbao como <em>Espejos del alma</em> (Colegio de Abogados de Bilbao), valorando en el taller el soporte que mejor cuente esa historia: composiciones de dibujo y tela vaquera, cajas de madera personalizadas o soportes recientes como la pizarra.</p></div></section><section class="commission-examples-section" aria-labelledby="commission-examples-heading"><div class="section-opening"><p class="eyebrow">Soportes reales del catálogo</p><h2 id="commission-examples-heading">Tres maneras de dar<br>forma a un retrato.</h2><p>Cada pieza cuenta con fotografías de conjunto, ángulo y detalle real del soporte en el archivo de Naroa.</p></div><div class="commission-examples">{examples_html}</div></section><section class="chapter" aria-labelledby="commission-specs-heading"><p class="eyebrow">Ficha técnica de encargos</p><div><h2 id="commission-specs-heading">Materiales, formatos<br>y condiciones reales.</h2>{specs_html}</div></section><section class="commission-steps" aria-label="Proceso de encargo"><article><span>01</span><h3>Me cuentas tu idea y tu foto.</h3><p>A quién quieres retratar, si es para regalar y qué historia u objetos le definen. Puedes adjuntar fotografías de referencia.</p></article><article><span>02</span><h3>Propuesta, materiales y presupuesto.</h3><p>Acordamos técnica, formato, orientación de precio y plazo de entrega antes de comenzar la obra.</p></article><article><span>03</span><h3>El retrato cobra vida en el estudio.</h3><p>Compartimos imágenes del proceso mientras el dibujo, la pintura o el collage van tomando forma.</p></article><article><span>04</span><h3>Entrega en Bilbao o envío.</h3><p>Acordamos la entrega en mano en Bilbao y Bizkaia o el envío preparado según el soporte y los materiales.</p></article></section>{configurator_html}<section class="commission-faq" aria-labelledby="commission-faq-heading"><div class="section-opening"><p class="eyebrow">Dudas frecuentes antes de encargar</p><h2 id="commission-faq-heading">Precios, fotos<br>y plazos.</h2></div><div class="commission-faq-list">{faq_html}</div></section><div class="closing"><p class="hand">¿A quién te gustaría retratar?</p><a class="text-link" href="https://wa.me/34636060609?text=Hola%20Naroa%2C%20me%20gustar%C3%ADa%20consultar%20un%20retrato%20personalizado%20por%20encargo." target="_blank" rel="noopener noreferrer">Hablar por WhatsApp directo ↗</a><a class="text-link" href="mailto:naroa@naroa.eu?subject=Solicitud%20de%20presupuesto%20para%20retrato%20por%20encargo">Solicitar presupuesto por email ↗</a><a class="text-link" href="/obra/#indice">Explorar las {len(projects)} obras del catálogo ↗</a></div></article>'''
    commissions_schema = {
        "@context": "https://schema.org",
        "@type": ["Service", "ProfessionalService"],
        "@id": ORIGIN + "/retratos-por-encargo-bilbao/#service",
        "name": "Retratos personalizados por encargo en Bilbao y Bizkaia",
        "serviceType": "Retratos artísticos de autor en dibujo, pintura, collage, madera y objetos",
        "url": ORIGIN + "/retratos-por-encargo-bilbao/",
        "inLanguage": "es-ES",
        "dateModified": catalogue["reviewed"],
        "description": "Encarga un retrato personalizado en Bilbao con Naroa Gutiérrez Gil. Piezas originales hechas a mano a partir de fotografía e historia personal: dibujo, pintura, collage, madera, objetos y pizarra con presupuesto cerrado previo.",
        "image": [ORIGIN + ex["photos"][0]["original"] for ex, _, _ in commission_examples],
        "provider": canonical_artist_entity,
        "providerMobility": "dynamic",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Bilbao, Bizkaia",
            "addressLocality": "Bilbao",
            "addressRegion": "Bizkaia",
            "postalCode": "48001",
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
            "Retrato al óleo y dibujo a lápiz",
            "Collage contemporáneo y textil sobre madera",
            "Cajas personalizadas y objetos intervenidos",
            "Retrato en técnica mixta sobre pizarra natural",
        ],
        "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Formatos y técnicas de retratos personalizados",
            "itemListElement": [
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
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Retrato sobre pizarra natural",
                        "description": "Exploración en técnica mixta (acrílico, lápices y detalles minerales) sobre soporte de pizarra natural.",
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
                "target": "https://wa.me/34636060609?text=Hola%20Naroa%2C%20me%20gustar%C3%ADa%20consultar%20un%20encargo%20de%20retrato%20personalizado%20por%20encargo.",
            },
        ],
    }
    page("/retratos-por-encargo-bilbao/", "Retratos personalizados por encargo en Bilbao · Precios, fotos y proceso", "Encarga un retrato personalizado en Bilbao con Naroa Gutiérrez Gil. Retratos hechos a mano a partir de tu historia y fotografía en dibujo, pintura, collage, madera y objetos.", '<main id="main">' + commissions + '</main>', amor["photos"][0]["original"], schema=commissions_schema, image_alt=work_alt(amor))

    contact = f'''<main id="main" class="contact-page"><div class="contact-background" data-parallax><img src="{rara['cover']}" alt="Rara Avis, composición de retratos y reflejos" fetchpriority="high"></div><div class="contact-shade"></div><section class="contact-copy"><p class="eyebrow">Naroa Gutiérrez Gil · Bilbao</p><h1 class="hand">¿Hablamos?</h1><p>Una persona. Una historia. Una idea a medio hacer.<br>No hace falta traerlo todo pensado.</p><a class="contact-email" href="mailto:naroa@naroa.eu?subject=Retrato%20por%20encargo">naroa@naroa.eu ↗</a><div class="contact-channels" aria-label="Vías de contacto diferenciadas"><article class="contact-channel"><span class="eyebrow">Encargos y obra</span><a class="text-link" href="mailto:naroa@naroa.eu?subject=Consulta%20sobre%20obra%20o%20encargo">Escribir por correo ↗</a><p>Consultas sobre obras del catálogo, formatos y encargos personalizados.</p></article><article class="contact-channel"><span class="eyebrow">Trato directo</span><a class="text-link" href="https://wa.me/34636060609?text=Hola%20Naroa%2C%20me%20gustar%C3%ADa%20hablar%20sobre%20un%20encargo." target="_blank" rel="noopener noreferrer">También por WhatsApp ↗</a><p>Conversación ágil para comentar una idea inicial o concertar llamada.</p></article><article class="contact-channel"><span class="eyebrow">Redes y archivo</span><a class="text-link" href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Facebook · Naroa Artista Plástica ↗</a><p>Álbumes de proceso, exposiciones y archivo fotográfico de cada serie.</p></article></div><div class="contact-details"><a href="tel:+34636060609">+34 636 060 609</a><a href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://instagram.com/naroa_art/" target="_blank" rel="noopener noreferrer">@naroa_art ↗</a><a href="https://naroagutierrez.wordpress.com/" target="_blank" rel="noopener noreferrer">Cuaderno WordPress ↗</a><span>Bilbao · País Vasco</span></div></section></main>'''
    contact_schema = {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        "@id": ORIGIN + "/contacto/#contact",
        "name": "Contacto · Naroa Gutiérrez Gil",
        "url": ORIGIN + "/contacto/",
        "description": "Habla con Naroa Gutiérrez Gil sobre una obra o un retrato por encargo. Bilbao. Email, WhatsApp e Instagram.",
        "mainEntity": canonical_artist_entity,
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
        "User-agent: cohere-ai\n"
        "Allow: /\n\n"
        "User-agent: Meta-ExternalAgent\n"
        "Allow: /\n\n"
        "User-agent: GPTBot\n"
        "Disallow: /\n\n"
        "User-agent: CCBot\n"
        "Disallow: /\n\n"
        "User-agent: Google-Extended\n"
        "Disallow: /\n\n"
        "User-agent: Bytespider\n"
        "Disallow: /\n\n"
        "User-agent: anthropic-ai\n"
        "Disallow: /\n\n"
        "User-agent: Amazonbot\n"
        "Disallow: /\n\n"
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /test/\n"
        "Disallow: /assets/backup_*/\n\n"
        "Sitemap: " + ORIGIN + "/sitemap.xml\n\n"
        "# LLM Knowledge Graph & Discovery Directives (GEO SOTA 2026)\n"
        "# Concise summary for LLM context windows:\n"
        f"# {ORIGIN}/llms.txt\n"
        "# Comprehensive catalogue and technical specifications:\n"
        f"# {ORIGIN}/llms-full.txt\n"
        "# Structured JSON catalog endpoint:\n"
        f"# {ORIGIN}/api/catalog.json\n"
    )
    sitemap_xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' + ''.join(sitemap_entries) + '</urlset>\n'
    write(output / "robots.txt", robots_content)
    write(REPO / "public" / "robots.txt", robots_content)
    write(output / "sitemap.xml", sitemap_xml)
    write(REPO / "public" / "sitemap.xml", sitemap_xml)

    blog_file = SOURCE / "data/blog.json"
    blog_posts = json.loads(blog_file.read_text()).get("posts", []) if blog_file.exists() else []

    feed_items = []
    for p in projects:
        pub_year = p.get("year")
        try:
            year_int = int(pub_year)
        except (ValueError, TypeError):
            year_int = 2026
        dt = datetime(year_int, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        medium_parts = [p.get("technique"), p.get("support"), p.get("dimensions")]
        medium_desc = " · ".join(filter(None, medium_parts))
        desc_text = f"{p['story']} ({medium_desc})" if medium_desc else p['story']
        item_xml = (
            "<item>"
            f"<title>{esc(p['title'])} · Retrato de autor</title>"
            f"<link>{ORIGIN}/obra/{p['slug']}/</link>"
            f"<guid isPermaLink=\"true\">{ORIGIN}/obra/{p['slug']}/</guid>"
            f"<pubDate>{format_datetime(dt)}</pubDate>"
            "<dc:creator>Naroa Gutiérrez Gil</dc:creator>"
            "<author>naroa@naroa.eu (Naroa Gutiérrez Gil)</author>"
            f"<description>{esc(desc_text)}</description>"
            f'<enclosure url="{ORIGIN}{esc(p["cover"])}" length="0" type="image/webp"/>'
            "</item>"
        )
        feed_items.append(item_xml)

    for post in blog_posts:
        try:
            post_dt = datetime.fromisoformat(post["date"]).replace(tzinfo=timezone.utc)
        except Exception:
            post_dt = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        post_link = post.get("url") or f"{ORIGIN}/cuaderno/"
        item_xml = (
            "<item>"
            f"<title>{esc(post['title'])}</title>"
            f"<link>{esc(post_link)}</link>"
            f"<guid isPermaLink=\"true\">{esc(post_link)}</guid>"
            f"<pubDate>{format_datetime(post_dt)}</pubDate>"
            "<dc:creator>Naroa Gutiérrez Gil</dc:creator>"
            "<author>naroa@naroa.eu (Naroa Gutiérrez Gil)</author>"
            f"<description>{esc(post.get('summary', ''))}</description>"
            "</item>"
        )
        feed_items.append(item_xml)

    build_now = datetime(2026, 10, 24, 8, 20, 0, tzinfo=timezone.utc)
    feed_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
        '  <channel>\n'
        '    <title>Naroa Gutiérrez Gil · Arte y Retratos</title>\n'
        f'    <link>{ORIGIN}/</link>\n'
        '    <description>Catálogo de obra plástica, servicio de retratos de autor y publicaciones del cuaderno de taller de Naroa Gutiérrez Gil en Bilbao.</description>\n'
        '    <language>es-es</language>\n'
        f'    <lastBuildDate>{format_datetime(build_now)}</lastBuildDate>\n'
        f'    <atom:link href="{ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>\n'
        + "".join(feed_items)
        + '\n  </channel>\n'
        '</rss>\n'
    )
    write(output / "feed.xml", feed_xml)
    write(REPO / "public" / "feed.xml", feed_xml)
    indexnow_key = "6621e1f1c138eeb14922f7804f61ae34"
    indexnow_payload = json.dumps({"host": "naroagutierrezgil.com", "key": indexnow_key, "keyLocation": f"{ORIGIN}/{indexnow_key}.txt", "urlList": [ORIGIN + p[0] for p in pages]}, indent=2) + "\n"
    write(output / f"{indexnow_key}.txt", indexnow_key + "\n")
    write(output / "indexnow.json", indexnow_payload)
    write(REPO / "public" / f"{indexnow_key}.txt", indexnow_key + "\n")
    write(REPO / "public" / "indexnow.json", indexnow_payload)

    catalog_api = {
        "version": "1.2",
        "entity_id": ORIGIN + "/#artist",
        "studio_id": ORIGIN + "/#studio",
        "artist": {
            "name": "Naroa Gutiérrez Gil",
            "role": "Artista plástica y retratista contemporánea",
            "location": "Bilbao, Bizkaia, País Vasco, España",
            "coordinates": {"latitude": 43.2630, "longitude": -2.9350},
            "url": ORIGIN + "/",
            "sameAs": artist_same_as,
            "canonical_locations": {
                "studio": {
                    "@id": ORIGIN + "/#studio",
                    "name": "Estudio Naroa Gutiérrez Gil · Bilbao",
                    "address_locality": "Bilbao",
                    "address_region": "Bizkaia",
                    "postal_code": "48001",
                    "country": "ES",
                    "coordinates": {"latitude": 43.2630, "longitude": -2.9350},
                    "hasMap": "https://www.google.com/maps?q=Bilbao,+Bizkaia",
                }
            },
            "contact": {
                "email": "naroa@naroa.eu",
                "whatsapp": "+34636060609",
                "inquiry_form": ORIGIN + "/contacto/",
            },
            "commission_service": {
                "@id": ORIGIN + "/retratos-por-encargo-bilbao/#service",
                "url": ORIGIN + "/retratos-por-encargo-bilbao/",
                "provider": ORIGIN + "/#artist",
                "supports": [
                    "Collage y técnica mixta textil sobre madera",
                    "Retrato al óleo y dibujo a grafito/pastel",
                    "Cajas tridimensionales y objetos intervenidos",
                    "Pizarra natural (exploración reciente)",
                ],
                "pricing_policy": "Presupuesto cerrado previo por escrito sin compromiso",
                "turnaround": "2 a 4 semanas según complejidad y secado de materiales",
                "delivery": "Entrega en mano en Bilbao y Bizkaia o envío asegurado nacional e internacional",
            },
        },
        "evidence_graph": {
            "studio_locus": "Bilbao, Bizkaia, España",
            "disciplines": [
                "Retrato al óleo, grafito y pastel Conté",
                "Collage textil y ensamblaje de objetos sobre madera",
                "Cajas tridimensionales de memoria y objetos intervenidos",
                "Exploraciones en técnica mixta sobre pizarra natural",
            ],
            "query_fan_out": [
                {
                    "intent": "Precios y presupuestos de retratos por encargo",
                    "question": "¿Cuánto cuesta un retrato personalizado en Bilbao con Naroa Gutiérrez Gil?",
                    "answer": "Presupuesto cerrado previo por escrito según técnica, soporte y formato (dibujo, óleo, collage sobre madera, cajas de memoria o piezas en pizarra de 20×30 cm a 40×50 cm). Sin compromiso previo.",
                },
                {
                    "intent": "Plazos de entrega",
                    "question": "¿Cuál es el plazo de entrega habitual de un encargo?",
                    "answer": "De 2 a 4 semanas según la técnica elegida y los tiempos de secado de óleos, acrílicos y barnices. Plazos prioritarios con aviso previo para fechas señaladas.",
                },
                {
                    "intent": "Proceso de encargo a partir de fotos",
                    "question": "¿Cómo se encarga un retrato personalizado a partir de fotografías?",
                    "answer": "Se envían fotografías de referencia por WhatsApp o email comentando el carácter o anécdotas; Naroa realiza una reinterpretación artística de autor en el soporte acordado.",
                },
                {
                    "intent": "Entrega local y envíos",
                    "question": "¿Dónde se entrega la obra?",
                    "answer": "Entrega en mano en Bilbao y Bizkaia, o envío protegido y asegurado a cualquier destino nacional e internacional.",
                },
                {
                    "intent": "Conservación y cuidado de las obras",
                    "question": "¿Cómo se conserva y limpia una obra en técnica mixta, collage u objeto intervenido?",
                    "answer": "Las piezas cuentan con fijación y barniz protector satinado. Se recomienda limpieza en seco con plumero suave o gamuza de microfibra, evitando humedad directa, disolventes o productos abrasivos.",
                },
                {
                    "intent": "Elección de soportes y materiales",
                    "question": "¿Qué aporta trabajar sobre madera, collage textil, objetos o pizarra frente al lienzo convencional?",
                    "answer": "Cada soporte aporta textura, volumen y relato propio: las betas de la madera, las costuras textiles, las cajas de recuerdos o las aristas de la piedra dialogan directamente con la historia de la persona retratada.",
                },
                {
                    "intent": "Embalaje y seguridad de transporte",
                    "question": "¿Cómo se garantiza la seguridad en los envíos de obras con volumen o relieve?",
                    "answer": "Cada obra se embala con protección tricapa: lámina de barrera antiadherente, cantoneras de espuma de polietileno de alta densidad a medida y caja rígida reforzada con precinto de seguridad y seguro a todo riesgo.",
                },
                {
                    "intent": "Cita presencial en estudio de Bilbao",
                    "question": "¿Es posible visitar el estudio en Bilbao para elegir soportes o ver obra en directo?",
                    "answer": "Sí, previa cita por email o WhatsApp se conciertan visitas al estudio en Bilbao para valorar formatos, maderas, tejidos, objetos y definir la obra en persona.",
                },
            ],
            "exhibitions_chronology": [
                {"year": 2026, "title": "BWALL Collective", "venue": "Colegio de Abogados de Bilbao", "press": "DEIA"},
                {"year": 2018, "title": "Dock Bilbao Showcase", "venue": "Dock Bilbao"},
                {"year": 2014, "title": "Politena Encuentros de Arte", "venue": "Politena Espacio de Arte, Bilbao"},
                {"year": 2010, "title": "Espejos del alma", "venue": "Colegio de Abogados de Bilbao", "press": "GARA, El Correo"},
                {"year": "2010+", "title": "Walking Gallery Bilbao", "venue": "Espacios públicos y galerías abiertas, Bilbao"},
            ],
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
    catalog_json = json.dumps(catalog_api, ensure_ascii=False, indent=2) + "\n"
    write(output / "api" / "catalog.json", catalog_json)
    write(REPO / "public" / "api" / "catalog.json", catalog_json)

    webmcp_json = json.dumps(webmcp_manifest, ensure_ascii=False, indent=2) + "\n"
    write(output / ".well-known" / "mcp.json", webmcp_json)
    write(REPO / "public" / ".well-known" / "mcp.json", webmcp_json)

    llms_txt = (
        "# Naroa Gutiérrez Gil · Artista Plástica y Retratista (Bilbao)\n\n"
        "> Catálogo oficial de obra plástica, servicio de retratos personalizados por encargo y archivo de exposiciones.\n\n"
        "## Resumen del Sitio y Evidence Graph\n"
        f"- Dominio Canónico: {ORIGIN}\n"
        f"- Entidad Creadora: Naroa Gutiérrez Gil [ID Canónico: {ORIGIN}/#artist]\n"
        f"- Estudio Físico: Bilbao, Bizkaia, País Vasco, España (43.2630 N, -2.9350 W) [ID Canónico: {ORIGIN}/#studio]\n"
        "- Contacto Directo: naroa@naroa.eu | WhatsApp: +34 636 060 609 | Instagram: @naroa_art\n"
        "- Perfiles de Autoridad (sameAs):\n"
        "  - Facebook: https://www.facebook.com/naroa.artista.plastica\n"
        "  - Instagram: https://instagram.com/naroa_art/\n"
        "  - Cuaderno WordPress: https://naroagutierrez.wordpress.com/\n"
        "  - DEIA Bizkaia: https://www.deia.eus/bizkaia/vida-social/2026/06/05/bwall-collective-inaugura-exposicion-ocho-11159371.html\n"
        "  - GARA Agenda: https://gara.naiz.eus/paperezkoa/20100305/186538/eu/Agenda\n"
        "  - El Correo Agenda: https://agenda.elcorreo.com/evento/naroa-gutierrez-gil-espejos-del-alma-476343.html\n"
        "  - YouTube: https://www.youtube.com/@naroagutierrezgil\n"
        "- Lenguaje y Práctica Artística: Retratos de autor y obra plástica multidisciplinar (dibujo, óleo, técnicas mixtas, collage textil sobre madera y objetos intervenidos, con exploraciones recientes sobre soportes minerales como la pizarra natural de cantera y mica).\n"
        f"- Servicio Canónico de Encargos: {ORIGIN}/retratos-por-encargo-bilbao/\n"
        "- Exposiciones Documentadas: Colegio de Abogados de Bilbao (Espejos del alma), Dock Bilbao, Politena Espacio de Arte, Walking Gallery Bilbao.\n\n"
        "## Respuestas Factuales Inmediatas (Query Fan-Out)\n"
        "- **¿Cuánto cuesta un retrato personalizado?** Presupuesto cerrado previo por escrito según técnica, soporte y formato (dibujo, óleo, collage sobre madera, cajas de recuerdos o pizarra de 20×30 cm a 40×50 cm). Consulta sin compromiso.\n"
        "- **¿Cómo se encarga a partir de fotos?** Se envían 1 o varias fotos de referencia (incluso tomadas con el móvil); Naroa realiza una reinterpretación artística de autor capturando la personalidad y mirada.\n"
        "- **¿Cuáles son los plazos de entrega?** De 2 a 4 semanas según la técnica y el secado de óleos, acrílicos y barnices. Plazos prioritarios disponibles para fechas señaladas con aviso previo.\n"
        "- **¿Dónde se entrega?** Entrega en mano en Bilbao y Bizkaia, o envío protegido y asegurado a nivel nacional e internacional.\n"
        "- **¿Cómo conservar una obra en técnica mixta o collage?** Fijación y barniz protector satinado. Limpieza en seco con plumero suave o microfibra; evitar humedad directa o productos químicos.\n"
        "- **¿Qué aporta trabajar sobre madera, collage, objetos o pizarra?** Cada soporte (betas de madera, costuras textiles, cajas cotidianas o cantos de piedra) aporta textura, volumen y relato propio en diálogo con la persona retratada.\n"
        "- **¿Cómo es el embalaje para envíos?** Embalaje tricapa con cantoneras de polietileno de alta densidad a medida, caja rígida reforzada y seguro a todo riesgo incluido.\n"
        "- **¿Se puede visitar el estudio en Bilbao?** Sí, visitas con cita concertada previa para ver obra en directo, valorar soportes y definir el proyecto en persona.\n\n"
        "## Secciones Principales\n"
        f"- [Inicio e Inmersión]({ORIGIN}/): Experiencia inmersiva y catálogo completo de {len(projects)} obras.\n"
        f"- [Retratos por Encargo en Bilbao]({ORIGIN}/retratos-por-encargo-bilbao/): Condiciones técnicas, formatos (20×30 cm a 40×50 cm), plazos de 2 a 4 semanas, configurador interactivo y galería de ejemplos reales.\n"
        f"- [Catálogo Completo]({ORIGIN}/obra/): Ficha detallada de las {len(projects)} piezas de la colección con fotografías de detalle y relato.\n"
        f"- [Serie Vaivenes]({ORIGIN}/series/vaivenes/): Retratos en técnica mixta, collage textil y objetos de memoria.\n"
        f"- [Sobre Mí]({ORIGIN}/sobre-mi/): Biografía, técnica, proceso creativo y proyectos comunitarios (Walking Gallery Bilbao, El ReCreo).\n"
        f"- [Trayectoria]({ORIGIN}/trayectoria/): Archivo cronológico de exposiciones documentadas desde 2010 (DEIA, GARA, Politena, Dock Bilbao).\n"
        f"- [Cuaderno]({ORIGIN}/cuaderno/): Relatos de proceso, vivencias del taller y artículos de prensa.\n"
        f"- [Contacto]({ORIGIN}/contacto/): Canales directos de consulta para obra y encargos.\n\n"
        "## Recursos Machine-to-Machine y GEO SOTA 2026\n"
        f"- [Catálogo JSON Estructurado]({ORIGIN}/api/catalog.json): Endpoint con especificaciones completas de las {len(projects)} obras y Evidence Graph.\n"
        f"- [Endpoint WebMCP]({ORIGIN}/.well-known/mcp.json): Manifiesto y definición formal de herramientas WebMCP para agentes autónomos.\n"
        f"- [Índice Extendido llms-full.txt]({ORIGIN}/llms-full.txt): Desglose exhaustivo de todas las piezas, fotos de detalle con hashes SHA-256 y condiciones de encargo.\n"
        f"- [Sitemap XML]({ORIGIN}/sitemap.xml): Índice canónico de {len(pages)} rutas y metadatos de imágenes.\n"
        f"- [Feed RSS 2.0]({ORIGIN}/feed.xml): Sindicación de obras recientes y publicaciones del taller.\n"
        f"- [Protocolo IndexNow]({ORIGIN}/indexnow.json): Sincronización instantánea de indexación para Bing y motores asociados.\n"
    )
    write(output / "llms.txt", llms_txt)
    write(REPO / "public" / "llms.txt", llms_txt)

    artworks_md = "\n".join(
        f"### {p['title']} ({p.get('year', 's/f')})\n"
        f"- **URL Canónica:** {ORIGIN}/obra/{p['slug']}/\n"
        f"- **Técnica:** {p.get('technique', 'Técnica mixta')}\n"
        f"- **Soporte:** {p.get('support', 'Soporte rígido')}\n"
        f"- **Medidas:** {p.get('dimensions', 'Medidas variables')}\n"
        f"- **Materiales:** {p.get('materials') or p.get('technique', 'Técnica mixta')}\n"
        f"- **Serie:** {p.get('series') or 'Colección general'}\n"
        f"- **Relato:** {p['story']}\n"
        f"- **Contacto Obra:** mailto:naroa@naroa.eu?subject={quote('Consulta sobre '+p['title'])}\n"
        for p in projects
    )
    llms_full_txt = (
        f"{llms_txt}\n"
        f"## Catálogo Exhaustivo de Obras ({len(projects)} Piezas Documentadas)\n\n"
        f"{artworks_md}\n\n"
        "## Condiciones del Servicio de Encargos en Bilbao (Evidence Base)\n\n"
        "- **Soportes:** Pizarra natural de cantera con contorno irregular, madera noble, collage textil sobre tela vaquera o papel de algodón, y cajas tridimensionales.\n"
        "- **Formatos habituales:** Pizarra de 20×30 cm a 40×50 cm; piezas especiales adaptadas al espacio.\n"
        "- **Técnicas:** Acrílico, óleo, grafito, pastel Conté, rotuladores acrílicos, escamas de mica mineral y ensamblaje de objetos cotidianos.\n"
        "- **Plazos:** 2 a 4 semanas según complejidad y secado de capas de óleo/barniz.\n"
        "- **Presupuesto:** Presupuesto cerrado por escrito antes de comenzar, sin compromiso previo.\n"
        "- **Entrega:** En mano en Bilbao y comarca de Bizkaia; envíos asegurados a nivel nacional e internacional.\n\n"
        "## Protocolo de Interacción para Agentes Autónomos (Agent-Ready DOM & WebMCP)\n\n"
        f"- **Endpoint WebMCP:** `{ORIGIN}/.well-known/mcp.json` (herramientas: `search_catalogue`, `get_artwork_details`, `configure_commission_inquiry`, `get_artist_profile`).\n"
        "- **Configurador de Encargos:** Accesible en `/retratos-por-encargo-bilbao/` bajo `[data-commission-configurator]`.\n"
        "- **Selectores Semánticos y Labels:** Soporte (`#cfg-support`), Motivo (`#cfg-motif`), Plazo (`#cfg-timing`) con `<label for=\"...\">` explícitos.\n"
        "- **Búsqueda en Catálogo:** Input `#art-search` con `<label for=\"art-search\">` accesible desde modal `#index-dialog`.\n"
        "- **Acción de Salida:** Botón dinámico `#cfg-whatsapp-btn` con query de WhatsApp pre-rellenada en $O(1)$.\n"
        "- **Consultas Directas:** Canales directos con asunto pre-rellenado disponibles en `/contacto/`.\n"
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
        "/.well-known/*\n"
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
    parser.add_argument("--ping-indexnow", action="store_true", help="Ping IndexNow endpoints immediately after build")
    parser.add_argument("--indexnow-dry-run", action="store_true", help="Dry-run IndexNow ping without network dispatch")
    args = parser.parse_args()
    dest_output = args.output.resolve()
    build(dest_output)
    if args.ping_indexnow or args.indexnow_dry_run:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from ping_indexnow import submit_indexnow, ENDPOINTS, load_payload
        payload = load_payload(dest_output / "indexnow.json")
        print(f"IndexNow Ping Dispatcher · Host: {payload['host']} · URLs: {len(payload['urlList'])}")
        for name, url in ENDPOINTS.items():
            res = submit_indexnow(payload, name, url, dry_run=args.indexnow_dry_run)
            prefix = "✓" if res["success"] else "✗"
            print(f" {prefix} [{name.upper()}] {res['message']}")
