#!/usr/bin/env python3
"""Check published catalogue links, image identity, dimensions and metadata offline."""
import hashlib, json
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
ROOT=Path(__file__).resolve().parents[1]/'classic'
class Page(HTMLParser):
    def __init__(self):super().__init__();self.refs=[];self.ids=[];self.h1=0;self.canonical=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='h1':self.h1+=1
        if a.get('rel')=='canonical':self.canonical.append(a['href'])
        for key in ['href','src']:
            if a.get(key,'').startswith('/') and not a[key].startswith('//'):self.refs.append(a[key])
data=json.loads((ROOT/'data/catalogo.json').read_text());projects=data['projects'];slugs=[p['slug'] for p in projects]
assert len(slugs)==len(set(slugs))
files=[ROOT/'index.html']+[ROOT/'obra'/slug/'index.html' for slug in slugs]
for f in files:
    page=Page();page.feed(f.read_text());assert page.h1==1,(f,page.h1)
    assert len(page.ids)==len(set(page.ids)),f
    assert len(page.canonical)==1,f
    for url in page.refs:
        path=ROOT/unquote(urlsplit(url).path).lstrip('/')
        if path.is_dir():path/='index.html'
        assert path.is_file(),(f,url)
for p in projects:
    src = p.get('source')
    if src is not None:
        assert src.startswith(('https://www.facebook.com/', 'https://naroagutierrez.wordpress.com/')), (p['slug'], src)
    for im in p['images']:
        path=ROOT/im['src'].lstrip('/')
        assert hashlib.sha256(path.read_bytes()).hexdigest()==im['sha256'],path
        assert im['caption'] and im['width']>0 and im['height']>0
    if p['category']=='caracterizacion':assert p['kind']=='proyecto'
    if p['selected']:assert max(p['images'][0]['width'],p['images'][0]['height'])>=700,p['title']
print(f'OK: {len(projects)} project pages; all links, image hashes and selected cover resolutions verified.')
