/* Native scrolling and a quiet header; photographs have no animation or filters. */
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
  if (routes[location.hash]) navigate(location.hash);
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
})();
