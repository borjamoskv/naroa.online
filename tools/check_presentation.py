#!/usr/bin/env python3
"""Keep the main visual journey free of repeated photographs and artwork views."""
from pathlib import Path
from html.parser import HTMLParser
from collections import Counter
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1] / 'classic'

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []
        self.links = []
        self.cards = 0
    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'img' and attrs.get('src', '').startswith('/'):
            self.images.append(attrs['src'])
        if tag == 'a':
            self.links.append(attrs.get('href', ''))
        if tag == 'article' and 'catalog-card' in attrs.get('class', '').split():
            self.cards += 1

home = Page()
home.feed((ROOT / 'index.html').read_text())
series = json.loads((ROOT / 'data/vaivenes.json').read_text())['images']
assert len(series) == len({item['work_slug'] for item in series}) == 8
assert home.cards == 31
all_images = home.images + [item['src'] for item in series]
hashes = [hashlib.sha256((ROOT / src.lstrip('/')).read_bytes()).hexdigest() for src in all_images]
assert all(count == 1 for count in Counter(hashes).values()), 'Repeated photograph in home journey'
projects = json.loads((ROOT / 'data/catalogo.json').read_text())['projects']
assert all('/obra/' + project['slug'] + '/' in home.links for project in projects), 'Project missing from home'
assert home.images.count('/images/catalogo/marilyn-rocks-hq-01.webp') == 1
assert 'hero-depth-layers' not in (ROOT / 'assets/art-first.js').read_text()
print(f'OK: {len(all_images)} unique local photographs, eight distinct Vaivenes works, all 33 project links and one intact Marilyn hero.')
