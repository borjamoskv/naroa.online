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

  const hero = document.getElementById('view-home');
  let heroFrame = 0, drift = 0, pointerX = 0, pointerY = 0, liveX = 0, liveY = 0, lastHeroTime = 0;
  const clamp = n => Math.max(-1, Math.min(1, n));
  function renderHero(time) {
    heroFrame = 0;
    // The explicit control can opt into motion even when the system reduces it.
    const on = document.documentElement.dataset.brushEnabled === 'true';
    const box = hero.getBoundingClientRect();
    const target = on ? Math.max(0, Math.min(1, -box.top / Math.max(1, box.height))) : 0;
    const dt = Math.min(40, Math.max(8, time - lastHeroTime || 16));
    lastHeroTime = time;
    const blend = 1 - Math.exp(-dt / 95);
    drift += (target - drift) * blend;
    liveX += ((on ? pointerX : 0) - liveX) * blend;
    liveY += ((on ? pointerY : 0) - liveY) * blend;
    if (!on) drift = liveX = liveY = 0;
    hero.style.setProperty('--studio-drift', `${(-drift * 62 + liveY * 7).toFixed(2)}px`);
    hero.style.setProperty('--studio-sway', `${(liveX * 9).toFixed(2)}px`);
    hero.style.setProperty('--studio-copy-drift', `${(drift * 28 - liveY * 3).toFixed(2)}px`);
    hero.style.setProperty('--studio-tilt', `${(liveX * .35).toFixed(3)}deg`);
    if (on && box.bottom > 0 && box.top < innerHeight &&
      (Math.abs(target - drift) > .0005 || Math.abs(pointerX - liveX) > .002 || Math.abs(pointerY - liveY) > .002)) scheduleHero();
  }
  function scheduleHero() { if (!heroFrame) heroFrame = requestAnimationFrame(renderHero); }
  hero.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const box = hero.getBoundingClientRect();
    pointerX = clamp((event.clientX - box.left) / box.width * 2 - 1);
    pointerY = clamp((event.clientY - box.top) / box.height * 2 - 1);
    scheduleHero();
  }, {passive:true});
  hero.addEventListener('pointerleave', () => { pointerX = pointerY = 0; scheduleHero(); });
  addEventListener('scroll', scheduleHero, {passive:true});
  addEventListener('resize', scheduleHero, {passive:true});
  document.addEventListener('naroa:motionchange', scheduleHero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleHero(); });
  scheduleHero();
  requestAnimationFrame(() => { if (routes[location.hash]) navigate(location.hash); });
})();
