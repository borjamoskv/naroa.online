#!/usr/bin/env python3
"""Verify the curated series retains real source resolution, attribution and working anchors."""
import json,hashlib
from pathlib import Path
from html.parser import HTMLParser
from PIL import Image
R=Path(__file__).resolve().parents[1]/'classic'
d=json.loads((R/'data/vaivenes.json').read_text());items=d['images'];assert len(items)==8
assert len({i['slug'] for i in items})==len(items)
assert len({i['sha256'] for i in items})==len(items)
class Page(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.nav=[];self.images=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if 'id' in a:self.ids.append(a['id'])
  if t=='a' and a.get('href','').startswith('#'):self.nav.append(a['href'][1:])
  if t=='img' and a.get('src','').startswith('/'):self.images.append(a)
p=Page();p.feed((R/'series/vaivenes/index.html').read_text())
for im in items:
 f=R/im['src'].lstrip('/');assert hashlib.sha256(f.read_bytes()).hexdigest()==im['sha256']
 with Image.open(f) as photo:assert photo.size==(im['width'],im['height'])
 assert max(im['width'],im['height'])>=1600 and min(im['width'],im['height'])>=1200
 assert im['source'].startswith('https://');assert im['slug'] in p.ids and im['slug'] in p.nav
 if im.get('stage')=='dibujo':assert 'Dibujo del retrato' in im['caption']
assert all(a in p.ids for a in p.nav)
assert sum(i.get('fetchpriority')=='high' for i in p.images)==1
assert sum(i.get('loading')=='lazy' for i in p.images)==len(items)-1
print(f'OK: {len(items)} Vaivenes works; source hashes, actual resolution, process labels, anchors and lazy loading verified.')
