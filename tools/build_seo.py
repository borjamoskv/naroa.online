#!/usr/bin/env python3
"""Local portrait SEO from real content; run after the three page builders."""
import json,re
from pathlib import Path
from html import escape as e
from urllib.parse import quote
from xml.etree import ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]/'classic'
BASE='https://naroagutierrezgil.com';DAY='2026-10-21';SLUG='retratos-por-encargo-bilbao'
projects=json.loads((ROOT/'data/catalogo.json').read_text())['projects']
artist={'@type':'Person','@id':BASE+'/#artist','name':'Naroa Gutiérrez Gil','url':BASE+'/','jobTitle':'Artista plástica y retratista','description':'Artista y retratista en Bilbao. Retratos, dibujo, pintura, collage y objetos intervenidos.','homeLocation':{'@type':'City','name':'Bilbao'},'image':BASE+'/images/sobre-mi/naroa-monoculo.jpg','email':'naroa@naroa.eu','sameAs':['https://www.facebook.com/naroa.artista.plastica','https://www.instagram.com/naroa_art/','https://naroagutierrez.wordpress.com/']}
service={'@type':'Service','@id':BASE+'/'+SLUG+'/#service','name':'Retratos por encargo en Bilbao','serviceType':'Retratos personalizados por encargo','url':BASE+'/'+SLUG+'/','provider':{'@id':artist['@id']},'areaServed':{'@type':'City','name':'Bilbao'},'description':'Consulta un retrato personalizado con Naroa Gutiérrez Gil: idea, fotografía de referencia, materiales, formato y propuesta de encargo.'}
def schema(data,id='seo-schema'):
 return f'<script type="application/ld+json" id="{id}">'+json.dumps(data,ensure_ascii=False).replace('<','\\u003c')+'</script>'
def breadcrumb(title,url):
 return {'@context':'https://schema.org','@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'Inicio','item':BASE+'/'},{'@type':'ListItem','position':2,'name':title,'item':url}]}
def meta(s,title,description,image=None):
 s=re.sub(r'<title>.*?</title>',lambda _:f'<title>{e(title)}</title>',s,count=1,flags=re.S)
 def tag(key,value,prop=False):
  nonlocal s
  attr='property' if prop else 'name';tag=f'<meta {attr}="{key}" content="{e(value,quote=True)}">'
  pat=r'<meta\b[^>]*\b'+attr+'="'+re.escape(key)+r'"[^>]*>'
  s=re.sub(pat,lambda _:tag,s,count=1) if re.search(pat,s) else s.replace('</head>',tag+'\n</head>')
 for key,val,prop in [('description',description,False),('robots','index, follow, max-image-preview:large',False),('og:title',title,True),('og:description',description,True),('twitter:title',title,False),('twitter:description',description,False)]:tag(key,val,prop)
 if image:tag('og:image',BASE+image,True);tag('twitter:image',BASE+image,False)
 return s
# The portrait service page answers a different intent from the artist's portfolio.
cover=next(p for p in projects if p['slug']=='marilyn-rocks')['images'][0]
hugo=next(p for p in projects if p['slug']=='hugo-box')['images'][0]
url=BASE+'/'+SLUG+'/'
title='Retratos por encargo en Bilbao | Naroa Gutiérrez Gil'
desc='Retratos personalizados en Bilbao con Naroa Gutiérrez Gil. Explora su obra en pintura, dibujo y collage y consulta tu idea, formato y materiales.'
email='mailto:naroa@naroa.eu?subject='+quote('Consulta de retrato por encargo en Bilbao')
page=f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><meta name="description" content="{desc}"><link rel="canonical" href="{url}"><meta property="og:url" content="{url}"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/naroa-icon-64-v1.png"><link rel="apple-touch-icon" href="/assets/naroa-icon-180-v1.png"><link rel="stylesheet" href="/assets/pop-organic.css?v=20261021-pop-v3"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/trayectoria.css"><link rel="stylesheet" href="/assets/seo-local.css">{schema({'@context':'https://schema.org','@graph':[artist,service,{'@type':'WebPage','@id':url+'#webpage','url':url,'name':title,'description':desc,'inLanguage':'es','mainEntity':{'@id':service['@id']}}]})}{schema(breadcrumb('Retratos por encargo en Bilbao',url),'seo-breadcrumb')}</head><body class="portrait-service"><a class="career-skip" href="#service-main">Ir al contenido</a><nav class="career-nav" aria-label="Principal"><a href="/">NAROA<span>Gutiérrez Gil</span></a><a href="/#/destacada">Obra</a><a href="/sobre-mi/">Sobre mí</a><a href="/trayectoria/">Trayectoria</a><a href="#consulta">Encargos ↗</a></nav><main id="service-main"><header class="portrait-service__hero"><img src="{cover['src']}" width="{cover['width']}" height="{cover['height']}" alt="Marilyn Rocks: retrato de Marilyn Monroe sobre pizarra realizado por Naroa Gutiérrez Gil" fetchpriority="high" decoding="async"><div><p class="local-kicker">Naroa Gutiérrez Gil · Retratista</p><h1>Retratos por encargo<br>en Bilbao</h1><a href="#consulta">Cuéntame tu idea →</a></div></header><p class="local-caption">Marilyn Rocks · Una obra del archivo de Naroa. <a href="/obra/marilyn-rocks/">Ver técnica y detalles →</a></p>
<section class="local-section"><p class="local-kicker">Un retrato personal</p><div><h2>Una persona.<br>Una historia propia.</h2><p>Si buscas una retratista en Bilbao, puedes conocer aquí el trabajo de Naroa Gutiérrez Gil y consultarle un retrato personalizado. Su práctica reúne dibujo, pintura, collage y objetos intervenidos: el rostro y el material se eligen como parte de una misma historia.</p><p>Una fotografía, un recuerdo o una idea pueden servir de punto de partida. Al escribirle, cuéntale a quién te gustaría retratar y qué significado tiene para ti. Así podréis valorar el formato, los materiales y las posibilidades del proyecto.</p><a href="/sobre-mi/">Conocer a Naroa y su proceso →</a></div></section>
<section class="local-section"><p class="local-kicker">Materiales y posibilidades</p><div><h2>Más de una forma<br>de mirar un rostro.</h2><p>En su archivo encontrarás retratos sobre pizarra, trabajos sobre papel y madera, collages y cajas personalizadas. Las obras publicadas permiten descubrir su lenguaje y hablar sobre la dirección de un nuevo encargo.</p><p>La pizarra conserva sus bordes y textura; el collage incorpora capas y elementos con sentido; una caja o un objeto puede formar parte del regalo. Cada propuesta se estudia con Naroa antes de decidir cómo realizarla.</p><div class="local-links"><a href="/obra/amy-rocks/">Retrato sobre pizarra: Amy Rocks →</a><a href="/obra/hugo-box/">Caja personalizada: Hugo Box →</a><a href="/obra/entre-tantas-flores-de-dia/">Dibujo y collage: Entre Tantas Flores →</a></div></div></section>
<figure class="local-artwork"><a href="/obra/hugo-box/"><img src="{hugo['src']}" width="{hugo['width']}" height="{hugo['height']}" alt="Hugo Box, caja de madera personalizada con un retrato y elementos de celebración" loading="lazy" decoding="async"></a><figcaption>Hugo Box · Un ejemplo de retrato integrado en un regalo personal. <a href="/obra/hugo-box/">Descubrir el proyecto →</a></figcaption></figure>
<section class="local-section"><p class="local-kicker">Cómo consultar un encargo</p><div><h2>Empezamos<br>con tu idea.</h2><ol class="local-steps"><li><h3>Cuenta a quién quieres retratar</h3><p>Explica para quién sería la obra y si hay una ocasión o una fecha que debamos tener en cuenta. Puedes enviar una fotografía como referencia.</p></li><li><h3>Comparte el formato que imaginas</h3><p>Si te atrae una técnica o un proyecto del archivo, incluye su enlace. Si aún no lo tienes claro, puedes pedir orientación sobre las posibilidades.</p></li><li><h3>Consulta la propuesta</h3><p>Antes de encargar la pieza, acuerda con Naroa los materiales, las medidas, el presupuesto y el plazo disponible para tu proyecto.</p></li></ol></div></section>
<section class="local-section"><p class="local-kicker">Preguntas sobre retratos</p><div class="local-faq"><h2>Antes de escribir.</h2><details><summary>¿Se puede partir de una fotografía?</summary><p>Puedes enviar una fotografía para estudiar la idea. Naroa te indicará si la referencia sirve y qué información adicional necesita.</p></details><details><summary>¿Cuánto cuesta un retrato por encargo?</summary><p>Solicita una propuesta para tu idea. Conviene concretar tamaño, técnica, soporte y complejidad antes de acordar el presupuesto.</p></details><details><summary>¿Puedo encargar un retrato para regalar?</summary><p>Puedes plantear un retrato o un objeto personalizado como regalo. Cuenta para quién sería y la fecha que tienes en mente, y consulta las posibilidades con Naroa.</p></details><details><summary>¿Cuánto tarda y cómo se entrega?</summary><p>El plazo y la forma de entrega se acuerdan para cada proyecto. Si necesitas una fecha concreta o un envío, indícalo en el primer mensaje.</p></details></div></section>
<section id="consulta" class="local-consult"><p class="local-kicker">Contacto · Bilbao</p><h2>Tu retrato empieza<br>con una conversación.</h2><p>Escribe a Naroa Gutiérrez Gil y cuéntale tu idea, el formato que imaginas y cualquier fecha importante.</p><a class="local-cta" href="{email}">Consultar un retrato por email ↗</a><p><a href="mailto:naroa@naroa.eu">naroa@naroa.eu</a></p><a href="/#/destacada">Explorar los retratos y proyectos →</a></section></main><footer class="career-footer"><a href="/">Naroa Gutiérrez Gil · Retratista en Bilbao</a><a href="/sobre-mi/">Sobre mí</a><a href="/trayectoria/">Trayectoria</a><span>© 2026</span></footer></body></html>'''
page=meta(page,title,desc,cover['src']);folder=ROOT/SLUG;folder.mkdir(exist_ok=True);(folder/'index.html').write_text(page.replace('</head>', '<link rel="stylesheet" href="/assets/handwriting.css?v=20261021-child-v1"></head>'))
# Keep local context within the existing introduction, without an extra SEO panel.
p=ROOT/'index.html';s=p.read_text();s=re.sub(r'\s*<h1 class="catalog-visually-hidden">.*?</h1>','',s,count=1)
s=re.sub(r'<!-- local-seo:start -->[\s\S]*?<!-- local-seo:end -->','',s)
s=s.replace('<h2 id="catalog-title">Obra</h2>','<h1 id="catalog-title">Obra</h1>')
s=s.replace('Retratos sobre pizarra, collages, objetos que se abren y rostros que se transforman. Entra en cada proyecto para descubrir sus materiales y sus detalles.','Retratos sobre pizarra, collages y objetos que se transforman. Descubre la obra de Naroa Gutiérrez Gil, artista y retratista en Bilbao, y los detalles de cada proyecto.')
s=meta(s,'Naroa Gutiérrez Gil · Retratista en Bilbao','Naroa Gutiérrez Gil, artista y retratista en Bilbao. Descubre retratos en pizarra, dibujo, pintura y collage, y consulta un retrato por encargo.',cover['src'])
s=re.sub(r'<script type="application/ld\+json"(?: id="seo-schema")?>[\s\S]*?</script>',lambda _:schema({'@context':'https://schema.org','@graph':[artist,{'@type':'WebSite','@id':BASE+'/#website','url':BASE+'/','name':'Naroa Gutiérrez Gil','inLanguage':'es','publisher':{'@id':artist['@id']}},{'@type':'WebPage','@id':BASE+'/#webpage','url':BASE+'/','name':'Naroa Gutiérrez Gil · Retratista en Bilbao','inLanguage':'es','about':{'@id':artist['@id']}}]}),s,count=1)
s=s.replace('content="https://naroagutierrezgil.com"','content="https://naroagutierrezgil.com/"')
if '/assets/seo-local.css' not in s:s=s.replace('</head>','<link rel="stylesheet" href="/assets/seo-local.css">\n</head>')
if 'id="home-portrait-service"' not in s:s=s.replace('<div class="encargo__timeline">',f'<p id="home-portrait-service" class="local-inline-link"><a href="/{SLUG}/">Consulta las posibilidades de un retrato por encargo →</a></p>\n<div class="encargo__timeline">',1)
s=s.replace('Cómo encargar un retrato personalizado en Bilbao →','Consulta las posibilidades de un retrato por encargo →')
s=re.sub(r'/assets/seo-local\.css(?:\?[^" ]*)?', '/assets/seo-local.css?v=20261021-discreto',s)
s=s.replace('  <meta name="twitter:creator" content="@naroa_art">\n','') # An Instagram handle does not establish a Twitter account.
p.write_text(s)
# Contextual, crawlable links from the artist profile and every artwork page.
for p in [ROOT/'sobre-mi/index.html',ROOT/'trayectoria/index.html']+[ROOT/'obra'/x['slug']/'index.html' for x in projects]:
 s=p.read_text()
 if p==ROOT/'sobre-mi/index.html':s=meta(s,'Sobre Naroa Gutiérrez Gil · Artista y retratista en Bilbao','Conoce a Naroa Gutiérrez Gil, artista y retratista en Bilbao: su proceso con pintura, dibujo, collage y objetos, y su faceta de creación compartida.')
 if 'id="portrait-service-link"' not in s:
  link=f'<a id="portrait-service-link" href="/{SLUG}/">Retratos por encargo en Bilbao →</a>'
  s=s.replace('</footer>',link+'</footer>',1)
 if '/obra/' in str(p):
  name=next(x['title'] for x in projects if x['slug']==p.parent.name)
  if 'id="seo-breadcrumb"' not in s:s=s.replace('</head>',schema(breadcrumb(name,BASE+'/obra/'+p.parent.name+'/'),'seo-breadcrumb')+'</head>')
 else:
  name='Sobre Naroa' if p.parent.name=='sobre-mi' else 'Trayectoria'
  if 'id="seo-breadcrumb"' not in s:s=s.replace('</head>',schema(breadcrumb(name,BASE+'/'+p.parent.name+'/'),'seo-breadcrumb')+'</head>')
 if 'name="robots"' not in s:s=s.replace('</head>','<meta name="robots" content="index, follow, max-image-preview:large"></head>')
 p.write_text(s)
# Replace a legacy HTML file containing an error message with a permanent redirect.
legacy=ROOT/'landing-bilbao.html'
if legacy.exists():legacy.unlink()
for config in [ROOT/'vercel.json',ROOT.parent/'vercel.json']:
 d=json.loads(config.read_text());red={'source':'/landing-bilbao','destination':'/'+SLUG+'/','permanent':True}
 if red not in d.setdefault('redirects',[]):d['redirects'].append(red)
 config.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
(ROOT/'robots.txt').write_text('User-agent: *\nAllow: /\nDisallow: /test/\nDisallow: /assets/backup_pre4k/\n\nSitemap: '+BASE+'/sitemap.xml\n')
# Sitemap includes the actual public image URLs; no invented license or image credits.
NS='http://www.sitemaps.org/schemas/sitemap/0.9';IMG='http://www.google.com/schemas/sitemap-image/1.1'
ET.register_namespace('',NS);ET.register_namespace('image',IMG)
tree=ET.Element('{'+NS+'}urlset')
pages=[('/',[x['images'][0]['src'] for x in projects if x['selected']]),('/sobre-mi/',['/images/sobre-mi/naroa-monoculo.jpg','/images/sobre-mi/rara-avis.jpg']),('/trayectoria/',['/images/trayectoria/cantinflowers.jpg']),('/'+SLUG+'/',[cover['src'],hugo['src']])]+[('/obra/'+x['slug']+'/',[im['src'] for im in x['images']]) for x in projects]
series=json.loads((ROOT/'data/vaivenes.json').read_text())
pages.append(('/series/vaivenes/',[im['src'] for im in series['images']]))
for path,imgs in pages:
 u=ET.SubElement(tree,'{'+NS+'}url');ET.SubElement(u,'{'+NS+'}loc').text=BASE+path;ET.SubElement(u,'{'+NS+'}lastmod').text=DAY
 for src in imgs:
  im=ET.SubElement(u,'{'+IMG+'}image');ET.SubElement(im,'{'+IMG+'}loc').text=BASE+src
ET.indent(tree);ET.ElementTree(tree).write(ROOT/'sitemap.xml',encoding='utf-8',xml_declaration=True)
print(f'Built local portrait service page; updated metadata, links and image sitemap for {len(pages)} pages.')
