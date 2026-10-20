#!/usr/bin/env python3
"""Build the public, curated catalogue from reviewed data; no network required."""
import json, re
from pathlib import Path
from html import escape as esc
from urllib.parse import quote
ROOT = Path(__file__).resolve().parents[1] / 'classic'
DATA = json.loads((ROOT / 'data/catalogo.json').read_text())
ITEMS = DATA['projects']
LABELS = {'pizarra': 'Pizarra · DiviNos', 'collage': 'Dibujo y collage', 'objetos': 'Retratos y objetos', 'caracterizacion': 'Caracterización'}
def image(p, i=0, eager=False):
    im=p['images'][i]
    return f'<img src="{esc(im["src"])}" alt="{esc(p["title"] + " — " + im["caption"])}" width="{im["width"]}" height="{im["height"]}" loading="{"eager" if eager else "lazy"}" decoding="async"{ " fetchpriority=\"high\"" if eager else ""}>'
def card(p):
    search=' '.join(str(p.get(k) or '') for k in ['title','category','technique','support','series','story'])
    return f'''<article class="catalog-card" data-category="{p['category']}" data-selected="{str(p['selected']).lower()}" data-search="{esc(search)}">
<a href="/obra/{p['slug']}/"><div class="catalog-card__image">{image(p)}</div><div class="catalog-card__meta"><span>{esc(LABELS[p['category']])}{' · Serie' if p['kind']=='serie' else ''}</span><span aria-hidden="true">↗</span></div><h3>{esc(p['title'])}</h3><p>{esc(p['support'])}</p></a></article>'''
filters=[('seleccion','Selección'),('todo','Todos los proyectos'),('pizarra','Pizarra'),('collage','Collage'),('objetos','Objetos'),('caracterizacion','Caracterización')]
catalog=f'''<section id="view-destacada" class="view view--destacada editorial-catalog" aria-labelledby="catalog-title">
<div class="catalog-intro"><div><p class="eyebrow">Naroa Gutiérrez Gil</p><h2 id="catalog-title">Obra</h2></div><p>Retratos sobre pizarra, collages, objetos que se abren y rostros que se transforman. Entra en cada proyecto para descubrir sus materiales y sus detalles.</p></div>
<div class="catalog-toolbar"><div class="catalog-filters" role="group" aria-label="Filtrar proyectos">{''.join(f'<button type="button" data-filter="{key}" aria-pressed="{str(key=="todo").lower()}">{label}</button>' for key,label in filters)}</div><label class="catalog-search">Buscar proyecto<input id="catalog-search" type="search" placeholder="Título, material o retratado…" autocomplete="off"></label></div>
<p id="catalog-count" class="catalog-count" role="status" aria-live="polite">{len(ITEMS)} proyectos</p><div class="catalog-grid">{''.join(card(p) for p in ITEMS)}</div><div id="catalog-empty" hidden><p>No hay proyectos que coincidan con tu búsqueda.</p><button type="button" id="catalog-reset">Ver todos los proyectos</button></div>
<div class="catalog-footnote"><span>Una obra, varias miradas.</span><p>Las fotografías de conjunto, detalle y proceso se reúnen en una misma ficha.</p></div></section>'''
index=(ROOT/'index.html').read_text()
index=re.sub(r'<section id="view-destacada"[\s\S]*?</section>',lambda _:catalog,index,count=1)
(ROOT/'index.html').write_text(index)
head='''<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/assets/favicon-Inu7iesc.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/catalogo.css"><script defer src="/assets/catalogo.js"></script>'''
for p in ITEMS:
    url=f'https://naroa.online/obra/{p["slug"]}/'
    facts=[('Técnica',p['technique']),('Soporte',p['support']),('Medidas',p['dimensions']),('Serie',p['series']),('Año',p['year'])]
    schema={'@context':'https://schema.org','@type':'VisualArtwork' if p['kind']=='obra' else 'CreativeWork','name':p['title'],'url':url,'image':['https://naroa.online'+im['src'] for im in p['images']],'description':p['story'],'creator':{'@type':'Person','name':'Naroa Gutiérrez Gil','url':'https://naroa.online/'}}
    if p['kind']=='obra':schema.update(artMedium=p['technique'],artworkSurface=p['support'])
    if p['year']:schema['dateCreated']=p['year']
    related=[q for q in ITEMS if q['category']==p['category'] and q['slug']!=p['slug']][:3]
    email='mailto:naroa@naroa.eu?subject='+quote('Consulta sobre '+p['title'])
    page=f'''<!doctype html><html lang="es"><head>{head}<title>{esc(p['title'])} · Naroa Gutiérrez Gil</title><meta name="description" content="{esc(p['story'])}"><link rel="canonical" href="{url}"><meta property="og:type" content="article"><meta property="og:title" content="{esc(p['title'])} · Naroa"><meta property="og:description" content="{esc(p['story'])}"><meta property="og:url" content="{url}"><meta property="og:image" content="https://naroa.online{esc(p['images'][0]['src'])}"><meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">{json.dumps(schema,ensure_ascii=False).replace('<','\\u003c')}</script></head>
<body class="project-page"><a href="#project-content" class="catalog-skip">Ir al contenido</a><header class="project-nav"><a class="project-brand" href="/">NAROA<span>Gutiérrez Gil</span></a><a href="/#/destacada">← Volver a la obra</a><a href="/#/contacto">Contacto ↗</a></header>
<main id="project-content"><div class="project-layout"><div class="project-photos">{''.join(f'<figure><a class="project-photo" href="{esc(im["src"])}" data-image="{esc(im["src"])}" data-caption="{esc(p["title"]+" — "+im["caption"])}" aria-label="Ampliar: {esc(im["caption"])}">{image(p,i,i==0)}<span aria-hidden="true">Ampliar ↗</span></a><figcaption><span>{i+1:02d} / {len(p["images"]):02d}</span> {esc(im["caption"])}</figcaption></figure>' for i,im in enumerate(p['images']))}</div>
<div class="project-info"><p class="eyebrow">{esc(LABELS[p['category']])}{' · Serie' if p['kind']=='serie' else ''}</p><h1>{esc(p['title'])}</h1><p class="project-story">{esc(p['story'])}</p><dl>{''.join(f'<div><dt>{key}</dt><dd>{esc(value)}</dd></div>' for key,value in facts if value)}</dl>{f'<p class="project-credit">{esc(p["credit"])}</p>' if p['credit'] else ''}<a class="editorial-button" href="{esc(email)}">Consultar sobre este proyecto ↗</a><p class="project-note">Para conocer disponibilidad, formatos o posibilidades de encargo, habla directamente con Naroa.</p><a class="project-source" href="{esc(p['source'])}" target="_blank" rel="noopener noreferrer">Ver publicación de la artista ↗</a></div></div>
<section class="project-related"><p class="eyebrow">Sigue explorando</p><h2>Otros proyectos</h2><div class="catalog-grid">{''.join(card(q) for q in related)}</div></section></main>
<footer class="project-footer"><a href="/">Naroa Gutiérrez Gil</a><a href="mailto:naroa@naroa.eu">naroa@naroa.eu ↗</a><span>Bilbao · © 2026</span></footer>
<dialog id="art-viewer" aria-label="Imagen ampliada"><div class="viewer-bar"><span id="viewer-counter" role="status"></span><button type="button" id="viewer-close">Cerrar ×</button></div><div class="viewer-stage"><button type="button" id="viewer-prev" aria-label="Imagen anterior">←</button><img id="viewer-image" alt=""><button type="button" id="viewer-next" aria-label="Imagen siguiente">→</button></div><p id="viewer-caption" aria-live="polite"></p></dialog></body></html>'''
    folder=ROOT/'obra'/p['slug'];folder.mkdir(parents=True,exist_ok=True);(folder/'index.html').write_text(page)
urls=['https://naroa.online/', 'https://naroa.online/trayectoria/', 'https://naroa.online/sobre-mi/']+[f'https://naroa.online/obra/{p["slug"]}/' for p in ITEMS]
(ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join(f'  <url><loc>{u}</loc><lastmod>{DATA["reviewed"]}</lastmod></url>\n' for u in urls)+'</urlset>\n')
print(f'Built {len(ITEMS)} project pages, home catalogue and sitemap.')
