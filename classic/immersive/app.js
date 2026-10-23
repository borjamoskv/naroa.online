/* Naroa — the reviewed catalogue, shown one artwork at a time. */
(() => {
  'use strict';
  const catalogue = window.NAROA_CATALOG;
  if (!catalogue) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Enable enhancements only after JavaScript has successfully initialized.
  document.documentElement.classList.add('has-motion');
  const legacy = { '#/destacada': '/obra/', '#/about': '/sobre-mi/', '#/trayectoria': '/trayectoria/', '#/blog': '/cuaderno/', '#/contacto': '/contacto/' };
  if (location.pathname === '/' && legacy[location.hash]) { location.replace(legacy[location.hash]); return; }
  let gallery = null;
  function openDialog(selector) {
    const dialog = $(selector);
    if (!dialog || dialog.open) return;
    if (gallery) gallery.pause();
    dialog.showModal();
    if (selector === '#index-dialog') $('#art-search').focus();
  }
  $$('[data-close-dialog]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  $$('dialog').forEach(d => d.addEventListener('click', e => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  }));
  $$('[data-open-menu]').forEach(b => b.addEventListener('click', () => openDialog('#menu-dialog')));
  $$('[data-open-index]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openDialog('#index-dialog'); }));
  const search = $('#art-search'), filters = $$('[data-filter]'), indexItems = $$('.index-work');
  let filter = 'all';
  const normalized = s => s.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function filterIndex() {
    const term = normalized(search.value.trim());
    let count = 0;
    indexItems.forEach(item => {
      const category = filter === 'all' || item.dataset.category === filter || item.dataset.series === filter;
      item.hidden = !category || !normalized(item.dataset.search).includes(term);
      if (!item.hidden) count++;
    });
    $('.index-count').textContent = `${count} ${count === 1 ? 'proyecto' : 'proyectos'}`;
    $('.index-empty').hidden = count !== 0;
    filters.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  }
  search.addEventListener('input', filterIndex);
  filters.forEach(b => b.addEventListener('click', () => { filter = b.dataset.filter; filterIndex(); }));
  $('[data-reset-index]').addEventListener('click', () => { search.value = ''; filter = 'all'; filterIndex(); search.focus(); });
  indexItems.forEach(a => a.addEventListener('click', e => {
    if (!gallery || !gallery.has(a.dataset.work) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); $('#index-dialog').close(); gallery.select(a.dataset.work);
  }));

  const stage = $('[data-gallery]');
  if (stage) {
    const works = catalogue.projects.filter(p => stage.dataset.subset !== 'Vaivenes' || p.series === 'Vaivenes');
    const scenes = $$('.art-scene', stage), images = scenes.map(s => $('img', s));
    const kineticTitle = $('[data-kinetic-title]', stage), caption = $('[data-art-copy]', stage);
    const state = { index: Number(stage.dataset.initial) || 0, fit: false, quiet: false, photo: 0 };
    const motion = { position: state.index, desired: state.index, frame: null, request: 0, navigation: null };
    const track = stage.closest('.art-scroll'), geometry = { top: 0, step: 1 };
    document.documentElement.classList.add('gallery-scroll');
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const pan = { x: 0, y: 0, tx: 0, ty: 0, frame: null };
    const pendingImages = new Map();
    const focals = { 'rara-avis': '56% 42%', 'amor-en-conserva': '50% 54%', 'entre-tantas-flores-de-dia': '50% 36%', 'johnny-rocks': '50% 42%', 'rockagipsy': '50% 43%', 'hugo-box': '50% 38%' };
    const mobileFocals = { 'rara-avis': '61% 40%', 'amor-en-conserva': '48% 54%' };
    function focusPictures() { works.forEach((p, i) => scenes[i].style.setProperty('--position', (innerWidth < 760 && mobileFocals[p.slug]) || focals[p.slug] || '50% 44%')); }
    focusPictures();
    function ensureImage(i) {
      if (!images[i]) return Promise.resolve();
      const img = images[i];
      if (!img.getAttribute('src')) img.src = works[i].cover;
      if (img.complete && img.naturalWidth) return Promise.resolve();
      if (pendingImages.has(i)) return pendingImages.get(i);
      const ready = (img.decode ? img.decode() : new Promise(resolve => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); })).catch(() => {
        if (Math.abs(i - state.index) > 1 && Math.abs(i - motion.desired) > 1) return;
        if (img.src !== new URL(works[i].photos[0].original, location.origin).href) img.src = works[i].photos[0].original;
      });
      pendingImages.set(i, ready); return ready;
    }
    function preloadNeighbours() {
      images.forEach((img, i) => {
        if (Math.abs(i - state.index) > 1 && img.hasAttribute('src')) {
          img.removeAttribute('src'); pendingImages.delete(i);
        }
      });
      [state.index - 1, state.index, state.index + 1].forEach(i => { ensureImage(i); });
    }
    function metadata() {
      const p = works[state.index], begin = clamp(state.index - 2, 0, Math.max(0, works.length - 5));
      $('[data-art-title]', stage).textContent = p.title; $('[data-art-material]', stage).textContent = p.label;
      $('[data-counter]', stage).textContent = `${String(state.index + 1).padStart(2, '0')} / ${String(works.length).padStart(2, '0')}`;
      $$('[data-select]', stage).forEach(b => { const i = Number(b.dataset.select); b.hidden = i < begin || i >= begin + 5; b.setAttribute('aria-pressed', String(i === state.index)); });
      $('[data-prev]', stage).disabled = state.index === 0; $('[data-next]', stage).disabled = state.index === works.length - 1;
      stage.style.setProperty('--count', works.length);
      stage.classList.toggle('is-fit', state.fit); document.body.classList.toggle('is-quiet', state.quiet);
      $('[data-restore]', stage).hidden = !state.quiet;
      const fit = $('[data-fit]', stage); fit.setAttribute('aria-pressed', String(state.fit)); fit.textContent = state.fit ? 'Volver a la inmersión ↙' : 'Ver imagen completa ↗';
      $('[data-open-photos]', stage).textContent = p.photos.length > 1 ? 'Otras miradas ↗' : 'Ver fotografía ↗';
      $$('.site-nav,.art-index,.art-bottom').forEach(el => { el.inert = state.quiet; });
      $('#story-title').textContent = p.title; $('[data-story-category]').textContent = p.label; $('[data-story]').textContent = p.story;
      const facts = $('[data-facts]'); facts.replaceChildren();
      [['Técnica', p.technique], ['Soporte', p.support], ['Medidas', p.dimensions], ['Serie', p.series], ['Año', p.year]].forEach(([label, value]) => {
        if (!value) return;
        const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; row.append(dt, dd); facts.append(row);
      });
      const credit = $('[data-credit]'); credit.textContent = p.credit || ''; credit.hidden = !p.credit;
      $('[data-art-email]').href = 'mailto:naroa@naroa.eu?subject=' + encodeURIComponent('Consulta sobre ' + p.title);
      $('[data-art-source]').href = p.source;
      scenes.forEach((s, i) => { s.setAttribute('aria-hidden', String(i !== state.index)); s.classList.toggle('is-current', i === state.index); });
      preloadNeighbours();
    }
    function saveRoute() {
      const p = works[state.index], url = '/obra/' + p.slug + '/';
      if (stage.dataset.subset === 'Vaivenes') return;
      history.replaceState({ artwork: p.slug }, '', url);
      document.title = p.title + ' · Naroa Gutiérrez Gil';
      $('link[rel="canonical"]').href = 'https://naroagutierrezgil.com' + url;
      $('meta[name="description"]').content = p.story;
      $('meta[property="og:title"]').content = document.title; $('meta[property="og:description"]').content = p.story; $('meta[property="og:url"]').content = 'https://naroagutierrezgil.com' + url;
      $('meta[property="og:image"]').content = 'https://naroagutierrezgil.com' + p.photos[0].original;
      $('#page-schema').textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'VisualArtwork', name: p.title, url: 'https://naroagutierrezgil.com' + url, description: p.story, image: p.photos.map(ph => 'https://naroagutierrezgil.com' + ph.original), creator: { '@type': 'Person', name: 'Naroa Gutiérrez Gil' } });
    }
    function render() {
      const position = clamp(motion.position, 0, works.length - 1), base = Math.floor(position), fraction = position - base;
      const still = state.fit || reduced.matches;
      const sideways = (base + 1) % 2 === 0;
      const edge = (1 - fraction) * 100, slant = Math.sin(fraction * Math.PI) * 9;
      const near = clamp(edge - slant, 0, 100).toFixed(3), far = clamp(edge + slant, 0, 100).toFixed(3);
      scenes.forEach((s, i) => {
        const visible = still ? i === state.index : i === base || (fraction > .0001 && i === base + 1);
        s.style.visibility = visible ? 'visible' : 'hidden'; s.style.zIndex = i === base + 1 ? '2' : '1';
        s.style.willChange = visible ? 'clip-path' : 'auto'; images[i].style.willChange = visible ? 'transform' : 'auto';
        if (!visible) return;
        if (still) { s.style.clipPath = 'inset(0)'; images[i].style.transform = ''; return; }
        if (i === base) {
          s.style.clipPath = 'inset(0)';
          images[i].style.transform = sideways
            ? `translate3d(${(-fraction * 14).toFixed(3)}%,0,0) scale(${(1.08 + fraction * .18).toFixed(4)})`
            : `translate3d(0,${(-fraction * 34).toFixed(3)}%,0) scale(${(1.08 + fraction * .18).toFixed(4)})`;
        } else {
          s.style.clipPath = sideways
            ? `polygon(${near}% 0,100% 0,100% 100%,${far}% 100%)`
            : `polygon(0 ${far}%,100% ${near}%,100% 100%,0 100%)`;
          images[i].style.transform = sideways
            ? `translate3d(${((1 - fraction) * 22).toFixed(3)}%,0,0) scale(${(1.08 + (1 - fraction) * .12).toFixed(4)})`
            : `translate3d(0,${((1 - fraction) * 34).toFixed(3)}%,0) scale(${(1.08 + (1 - fraction) * .12).toFixed(4)})`;
        }
      });
      const transitioning = !still && fraction > .001 && fraction < .999;
      const nextTitle = transitioning ? works[base + 1].title : '';
      if (kineticTitle.textContent !== nextTitle) kineticTitle.textContent = nextTitle;
      kineticTitle.style.opacity = transitioning ? (Math.sin(fraction * Math.PI) * .46).toFixed(3) : '0';
      kineticTitle.style.transform = `translate3d(${((fraction - .5) * -12).toFixed(3)}%,${((fraction - .5) * -12).toFixed(3)}vh,0)`;
      caption.style.opacity = transitioning ? (.45 + .55 * Math.pow(Math.abs(fraction - .5) * 2, .6)).toFixed(3) : '1';
      caption.style.transform = transitioning ? `translateY(${((fraction < .5 ? -fraction : 1 - fraction) * 44).toFixed(3)}px)` : '';
      stage.classList.toggle('is-travelling', transitioning);
      stage.style.setProperty('--progress', (position * 100).toFixed(3) + '%');
    }
    function measure() {
      const bounds = track.getBoundingClientRect(), height = stage.getBoundingClientRect().height || innerHeight;
      geometry.top = bounds.top + scrollY;
      geometry.step = (bounds.height - height) / Math.max(1, works.length - 1) || height * .75;
    }
    function leaveFit() { if (state.fit) { state.fit = false; images[state.index].src = works[state.index].cover; } }
    function syncScroll() {
      motion.frame = null;
      if (document.querySelector('dialog[open]')) return;
      const position = clamp((scrollY - geometry.top) / geometry.step, 0, works.length - 1);
      const request = ++motion.request;
      motion.desired = position;
      if (motion.navigation !== null && Math.abs(position - motion.navigation) < .002) motion.navigation = null;
      if (Math.abs(position - motion.position) > .002) { leaveFit(); resetPan(); }
      Promise.all([ensureImage(Math.floor(position)), ensureImage(Math.ceil(position))]).then(() => {
        if (request !== motion.request || document.querySelector('dialog[open]')) return;
        motion.position = position;
        const index = clamp(Math.round(position), 0, works.length - 1);
        if (index !== state.index) { state.index = index; metadata(); saveRoute(); }
        else stage.classList.toggle('is-fit', state.fit);
        render();
      });
    }
    function scheduleScroll() { if (motion.frame === null) motion.frame = requestAnimationFrame(syncScroll); }
    function moveTo(index, smooth = false) {
      window.scrollTo({ top: geometry.top + index * geometry.step, behavior: smooth && !reduced.matches ? 'smooth' : 'auto' });
      scheduleScroll();
    }
    function pause() {
      motion.request++;
      motion.navigation = null;
      if (motion.frame !== null) cancelAnimationFrame(motion.frame);
      motion.frame = null;
      moveTo(state.index);
      motion.position = motion.desired = state.index;
      render();
    }
    function change(next) {
      if (document.querySelector('dialog[open]') || next < 0 || next >= works.length) return;
      leaveFit(); resetPan(); metadata();
      motion.navigation = next;
      // Nearby controls use the browser's smooth scroll; catalogue jumps go directly there.
      moveTo(next, Math.abs(next - motion.position) <= 2);
    }
    addEventListener('scroll', scheduleScroll, { passive: true });
    // Preserve native inertia, browser zoom, touch scrolling and scroll-bar navigation.
    const interruptNavigation = () => { motion.navigation = null; };
    addEventListener('wheel', interruptNavigation, { passive: true });
    addEventListener('touchstart', interruptNavigation, { passive: true });
    $$('[data-select]', stage).forEach(b => b.addEventListener('click', () => change(Number(b.dataset.select))));
    $('[data-prev]', stage).addEventListener('click', () => change(Math.round(motion.navigation ?? motion.desired) - 1)); $('[data-next]', stage).addEventListener('click', () => change(Math.round(motion.navigation ?? motion.desired) + 1));
    $('[data-fit]', stage).addEventListener('click', () => { pause(); state.fit = !state.fit; images[state.index].src = state.fit ? works[state.index].photos[0].src : works[state.index].cover; resetPan(); metadata(); render(); });
    $('[data-open-story]', stage).addEventListener('click', () => openDialog('#story-dialog'));
    function showPhoto() {
      const p = works[state.index], photo = p.photos[state.photo]; $('#photos-heading').textContent = p.title; $('[data-photo-image]').src = photo.src; $('[data-photo-image]').alt = p.title + ' — ' + photo.caption;
      $('[data-photo-caption]').textContent = `${String(state.photo + 1).padStart(2, '0')} / ${String(p.photos.length).padStart(2, '0')} · ${photo.caption}`;
      $('[data-photo-prev]').disabled = state.photo === 0; $('[data-photo-next]').disabled = state.photo === p.photos.length - 1;
    }
    function photoStep(d) { state.photo = clamp(state.photo + d, 0, works[state.index].photos.length - 1); showPhoto(); }
    $('[data-open-photos]', stage).addEventListener('click', () => { state.photo = 0; showPhoto(); openDialog('#photos-dialog'); });
    $('[data-photo-prev]').addEventListener('click', () => photoStep(-1)); $('[data-photo-next]').addEventListener('click', () => photoStep(1));
    $('#photos-dialog').addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); photoStep(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); photoStep(-1); } });
    function quiet(value) { state.quiet = value; metadata(); (value ? $('[data-restore]', stage) : $('[data-quiet]')).focus(); }
    $('[data-quiet]').addEventListener('click', () => quiet(true)); $('[data-restore]', stage).addEventListener('click', () => quiet(false));
    document.addEventListener('keydown', e => {
      if (document.querySelector('dialog[open]') || e.target.closest?.('input,textarea,select,[contenteditable=true]')) return;
      if (e.key === 'Escape' && state.quiet) { e.preventDefault(); quiet(false); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); change(Math.round(motion.navigation ?? motion.desired) + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); change(Math.round(motion.navigation ?? motion.desired) - 1); }
    });
    function drawPan() { pan.x += (pan.tx - pan.x) * .1; pan.y += (pan.ty - pan.y) * .1; if (Math.abs(pan.tx - pan.x) < .03 && Math.abs(pan.ty - pan.y) < .03) { pan.x = pan.tx; pan.y = pan.ty; pan.frame = null; } else pan.frame = requestAnimationFrame(drawPan); stage.style.setProperty('--pan-x', pan.x.toFixed(2) + 'px'); stage.style.setProperty('--pan-y', pan.y.toFixed(2) + 'px'); }
    function resetPan() { if (pan.frame !== null) cancelAnimationFrame(pan.frame); pan.x = pan.y = pan.tx = pan.ty = 0; pan.frame = null; stage.style.setProperty('--pan-x', '0px'); stage.style.setProperty('--pan-y', '0px'); }
    stage.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || state.fit || reduced.matches || document.querySelector('dialog[open]')) return; const r = stage.getBoundingClientRect(); if (!r.width || !r.height) return; pan.tx = ((e.clientX - r.left) / r.width - .5) * -22; pan.ty = ((e.clientY - r.top) / r.height - .5) * -18; if (pan.frame === null) pan.frame = requestAnimationFrame(drawPan); });
    stage.addEventListener('pointerleave', () => { pan.tx = pan.ty = 0; if (pan.frame === null && !reduced.matches) pan.frame = requestAnimationFrame(drawPan); });
    reduced.addEventListener('change', () => { resetPan(); pause(); if (reduced.matches) $('.art-layers', stage).getAnimations?.().forEach(animation => animation.cancel()); });
    addEventListener('resize', () => {
      const position = clamp((scrollY - geometry.top) / geometry.step, 0, works.length - 1);
      const oldStep = geometry.step, oldTop = geometry.top;
      focusPictures(); measure();
      // Mobile toolbar changes must not cancel the user's native scrolling.
      if (Math.abs(oldStep - geometry.step) > .5 || Math.abs(oldTop - geometry.top) > .5) moveTo(position);
      else scheduleScroll();
    }, { passive: true });
    addEventListener('pageshow', scheduleScroll, { passive: true });
    gallery = { pause, has: slug => works.some(w => w.slug === slug), select: slug => change(works.findIndex(w => w.slug === slug)) };
    measure(); metadata(); render(); moveTo(state.index);
  }

  const years = $$('[data-year]'), events = $$('[data-exhibition-year]');
  years.forEach(button => button.addEventListener('click', () => {
    const year = button.dataset.year; let count = 0;
    events.forEach(entry => { entry.hidden = year !== 'all' && entry.dataset.exhibitionYear !== year; if (!entry.hidden) count++; });
    years.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    $('.career-count').textContent = `${count} ${count === 1 ? 'encuentro documentado' : 'encuentros documentados'}`;
  }));
  if (!stage) {
    const sections = $$('[data-parallax]'); let frame = null;
    function pageParallax() {
      frame = null;
      const vh = innerHeight || 800;
      sections.forEach(section => {
        const r = section.getBoundingClientRect(); if (r.bottom < -100 || r.top > vh + 100) return;
        const target = $('.page-hero-image', section) || (section.matches('.contact-background') ? section : $('img', section));
        if (!target) return;
        const progress = clamp((vh - r.top) / (vh + r.height), 0, 1);
        const strength = section.matches('.contact-background') ? .28 : .36;
        target.style.transform = reduced.matches ? '' : `translate3d(0,${((progress - .5) * Math.min(vh, r.height) * strength).toFixed(2)}px,0) scale(1.06)`;
        const copy = $('.page-hero-copy', section);
        if (copy) {
          const exit = clamp(-r.top / vh, 0, 1);
          copy.style.transform = reduced.matches ? '' : `translate3d(0,${(-exit * 100).toFixed(2)}px,0)`;
          copy.style.opacity = reduced.matches ? '1' : (1 - exit * .75).toFixed(3);
        }
      });
      $('.site-nav').classList.toggle('is-scrolled', scrollY > vh * .72);
    }
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(pageParallax); };
    addEventListener('scroll', schedule, { passive: true }); addEventListener('resize', schedule, { passive: true }); reduced.addEventListener('change', schedule); schedule();
  }
  const reveals = $$('.chapter>div,.chapter>.eyebrow,.section-opening,.editorial blockquote,.timeline-entry,.notebook-posts article,.commission-steps article,.closing,.contact-details');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); observer.unobserve(entry.target); }
    }), { threshold: .08, rootMargin: '0px 0px -24px 0px' });
    reveals.forEach(el => { el.classList.add('motion-reveal'); observer.observe(el); });
    reduced.addEventListener('change', () => { if (reduced.matches) reveals.forEach(el => el.classList.add('is-revealed')); });
  }
  $$('.art-arrows button,.hero-down,.art-story-link,.text-link').forEach(el => {
    el.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || reduced.matches || el.disabled) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--magnet-x', clamp((e.clientX - r.left - r.width / 2) * .16, -7, 7).toFixed(2) + 'px');
      el.style.setProperty('--magnet-y', clamp((e.clientY - r.top - r.height / 2) * .16, -7, 7).toFixed(2) + 'px');
    });
    const clear = () => { el.style.setProperty('--magnet-x', '0px'); el.style.setProperty('--magnet-y', '0px'); };
    el.addEventListener('pointerleave', clear); el.addEventListener('blur', clear); reduced.addEventListener('change', clear);
  });
  if (location.hash === '#indice') openDialog('#index-dialog');
})();
