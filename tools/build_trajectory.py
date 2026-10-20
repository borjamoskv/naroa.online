#!/usr/bin/env python3
"""Render the reviewed exhibition archive without network or generated biography."""
import json,re
from pathlib import Path
from html import escape as e
ROOT=Path(__file__).resolve().parents[1]/'classic'
data=json.loads((ROOT/'data/exhibitions.json').read_text())
items=data['exhibitions'];hero=data['hero']
labels={'solo':'Individual','group':'Colectiva','street':'Arte en la calle','market':'Mercado de arte'}
def links(x):
 return ' '.join(f'<a href="{e(s["url"])}" target="_blank" rel="noopener noreferrer">{e(s["label"])} ↗</a>' for s in x['sources'])
def row(x):
 return f'''<article class="career-entry" data-kind="{x['type']}"><div class="career-entry__date"><time datetime="{x['date']}">{e(x['dateLabel'])}</time><span>{labels[x['type']]}</span></div><div><h4>{e(x['title'])}</h4><p class="career-venue">{e(x['location'])}</p><p class="career-description">{e(x['description'])}</p><div class="career-sources">{links(x)}{f'<a href="{x["artwork"]}">Ver Rara Avis →</a>' if x.get('artwork') else ''}</div></div></article>'''
years=sorted(set(x['year'] for x in items),reverse=True)
body=f'''<div class="career" data-career>
<header class="career-heading"><p class="career-kicker">Naroa Gutiérrez Gil · 2010 — 2026</p><h2 id="career-title">Trayectoria</h2><p class="career-deck">El retrato como encuentro.</p></header>
<figure class="career-hero"><img src="{hero['src']}" width="{hero['width']}" height="{hero['height']}" alt="{e(hero['alt'])}" loading="lazy" decoding="async"><figcaption>{e(hero['caption'])} <a href="{e(hero['source'])}" target="_blank" rel="noopener noreferrer">Leer el relato ↗</a></figcaption></figure>
<div class="career-story"><p class="career-kicker">De la mirada al encuentro</p><div><p>El rostro atraviesa la obra de Naroa Gutiérrez Gil. En <em>Espejos del Alma</em>, el retrato propone reconocernos en los demás. Con <em>Sácame los Colores</em>, esa búsqueda se vuelve una exploración del color. <em>Vaivenes</em> incorpora el collage, los objetos y los materiales reutilizados para dar forma a emociones cotidianas.</p><p>En 2026, <em>DiviNos VaiVenes</em> reúne ese recorrido con los retratos sobre pizarra de <em>DiviNos</em>. Las muestras individuales conviven con exposiciones colectivas, mercados de arte y encuentros de Walking Gallery: ocasiones para acercar las obras a otras miradas, dentro y fuera de las salas.</p></div></div>
<section class="career-archive" aria-labelledby="career-archive-title"><div class="career-archive__heading"><h3 id="career-archive-title">Exposiciones<br><em>y encuentros</em></h3><p>Una selección del archivo de la artista.<br>Cada encuentro, con su historia.</p></div>
<div class="career-tools" hidden><div class="career-filters" role="group" aria-label="Filtrar trayectoria"><button type="button" data-career-filter="all" aria-pressed="true">Todo</button>{''.join(f'<button type="button" data-career-filter="{k}" aria-pressed="false">{v}</button>' for k,v in labels.items())}</div><label>Ir al año<select class="career-year"><option value="">Elegir año</option>{''.join(f'<option value="{y}">{y}</option>' for y in years)}</select></label></div>
<p class="career-count" role="status" aria-live="polite">{len(items)} encuentros documentados</p>
{''.join(f'<section class="career-year-group" id="career-year-{y}" data-career-year="{y}" aria-labelledby="career-label-{y}"><h3 id="career-label-{y}">{y}</h3><div>{"".join(row(x) for x in items if x["year"]==y)}</div></section>' for y in years)}
<p class="career-method">{e(data['scope'])} Archivo revisado el 20 de octubre de 2026.</p></section>
<div class="career-outro"><p>La historia continúa<br>en cada obra.</p><a href="/#/destacada">Explorar la obra →</a></div></div>'''
index=(ROOT/'index.html').read_text()
index=re.sub(r'<section id="view-trayectoria"[\s\S]*?(?=<!-- ═══ SECTION 4: ENCARGO)' ,lambda _:f'<section id="view-trayectoria" class="view view--trayectoria view--premium-dark" aria-labelledby="career-title"><div id="exposiciones-container">{body}</div></section>',index,count=1)
assets='<link rel="stylesheet" href="/assets/trayectoria.css"><script type="module" src="/assets/trayectoria.js"></script>'
if '/assets/trayectoria.css' not in index:index=index.replace('</head>',assets+'\n</head>')
index=index.replace('href="#/trayectoria" class="nav__link"','href="/trayectoria/" class="nav__link"')
(ROOT/'index.html').write_text(index)
# The dedicated page shares the same content, with its own primary heading.
pagebody=body.replace('<h2 id="career-title">','<h1 id="career-title">').replace('Trayectoria</h2>','Trayectoria</h1>')
pagebody=pagebody.replace('<h3 id="career-archive-title">Exposiciones<br><em>y encuentros</em></h3>', '<h2 id="career-archive-title">Exposiciones<br><em>y encuentros</em></h2>')
page=f'''<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trayectoria · Naroa Gutiérrez Gil</title><meta name="description" content="Exposiciones y encuentros de Naroa Gutiérrez Gil: de Espejos del Alma a DiviNos VaiVenes. Una selección documentada de 2010 a 2026."><link rel="canonical" href="https://naroa.online/trayectoria/"><meta property="og:title" content="Trayectoria · Naroa Gutiérrez Gil"><meta property="og:description" content="El retrato como encuentro. Exposiciones, colectivos y arte en la calle, 2010–2026."><meta property="og:image" content="https://naroa.online{hero['src']}"><meta property="og:url" content="https://naroa.online/trayectoria/"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/favicon-Inu7iesc.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">{assets}</head><body class="career-page"><a class="career-skip" href="#career-main">Ir al contenido</a><nav class="career-nav" aria-label="Principal"><a href="/">NAROA<span>Gutiérrez Gil</span></a><a href="/#/destacada">Obra</a><a href="/sobre-mi/">Sobre mí</a><a href="/trayectoria/" aria-current="page">Trayectoria</a><a href="/#/contacto">Contacto ↗</a></nav><main id="career-main">{pagebody}</main><footer class="career-footer"><a href="/">Naroa Gutiérrez Gil</a><a href="mailto:naroa@naroa.eu">naroa@naroa.eu ↗</a><span>Bilbao · © 2026</span></footer></body></html>'''
folder=ROOT/'trayectoria';folder.mkdir(exist_ok=True);(folder/'index.html').write_text(page)
print(f'Built trajectory: {len(items)} sourced entries, {len(years)} years.')
