"""Render a last-known snapshot; the browser refreshes from the public WordPress API."""
from pathlib import Path
from html import escape as e
import json
ROOT=Path(__file__).resolve().parents[1]/'classic'
def render_notebook(level=3):
 data=json.loads((ROOT/'data/blog.json').read_text())
 def entry(post,featured=False):
  date=f'<time datetime="{e(post["date"])}">{e(post["date_label"])}</time>'
  photo=''
  if post.get('image'):
   im=post['image'];photo=f'<a class="notebook-photo" href="{e(post["url"])}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true"><img src="{e(im["src"])}" width="{im["width"]}" height="{im["height"]}" alt="{e(im["alt"])}" loading="lazy" decoding="async"></a>'
  return f'''<article class="notebook-entry {'notebook-entry--feature' if featured else 'notebook-entry--note'}">{photo}<div class="notebook-entry__text"><p class="notebook-meta"><span>{e(post['category'])}</span>{date}</p><h{level+1} class="notebook-post-title"><a href="{e(post['url'])}" target="_blank" rel="noopener noreferrer">{e(post['title'])}</a></h{level+1}><p class="notebook-summary">{e(post['summary'])}</p><a class="notebook-read" href="{e(post['url'])}" target="_blank" rel="noopener noreferrer">Leer la historia <span aria-hidden="true">↗</span><span class="notebook-visually-hidden">: {e(post['title'])}</span></a></div></article>'''
 featured=next(post for post in data['posts'] if post.get('featured'))
 notes=[post for post in data['posts'] if not post.get('featured')]
 return f'''<section class="artist-notebook notebook" id="about-journal" aria-labelledby="artist-notebook-title"><header class="notebook-intro"><p class="artist-kicker">Blog · Cuaderno abierto</p><h{level} id="artist-notebook-title">Entre una obra<br>y la siguiente<span aria-hidden="true">.</span></h{level}><p>Historias de obras, procesos y encuentros.<br>Contadas por Naroa, a su manera.</p></header>{entry(featured,True)}<div class="notebook-notes">{''.join(entry(post) for post in notes)}</div><footer class="notebook-footer"><p>Hay más de una forma<br>de entrar en una obra.</p><a href="https://naroagutierrez.wordpress.com/" target="_blank" rel="noopener noreferrer">Seguir leyendo su cuaderno <span aria-hidden="true">↗</span></a><a href="/series/vaivenes/">O dejar que hablen las imágenes <span aria-hidden="true">→</span></a></footer></section>'''
