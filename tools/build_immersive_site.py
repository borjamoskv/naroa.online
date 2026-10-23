#!/usr/bin/env python3
"""Build the complete immersive portfolio from the reviewed local catalogue.

No network calls, no edits to reviewed data or original photographs.
"""
import argparse
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
        name = f"{source.stem}-{digest}-{'thumb' if thumb else 'view'}.webp"
        dest = media / name
        jobs[dest] = (source, limit, 72 if thumb else 80)
        originals.add(src)
        return "/immersive/media/" + name

    catalogue = read_data("catalogo")
    series = read_data("vaivenes")
    projects = []
    series_slugs = {im.get("work_slug", im.get("slug")) for im in series["images"]}
    for p in catalogue["projects"]:
        photographs = [{"src": derivative(im["src"]), "original": im["src"], "caption": im["caption"], "width": im["width"], "height": im["height"]} for im in p["images"]]
        cover_index = 2 if p["slug"] == "marilyn-rocks" else 0
        projects.append({"slug": p["slug"], "title": p["title"], "category": p["category"], "label": LABELS[p["category"]], "story": p["story"], "technique": p["technique"], "support": p["support"], "dimensions": p["dimensions"], "year": p["year"], "series": "Vaivenes" if p["slug"] in series_slugs else p["series"], "credit": p["credit"], "source": p["source"], "kind": p["kind"], "cover": photographs[cover_index]["src"], "thumb": derivative(p["images"][0]["src"], 480, True), "photos": photographs, "stage": "obra"})
    known = {p["slug"] for p in projects}
    for im in series["images"]:
        slug = im.get("work_slug", im.get("slug"))
        if slug in known:
            continue
        known.add(slug)
        stage = im.get("stage", "obra")
        projects.append({"slug": slug, "title": im["title"], "category": "collage", "label": "Vaivenes" + (" · Detalle" if stage == "detalle" else " · Dibujo" if stage == "dibujo" else ""), "story": im["caption"], "technique": "Pintura y collage" if stage != "dibujo" else "Dibujo", "support": None, "dimensions": None, "year": None, "series": "Vaivenes", "credit": None, "source": im["source"], "kind": "obra", "cover": derivative(im["src"]), "thumb": derivative(im["src"], 480, True), "photos": [{"src": derivative(im["src"]), "original": im["src"], "caption": im["caption"], "width": im["width"], "height": im["height"]}], "stage": stage})
    # The non-curated order follows the reviewed files, independently of hash seed.
    first = {slug: i for i, slug in enumerate(CURATED)}
    original_order = {p["slug"]: i for i, p in enumerate(catalogue["projects"])}
    for i, im in enumerate(series["images"]):
        original_order.setdefault(im.get("work_slug", im.get("slug")), len(catalogue["projects"]) + i)
    projects.sort(key=lambda p: (0, first[p["slug"]]) if p["slug"] in first else (1, original_order[p["slug"]]))
    assert len(projects) == len(known)
    portrait = derivative("/images/sobre-mi/naroa-monoculo.jpg")
    cantinflowers = derivative("/images/trayectoria/cantinflowers.jpg")
    content = {"projects": projects, "reviewed": catalogue["reviewed"], "labels": LABELS}
    assets = {}
    for name in ("app.css", "app.js"):
        src = SOURCE / "immersive" / name
        digest = hashlib.sha256(src.read_bytes()).hexdigest()[:12]
        dest = output / "immersive" / f"{src.stem}-{digest}{src.suffix}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        assets[name] = "/" + str(dest.relative_to(output))
    encoded = "window.NAROA_CATALOG=" + data_json(content) + ";\n"
    digest = hashlib.sha256(encoded.encode()).hexdigest()[:12]
    catalog_path = f"/immersive/catalog-{digest}.js"
    write(output / catalog_path.lstrip("/"), encoded)

    def links():
        return '<a href="/obra/">Obra</a><a href="/series/vaivenes/">Vaivenes</a><a href="/sobre-mi/">Naroa</a><a href="/trayectoria/">Trayectoria</a><a href="/cuaderno/">Cuaderno</a><a href="/retratos-por-encargo-bilbao/">Encargos</a><a href="/contacto/">Contacto</a>'

    def header(gallery=False):
        return f'''<header class="site-nav"><a class="signature" href="/" aria-label="Naroa Gutiérrez Gil, inicio"><span>Naroa</span><small>GUTIÉRREZ GIL</small></a><nav aria-label="Principal"><a href="/obra/#indice" data-open-index>Obras</a>{'<button type="button" data-quiet>Solo obra</button>' if gallery else '<a class="desktop-link" href="/sobre-mi/">La artista</a>'}<button type="button" data-open-menu aria-haspopup="dialog">Menú <span aria-hidden="true">+</span></button></nav></header>'''

    def dialogs():
        index = ''.join(f'''<a class="index-work" href="/obra/{p['slug']}/" data-work="{p['slug']}" data-category="{p['category']}" data-series="{esc(p['series'] or '')}" data-search="{esc(' '.join(str(p[k] or '') for k in ['title','technique','support','series','story']))}"><img src="{p['thumb']}" width="92" height="100" alt="{esc(p['title'])}" loading="lazy"><span><small>{esc(p['label'])}</small><strong>{esc(p['title'])}</strong><em>{esc(p['support'] or p['technique'] or '')}</em></span><span aria-hidden="true">↗</span></a>''' for p in projects)
        return f'''<dialog id="menu-dialog" class="menu-dialog" aria-labelledby="menu-heading"><div class="dialog-top"><span id="menu-heading">Naroa Gutiérrez Gil</span><button type="button" data-close-dialog>Cerrar ×</button></div><nav aria-label="Todas las páginas">{links()}</nav><div class="menu-foot"><a href="mailto:naroa@naroa.eu">naroa@naroa.eu ↗</a><a href="https://instagram.com/naroa_art/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><span>Bilbao · País Vasco</span></div></dialog>
<dialog id="index-dialog" class="index-dialog" aria-labelledby="index-heading"><div class="dialog-top"><h2 id="index-heading">La obra</h2><button type="button" data-close-dialog>Cerrar ×</button></div><div class="index-controls"><label>Buscar obra<input type="search" id="art-search" placeholder="Título, material o retratado…" autocomplete="off"></label><div class="index-filters" role="group" aria-label="Filtrar obras"><button type="button" data-filter="all" aria-pressed="true">Todas</button><button type="button" data-filter="pizarra" aria-pressed="false">Pizarra</button><button type="button" data-filter="collage" aria-pressed="false">Collage</button><button type="button" data-filter="objetos" aria-pressed="false">Objetos</button><button type="button" data-filter="caracterizacion" aria-pressed="false">Caracterización</button><button type="button" data-filter="Vaivenes" aria-pressed="false">Vaivenes</button></div></div><p class="index-count" role="status" aria-live="polite">{len(projects)} proyectos</p><div class="index-list">{index}</div><p class="index-empty" hidden>No hay obras que coincidan con esta búsqueda. <button type="button" data-reset-index>Ver todas</button></p></dialog>'''

    def footer():
        return '''<footer class="site-footer"><a class="signature" href="/">Naroa</a><a href="mailto:naroa@naroa.eu">naroa@naroa.eu ↗</a><a href="/contacto/">¿Hablamos? ↗</a><span>Bilbao · © 2026</span></footer>'''

    pages = []

    def page(path, title, description, body, image, gallery=False, schema=None, not_found=False):
        canonical = ORIGIN + path
        structured = schema or {"@context": "https://schema.org", "@type": "WebPage", "name": title, "url": canonical, "description": description}
        html = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{esc(title)} · Naroa Gutiérrez Gil</title><meta name="description" content="{esc(description)}"><link rel="canonical" href="{canonical}"><meta property="og:title" content="{esc(title)} · Naroa Gutiérrez Gil"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{canonical}"><meta property="og:type" content="{'article' if gallery else 'website'}"><meta property="og:image" content="{ORIGIN}{image}"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"><link rel="stylesheet" href="{assets['app.css']}"><script type="application/ld+json" id="page-schema">{data_json(structured)}</script><script defer src="{catalog_path}"></script><script defer src="{assets['app.js']}"></script></head><body class="{'gallery-page' if gallery else 'editorial-page'}"><a class="skip-link" href="#main">Ir al contenido</a>{header(gallery)}{body}{'' if gallery else footer()}{dialogs()}</body></html>'''
        dest = output / ("404.html" if not_found else path.lstrip("/") + "index.html")
        write(dest, html)
        if not not_found:
            pages.append((path, image))

    def gallery(path, initial=0, subset="all", title=None):
        selected = [p for p in projects if subset != "Vaivenes" or p["series"] == "Vaivenes"]
        p = selected[initial]
        stages = ''.join(f'''<div class="art-scene{' is-current' if q['slug']==p['slug'] else ''}" data-scene="{i}"{' aria-hidden="true"' if q['slug']!=p['slug'] else ''}><div class="art-pan"><img {'src' if q['slug']==p['slug'] else 'data-src'}="{q['cover']}" alt="{esc(q['title']+' — '+q['label'])}" decoding="async" draggable="false"{' fetchpriority="high"' if q['slug']==p['slug'] else ''}></div></div>''' for i, q in enumerate(selected))
        nav = ''.join(f'<button type="button" data-select="{i}" aria-label="Ver {esc(q["title"])}" aria-pressed="{str(i==initial).lower()}"{ " hidden" if abs(i-initial)>2 else ""}>{i+1:02d}</button>' for i, q in enumerate(selected))
        body = f'''<main id="main" class="art-stage" data-gallery data-initial="{initial}" data-subset="{subset}"><div class="art-layers">{stages}</div><div class="art-shade" aria-hidden="true"></div><div class="kinetic-title" data-kinetic-title aria-hidden="true"></div><nav class="art-index" aria-label="Recorrido de obras">{nav}</nav><div class="art-bottom"><div><div data-art-copy aria-live="polite"><p class="art-counter"><span data-counter>{initial+1:02d} / {len(selected):02d}</span><small>Desplázate para recorrer ↕</small></p><h1 data-art-title>{esc(p['title'])}</h1><p class="art-material" data-art-material>{esc(p['label'])}</p></div><button type="button" class="art-story-link" data-open-story>Sobre esta obra <span aria-hidden="true">+</span></button></div><div class="art-controls"><div class="art-view-actions"><button type="button" data-fit aria-pressed="false">Ver imagen completa ↗</button><button type="button" data-open-photos>Otras miradas ↗</button></div><div class="art-arrows"><button type="button" data-prev aria-label="Obra anterior"{' disabled' if initial==0 else ''}>←</button><button type="button" data-next aria-label="Obra siguiente"{' disabled' if initial==len(selected)-1 else ''}>→</button></div></div></div><button type="button" class="restore-ui" data-restore hidden>Volver a la navegación ↙</button><div class="art-progress" aria-hidden="true"><span></span></div></main>
<dialog id="story-dialog" class="story-dialog" aria-labelledby="story-title"><div class="dialog-top"><span data-story-category>{esc(p['label'])}</span><button type="button" data-close-dialog>Cerrar ×</button></div><div class="story-body"><h2 id="story-title">{esc(p['title'])}</h2><p data-story>{esc(p['story'])}</p><dl data-facts></dl><p class="art-credit" data-credit>{esc(p['credit'] or '')}</p><a class="text-link" data-art-email href="mailto:naroa@naroa.eu?subject={quote('Consulta sobre '+p['title'])}">Consultar sobre esta obra ↗</a><a class="source-link" data-art-source href="{esc(p['source'])}" target="_blank" rel="noopener noreferrer">Ver publicación de la artista ↗</a></div><a class="story-footer" href="/retratos-por-encargo-bilbao/">Tu propio retrato empieza aquí ↗</a></dialog>
<dialog id="photos-dialog" class="photos-dialog" aria-labelledby="photos-heading"><div class="dialog-top"><span id="photos-heading">{esc(p['title'])}</span><button type="button" data-close-dialog>Cerrar ×</button></div><div class="photo-view"><button type="button" data-photo-prev aria-label="Fotografía anterior">←</button><img data-photo-image data-src="{p['photos'][0]['src']}" alt="{esc(p['title'])}" decoding="async"><button type="button" data-photo-next aria-label="Fotografía siguiente">→</button></div><p data-photo-caption aria-live="polite"></p></dialog>'''
        schema = {"@context": "https://schema.org", "@type": "VisualArtwork", "name": p["title"], "url": ORIGIN + "/obra/" + p["slug"] + "/", "image": [ORIGIN + ph["original"] for ph in p["photos"]], "description": p["story"], "creator": {"@type": "Person", "name": "Naroa Gutiérrez Gil", "url": ORIGIN + "/"}, "artMedium": p["technique"]}
        page(path, title or p["title"], p["story"], body, p["photos"][0]["original"], True, schema)

    def hero(image, eyebrow, heading, lead="", link=None, alt="Obra de Naroa Gutiérrez Gil", position="50% 45%"):
        return f'''<section class="page-hero" data-parallax><div class="page-hero-image"><img src="{image}" alt="{esc(alt)}" fetchpriority="high" style="object-position:{position}"></div><div class="page-hero-shade"></div><div class="page-hero-copy"><p class="eyebrow">{esc(eyebrow)}</p><h1>{heading}</h1>{f'<p class="hero-lead">{lead}</p>' if lead else ''}{f'<a class="text-link" href="{link[0]}">{link[1]} ↗</a>' if link else ''}</div><a class="hero-down" href="#contenido" aria-label="Seguir leyendo">↓</a></section>'''

    gallery("/", 0, title="Retratos, collage y objetos · Bilbao")
    gallery("/obra/", 0, title="Obra")
    for i, p in enumerate(projects):
        gallery(f"/obra/{p['slug']}/", i)
    gallery("/series/vaivenes/", 0, "Vaivenes", "Vaivenes")
    about = hero(portrait, "La artista · Bilbao", "Naroa<br><span>Gutiérrez Gil.</span>", "Rostros, materia y ganas de jugar.", alt="Naroa Gutiérrez Gil con chistera y un monóculo ante un ojo", position="50% 29%")
    about += '''<article id="contenido" class="editorial"><section class="chapter"><p class="eyebrow">La mirada</p><div><h2>Mirar a los demás.<br><span>Encontrarse en ellos.</span></h2><p class="lead">Naroa Gutiérrez Gil trabaja con rostros. Los dibuja, los pinta y los reconstruye con papeles, texturas y objetos. En cada retrato hay también una pregunta por quien lo mira.</p><p>En sus textos, crear y conocerse aparecen una y otra vez de la mano. Las figuras del cine, la música o la televisión son el punto de partida para hablar de emociones, de identidad y de aquello que reconocemos en otras personas.</p></div></section><blockquote>«Me encontré a mí en los demás».<cite>Naroa · <a href="https://naroagutierrez.wordpress.com/2020/09/27/iconos-pop-muestra-colectiva-de-retratos/" target="_blank" rel="noopener noreferrer">Iconos Pop, 2020 ↗</a></cite></blockquote><section class="chapter"><p class="eyebrow">01 · La materia</p><div><h2>Lo que cuenta<br>cada material.</h2><p>Una pizarra, un plato de madera, un recorte o una lata pueden convertirse en parte del retrato. El soporte aporta significado: la pintura convive con las huellas, las capas y las posibilidades de cada objeto.</p><p>En Vaivenes, el collage y los materiales reutilizados dan forma a vivencias y estados de ánimo. En DiviNos, los rostros sobre pizarra incorporan pintura, lápices de colores y mica.</p><a class="text-link" href="/series/vaivenes/">Descubrir Vaivenes ↗</a></div></section>'''
    amor = next(p for p in projects if p["slug"] == "amor-en-conserva")
    rara = next(p for p in projects if p["slug"] == "rara-avis")
    about += f'''<figure class="full-figure" data-parallax><a href="/obra/amor-en-conserva/"><img src="{amor['cover']}" alt="Amor en Conserva, retratos y objetos reunidos en una lata abierta" loading="lazy"></a><figcaption>Amor en Conserva · <a href="/obra/amor-en-conserva/">Entrar en la obra ↗</a></figcaption></figure><section class="chapter"><p class="eyebrow">02 · La propia mirada</p><div><h2>Al otro lado<br>del espejo.</h2><p>Después de años retratando a otras personas, Naroa cuenta que dibujarse directamente ante un espejo supuso un reto nuevo. En 2025 participó en el taller de autorretrato de Ana Rosa Arroyo, en la asociación Mujeres en la Diversidad.</p><p>Rara Avis reúne esa exploración en un autorretrato de pastel y collage. Mirarse se convierte, otra vez, en una oportunidad para experimentar.</p><a class="text-link" href="/obra/rara-avis/">Descubrir Rara Avis ↗</a></div></section><figure class="full-figure" data-parallax><a href="/obra/rara-avis/"><img src="{rara['cover']}" alt="Rara Avis: autorretrato entre marcos, papeles y reflejos" loading="lazy"></a><figcaption>Rara Avis · Pastel y collage</figcaption></figure><section class="chapter"><p class="eyebrow">03 · Compartir</p><div><h2>Crear también<br>es encontrarse.</h2><p>En Bilbao, sus convocatorias de Walking Gallery invitan a sacar las creaciones a la calle y conversar mientras se camina con ellas.</p><p>En 2024 presentó El ReCreo, un espacio de experimentación para personas de distintas edades. La curiosidad, el respeto y el disfrute del proceso atraviesan esta otra faceta de su práctica.</p><a class="text-link" href="/trayectoria/">Recorrer su trayectoria ↗</a></div></section></article>'''
    page("/sobre-mi/", "Sobre mí", "Rostros, materia y ganas de jugar. La mirada y el proceso creativo de Naroa Gutiérrez Gil, artista plástica en Bilbao.", '<main id="main">' + about + '</main>', "/images/sobre-mi/naroa-monoculo.jpg")

    exhibitions = read_data("exhibitions")["exhibitions"]
    years = sorted({x["year"] for x in exhibitions}, reverse=True)
    career = hero(cantinflowers, "Exposiciones y encuentros", "El arte también<br><span>sale de paseo.</span>", "De sala en sala. Entre otras personas.", alt="Cantinflowers, pintura y collage en torno a Mario Moreno")
    career += '<section id="contenido" class="career editorial"><div class="section-opening"><p class="eyebrow">Trayectoria documentada</p><h2>El camino<br>de las obras.</h2><p>Una selección de exposiciones, encuentros y espacios compartidos. Las fechas corresponden a las muestras; cada entrada conserva sus fuentes.</p></div><div class="year-filters" role="group" aria-label="Filtrar exposiciones por año"><button type="button" data-year="all" aria-pressed="true">Todos</button>' + ''.join(f'<button type="button" data-year="{y}" aria-pressed="false">{y}</button>' for y in years) + '</div><p class="career-count" role="status" aria-live="polite">' + str(len(exhibitions)) + ' encuentros documentados</p><div class="timeline">'
    for x in exhibitions:
        sources = ''.join(f'<a href="{esc(s["url"])}" target="_blank" rel="noopener noreferrer">{esc(s["label"])} ↗</a>' for s in x["sources"])
        career += f'''<article class="timeline-entry" data-exhibition-year="{x['year']}"><p>{esc(x['dateLabel'])}</p><div><h3>{esc(x['title'])}</h3><p class="timeline-location">{esc(x['location'])}</p><p>{esc(x['description'])}</p><div class="timeline-sources">{sources}</div></div></article>'''
    career += '</div></section>'
    page("/trayectoria/", "Trayectoria", "Exposiciones, encuentros y espacios compartidos de Naroa Gutiérrez Gil. Una selección documentada de su trayectoria.", '<main id="main">' + career + '</main>', "/images/trayectoria/cantinflowers.jpg")

    posts = read_data("blog")["posts"]
    notebook = hero(rara["cover"], "El cuaderno de Naroa", "Entre una obra<br><span>y la siguiente.</span>", "Historias, procesos y encuentros. Contados por Naroa, a su manera.", alt="Rara Avis, autorretrato de Naroa")
    notebook += '<section class="editorial notebook" id="contenido"><div class="section-opening"><p class="eyebrow">Cuaderno abierto</p><h2>Lo que ocurre<br>alrededor de una obra.</h2></div><div class="notebook-posts">'
    for x in posts:
        notebook += f'''<article><p class="eyebrow">{esc(x['date_label'])}</p><h3><a href="{esc(x['url'])}" target="_blank" rel="noopener noreferrer">{esc(x['title'])} ↗</a></h3><p>{esc(x['summary'])}</p><a class="text-link" href="{esc(x['url'])}" target="_blank" rel="noopener noreferrer">Leer en el cuaderno de Naroa ↗</a></article>'''
    notebook += '</div><a class="text-link" href="https://naroagutierrez.wordpress.com/" target="_blank" rel="noopener noreferrer">Seguir leyendo su cuaderno ↗</a></section>'
    page("/cuaderno/", "Cuaderno", "Historias de obras, procesos y encuentros. El cuaderno de la artista Naroa Gutiérrez Gil.", '<main id="main">' + notebook + '</main>', rara["photos"][0]["original"])

    commissions = hero(amor["cover"], "Retratos por encargo · Bilbao", "Una persona.<br><span>Una historia.</span>", "No hace falta traerlo todo pensado. Cuéntamelo y empezamos por ahí.", ("/contacto/", "Hablemos de tu idea"), alt="Amor en Conserva, retratos y recuerdos en un objeto cotidiano")
    commissions += '''<article class="editorial" id="contenido"><section class="chapter"><p class="eyebrow">Un retrato propio</p><div><h2>Cada retrato empieza<br>con una conversación.</h2><p>Cuéntame tu idea y a quién te gustaría retratar. Podemos hablar de una obra sobre pizarra, un collage o un objeto intervenido, y valorar el formato que mejor encaje.</p><p>La técnica, el soporte, el presupuesto y el plazo se acuerdan antes de empezar. Las posibilidades dependen de cada proyecto y de sus materiales.</p></div></section><section class="commission-steps"><article><span>01</span><h3>Me cuentas tu idea.</h3><p>A quién quieres retratar y qué significado tiene para ti. No necesitas tenerlo todo claro.</p></article><article><span>02</span><h3>Le damos forma.</h3><p>Acordamos técnica, formato, presupuesto y plazo antes de comenzar.</p></article><article><span>03</span><h3>La obra cobra vida.</h3><p>Compartimos imágenes del proceso y hablamos de cómo va tomando forma el retrato.</p></article><article><span>04</span><h3>El momento de encontrarse.</h3><p>Acordamos la entrega y la presentación de la pieza según su soporte y sus materiales.</p></article></section><div class="closing"><p class="hand">¿A quién te gustaría retratar?</p><a class="text-link" href="/contacto/">Cuéntame tu idea ↗</a><a class="text-link" href="/obra/#indice">Explorar los materiales en la obra ↗</a></div></article>'''
    page("/retratos-por-encargo-bilbao/", "Retratos por encargo en Bilbao", "Retratos por encargo sobre pizarra, collage y objetos intervenidos. Habla con Naroa Gutiérrez Gil para valorar técnica, formato y posibilidades.", '<main id="main">' + commissions + '</main>', amor["photos"][0]["original"])

    contact = f'''<main id="main" class="contact-page"><div class="contact-background" data-parallax><img src="{rara['cover']}" alt="Rara Avis, composición de retratos y reflejos" fetchpriority="high"></div><div class="contact-shade"></div><section class="contact-copy"><p class="eyebrow">Naroa Gutiérrez Gil · Bilbao</p><h1 class="hand">¿Hablamos?</h1><p>Una persona. Una historia. Una idea a medio hacer.<br>No hace falta traerlo todo pensado.</p><a class="contact-email" href="mailto:naroa@naroa.eu?subject=Retrato%20por%20encargo">naroa@naroa.eu ↗</a><a class="text-link" href="https://wa.me/34636060609?text=Hola%20Naroa%2C%20me%20gustar%C3%ADa%20hablar%20sobre%20un%20encargo." target="_blank" rel="noopener noreferrer">También por WhatsApp ↗</a><div class="contact-details"><a href="tel:+34636060609">+34 636 060 609</a><a href="https://instagram.com/naroa_art/" target="_blank" rel="noopener noreferrer">@naroa_art ↗</a><span>Bilbao · País Vasco</span></div></section></main>'''
    page("/contacto/", "Contacto", "Habla con Naroa Gutiérrez Gil sobre una obra o un retrato por encargo. Bilbao. Email, WhatsApp e Instagram.", contact, rara["photos"][0]["original"])
    page("/404/", "Esta página se ha ido de paseo", "Vuelve a la obra de Naroa Gutiérrez Gil.", '<main id="main" class="not-found"><p class="eyebrow">404</p><h1>Esta página<br>se ha ido de paseo.</h1><a class="text-link" href="/">Volver a la obra ↗</a></main>', amor["photos"][0]["original"], not_found=True)
    aliases = {"/bio/": "/sobre-mi/", "/exposiciones/": "/trayectoria/", "/encargos/": "/retratos-por-encargo-bilbao/", "/prensa/": "/cuaderno/", "/blog/": "/cuaderno/"}
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
    write(output / "favicon.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#11120f"/><text x="32" y="46" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="48" fill="#fffdf4">N</text></svg>')
    write(output / "robots.txt", "User-agent: *\nAllow: /\nSitemap: " + ORIGIN + "/sitemap.xml\n")
    write(output / "sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join('<url><loc>' + ORIGIN + path + '</loc></url>' for path, _ in pages) + '</urlset>\n')
    write(output / "_headers", '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Cache-Control: public, max-age=0, must-revalidate\n/immersive/*\n  Cache-Control: public, max-age=31536000, immutable\n')
    write(output / "_redirects", ''.join(f'{src.rstrip("/")} {dest} 301\n' for src, dest in aliases.items()) + '/landing-bilbao /retratos-por-encargo-bilbao/ 301\n')
    write(output / "immersive" / "build-manifest.json", json.dumps({"reviewed": catalogue["reviewed"], "projects": len(projects), "canonical_routes": [p for p, _ in pages], "media_files": len(jobs), "originals": len(originals), "assets": assets}, ensure_ascii=False, indent=2) + '\n')
    print(f'Built {len(projects)} artworks, {len(pages)} canonical routes, {len(jobs)} optimized images → {output}')


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=REPO / ".deploy")
    args = parser.parse_args()
    build(args.output.resolve())
