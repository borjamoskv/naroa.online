#!/usr/bin/env python3
"""Render the reviewed exhibition archive without network or generated biography."""
import json,re
from pathlib import Path
from html import escape as e
ROOT=Path(__file__).resolve().parents[1]/'classic'
data=json.loads((ROOT/'data/exhibitions.json').read_text())
items=data['exhibitions'];hero=data['hero']
labels={'solo':'Individual','group':'Colectiva','street':'Arte en la calle','market':'Mercado de arte'}
catalogue_data = json.loads((ROOT / 'data/catalogo.json').read_text())
series_data = json.loads((ROOT / 'data/vaivenes.json').read_text())
artwork_lookup = {}
for p in catalogue_data['projects']:
    s = p['slug']
    artwork_lookup[s] = {
        'slug': s,
        'title': p['title'],
        'thumb': p['images'][0]['src'],
        'medium': p.get('technique') or p.get('support') or 'Técnica mixta',
        'url': f'/obra/{s}/'
    }
for im in series_data.get('images', []):
    s = im.get('work_slug') or im['slug']
    if s not in artwork_lookup:
        artwork_lookup[s] = {
            'slug': s,
            'title': im['title'],
            'thumb': im['src'],
            'medium': 'Técnica mixta · Vaivenes',
            'url': f'/obra/{s}/'
        }

def links(x):
 return ' '.join(f'<a href="{e(s["url"])}" target="_blank" rel="noopener noreferrer">{e(s["label"])} ↗</a>' for s in x['sources'])
def row(x):
 art_text = f'<a href="{x["artwork"]}">{e(x.get("artworkLabel", "Ver Rara Avis"))} →</a>' if x.get('artwork') else ''
 art_slugs = x.get('artworks', [])
 arts = [artwork_lookup[s] for s in art_slugs if s in artwork_lookup]
 art_json = e(json.dumps(arts, ensure_ascii=False))
 cards_html = ''
 if arts:
     cards_html = '<div class="timeline-cards-strip" role="group" aria-label="Obras de este encuentro">' + ''.join(
         f'<a href="{e(a["url"])}" class="timeline-cromo" data-cromo-slug="{e(a["slug"])}" title="{e(a["title"])}">'
         f'<span class="timeline-cromo-frame"><img src="{e(a["thumb"])}" alt="{e(a["title"])}" width="80" height="96" loading="lazy" decoding="async"></span>'
         f'<span class="timeline-cromo-meta"><strong>{e(a["title"])}</strong><small>{e(a["medium"])}</small></span>'
         f'</a>'
         for a in arts
     ) + '</div>'
 return f'''<article class="career-entry" data-kind="{x['type']}" data-artworks="{art_json}"><div class="career-entry__date"><time datetime="{x['date']}">{e(x['dateLabel'])}</time><span>{labels[x['type']]}</span></div><div><h4>{e(x['title'])}</h4><p class="career-venue">{e(x['location'])}</p><p class="career-description">{e(x['description'])}</p>{cards_html}<div class="career-sources">{links(x)}{art_text}</div></div></article>'''
years=sorted(set(x['year'] for x in items),reverse=True)
body=f'''<div class="career" data-career>
<header class="career-heading"><p class="career-kicker">Naroa Gutiérrez Gil · 2010 — 2026</p><h2 id="career-title">Trayectoria</h2><p class="career-deck">El retrato como encuentro.</p></header>
<figure class="career-hero"><img src="{hero['src']}" width="{hero['width']}" height="{hero['height']}" alt="{e(hero['alt'])}" loading="lazy" decoding="async"><figcaption>{e(hero['caption'])} <a href="{e(hero['source'])}" target="_blank" rel="noopener noreferrer">Leer el relato ↗</a></figcaption></figure>
<div class="career-story"><p class="career-kicker">De la mirada al encuentro</p><div><p>«Porque las exposiciones colectivas son como el corro de las patatas o el pilla-pilla de la vida artística: es enseñarnos los nuevos cromos al reunirnos con las amigas; es pegar en la misma pared todas nuestras pegatinas».</p><p>«Mandar el arte a paseo para que las creaciones abandonen los espacios cerrados (o zulos), respiren aire fresco, vean gente y la gente las pueda ver... Una galería sin muros, sin duros, abierta y flexible. De tú a tú, haciendo piña, haciendo amig@s, apetecible».</p></div></div>
<section class="career-archive" aria-labelledby="career-archive-title"><div class="career-archive__heading"><h3 id="career-archive-title">Exposiciones<br><em>y encuentros</em></h3><p>Una selección del archivo de la artista.<br>Cada encuentro, con su historia.</p></div>
<div class="career-tools" hidden><div class="career-filters" role="group" aria-label="Filtrar trayectoria"><button type="button" data-career-filter="all" aria-pressed="true">Todo</button>{''.join(f'<button type="button" data-career-filter="{k}" aria-pressed="false">{v}</button>' for k,v in labels.items())}</div><label>Ir al año<select class="career-year"><option value="">Elegir año</option>{''.join(f'<option value="{y}">{y}</option>' for y in years)}</select></label></div>
<p class="career-count" role="status" aria-live="polite">{len(items)} encuentros documentados</p>
{''.join(f'<section class="career-year-group" id="career-year-{y}" data-career-year="{y}" aria-labelledby="career-label-{y}"><h3 id="career-label-{y}">{y}</h3><div>{"".join(row(x) for x in items if x["year"]==y)}</div></section>' for y in years)}
<p class="career-method">{e(data['scope'])} Archivo revisado el 20 de octubre de 2026.</p></section>
<div class="career-outro"><p>La historia continúa<br>en cada obra.</p><a href="/#/destacada">Explorar la obra →</a></div></div>'''
index=(ROOT/'index.html').read_text()
home_body='''<div class="career-home"><p class="artist-kicker">2010 — 2026 · De sala en sala</p><h2 id="career-title">El arte también<br>sale de paseo.</h2><p>Exposiciones, encuentros y obras que encuentran su lugar entre otras personas.</p><a href="/trayectoria/">Recorrer la trayectoria de Naroa ↗</a></div>'''
index=re.sub(r'<section id="view-trayectoria"[\s\S]*?(?=<!-- ═══ SECTION 4: ENCARGO)' ,lambda _:f'<section id="view-trayectoria" class="view view--trayectoria view--premium-dark" aria-labelledby="career-title"><div id="exposiciones-container">{home_body}</div></section>',index,count=1)
assets='<link rel="stylesheet" href="/assets/trayectoria.css"><script type="module" src="/assets/trayectoria.js"></script>'
if '/assets/trayectoria.css' not in index:index=index.replace('</head>',assets+'\n</head>')
index=index.replace('href="#/trayectoria" class="nav__link"','href="/trayectoria/" class="nav__link"')
(ROOT/'index.html').write_text(index)
# The dedicated page shares the same content, with its own primary heading.
pagebody=body.replace('<h2 id="career-title">','<h1 id="career-title">').replace('Trayectoria</h2>','Trayectoria</h1>')
pagebody=pagebody.replace('<h3 id="career-archive-title">Exposiciones<br><em>y encuentros</em></h3>', '<h2 id="career-archive-title">Exposiciones<br><em>y encuentros</em></h2>')
page=f'''<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trayectoria · Naroa Gutiérrez Gil</title><meta name="description" content="Exposiciones y encuentros de Naroa Gutiérrez Gil: de Espejos del Alma a DiviNos VaiVenes. Una selección documentada de 2010 a 2026."><link rel="canonical" href="https://naroagutierrezgil.com/trayectoria/"><meta property="og:title" content="Trayectoria · Naroa Gutiérrez Gil"><meta property="og:description" content="El retrato como encuentro. Exposiciones, colectivos y arte en la calle, 2010–2026."><meta property="og:image" content="https://naroagutierrezgil.com{hero['src']}"><meta property="og:url" content="https://naroagutierrezgil.com/trayectoria/"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/naroa-icon-64-v1.png"><link rel="apple-touch-icon" href="/assets/naroa-icon-180-v1.png"><link rel="stylesheet" href="/assets/pop-organic.css?v=20261021-pop-v3"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">{assets}</head><body class="career-page"><a class="career-skip" href="#career-main">Ir al contenido</a><nav class="career-nav" aria-label="Principal"><a href="/">NAROA<span>Gutiérrez Gil</span></a><a href="/#/destacada">Obra</a><a href="/sobre-mi/">Sobre mí</a><a href="/trayectoria/" aria-current="page">Trayectoria</a><a href="/#/contacto">Contacto ↗</a></nav><main id="career-main">{pagebody}</main><footer class="career-footer"><a href="/">Naroa Gutiérrez Gil</a><a href="mailto:naroa@naroa.eu">naroa@naroa.eu ↗</a><span>Bilbao · © 2026</span></footer></body></html>'''
folder=ROOT/'trayectoria';folder.mkdir(exist_ok=True);(folder/'index.html').write_text(page.replace('</head>', '<link rel="stylesheet" href="/assets/handwriting.css?v=20261021-child-v1"><link rel="stylesheet" href="/assets/studio-refinement.css?v=20261021-quiet-v4"></head>'))
print(f'Built trajectory: {len(items)} sourced entries, {len(years)} years.')
