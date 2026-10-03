#!/usr/bin/env python3
"""
build_museum_site.py — Generador estático de alta exergía para naroagutierrezgil.com (El Museo)
Compila las 6 páginas canónicas: /obra, /bio, /exposiciones, /prensa, /encargos, /contacto.
"""

import os
import re
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUSEUM_DIR = os.path.join(BASE_DIR, 'museum')
os.makedirs(MUSEUM_DIR, exist_ok=True)

# 1. Parsear Obras de src/artworks.ts
with open(os.path.join(BASE_DIR, 'src/artworks.ts')) as f:
    ts_content = f.read()

pattern = re.compile(
    r'{\s*id:\s*(\d+).*?category:\s*[\'\"]([^\'\"]+)[\'\"]\s*,.*?slug:\s*[\'\"]([^\'\"]+)[\'\"]\s*,.*?url:\s*[\'\"]([^\'\"]+)[\'\"]\s*,.*?title:\s*[\'\"]([^\'\"]+)[\'\"]\s*,.*?year:\s*[\'\"]([^\'\"]+)[\'\"]\s*,.*?medium:\s*[\'\"]([^\'\"]+)[\'\"]\s*,.*?description:\s*[\'\"]([^\'\"]+)[\'\"]',
    re.DOTALL
)

artworks = []
for m in pattern.findall(ts_content):
    artworks.append({
        'id': m[0],
        'category': m[1],
        'slug': m[2],
        'url': m[3],
        'title': m[4],
        'year': m[5],
        'medium': m[6],
        'description': m[7]
    })

# 2. Leer Exhibitions de live-site/data/exhibitions.json
with open(os.path.join(BASE_DIR, 'live-site/data/exhibitions.json')) as f:
    exhibitions_data = json.load(f)['exhibitions']

def get_header(active_nav=''):
    nav_items = [
        ('OBRA', '/obra/'),
        ('BIO', '/bio/'),
        ('EXPOSICIONES', '/exposiciones/'),
        ('PRENSA', '/prensa/'),
        ('ENCARGOS', '/encargos/'),
        ('CONTACTO', '/contacto/')
    ]
    links_html = ''
    for label, url in nav_items:
        is_active = ' active' if active_nav == label else ''
        links_html += f'          <li><a href="{url}" class="nav-link{is_active}">{label}</a></li>\n'
    
    return f"""  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="brand-link">
        <h1 class="brand-name">NAROA <span>GUTIÉRREZ GIL</span></h1>
        <span class="brand-tag">ARTISTA VISUAL · BILBAO</span>
      </a>
      <nav>
        <ul class="nav-menu">
{links_html}          <li><a href="https://naroa.online" target="_blank" rel="noopener noreferrer" class="nav-btn-lab">LAB / naroa.online ↗</a></li>
        </ul>
      </nav>
    </div>
  </header>"""

def get_footer():
    return """  <footer class="site-footer">
    <div class="footer-inner">
      <div>
        <p>© 2026 NAROA GUTIÉRREZ GIL · TODOS LOS DERECHOS RESERVADOS</p>
        <p style="margin-top: 4px; color: var(--text-muted);">Atelier en Bilbao, País Vasco · Envíos asegurados a toda Europa</p>
      </div>
      <div class="footer-links">
        <a href="/contacto/">Contacto</a>
        <a href="https://www.instagram.com/naroa_art/" target="_blank" rel="noopener noreferrer">Instagram</a>
        <a href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Facebook</a>
        <a href="https://naroa.online" target="_blank" rel="noopener noreferrer" style="color: var(--gold);">naroa.online ↗</a>
      </div>
    </div>
  </footer>"""

def write_page(rel_path, title, description, active_nav, content):
    full_path = os.path.join(MUSEUM_DIR, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    canonical = f"https://naroagutierrezgil.com/{rel_path.replace('index.html', '')}"
    html = f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} | Naroa Gutiérrez Gil · Artista Visual</title>
  <link rel="canonical" href="{canonical}" />
  <meta name="description" content="{description}" />
  <meta property="og:title" content="{title} | Naroa Gutiérrez Gil" />
  <meta property="og:description" content="{description}" />
  <meta property="og:image" content="https://naroa.online/assets/naroa-portrait-DW8XfHYG.webp" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=Share+Tech+Mono&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/museum.css" />
</head>
<body>
{get_header(active_nav)}
  <main class="main-wrapper">
{content}
  </main>
{get_footer()}
</body>
</html>"""
    with open(full_path, 'w', encoding='utf-8') as out:
        out.write(html)
    print(f"Generated {rel_path}")

# ── 1. PÁGINA: /obra/index.html ──────────────────────────────
rocks_count = sum(1 for a in artworks if a['category'] == 'rocks')
divinos_count = sum(1 for a in artworks if a['category'] == 'divinos')
kintsugi_count = sum(1 for a in artworks if a['category'] == 'kintsugi')
drawing_count = sum(1 for a in artworks if a['category'] == 'drawing')
total_count = len(artworks)

cards_html = ""
for art in artworks:
    clean_desc = art['description'].replace('"', '&quot;')
    cards_html += f"""        <article class="artwork-card" data-category="{art['category']}" data-id="{art['id']}" data-title="{art['title']}" data-medium="{art['medium']}" data-year="{art['year']}" data-desc="{clean_desc}" data-url="{art['url']}">
          <div class="artwork-img-box">
            <img src="{art['url']}" alt="{art['title']} — Naroa Gutiérrez Gil" loading="lazy" />
            <span class="artwork-zoom-badge">🔍 AMPLIAR</span>
          </div>
          <div class="artwork-info">
            <div class="artwork-meta-row">
              <span>SERIE {art['category'].upper()}</span>
              <span>{art['year']}</span>
            </div>
            <h3 class="artwork-title">{art['title']}</h3>
            <p class="artwork-medium">{art['medium']}</p>
            <p style="font-size: 0.84rem; color: var(--text-secondary); line-height: 1.4; margin-top: auto;">{art['description']}</p>
          </div>
        </article>\n"""

obra_content = f"""    <section class="section-header">
      <p class="section-kicker">CATÁLOGO RAZONADO & SERIES</p>
      <h2 class="section-title">OBRAS CANÓNICAS (36 PIEZAS)</h2>
      <p style="max-width: 680px; margin: 16px auto 0; color: var(--text-muted); font-size: 0.95rem;">
        Colección completa de piezas en acrílico, óleo, pan de oro y mica mineral sobre soporte de pizarra natural milenaria y lienzos de gran formato.
      </p>
    </section>

    <div class="search-filter-row">
      <div class="filter-bar">
        <button class="filter-pill active" data-filter="all">TODAS ({total_count})</button>
        <button class="filter-pill" data-filter="rocks">ROCKS & PIZARRA ({rocks_count})</button>
        <button class="filter-pill" data-filter="divinos">DIVINOS & POP ({divinos_count})</button>
        <button class="filter-pill" data-filter="kintsugi">KINTSUGI & LATAS ({kintsugi_count})</button>
        <button class="filter-pill" data-filter="drawing">DIBUJO & PASTEL ({drawing_count})</button>
      </div>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="obra-search" class="search-input" placeholder="Buscar por título o técnica..." autocomplete="off" />
      </div>
    </div>

    <div class="artwork-grid">
{cards_html}    </div>

    <!-- MODAL LIGHTBOX HAUTE CURATORIAL -->
    <div id="museum-lightbox" class="museum-lightbox" aria-hidden="true">
      <div class="lightbox-backdrop" onclick="closeMuseumLightbox()"></div>
      <div class="lightbox-dialog" role="dialog" aria-modal="true">
        <button class="lightbox-close" onclick="closeMuseumLightbox()" aria-label="Cerrar">✕</button>
        <div class="lightbox-media">
          <img id="lightbox-img" src="" alt="" />
        </div>
        <div class="lightbox-details">
          <span id="lightbox-series" class="lightbox-series"></span>
          <h3 id="lightbox-title" class="lightbox-title"></h3>
          <p id="lightbox-medium" class="lightbox-medium"></p>
          <p id="lightbox-desc" class="lightbox-desc"></p>
          <div class="lightbox-actions">
            <a id="lightbox-wa" href="" target="_blank" rel="noopener noreferrer" class="btn-primary">
              <span>💬</span>
              <span>CONSULTAR DISPONIBILIDAD EN WHATSAPP ↗</span>
            </a>
            <a href="https://naroa.online/#/lab" target="_blank" rel="noopener noreferrer" class="btn-secondary">
              <span>🔬</span>
              <span>INSPECCIONAR EN LAB 3D ↗</span>
            </a>
          </div>
        </div>
      </div>
    </div>

    <script>
      // Filtrado interactivo multi-criterio instantáneo
      let currentFilter = 'all';
      let currentQuery = '';

      function applyFilters() {{
        document.querySelectorAll('.artwork-card').forEach(card => {{
          const cat = card.getAttribute('data-category');
          const title = (card.getAttribute('data-title') || '').toLowerCase();
          const medium = (card.getAttribute('data-medium') || '').toLowerCase();
          const desc = (card.getAttribute('data-desc') || '').toLowerCase();

          const matchesCat = (currentFilter === 'all' || cat === currentFilter);
          const matchesQuery = !currentQuery || title.includes(currentQuery) || medium.includes(currentQuery) || desc.includes(currentQuery);

          if (matchesCat && matchesQuery) {{
            card.style.display = 'flex';
            card.style.animation = 'fadeInCard 0.35s ease forwards';
          }} else {{
            card.style.display = 'none';
          }}
        }});
      }}

      document.querySelectorAll('.filter-pill').forEach(btn => {{
        btn.addEventListener('click', () => {{
          document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentFilter = btn.getAttribute('data-filter');
          applyFilters();
        }});
      }});

      const searchInput = document.getElementById('obra-search');
      if (searchInput) {{
        searchInput.addEventListener('input', (e) => {{
          currentQuery = e.target.value.toLowerCase().trim();
          applyFilters();
        }});
      }}


      // Lightbox Haute Curatorial
      const lightbox = document.getElementById('museum-lightbox');
      const lbImg = document.getElementById('lightbox-img');
      const lbTitle = document.getElementById('lightbox-title');
      const lbMedium = document.getElementById('lightbox-medium');
      const lbSeries = document.getElementById('lightbox-series');
      const lbDesc = document.getElementById('lightbox-desc');
      const lbWa = document.getElementById('lightbox-wa');

      function openMuseumLightbox(card) {{
        const title = card.getAttribute('data-title');
        const medium = card.getAttribute('data-medium');
        const year = card.getAttribute('data-year');
        const desc = card.getAttribute('data-desc');
        const url = card.getAttribute('data-url');
        const cat = card.getAttribute('data-category');

        lbImg.src = url;
        lbImg.alt = title + ' — Naroa Gutiérrez Gil';
        lbTitle.textContent = title;
        lbMedium.textContent = year + ' · ' + medium;
        lbSeries.textContent = 'SERIE ' + cat.toUpperCase();
        lbDesc.textContent = desc;

        const waText = 'Hola Naroa! Me interesa conocer los detalles y disponibilidad de la obra "' + title + '" (' + year + ', ' + medium + ') expuesta en el catálogo oficial de naroagutierrezgil.com.';
        lbWa.href = 'https://wa.me/34636060609?text=' + encodeURIComponent(waText);

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      }}

      function closeMuseumLightbox() {{
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
      }}

      document.querySelectorAll('.artwork-card').forEach(card => {{
        card.addEventListener('click', () => openMuseumLightbox(card));
      }});

      window.addEventListener('keydown', (e) => {{
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {{
          closeMuseumLightbox();
        }}
      }});
    </script>

    <section class="lab-callout-banner">
      <p class="section-kicker">EXPERIENCIA INMERSIVA</p>
      <h3 class="lab-callout-title">¿QUIERES VER ESTAS OBRAS EN 3D?</h3>
      <p class="lab-callout-text">Visita el pabellón interactivo WebGL a 60fps con la banda sonora procedural <em>Boards of Burgos</em> en el laboratorio experimental.</p>
      <a href="https://naroa.online/#/experiments" target="_blank" rel="noopener noreferrer" class="btn-primary">
        <span>🏛️</span>
        <span>ABRIR PABELLÓN 3D EN NAROA.ONLINE ↗</span>
      </a>
    </section>"""

write_page('obra/index.html', 'Catálogo Razonado de Obras', 'Catálogo oficial de obras de Naroa Gutiérrez Gil: Series Rocks, Divinos, retratos en pizarra natural milenaria y pan de oro.', 'OBRA', obra_content)

# ── 2. PÁGINA: /bio/index.html ───────────────────────────────
bio_content = """    <section class="hero-editorial">
      <div class="hero-portrait-frame">
        <img src="/assets/naroa-portrait-DW8XfHYG.webp" alt="Naroa Gutiérrez Gil en su taller de Bilbao" />
      </div>

      <div>
        <p class="section-kicker">BIOGRAFÍA & MANIFIESTO MATÉRICO</p>
        <h2 class="section-title" style="text-align: left; margin-bottom: 24px;">NAROA GUTIÉRREZ GIL</h2>
        <div style="display: flex; flex-direction: column; gap: 18px; color: var(--text-secondary); font-size: 1.05rem; line-height: 1.7;">
          <p>
            Nacida en Bilbao y licenciada en Bellas Artes por la Universidad del País Vasco (UPV/EHU), Naroa Gutiérrez Gil ha consolidado un lenguaje plástico inconfundible que une la potencia del <strong>Hiperrealismo POP</strong> con la crudeza geológica de la <strong>pizarra natural fósil</strong> y los reflejos iridiscentes de la <strong>mica mineral</strong>.
          </p>
          <p>
            Su investigación matérica aborda la fragilidad de la memoria y la pervivencia del icono humano. Al sustituir el lienzo textil convencional por losas milenarias de pizarra negra, cada fractura de la roca se convierte en parte integral de la fisonomía del retrato.
          </p>
          <blockquote style="font-family: var(--font-editorial); font-size: 1.4rem; font-style: italic; color: var(--gold); border-left: 2px solid var(--gold); padding-left: 18px; margin: 12px 0;">
            «No busco domesticar la roca; busco que el rostro humano habite su fractura sin pedir perdón. La mirada sobre la piedra no parpadea: permanece.»
          </blockquote>
          <p>
            Sus obras forman parte de colecciones privadas en Madrid, Bilbao, San Sebastián, Barcelona, París y Londres, combinando encargos de taller bespoke con muestras en galerías de vanguardia.
          </p>
        </div>
      </div>
    </section>

    <!-- LOS TRES PILARES MATÉRICOS -->
    <section style="margin: 60px 0;">
      <p class="section-kicker" style="text-align: center;">INVESTIGACIÓN DE MATERIALES</p>
      <h3 class="section-title" style="text-align: center;">LOS TRES PILARES MATÉRICOS</h3>
      <div class="pillars-grid">
        <div class="pillar-card">
          <span class="pillar-num">PILAR 01</span>
          <h4 class="pillar-title">PIZARRA NATURAL FÓSIL</h4>
          <p class="pillar-desc">
            Losas extraídas de canteras milenarias con cantos vivos e irregulares. La roca no actúa como un fondo inerte, sino como coautora activa de la obra: sus vetas y estratos geológicos guían el trazo del pincel.
          </p>
        </div>
        <div class="pillar-card">
          <span class="pillar-num">PILAR 02</span>
          <h4 class="pillar-title">MICA MINERAL & PAN DE ORO</h4>
          <p class="pillar-desc">
            Micro-escamas de silicato de mica combinadas con láminas de pan de oro fino de 24 quilates. La luz rebota en ángulos dispares según la posición del espectador, transformando el cuadro en un objeto óptico dinámico.
          </p>
        </div>
        <div class="pillar-card">
          <span class="pillar-num">PILAR 03</span>
          <h4 class="pillar-title">KINTSUGI VITAL & METAL POP</h4>
          <p class="pillar-desc">
            Sublimación poética de la cicatriz inspirada en la técnica centenaria japonesa. Latas de hojalata prensada y superficies oxidadas se unen con suturas de oro, rescatando la belleza de lo vulnerable.
          </p>
        </div>
      </div>
    </section>

    <!-- CRONOLOGÍA CURATORIAL DE HITOS -->
    <section style="margin: 60px 0;">
      <p class="section-kicker" style="text-align: center;">HITOS & RECONOCIMIENTOS</p>
      <h3 class="section-title" style="text-align: center;">TRAYECTORIA ARTÍSTICA</h3>
      <div class="exhibitions-timeline" style="max-width: 900px; margin: 40px auto 0;">
        <article class="exhibition-item">
          <div class="exhibition-year">2024 - 2026</div>
          <div>
            <h4 class="exhibition-title">Investigación en Minerales Ópticos y Expansión Europea</h4>
            <p class="exhibition-place">Bilbao · Taller de Creación Matérica</p>
            <p class="exhibition-desc">Desarrollo de las series Kintsugi Mineral y Rocks de gran formato. Entrada en colecciones privadas de París, Londres y Madrid.</p>
          </div>
        </article>
        <article class="exhibition-item">
          <div class="exhibition-year">2023</div>
          <div>
            <h4 class="exhibition-title">Exposición Individual «Espejos del Alma»</h4>
            <p class="exhibition-place">Bizkaia · Sala de Exposiciones</p>
            <p class="exhibition-desc">Presentación pública de la serie de retratos sobre losas fósiles de pizarra negra con acabados al pan de oro y óleo satinado.</p>
          </div>
        </article>
        <article class="exhibition-item">
          <div class="exhibition-year">2021</div>
          <div>
            <h4 class="exhibition-title">Selección Muestra Jóvenes Creadores</h4>
            <p class="exhibition-place">País Vasco · Certamen Institucional</p>
            <p class="exhibition-desc">Distinción por la experimentación técnica y rescate de soportes geológicos en el hiperrealismo contemporáneo.</p>
          </div>
        </article>
        <article class="exhibition-item">
          <div class="exhibition-year">2018</div>
          <div>
            <h4 class="exhibition-title">Licenciatura en Bellas Artes (UPV/EHU)</h4>
            <p class="exhibition-place">Universidad del País Vasco · Especialidad Pintura</p>
            <p class="exhibition-desc">Formación académica rigurosa en dibujo anatómico, química de pigmentos, temple y técnicas clásicas de veladura.</p>
          </div>
        </article>
      </div>
    </section>

    <!-- CALLOUT AL SÓTANO EXPERIMENTAL -->
    <section class="lab-callout-banner">
      <p class="section-kicker">PROCESO EN VIVO & EXPERIMENTOS</p>
      <h3 class="lab-callout-title">EXPLORA EL LABORATORIO DIGITAL</h3>
      <p class="lab-callout-text">Accede a las pruebas de texturas interactivas, lupa de alta resolución y shaders WebGL en naroa.online.</p>
      <a href="https://naroa.online/#/process" target="_blank" rel="noopener noreferrer" class="btn-primary">
        <span>🔬</span>
        <span>VER PROCESO DE TALLER EN NAROA.ONLINE ↗</span>
      </a>
    </section>"""

write_page('bio/index.html', 'Biografía & Manifiesto Curatorial', 'Trayectoria profesional, formación en Bellas Artes y filosofía matérica de Naroa Gutiérrez Gil, artista visual en Bilbao.', 'BIO', bio_content)

# ── 3. PÁGINA: /exposiciones/index.html ───────────────────────
solo_count = sum(1 for e in exhibitions_data if e.get('type') == 'solo')
group_count = sum(1 for e in exhibitions_data if e.get('type') == 'group')
total_exhib = len(exhibitions_data)

exhib_items_html = ""
for ex in exhibitions_data:
    exhib_items_html += f"""      <article class="exhibition-item" data-type="{ex.get('type', 'solo')}">
        <div class="exhibition-year">{ex.get('year', '')}</div>
        <div>
          <h3 class="exhibition-title">{ex.get('title', '')} <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--gold); font-weight: normal;">({ex.get('type', 'solo').upper()})</span></h3>
          <p class="exhibition-place">📍 {ex.get('location', '')}</p>
          <p class="exhibition-desc">{ex.get('description', '')}</p>
        </div>
      </article>\n"""

exhib_content = f"""    <section class="section-header">
      <p class="section-kicker">HISTORIAL CURATORIAL</p>
      <h2 class="section-title">EXPOSICIONES & TRAYECTORIA (2018 - 2024)</h2>
      <p style="max-width: 680px; margin: 16px auto 0; color: var(--text-muted); font-size: 0.95rem;">
        Cronología exhaustiva de muestras individuales, participaciones colectivas y ferias de arte contemporáneo.
      </p>
    </section>

    <div class="filter-bar" style="margin-bottom: 40px;">
      <button class="filter-pill active" data-type="all">TODAS ({total_exhib})</button>
      <button class="filter-pill" data-type="solo">INDIVIDUALES ({solo_count})</button>
      <button class="filter-pill" data-type="group">COLECTIVAS ({group_count})</button>
    </div>

    <div class="exhibitions-timeline">
{exhib_items_html}    </div>

    <script>
      document.querySelectorAll('.filter-bar .filter-pill').forEach(btn => {{
        btn.addEventListener('click', () => {{
          document.querySelectorAll('.filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const type = btn.getAttribute('data-type');
          document.querySelectorAll('.exhibition-item').forEach(item => {{
            const itemType = item.getAttribute('data-type');
            if (type === 'all' || itemType === type) {{
              item.style.display = 'grid';
              item.style.animation = 'fadeInCard 0.3s ease forwards';
            }} else {{
              item.style.display = 'none';
            }}
          }});
        }});
      }});
    </script>"""

write_page('exposiciones/index.html', 'Historial de Exposiciones', 'Cronología de muestras individuales y colectivas de Naroa Gutiérrez Gil en Bilbao, Madrid, San Sebastián y galerías online.', 'EXPOSICIONES', exhib_content)

# ── 4. PÁGINA: /prensa/index.html ─────────────────────────────
prensa_content = """    <section class="section-header">
      <p class="section-kicker">MEDIOS & CRÍTICA DE ARTE</p>
      <h2 class="section-title">DOSSIER DE PRENSA & ENTREVISTAS</h2>
      <p style="max-width: 680px; margin: 16px auto 0; color: var(--text-muted); font-size: 0.95rem;">
        Artículos, entrevistas y menciones en medios de comunicación culturales y publicaciones de diseño de interiores.
      </p>
    </section>

    <!-- CITAS DESTACADAS DE CRÍTICA DE ARTE -->
    <div class="press-quotes-grid">
      <div class="press-quote-card">
        <p class="press-quote-text">«Una de las aportaciones más magnéticas y táctiles de la pintura figurativa vasca contemporánea. La roca no es soporte: es coautora viva del retrato.»</p>
        <div>
          <p class="press-quote-author">DEIA CULTURAL</p>
          <p class="press-quote-source">Suplemento de Artes Plásticas · Especial Nuevas Voces</p>
        </div>
      </div>
      <div class="press-quote-card">
        <p class="press-quote-text">«El rostro humano brota de la pizarra con una presencia que desafía la gravedad. La luz de la mica mineral transforma el cuadro en un objeto óptico dinámico.»</p>
        <div>
          <p class="press-quote-author">EL CORREO ESPAÑOL</p>
          <p class="press-quote-source">Sección Arte Vasco · Crítica de Exposiciones</p>
        </div>
      </div>
      <div class="press-quote-card">
        <p class="press-quote-text">«Al aplicar el kintsugi con pan de oro fino sobre latas y pizarra rota, Naroa Gutiérrez Gil eleva la cicatriz cotidiana a reliquia sagrada del pop contemporáneo.»</p>
        <div>
          <p class="press-quote-author">RADIO EUSKADI</p>
          <p class="press-quote-source">Graffiti Cultural · Mesa Redonda de Creadores</p>
        </div>
      </div>
    </div>

    <div class="exhibitions-timeline" style="max-width: 900px; margin: 0 auto;">
      <article class="exhibition-item">
        <div class="exhibition-year">2024</div>
        <div>
          <h3 class="exhibition-title">«El alma fósil del pop»: Entrevista en Deia Cultural</h3>
          <p class="exhibition-place">Deia · Suplemento de Cultura y Artes Plásticas</p>
          <p class="exhibition-desc">Un repaso monográfico sobre la serie Rocks y la introducción de pigmentos minerales iridiscentes en gran formato.</p>
        </div>
      </article>

      <article class="exhibition-item">
        <div class="exhibition-year">2023</div>
        <div>
          <h3 class="exhibition-title">«Miradas que desafían la gravedad»: Reportaje en El Correo</h3>
          <p class="exhibition-place">El Correo Español · Sección Arte Vasco</p>
          <p class="exhibition-desc">Crítica curatorial de la muestra Espejos del Alma y el uso de la técnica del pan de oro sobre pizarra negra.</p>
        </div>
      </article>

      <article class="exhibition-item">
        <div class="exhibition-year">2021</div>
        <div>
          <h3 class="exhibition-title">Especial Artistas Revelación: Radio Euskadi</h3>
          <p class="exhibition-place">Radio Euskadi · Programa Graffiti Cultural</p>
          <p class="exhibition-desc">Mesa redonda con las nuevas voces de la pintura figurativa contemporánea en el País Vasco tras la exposición en Sala Rekalde.</p>
        </div>
      </article>
    </div>

    <section class="lab-callout-banner" style="margin-top: 60px;">
      <p class="section-kicker">MATERIAL PARA COMISARIOS & MEDIOS</p>
      <h3 class="lab-callout-title">DESCARGAR DOSSIER CURATORIAL (PDF)</h3>
      <p class="lab-callout-text">Contiene biografía extendida, statement, ficha técnica de obras seleccionadas y fotografías en alta resolución para catálogos y notas de prensa.</p>
      <a href="mailto:naroa@naroa.eu?subject=Solicitud%20Dossier%20Prensa%20Naroa%20Gutierrez%20Gil" class="btn-primary">
        <span>📥</span>
        <span>SOLICITAR DOSSIER INSTITUCIONAL EN PDF ➔</span>
      </a>
    </section>"""


write_page('prensa/index.html', 'Prensa & Dossier Curatorial', 'Apariciones en medios de comunicación, entrevistas y dossier descargable para comisarios y periodistas de arte.', 'PRENSA', prensa_content)

# ── 5. PÁGINA: /encargos/index.html ───────────────────────────
encargos_content = """    <section class="section-header">
      <p class="section-kicker">ATELIER BESPOKE</p>
      <h2 class="section-title">RETRATOS & OBRAS POR ENCARGO</h2>
      <p style="max-width: 720px; margin: 16px auto 0; color: var(--text-muted); font-size: 0.95rem;">
        Piezas únicas pintadas a mano en acrílico, pan de oro y mica mineral sobre losa de pizarra natural milenaria tratada o lienzo 3D.
      </p>
    </section>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; margin-bottom: 60px;">
      <div style="background: var(--bg-card); border: 1px solid var(--gold-border); border-radius: 16px; padding: 32px;">
        <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--gold); letter-spacing: 0.2em;">FASE 01</span>
        <h3 style="font-family: var(--font-serif); font-size: 1.3rem; margin: 12px 0 8px;">CURADURÍA FOTOGRÁFICA</h3>
        <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.5;">Selección conjunta de fotografías de referencia en alta resolución. Análisis de iluminación, ángulo y expresión para capturar la esencia viva.</p>
      </div>

      <div style="background: var(--bg-card); border: 1px solid var(--gold-border); border-radius: 16px; padding: 32px;">
        <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--gold); letter-spacing: 0.2em;">FASE 02</span>
        <h3 style="font-family: var(--font-serif); font-size: 1.3rem; margin: 12px 0 8px;">ELECCIÓN DE SOPORTE</h3>
        <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.5;">Pizarra natural de cantera fósil con cantos rústicos o lienzo de gran formato. Determinación de dimensiones y peso de la pieza.</p>
      </div>

      <div style="background: var(--bg-card); border: 1px solid var(--gold-border); border-radius: 16px; padding: 32px;">
        <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--gold); letter-spacing: 0.2em;">FASE 03</span>
        <h3 style="font-family: var(--font-serif); font-size: 1.3rem; margin: 12px 0 8px;">CREACIÓN & METALES</h3>
        <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.5;">Pintura capa a capa, incrustación de escamas de mica mineral y pan de oro fino. Sellado protector mate o satinado anti-UV.</p>
      </div>
    </div>

    <!-- TERMINAL INTERACTIVO HAUTE BESPOKE ESTIMATOR -->
    <div class="bespoke-configurator-box">
      <div style="text-align: center; margin-bottom: 32px;">
        <p class="section-kicker">TERMINAL INTERACTIVO</p>
        <h3 style="font-family: var(--font-serif); font-size: 1.8rem; margin-bottom: 8px;">DISEÑA TU PROYECTO A MEDIDA</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 560px; margin: 0 auto;">
          Selecciona soporte, escala y metales nobles para generar una propuesta inmediata dirigida al taller de Bilbao.
        </p>
      </div>

      <!-- SELECCIÓN 1: SOPORTE -->
      <div class="config-step">
        <label class="config-label">1. SELECCIONA EL SOPORTE MATERIAL</label>
        <div class="config-options" data-group="support">
          <button type="button" class="config-pill active" data-val="Pizarra Natural Fósil (Cantos Rústicos)">🪨 Pizarra Natural Fósil</button>
          <button type="button" class="config-pill" data-val="Lienzo 3D Belga Gran Formato">🖼️ Lienzo 3D Belga</button>
          <button type="button" class="config-pill" data-val="Hojalata & Metales Kintsugi">🥫 Metales Kintsugi</button>
        </div>
      </div>

      <!-- SELECCIÓN 2: ESCALA / FORMATO -->
      <div class="config-step">
        <label class="config-label">2. ESCALA / DIMENSIÓN APROXIMADA</label>
        <div class="config-options" data-group="size">
          <button type="button" class="config-pill active" data-val="Íntimo (~40 × 30 cm)">Íntimo (~40 × 30 cm)</button>
          <button type="button" class="config-pill" data-val="Galería (~80 × 60 cm)">Galería (~80 × 60 cm)</button>
          <button type="button" class="config-pill" data-val="Monumental (~120 × 90 cm)">Monumental (~120 × 90 cm)</button>
        </div>
      </div>

      <!-- SELECCIÓN 3: PIGMENTOS Y METALES NOBLES -->
      <div class="config-step">
        <label class="config-label">3. METALES & PIGMENTOS MINERALES</label>
        <div class="config-options" data-group="metal">
          <button type="button" class="config-pill active" data-val="Pan de Oro 24K Fino">✨ Pan de Oro 24K Fino</button>
          <button type="button" class="config-pill" data-val="Mica Mineral Iridiscente">💎 Mica Mineral Iridiscente</button>
          <button type="button" class="config-pill" data-val="Hiperrealismo Clásico Óleo Puro">🎨 Óleo Clásico Puro</button>
          <button type="button" class="config-pill" data-val="Fusión Mixta Kintsugi">⚡ Fusión Mixta Kintsugi</button>
        </div>
      </div>

      <!-- RESUMEN EN TIEMPO REAL -->
      <div class="config-summary-card">
        <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--gold); letter-spacing: 0.15em; margin-bottom: 6px;">RESUMEN DE CONFIGURACIÓN BESPOKE</div>
        <div id="config-summary-text" style="font-family: var(--font-editorial); font-size: 1.25rem; font-style: italic; color: #FFFFFF; line-height: 1.4; margin-bottom: 24px;">
          Retrato sobre Pizarra Natural Fósil (Cantos Rústicos) · Escala Íntimo (~40 × 30 cm) · Acabado Pan de Oro 24K Fino
        </div>

        <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
          <a id="btn-config-wa" href="#" target="_blank" rel="noopener noreferrer" class="btn-primary" style="padding: 14px 28px;">
            <span>💬</span>
            <span>ENVIAR CONFIGURACIÓN POR WHATSAPP ➔</span>
          </a>
          <a id="btn-config-mail" href="#" class="btn-secondary" style="padding: 14px 28px;">
            <span>✉</span>
            <span>ENVIAR POR EMAIL</span>
          </a>
        </div>
      </div>
    </div>

    <script>
      let selectedSupport = 'Pizarra Natural Fósil (Cantos Rústicos)';
      let selectedSize = 'Íntimo (~40 × 30 cm)';
      let selectedMetal = 'Pan de Oro 24K Fino';

      function updateConfigurator() {
        const summary = document.getElementById('config-summary-text');
        const btnWa = document.getElementById('btn-config-wa');
        const btnMail = document.getElementById('btn-config-mail');

        summary.textContent = 'Retrato sobre ' + selectedSupport + ' · Escala ' + selectedSize + ' · Acabado ' + selectedMetal;

        const text = 'Hola Naroa! He configurado un encargo bespoke en naroagutierrezgil.com:\\n• Soporte: ' + selectedSupport + '\\n• Escala: ' + selectedSize + '\\n• Acabado: ' + selectedMetal + '\\n¿Podemos hablar de plazos y propuesta económica?';

        btnWa.href = 'https://wa.me/34636060609?text=' + encodeURIComponent(text);
        btnMail.href = 'mailto:naroa@naroa.eu?subject=' + encodeURIComponent('Consulta Encargo Bespoke: ' + selectedSupport) + '&body=' + encodeURIComponent(text);
      }

      document.querySelectorAll('.config-options').forEach(group => {
        const groupName = group.getAttribute('data-group');
        group.querySelectorAll('.config-pill').forEach(pill => {
          pill.addEventListener('click', () => {
            group.querySelectorAll('.config-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const val = pill.getAttribute('data-val');
            if (groupName === 'support') selectedSupport = val;
            if (groupName === 'size') selectedSize = val;
            if (groupName === 'metal') selectedMetal = val;
            updateConfigurator();
          });
        });
      });

      updateConfigurator();
    </script>"""

write_page('encargos/index.html', 'Encargos Bespoke & Retratos Personalizados', 'Proceso de encargo de retratos hiperrealistas en pizarra y óleo con Naroa Gutiérrez Gil desde Bilbao.', 'ENCARGOS', encargos_content)

# ── 6. PÁGINA: /contacto/index.html ───────────────────────────
contacto_content = """    <section class="section-header">
      <p class="section-kicker">ESTUDIO & GALERÍA</p>
      <h2 class="section-title">CONTACTO DIRECTO</h2>
      <p style="max-width: 680px; margin: 16px auto 0; color: var(--text-muted); font-size: 0.95rem;">
        Para adquisición de obra original, visitas privadas al taller con cita previa, exposiciones o prensa.
      </p>
    </section>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 32px; max-width: 900px; margin: 0 auto 60px;">
      <div style="background: var(--bg-card); border: 1px solid var(--gold-border); border-radius: 16px; padding: 32px;">
        <span style="font-size: 2rem;">📍</span>
        <h3 style="font-family: var(--font-serif); font-size: 1.25rem; margin: 12px 0 6px;">TALLER EN BILBAO</h3>
        <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.5;">Bilbao, Bizkaia (País Vasco, España). Visitas para coleccionistas concertadas previamente.</p>
      </div>

      <div style="background: var(--bg-card); border: 1px solid var(--gold-border); border-radius: 16px; padding: 32px;">
        <span style="font-size: 2rem;">✉</span>
        <h3 style="font-family: var(--font-serif); font-size: 1.25rem; margin: 12px 0 6px;">CORREO ELECTRÓNICO</h3>
        <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.5;">Atención institucional y pedidos:<br><a href="mailto:naroa@naroa.eu" style="color: var(--gold); font-weight: 700;">naroa@naroa.eu</a></p>
      </div>

      <div style="background: var(--bg-card); border: 1px solid var(--gold-border); border-radius: 16px; padding: 32px;">
        <span style="font-size: 2rem;">💬</span>
        <h3 style="font-family: var(--font-serif); font-size: 1.25rem; margin: 12px 0 6px;">WHATSAPP OFICIAL</h3>
        <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.5;">Atención directa de taller:<br><a href="https://wa.me/34636060609" target="_blank" rel="noopener noreferrer" style="color: var(--gold); font-weight: 700;">+34 636 060 609</a></p>
      </div>
    </div>

    <!-- TERMINAL DE CONTACTO RÁPIDO CON SELECCIÓN DE MOTIVO -->
    <div style="background: var(--bg-surface); border: 1px solid var(--gold-border); border-radius: 20px; padding: 48px 32px; max-width: 800px; margin: 0 auto; text-align: center;">
      <p class="section-kicker">CANAL PRIORITARIO</p>
      <h3 style="font-family: var(--font-serif); font-size: 1.8rem; margin-bottom: 12px;">INICIAR CONVERSACIÓN CON EL ATELIER</h3>
      <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 28px;">
        Selecciona el motivo de tu consulta para abrir el canal directo de comunicación inmediata con el taller de Bilbao:
      </p>

      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 32px;" id="contact-reasons">
        <button type="button" class="config-pill active" data-msg="Hola Naroa, me gustaría consultar la disponibilidad de una obra original de tu catálogo.">🖼️ Obra de Catálogo</button>
        <button type="button" class="config-pill" data-msg="Hola Naroa, deseo consultar sobre un encargo personalizado bespoke en pizarra fósil.">⚡ Encargo Bespoke</button>
        <button type="button" class="config-pill" data-msg="Hola Naroa, te contacto con una propuesta curatorial / exposición para galería o feria de arte.">🏛️ Exposición / Comisariado</button>
        <button type="button" class="config-pill" data-msg="Hola Naroa, te escribo de un medio de comunicación cultural para una entrevista o nota de prensa.">📰 Prensa / Medios</button>
      </div>

      <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
        <a id="btn-contact-wa" href="https://wa.me/34636060609?text=Hola%20Naroa%2C%20me%20gustar%C3%ADa%20consultar%20la%20disponibilidad%20de%20una%20obra%20original%20de%20tu%20cat%C3%A1logo." target="_blank" rel="noopener noreferrer" class="btn-primary" style="padding: 14px 28px;">
          <span>💬</span>
          <span>ABRIR WHATSAPP OFICIAL ➔</span>
        </a>
        <a id="btn-contact-mail" href="mailto:naroa@naroa.eu" class="btn-secondary" style="padding: 14px 28px;">
          <span>✉</span>
          <span>ENVIAR CORREO ELECTRÓNICO</span>
        </a>
      </div>
    </div>

    <script>
      document.querySelectorAll('#contact-reasons .config-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#contact-reasons .config-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const msg = btn.getAttribute('data-msg');
          document.getElementById('btn-contact-wa').href = 'https://wa.me/34636060609?text=' + encodeURIComponent(msg);
          document.getElementById('btn-contact-mail').href = 'mailto:naroa@naroa.eu?subject=' + encodeURIComponent('Consulta desde naroagutierrezgil.com') + '&body=' + encodeURIComponent(msg);
        });
      });
    </script>"""

write_page('contacto/index.html', 'Contacto Institucional & Taller', 'Contacto oficial de Naroa Gutiérrez Gil en Bilbao: teléfono, email, estudio y redes para adquisición de obra y prensa.', 'CONTACTO', contacto_content)

print("Museum site compilation finished successfully!")
