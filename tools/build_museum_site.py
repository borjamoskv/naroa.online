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

# 2. Leer Exhibitions de src/data/exhibitions.json (canónico)
exhibitions_path = os.path.join(BASE_DIR, 'src/data/exhibitions.json')
if not os.path.exists(exhibitions_path):
    exhibitions_path = os.path.join(BASE_DIR, 'live-site/data/exhibitions.json')
with open(exhibitions_path, 'r', encoding='utf-8') as f:
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
  <meta property="og:image" content="https://naroagutierrezgil.com/assets/naroa-portrait-DW8XfHYG.webp" />
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

    <!-- MODAL LIGHTBOX HAUTE CURATORIAL CON NAVEGACIÓN SECUENCIAL -->
    <div id="museum-lightbox" class="museum-lightbox" aria-hidden="true">
      <div class="lightbox-backdrop" onclick="closeMuseumLightbox()"></div>
      <div class="lightbox-dialog" role="dialog" aria-modal="true">
        <button class="lightbox-close" onclick="closeMuseumLightbox()" aria-label="Cerrar">✕</button>
        <button class="lightbox-nav-btn lightbox-prev" onclick="navigateMuseumLightbox(-1)" aria-label="Obra anterior">‹</button>
        <button class="lightbox-nav-btn lightbox-next" onclick="navigateMuseumLightbox(1)" aria-label="Obra siguiente">›</button>

        <div class="lightbox-media">
          <img id="lightbox-img" src="" alt="" />
        </div>
        <div class="lightbox-details">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span id="lightbox-series" class="lightbox-series"></span>
            <span id="lightbox-counter" class="lightbox-counter"></span>
          </div>
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

      // Lightbox Haute Curatorial con Navegación Secuencial
      const lightbox = document.getElementById('museum-lightbox');
      const lbImg = document.getElementById('lightbox-img');
      const lbTitle = document.getElementById('lightbox-title');
      const lbMedium = document.getElementById('lightbox-medium');
      const lbSeries = document.getElementById('lightbox-series');
      const lbDesc = document.getElementById('lightbox-desc');
      const lbWa = document.getElementById('lightbox-wa');
      const lbCounter = document.getElementById('lightbox-counter');

      let currentCardIndex = -1;
      let visibleCards = [];

      function getVisibleCards() {{
        return Array.from(document.querySelectorAll('.artwork-card')).filter(c => c.style.display !== 'none');
      }}

      function renderLightbox(card, index, total) {{
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
        lbCounter.textContent = String(index).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');

        const waText = 'Hola Naroa! Me interesa conocer los detalles y disponibilidad de la obra "' + title + '" (' + year + ', ' + medium + ') expuesta en el catálogo oficial de naroagutierrezgil.com.';
        lbWa.href = 'https://wa.me/34636060609?text=' + encodeURIComponent(waText);

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      }}

      function openMuseumLightboxByIndex(idx) {{
        visibleCards = getVisibleCards();
        if (visibleCards.length === 0) return;
        if (idx < 0) idx = visibleCards.length - 1;
        if (idx >= visibleCards.length) idx = 0;
        currentCardIndex = idx;
        renderLightbox(visibleCards[currentCardIndex], currentCardIndex + 1, visibleCards.length);
      }}

      function navigateMuseumLightbox(delta) {{
        openMuseumLightboxByIndex(currentCardIndex + delta);
      }}

      function closeMuseumLightbox() {{
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
      }}

      document.querySelectorAll('.artwork-card').forEach((card) => {{
        card.addEventListener('click', () => {{
          visibleCards = getVisibleCards();
          const idx = visibleCards.indexOf(card);
          openMuseumLightboxByIndex(idx !== -1 ? idx : 0);
        }});
      }});

      window.addEventListener('keydown', (e) => {{
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') {{
          closeMuseumLightbox();
        }} else if (e.key === 'ArrowRight') {{
          navigateMuseumLightbox(1);
        }} else if (e.key === 'ArrowLeft') {{
          navigateMuseumLightbox(-1);
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

    <!-- ==========================================
         CONFIGURADOR DE ENCARGOS + FAQ SEO BILBAO
         ========================================== -->
    <section id="encargos-configurador" class="naroa-commission-wrap">
      <div class="naroa-commission-header">
        <span class="naroa-badge">Estudio en Bilbao · Piezas Únicas</span>
        <h2>Configura tu Retrato por Encargo</h2>
        <p>No necesitas tenerlo todo claro. Elige la base que más te inspire y cuéntame la historia detrás del rostro.</p>
      </div>

      <div class="naroa-config-grid">
        <!-- Columna Izquierda: Selectores -->
        <div class="naroa-steps">
          
          <!-- Paso 1: Soporte -->
          <div class="naroa-step-group">
            <label class="naroa-step-label">1. ¿Qué soporte te llama más?</label>
            <div class="naroa-options" data-group="soporte">
              <button type="button" class="naroa-chip active" data-value="Pizarra natural (acrílico sobre piedra)">
                🪨 Pizarra Natural
                <small>Textura milenaria</small>
              </button>
              <button type="button" class="naroa-chip" data-value="Lienzo (óleo / acrílico)">
                🎨 Lienzo
                <small>Óleo y acrílico</small>
              </button>
              <button type="button" class="naroa-chip" data-value="Mica mineral y Mixed Media">
                ✨ Mica Mineral
                <small>Brillo orgánico</small>
              </button>
              <button type="button" class="naroa-chip" data-value="Formato Lata (Tin Art / Amor en Conserva)">
                🥫 En Conserva
                <small>Tin Art único</small>
              </button>
              <button type="button" class="naroa-chip" data-value="Quiero que me asesores con el soporte">
                💡 Déjame aconsejarte
                <small>Lo vemos juntos</small>
              </button>
            </div>
          </div>

          <!-- Paso 2: Protagonista -->
          <div class="naroa-step-group">
            <label class="naroa-step-label">2. ¿A quién vamos a inmortalizar?</label>
            <div class="naroa-options" data-group="sujeto">
              <button type="button" class="naroa-chip active" data-value="un retrato individual">👤 Individual</button>
              <button type="button" class="naroa-chip" data-value="un retrato de pareja o familia">👥 Pareja / Familia</button>
              <button type="button" class="naroa-chip" data-value="un retrato homenaje muy especial">🕊️ Homenaje</button>
              <button type="button" class="naroa-chip" data-value="un retrato de mascota / compañero de vida">🐾 Mascota</button>
            </div>
          </div>

          <!-- Paso 3: Entrega -->
          <div class="naroa-step-group">
            <label class="naroa-step-label">3. ¿Dónde entregamos la obra?</label>
            <div class="naroa-options" data-group="entrega">
              <button type="button" class="naroa-chip active" data-value="recogida en mano en Bilbao">📍 En mano en Bilbao / Bizkaia</button>
              <button type="button" class="naroa-chip" data-value="envío asegurado con certificado">📦 Envío asegurado (España / Internacional)</button>
            </div>
          </div>

          <!-- Paso 4: Detalles opcionales -->
          <div class="naroa-step-group">
            <label class="naroa-step-label" for="naroa-custom-note">4. ¿Algún detalle o fecha especial? (Opcional)</label>
            <input 
              type="text" 
              id="naroa-custom-note" 
              class="naroa-input" 
              placeholder="Ej: Es para un aniversario en junio, le encanta el estilo Pop..."
            />
          </div>
        </div>

        <!-- Columna Derecha: Vista previa del mensaje y Acción -->
        <div class="naroa-preview-card">
          <div class="naroa-preview-top">
            <span class="naroa-preview-tag">Tu mensaje listo para enviar</span>
            <textarea id="naroa-message-box" rows="6" readonly></textarea>
          </div>

          <div class="naroa-actions">
            <a id="naroa-mailto-btn" href="#" class="naroa-btn naroa-btn-primary">
              Enviar por Email →
            </a>
            <a id="naroa-wa-btn" href="#" target="_blank" rel="noopener noreferrer" class="naroa-btn" style="background: #25D366; color: #000; font-weight: 700;">
              Enviar por WhatsApp 💬
            </a>
            <button type="button" id="naroa-ig-btn" class="naroa-btn naroa-btn-secondary">
              Copiar idea y abrir Instagram (@naroagutierrezgil)
            </button>
            <p id="naroa-copy-toast" class="naroa-toast" aria-live="polite"></p>
          </div>

          <div class="naroa-trust-notes">
            <span>✓ Boceto previo sin compromiso</span>
            <span>✓ Fotos del proceso paso a paso</span>
            <span>✓ Certificado de autenticidad</span>
          </div>
        </div>
      </div>

      <!-- Bloque FAQ para SEO Local ("Retratos Bilbao") -->
      <div class="naroa-faq-block">
        <h3>Preguntas frecuentes sobre retratos por encargo en Bilbao</h3>
        
        <details class="naroa-faq-item">
          <summary>¿Qué tipo de fotografía necesito para encargar un retrato?</summary>
          <p>No necesitas una sesión profesional. Basta con una o varias fotos donde se reconozca bien la expresión y la mirada. Si quieres unir en un mismo cuadro a personas de distintas fotos o restaurar un recuerdo antiguo, trabajamos el boceto previo hasta dar con la composición exacta.</p>
        </details>

        <details class="naroa-faq-item">
          <summary>¿Puedo ver o recoger el retrato en persona en Bilbao?</summary>
          <p>Sí. Mi estudio está en Bilbao. Podemos comentar la obra, elegir juntos la laja de pizarra o el formato del lienzo y hacer la entrega en mano en Bilbao y Bizkaia. Si estás fuera, envío la obra protegida y asegurada a cualquier punto.</p>
        </details>

        <details class="naroa-faq-item">
          <summary>¿Cuánto tiempo lleva pintar un retrato hiperrealista o Pop Art?</summary>
          <p>Cada pieza se pinta a mano capa a capa respetando los tiempos de secado del óleo, el acrílico y los minerales. El plazo habitual oscila entre 3 y 6 semanas según el tamaño y el soporte elegido. Si tienes una fecha clave para un regalo, dímelo en el primer mensaje para planificarlo.</p>
        </details>
      </div>
    </section>

    <!-- Datos Estructurados FAQPage para Google -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "¿Qué tipo de fotografía necesito para encargar un retrato?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No necesitas una sesión profesional. Basta con una o varias fotos donde se reconozca bien la expresión y la mirada. También es posible combinar diferentes fotografías en un único boceto personalizado."
          }
        },
        {
          "@type": "Question",
          "name": "¿Puedo encargar y recoger el retrato en mano en Bilbao?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Sí. El estudio de Naroa Gutiérrez Gil está en Bilbao, permitiendo asesoramiento sobre soportes como pizarra natural, mica o lienzo y entrega en mano en Bilbao y Bizkaia, además de envío asegurado al resto de España."
          }
        },
        {
          "@type": "Question",
          "name": "¿Cuánto tiempo se tarda en pintar un retrato por encargo?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "El proceso artesanal al óleo, acrílico o sobre piedra natural toma habitualmente entre 3 y 6 semanas, incluyendo el envío de fotografías del progreso y certificado de autenticidad."
          }
        }
      ]
    }
    </script>

    <style>
      .naroa-commission-wrap {
        max-width: 1080px;
        margin: 4rem auto;
        padding: 2.5rem 1.5rem;
        color: #f4f4f5;
        font-family: inherit;
      }
      .naroa-commission-header {
        text-align: center;
        max-width: 680px;
        margin: 0 auto 2.5rem;
      }
      .naroa-badge {
        display: inline-block;
        font-size: 0.78rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #d4af37;
        border: 1px solid rgba(212, 175, 55, 0.35);
        padding: 0.35rem 0.85rem;
        border-radius: 999px;
        margin-bottom: 0.8rem;
      }
      .naroa-commission-header h2 {
        font-size: clamp(1.8rem, 3.5vw, 2.5rem);
        margin: 0.3rem 0 0.8rem;
      }
      .naroa-commission-header p {
        color: #a1a1aa;
        line-height: 1.6;
      }
      .naroa-config-grid {
        display: grid;
        grid-template-columns: 1.25fr 1fr;
        gap: 2rem;
        align-items: start;
      }
      @media (max-width: 840px) {
        .naroa-config-grid {
          grid-template-columns: 1fr;
        }
      }
      .naroa-step-group {
        margin-bottom: 1.6rem;
      }
      .naroa-step-label {
        display: block;
        font-weight: 600;
        margin-bottom: 0.75rem;
        font-size: 0.95rem;
        color: #e4e4e7;
      }
      .naroa-options {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
      }
      .naroa-chip {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #e4e4e7;
        padding: 0.65rem 1rem;
        border-radius: 12px;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s ease;
        font-size: 0.9rem;
      }
      .naroa-chip small {
        display: block;
        font-size: 0.72rem;
        color: #a1a1aa;
        margin-top: 0.15rem;
      }
      .naroa-chip:hover {
        border-color: rgba(212, 175, 55, 0.5);
        background: rgba(255, 255, 255, 0.07);
      }
      .naroa-chip.active {
        background: rgba(212, 175, 55, 0.14);
        border-color: #d4af37;
        color: #ffffff;
      }
      .naroa-input {
        width: 100%;
        padding: 0.85rem 1rem;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.04);
        color: #fff;
        font-size: 0.92rem;
        box-sizing: border-box;
      }
      .naroa-preview-card {
        background: rgba(24, 24, 27, 0.85);
        border: 1px solid rgba(212, 175, 55, 0.28);
        border-radius: 16px;
        padding: 1.5rem;
        position: sticky;
        top: 2rem;
      }
      .naroa-preview-tag {
        display: block;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #d4af37;
        margin-bottom: 0.6rem;
      }
      #naroa-message-box {
        width: 100%;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        color: #f4f4f5;
        padding: 0.9rem;
        font-size: 0.92rem;
        line-height: 1.55;
        resize: vertical;
        box-sizing: border-box;
        margin-bottom: 1rem;
      }
      .naroa-actions {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }
      .naroa-btn {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        padding: 0.9rem 1.2rem;
        border-radius: 10px;
        font-weight: 600;
        font-size: 0.95rem;
        text-decoration: none;
        cursor: pointer;
        transition: transform 0.15s ease, opacity 0.2s ease;
        border: none;
      }
      .naroa-btn-primary {
        background: #d4af37;
        color: #111113;
      }
      .naroa-btn-secondary {
        background: rgba(255, 255, 255, 0.08);
        color: #f4f4f5;
        border: 1px solid rgba(255, 255, 255, 0.16);
      }
      .naroa-btn:hover {
        transform: translateY(-1px);
      }
      .naroa-toast {
        font-size: 0.82rem;
        color: #d4af37;
        min-height: 1.2em;
        margin: 0.2rem 0 0;
        text-align: center;
      }
      .naroa-trust-notes {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 0.78rem;
        color: #a1a1aa;
      }
      .naroa-faq-block {
        margin-top: 3.5rem;
        padding-top: 2rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      .naroa-faq-block h3 {
        font-size: 1.35rem;
        margin-bottom: 1.2rem;
      }
      .naroa-faq-item {
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding: 1rem 0;
      }
      .naroa-faq-item summary {
        cursor: pointer;
        font-weight: 600;
        color: #f4f4f5;
      }
      .naroa-faq-item p {
        margin: 0.75rem 0 0;
        color: #a1a1aa;
        line-height: 1.6;
        font-size: 0.94rem;
      }
    </style>

    <script>
      (function () {
        const state = {
          soporte: "Pizarra natural (acrílico sobre piedra)",
          sujeto: "un retrato individual",
          entrega: "recogida en mano en Bilbao",
          nota: ""
        };

        const msgBox = document.getElementById("naroa-message-box");
        const mailBtn = document.getElementById("naroa-mailto-btn");
        const waBtn = document.getElementById("naroa-wa-btn");
        const igBtn = document.getElementById("naroa-ig-btn");
        const noteInput = document.getElementById("naroa-custom-note");
        const toast = document.getElementById("naroa-copy-toast");

        function updatePreview() {
          const extra = state.nota.trim()
            ? "\\n\\nDetalle adicional: " + state.nota.trim()
            : "";

          const text =
            "¡Hola Naroa! Oye, tengo una idea para encargar " + state.sujeto + ".\\n\\n" +
            "Me llama mucho el soporte de " + state.soporte + " y me gustaría valorar opciones con " + state.entrega + "." +
            extra +
            "\\n\\n¿Hablamos para ver cómo enfocar el boceto?";

          if (msgBox) msgBox.value = text;

          const subject = encodeURIComponent("Encargo de retrato — " + state.soporte);
          const body = encodeURIComponent(text);
          if (mailBtn) mailBtn.href = "mailto:naroa@naroa.eu?subject=" + subject + "&body=" + body;
          if (waBtn) waBtn.href = "https://wa.me/34636060609?text=" + encodeURIComponent(text);
        }

        document.querySelectorAll(".naroa-options").forEach((groupEl) => {
          const groupName = groupEl.getAttribute("data-group");
          groupEl.querySelectorAll(".naroa-chip").forEach((btn) => {
            btn.addEventListener("click", () => {
              groupEl.querySelectorAll(".naroa-chip").forEach((b) => b.classList.remove("active"));
              btn.classList.add("active");
              state[groupName] = btn.getAttribute("data-value");
              updatePreview();
            });
          });
        });

        if (noteInput) {
          noteInput.addEventListener("input", (e) => {
            state.nota = e.target.value;
            updatePreview();
          });
        }

        if (igBtn) {
          igBtn.addEventListener("click", async () => {
            try {
              if (msgBox) await navigator.clipboard.writeText(msgBox.value);
              if (toast) toast.textContent = "✓ Mensaje copiado. Pega tu idea en el chat de Instagram.";
            } catch (_) {
              if (toast) toast.textContent = "Abriendo Instagram (@naroagutierrezgil)...";
            }
            setTimeout(() => {
              window.open("https://www.instagram.com/naroagutierrezgil/", "_blank", "noopener");
            }, 450);
          });
        }

        updatePreview();
      })();
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

      <div style="background: var(--bg-card); border: 1px solid var(--gold-border); border-radius: 16px; padding: 32px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span style="font-size: 2rem;">✉</span>
          <h3 style="font-family: var(--font-serif); font-size: 1.25rem; margin: 12px 0 6px;">CORREO ELECTRÓNICO</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.5;">Atención institucional y pedidos:<br><a href="mailto:naroa@naroa.eu" style="color: var(--gold); font-weight: 700;">naroa@naroa.eu</a></p>
        </div>
        <button type="button" class="btn-copy" onclick="copyContactText(this, 'naroa@naroa.eu')">📋 COPIAR EMAIL</button>
      </div>

      <div style="background: var(--bg-card); border: 1px solid var(--gold-border); border-radius: 16px; padding: 32px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span style="font-size: 2rem;">💬</span>
          <h3 style="font-family: var(--font-serif); font-size: 1.25rem; margin: 12px 0 6px;">WHATSAPP OFICIAL</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.5;">Atención directa de taller:<br><a href="https://wa.me/34636060609" target="_blank" rel="noopener noreferrer" style="color: var(--gold); font-weight: 700;">+34 636 060 609</a></p>
        </div>
        <button type="button" class="btn-copy" onclick="copyContactText(this, '+34636060609')">📋 COPIAR TELÉFONO</button>
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
      function copyContactText(btn, text) {
        navigator.clipboard.writeText(text).then(() => {
          const original = btn.textContent;
          btn.textContent = '✓ ¡COPIADO!';
          btn.style.background = '#D4AF37';
          btn.style.color = '#000000';
          setTimeout(() => {
            btn.textContent = original;
            btn.style.background = '';
            btn.style.color = '';
          }, 2000);
        });
      }

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
