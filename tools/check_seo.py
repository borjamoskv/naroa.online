#!/usr/bin/env python3
"""Validate the crawlable local SEO release, independently of page generators."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,re
from xml.etree import ElementTree as ET
R=Path(__file__).resolve().parents[1]/'classic';BASE='https://naroagutierrezgil.com'
class Page(HTMLParser):
 def __init__(self):super().__init__();self.h1=0;self.ids=[];self.meta={};self.canon=[];self.links=[];self.images=[];self.title='';self.in_title=False;self.script=None;self.schemas=[]
 def handle_starttag(self,t,a):
  d=dict(a)
  if t=='h1':self.h1+=1
  if d.get('id'):self.ids.append(d['id'])
  if t=='title':self.in_title=True
  if t=='meta':self.meta[d.get('name',d.get('property',''))]=d.get('content','')
  if t=='link' and d.get('rel')=='canonical':self.canon.append(d['href'])
  if t=='a':self.links.append(d.get('href',''))
  if t=='img':self.images.append(d)
  if t=='script' and d.get('type')=='application/ld+json':self.script=''
 def handle_data(self,d):
  if self.in_title:self.title+=d
  if self.script is not None:self.script+=d
 def handle_endtag(self,t):
  if t=='title':self.in_title=False
  if t=='script' and self.script is not None:self.schemas.append(json.loads(self.script));self.script=None
sitemap=ET.parse(R/'sitemap.xml');ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9','i':'http://www.google.com/schemas/sitemap-image/1.1'}
urls=[u.text for u in sitemap.findall('s:url/s:loc',ns)];assert len(urls)==38 and len(set(urls))==38
pages={};titles=[]
for u in urls:
 path=urlsplit(u).path;f=R/path.lstrip('/')/'index.html' if path!='/' else R/'index.html'
 p=Page();p.feed(f.read_text());pages[u]=p;titles.append(p.title)
 assert p.h1==1,(u,'H1 count');assert len(set(p.ids))==len(p.ids),(u,'duplicate IDs');assert p.canon==[u],(u,'canonical')
 assert p.title.strip() and p.meta.get('description'),(u,'metadata')
 assert 'noindex' not in p.meta.get('robots','') and 'max-image-preview:large' in p.meta.get('robots',''),(u,'robots')
 for href in p.links:
  if href.startswith('/') and not href.startswith('//'):
   target=R/unquote(urlsplit(href).path).lstrip('/');target=target/'index.html' if target.is_dir() else target;assert target.is_file(),(u,href)
 for im in p.images:
  if im.get('src','').startswith('/'):
   assert (R/im['src'].lstrip('/')).is_file();assert im.get('alt'),(u,'missing alt')
assert len(titles)==len(set(titles)),'duplicate titles'
service=BASE+'/retratos-por-encargo-bilbao/'
assert 'Retratista en Bilbao' in pages[BASE+'/'].title
assert 'Retratos por encargo en Bilbao' in pages[service].title
assert sum('/retratos-por-encargo-bilbao/' in p.links for p in pages.values())>=36,'service orphaned'
for im in sitemap.findall('s:url/i:image/i:loc',ns):assert (R/urlsplit(im.text).path.lstrip('/')).is_file(),im.text
schema=next(s for s in pages[service].schemas if '@graph' in s)['@graph'];assert any(x.get('@type')=='Service' and x['areaServed']['name']=='Bilbao' for x in schema)
assert not any(x.get('@type') in ['LocalBusiness','AggregateRating'] for x in schema)
assert not (R/'landing-bilbao.html').exists()
for file in [R/'vercel.json',R.parent/'vercel.json']:
 d=json.loads(file.read_text());assert any(x['source']=='/landing-bilbao' and x['permanent'] for x in d['redirects'])
print('OK: 38 unique indexable URLs; titles, descriptions, canonical URLs, H1s, JSON-LD, internal links, image sitemap and legacy redirect verified.')
