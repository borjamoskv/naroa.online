/* An artwork-led entrance, with optional scroll depth and native navigation. */
(() => {
  'use strict';
  const nav = document.getElementById('main-nav');
  const menu = document.getElementById('nav-links');
  const toggle = document.getElementById('nav-toggle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function setMenu(open, restoreFocus = false) {
    menu.classList.toggle('nav__links--open', open);
    toggle.classList.toggle('nav__toggle--open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setMenu(false, true);
  });
  document.addEventListener('click', event => {
    if (!nav.contains(event.target)) setMenu(false);
  });
  nav.addEventListener('focusin', () => nav.classList.remove('nav--quiet'));
  nav.addEventListener('focusout', event => { if (event.relatedTarget && !nav.contains(event.relatedTarget)) setMenu(false); });
  let previousY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = Math.max(0, window.scrollY);
    if (Math.abs(y - previousY) < 8) return;
    nav.classList.toggle('nav--quiet', y > previousY && y > 100 && !nav.contains(document.activeElement));
    previousY = y;
  }, {passive: true});
  const routes = {'#/': 'view-home', '#/destacada': 'view-destacada', '#/galeria': 'view-destacada', '#/archivo': 'view-destacada', '#/contacto': 'view-contacto', '#/about': 'view-about', '#/blog': 'about-journal', '#/trayectoria': 'view-trayectoria'};
  function navigate(hash, focus = false) {
    const target = document.getElementById(routes[hash]);
    if (!target) return;
    setMenu(false);
    if (focus) {
      target.setAttribute('tabindex', '-1');
      target.focus({preventScroll: true});
    }
    target.scrollIntoView({block: 'start', behavior: focus && !reducedMotion.matches ? 'smooth' : 'instant'});
    menu.querySelectorAll('a').forEach(link => {
      if (link.getAttribute('href') === hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  document.querySelectorAll('a[href^="#/"]').forEach(link => link.addEventListener('click', event => {
    const hash = link.getAttribute('href');
    if (!routes[hash] || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (location.hash !== hash) history.pushState(null, '', hash);
    navigate(hash, true);
  }));
  window.addEventListener('hashchange', () => navigate(location.hash));

  // Show a complete portrait on narrow screens, and the three works together on desktop.
  const portraitScreen = window.matchMedia('(max-width: 640px)');
  const homePhoto = document.getElementById('home-art-photo');
  const homeOpen = document.getElementById('home-art-open');
  function setHomeArtwork() {
    const src = portraitScreen.matches ? '/images/catalogo/marilyn-rocks-hq-01.webp' : '/images/artworks/naroa-portrait-new.webp';
    const caption = portraitScreen.matches ? 'DiviNos · Marilyn Rocks. Retrato sobre pizarra.' : 'DiviNos · Marilyn Rocks, Johnny Rocks y James Rocks. Retratos sobre pizarra.';
    homePhoto.href = homeOpen.href = src;
    homePhoto.dataset.image = src;
    homePhoto.dataset.caption = caption;
    homePhoto.querySelector('img').alt = caption;
  }
  setHomeArtwork();
  portraitScreen.addEventListener('change', setHomeArtwork);
  // Let the caption offer the same enlargement as the photograph itself.
  document.getElementById('home-art-open')?.addEventListener('click', event => {
    if (typeof document.getElementById('art-viewer')?.showModal !== 'function') return;
    event.preventDefault();
    document.getElementById('home-art-photo').click();
  });
  // Three strips of the original photograph form a shallow, moving collage.
  // The intact original remains the accessible enlargement and static fallback.
  const hero = document.getElementById('view-home');
  const heroFigure = hero.querySelector('.home-art');
  const layers = document.createElement('div');
  layers.className = 'hero-depth-layers';
  layers.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 3; index++) {
    const panel = document.createElement('div');
    panel.className = `hero-depth-panel hero-depth-panel--${index + 1}`;
    const photo = document.createElement('img');
    photo.src = '/images/artworks/naroa-portrait-new.webp';
    photo.alt = '';
    photo.decoding = 'async';
    panel.append(photo);
    layers.append(panel);
  }
  homePhoto.append(layers);
  let heroFrame = 0;
  let pointerX = 0, pointerY = 0;
  let liveP = 0, liveX = 0, liveY = 0, lastHeroTick = 0;
  function renderHero(time) {
    heroFrame = 0;
    const enabled = document.documentElement.dataset.brushEnabled === 'true';
    const wasEnabled = hero.classList.contains('hero-depth-on');
    if (wasEnabled !== enabled) {
      const before = hero.getBoundingClientRect();
      hero.classList.toggle('hero-depth-on', enabled);
      // Keep the visitor on the same artwork when toggling effects from the catalogue.
      if (before.bottom <= 0) window.scrollBy({top: hero.offsetHeight - before.height, behavior: 'instant'});
    }
    if (!enabled || document.hidden) return;
    const rect = hero.getBoundingClientRect();
    const viewport = window.innerHeight;
    if (rect.bottom < 0 || rect.top > viewport) return;
    const distance = Math.max(1, hero.offsetHeight - heroFigure.offsetHeight);
    const progress = Math.max(0, Math.min(1, -rect.top / distance));
    const dt = Math.min(40, Math.max(8, time - lastHeroTick || 16));
    lastHeroTick = time;
    const blend = 1 - Math.exp(-dt / 85);
    const desired = progress * progress * (3 - 2 * progress);
    liveP += (desired - liveP) * blend;
    liveX += (pointerX - liveX) * blend;
    liveY += (pointerY - liveY) * blend;
    hero.style.setProperty('--hero-p', liveP.toFixed(4));
    hero.style.setProperty('--hero-x', liveX.toFixed(3));
    hero.style.setProperty('--hero-y', liveY.toFixed(3));
    if (Math.abs(desired-liveP) > .0004 || Math.abs(pointerX-liveX) > .002 || Math.abs(pointerY-liveY) > .002) scheduleHero();
  }
  function scheduleHero() {
    if (!heroFrame) heroFrame = requestAnimationFrame(renderHero);
  }
  hero.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const bounds = heroFigure.getBoundingClientRect();
    pointerX = Math.max(-1, Math.min(1, (event.clientX / bounds.width - .5) * 2));
    pointerY = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - .5) * 2));
    scheduleHero();
  }, {passive: true});
  hero.addEventListener('pointerleave', () => { pointerX = pointerY = 0; scheduleHero(); });
  window.addEventListener('scroll', scheduleHero, {passive: true});
  window.addEventListener('resize', scheduleHero, {passive: true});
  document.addEventListener('naroa:motionchange', scheduleHero);
  scheduleHero();
  requestAnimationFrame(() => { if (routes[location.hash]) navigate(location.hash); });
})();
