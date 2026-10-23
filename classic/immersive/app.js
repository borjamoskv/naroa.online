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
    const track = stage.closest('.art-scroll'), geometry = { top: 0, step: 1, width: 0, height: 0 };
    document.documentElement.classList.add('gallery-scroll');
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const pan = { x: 0, y: 0, tx: 0, ty: 0, frame: null };
    const pendingImages = new Map();
    const focals = { 'rara-avis': '56% 42%', 'amor-en-conserva': '50% 54%', 'entre-tantas-flores-de-dia': '50% 36%', 'johnny-rocks': '50% 42%', 'rockagipsy': '50% 43%', 'hugo-box': '50% 38%' };
    const mobileFocals = { 'rara-avis': '61% 40%', 'amor-en-conserva': '48% 54%' };
    // Pupil centres measured on the unaltered cover photographs, in source-image coordinates.
    const eyes = {
      'marilyn-rocks': { x: .635, y: .392, span: .067 },
      'rara-avis': { x: .683, y: .417, span: .049 },
      'johnny-rocks': { x: .583, y: .459, span: .066 },
      'rockagipsy': { x: .545, y: .402, span: .037 },
      'infusion-de-berto': { x: .469, y: .463, span: .043 },
      'buena-fuente': { x: .678, y: .439, span: .050 }
    };
    const eyeLinks = { 'marilyn-rocks': 'rara-avis', 'johnny-rocks': 'rockagipsy', 'infusion-de-berto': 'buena-fuente' };
    const ease = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
    function eyePose(index, amount) {
      const eye = eyes[works[index].slug], img = images[index];
      const width = geometry.width + 20, height = geometry.height + 20;
      const naturalWidth = img.naturalWidth || 1000, naturalHeight = img.naturalHeight || 1000;
      const cover = Math.max(width / naturalWidth, height / naturalHeight);
      const pictureWidth = naturalWidth * cover, pictureHeight = naturalHeight * cover;
      const focus = scenes[index].style.getPropertyValue('--position').split(' ').map(v => parseFloat(v) / 100);
      const x = (width - pictureWidth) * focus[0] + eye.x * pictureWidth;
      const y = (height - pictureHeight) * focus[1] + eye.y * pictureHeight;
      const closeup = clamp(clamp(geometry.width * .18, 140, 280) / (eye.span * pictureWidth), 2.6, 6);
      const zoom = 1.10 + (closeup - 1.10) * amount;
      const tx = -(zoom - 1) * width / 2 * (1 - amount) + (geometry.width * .5 + 10 - x * zoom) * amount;
      const ty = -(zoom - 1) * height / 2 * (1 - amount) + (geometry.height * .42 + 10 - y * zoom) * amount;
      img.style.transformOrigin = '0px 0px';
      img.style.transform = `translate3d(${tx.toFixed(3)}px,${ty.toFixed(3)}px,0) scale(${zoom.toFixed(5)})`;
    }
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
      const still = state.fit || reduced.matches, progress = ease(fraction);
      const sideways = (base + 1) % 2 === 0;
      const eyeMatch = !still && !!eyeLinks[works[base].slug] && eyeLinks[works[base].slug] === works[base + 1]?.slug;
      const edge = (1 - progress) * 100, feather = Math.sin(progress * Math.PI) * 14;
      stage.dataset.transition = still ? 'still' : eyeMatch ? 'eyes' : 'depth';
      scenes.forEach((scene, index) => {
        const visible = still ? index === state.index : index === base || (fraction > .0001 && index === base + 1);
        scene.style.visibility = visible ? 'visible' : 'hidden'; scene.style.zIndex = index === base + 1 ? '2' : '1';
        scene.style.willChange = visible ? 'opacity,mask-image' : 'auto'; images[index].style.willChange = visible ? 'transform' : 'auto';
        if (!visible) return;
        scene.style.clipPath = 'inset(0)'; scene.style.opacity = '1';
        scene.style.maskImage = scene.style.webkitMaskImage = 'none';
        images[index].style.transformOrigin = '50% 50%';
        if (still) { images[index].style.transform = ''; return; }
        if (eyeMatch) {
          eyePose(index, index === base ? ease(fraction * 2) : 1 - ease((fraction - .5) * 2));
          if (index === base + 1) scene.style.opacity = ease((fraction - .40) / .20).toFixed(4);
          return;
        }
        if (index === base) {
          images[index].style.transform = sideways
            ? `translate3d(${(-progress * 20).toFixed(3)}%,0,0) scale(${(1.10 + progress * .24).toFixed(5)})`
            : `translate3d(0,${(-progress * 38).toFixed(3)}%,0) scale(${(1.10 + progress * .24).toFixed(5)})`;
        } else {
          const mask = `linear-gradient(${sideways ? 110 : 170}deg,transparent ${(edge - feather).toFixed(3)}%,#000 ${(edge + feather).toFixed(3)}%)`;
          scene.style.maskImage = scene.style.webkitMaskImage = mask;
          images[index].style.transform = sideways
            ? `translate3d(${((1 - progress) * 28).toFixed(3)}%,0,0) scale(${(1.10 + (1 - progress) * .18).toFixed(5)})`
            : `translate3d(0,${((1 - progress) * 44).toFixed(3)}%,0) scale(${(1.10 + (1 - progress) * .18).toFixed(5)})`;
        }
      });
      const transitioning = !still && fraction > .001 && fraction < .999;
      const nextTitle = transitioning ? works[base + 1].title : '';
      if (kineticTitle.textContent !== nextTitle) kineticTitle.textContent = nextTitle;
      kineticTitle.style.opacity = transitioning && !eyeMatch ? (Math.sin(progress * Math.PI) * .32).toFixed(3) : '0';
      kineticTitle.style.transform = `translate3d(${((progress - .5) * -14).toFixed(3)}%,${((progress - .5) * -16).toFixed(3)}vh,0)`;
      caption.style.opacity = transitioning ? (.45 + .55 * Math.pow(Math.abs(fraction - .5) * 2, .6)).toFixed(3) : '1';
      caption.style.transform = transitioning ? `translateY(${(-Math.sin(fraction * Math.PI * 2) * 10).toFixed(3)}px)` : '';
      stage.classList.toggle('is-travelling', transitioning);
      stage.style.setProperty('--progress', (position * 100).toFixed(3) + '%');
    }
    function measure() {
      const bounds = track.getBoundingClientRect(), viewport = stage.getBoundingClientRect(), height = viewport.height || innerHeight;
      geometry.width = viewport.width || innerWidth; geometry.height = height;
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
    stage.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || state.fit || reduced.matches || stage.dataset.transition === 'eyes' && stage.classList.contains('is-travelling') || document.querySelector('dialog[open]')) return; const r = stage.getBoundingClientRect(); if (!r.width || !r.height) return; pan.tx = ((e.clientX - r.left) / r.width - .5) * -28; pan.ty = ((e.clientY - r.top) / r.height - .5) * -24; if (pan.frame === null) pan.frame = requestAnimationFrame(drawPan); });
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
  const portraitTrack = $('[data-portrait-scroll]');
  if (portraitTrack) {
    document.documentElement.classList.add('portrait-scroll-native');
    const hero = $('[data-eye-portrait]', portraitTrack), plane = $('[data-portrait-plane]', hero);
    const photograph = $('img', plane), copy = $('.page-hero-copy', hero), shade = $('.page-hero-shade', hero);
    const artwork = $('[data-portrait-artwork]', hero), artCopy = $('[data-portrait-work-copy]', hero);
    const controls = $('[data-portrait-controls]', hero), previous = $('[data-portrait-prev]', hero), next = $('[data-portrait-next]', hero);
    const cue = $('.hero-down', hero), wink = $('[data-portrait-wink]', hero);
    const eye = { x: 571 / 1248, y: 766 / 1966, iris: .032 };
    const eyes = {
      'rara-avis': { x: .685, y: .417, iris: .025 },
      'marilyn-rocks': { x: .635, y: .392, iris: .030 },
      'amy-rocks': { x: .512, y: .424, iris: .018 },
      'johnny-rocks': { x: .583, y: .459, iris: .028 },
      'rockagipsy': { x: .545, y: .402, iris: .018 },
      'infusion-de-berto': { x: .469, y: .463, iris: .020 },
      'buena-fuente': { x: .678, y: .439, iris: .025 },
      'james-rocks': { x: .420, y: .345, iris: .025 },
      'elene': { x: .487, y: .406, iris: .029 }
    };
    const opening = Object.keys(eyes);
    const works = [...opening.map(slug => catalogue.projects.find(p => p.slug === slug)), ...catalogue.projects.filter(p => !opening.includes(p.slug))];
    // The very same Rara Avis element opens the portal and starts the exhibition.
    // There is no second stage, document navigation or image swap at the join.
    const scenes = works.map((work, index) => {
      const scene = index ? document.createElement('div') : artwork;
      const photo = work.photos.find(p => p.src === work.cover) || work.photos[0];
      const img = index ? document.createElement('img') : $('img', scene);
      scene.classList.add('portrait-artwork'); scene.dataset.portraitScene = String(index); scene.dataset.work = work.slug;
      scene.setAttribute('aria-hidden', 'true');
      if (index) {
        img.width = photo.width; img.height = photo.height;
        img.alt = work.title + ' — ' + work.label; img.decoding = 'async'; img.draggable = false;
        img.dataset.src = work.cover; scene.append(img); $('.portrait-frame', hero).append(scene);
      } else img.dataset.src = img.getAttribute('src');
      return scene;
    });
    const images = scenes.map(scene => $('img', scene)), decoded = new Set(), pending = new Map(), failed = new Set();
    const smooth = value => { const t = clamp(value, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
    let frame = null, geometry = null, current = 0, captionIndex = -1;
    const active = new Set([0]);
    function ready(index) { return decoded.has(index) && images[index]?.complete && !!images[index]?.naturalWidth; }
    function ensureScene(index) {
      const img = images[index]; if (!img || ready(index) || failed.has(index)) return Promise.resolve();
      if (pending.has(index)) return pending.get(index);
      if (!img.getAttribute('src')) img.src = img.dataset.src;
      const source = img.getAttribute('src');
      const job = Promise.resolve().then(async () => {
        try {
          if (img.decode) await img.decode();
          else if (!img.complete) await new Promise(resolve => {
            img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true });
          });
          if (img.getAttribute('src') === source && img.complete && img.naturalWidth) decoded.add(index);
        } catch { if (img.getAttribute('src') === source) failed.add(index); }
      }).finally(() => {
        if (pending.get(index) === job) pending.delete(index);
        schedulePortrait();
      });
      pending.set(index, job); return job;
    }
    function releaseDistant(base) {
      images.forEach((img, i) => {
        if (Math.abs(i - base) > 1 && !active.has(i) && img.hasAttribute('src')) {
          img.removeAttribute('src'); decoded.delete(i); pending.delete(i); failed.delete(i);
        }
      });
      [base - 1, base, base + 1].forEach(i => { ensureScene(i); });
    }
    function measurePortrait() {
      const rect = hero.getBoundingClientRect();
      const width = rect.width || innerWidth, height = rect.height || innerHeight;
      const cover = (aspect, x, y) => {
        const imageWidth = Math.max(width, height * aspect), imageHeight = imageWidth / aspect;
        return { width: imageWidth, height: imageHeight, left: (width - imageWidth) * x, top: (height - imageHeight) * y };
      };
      const boxes = works.map((work, i) => {
        const aspect = Number(images[i].getAttribute('width')) / Number(images[i].getAttribute('height'));
        return cover(aspect, i === 0 && width <= 760 ? .72 : .5, .42);
      });
      geometry = { width, height, portrait: cover(2201 / 3468, .5, .29), art: boxes[0], boxes };
      [[plane, geometry.portrait], ...scenes.map((scene, i) => [scene, boxes[i]])].forEach(([element, box]) => {
        Object.assign(element.style, reduced.matches
          ? { width: '', height: '', left: '', top: '' }
          : { width: `${box.width}px`, height: `${box.height}px`, left: `${box.left}px`, top: `${box.top}px` });
      });
      plane.classList.toggle('is-measured', !reduced.matches);
      schedulePortrait();
    }
    function pose(element, box, point, zoom, focus, offset = 0) {
      const g = geometry, x = box.left + point.x * box.width, y = box.top + point.y * box.height;
      const tx = x + (g.width * .5 - x) * focus - box.left - zoom * point.x * box.width;
      const ty = y + (g.height * .46 - y) * focus - box.top - zoom * point.y * box.height + offset;
      element.style.transform = reduced.matches ? '' : `translate3d(${tx.toFixed(3)}px,${ty.toFixed(3)}px,0) scale(${zoom.toFixed(5)})`;
    }
    function eyePass(from, target, fromBox, targetBox, fromEye, targetEye, progress) {
      const start = fromEye.iris * fromBox.width, finish = targetEye.iris * targetBox.width;
      // One camera distance drives both photographs. Keep pushing through the
      // dissolve; the deepest point arrives afterwards, with a C2 turn into the reveal.
      const deep = Math.max(Math.min(geometry.width, geometry.height) * 2.4, Math.hypot(geometry.width, geometry.height) * 1.2);
      const approach = smooth(progress / .64), reveal = smooth((progress - .64) / .32);
      const diameter = Math.exp(progress <= .64
        ? Math.log(start) + Math.log(deep / start) * approach
        : Math.log(deep) + Math.log(finish / deep) * reveal);
      const focus = smooth(progress / .34) * (1 - reveal);
      pose(from, fromBox, fromEye, Math.max(1, diameter / start), focus);
      pose(target, targetBox, targetEye, Math.max(1, diameter / finish), focus);
      return smooth((progress - .44) / .14);
    }
    function showCaption(index, opacity) {
      const work = works[index]; current = index;
      if (captionIndex !== index) {
        $('[data-portrait-title]', hero).textContent = work.title;
        $('[data-portrait-label]', hero).textContent = `${index ? work.label : 'Del rostro al autorretrato'} · ${String(index + 1).padStart(2, '0')} / ${works.length}`;
        $('[data-portrait-link]', hero).href = '/obra/' + work.slug + '/';
        previous.disabled = index === 0; next.disabled = index === works.length - 1;
        hero.dataset.work = work.slug; captionIndex = index;
      }
      [artCopy, controls].forEach(element => {
        element.style.opacity = opacity.toFixed(3); element.style.visibility = opacity > 0 ? 'visible' : 'hidden'; element.inert = opacity < .2;
      });
      artCopy.style.transform = reduced.matches ? '' : `translate3d(0,${((1 - opacity) * 24).toFixed(2)}px,0)`;
    }
    function renderExhibition(position) {
      const g = geometry, base = Math.floor(position), fraction = position - base;
      const incoming = Math.min(base + 1, works.length - 1), pair = fraction > 0 && incoming !== base;
      ensureScene(base); if (pair) ensureScene(incoming);
      // Wait for the requested pair while retaining the last painted pair.
      // Scroll remains native even when several works are skipped quickly.
      if (!ready(base) || pair && !ready(incoming)) return;
      active.clear(); active.add(base); if (pair) active.add(incoming);
      scenes.forEach((scene, i) => {
        const visible = active.has(i); scene.style.visibility = visible ? 'visible' : 'hidden'; scene.classList.toggle('is-visible', visible);
        scene.setAttribute('aria-hidden', String(i !== Math.round(position)));
      });
      const outgoing = scenes[base], target = scenes[incoming], fromEye = eyes[works[base].slug], toEye = eyes[works[incoming].slug];
      outgoing.style.opacity = '1'; outgoing.style.zIndex = '1';
      const eyeMatch = pair && fromEye && toEye;
      hero.dataset.transition = eyeMatch ? 'eyes' : pair ? 'depth' : 'still';
      if (eyeMatch) {
        target.style.opacity = eyePass(outgoing, target, g.boxes[base], g.boxes[incoming], fromEye, toEye, fraction).toFixed(4);
      } else {
        const progress = smooth(fraction), centre = { x: .5, y: .5 };
        pose(outgoing, g.boxes[base], centre, 1 + progress * .12, 0, -g.height * .05 * progress);
        if (pair) {
          pose(target, g.boxes[incoming], centre, 1 + (1 - progress) * .12, 0, g.height * .05 * (1 - progress));
          target.style.opacity = smooth((fraction - .10) / .80).toFixed(4);
        }
      }
      if (pair) target.style.zIndex = '2';
      const opacity = eyeMatch ? 1 - smooth(fraction / .22) + smooth((fraction - .84) / .12)
        : pair ? .4 + .6 * Math.pow(Math.abs(fraction - .5) * 2, .6) : 1;
      showCaption(Math.round(position), opacity);
      plane.style.visibility = 'hidden'; plane.setAttribute('aria-hidden', 'true');
      copy.style.opacity = cue.style.opacity = '0'; cue.tabIndex = -1; cue.style.pointerEvents = 'none';
      shade.style.opacity = '.75';
      releaseDistant(base);
    }
    function renderPortrait() {
      frame = null;
      const g = geometry; if (!g || document.querySelector('dialog[open]')) return;
      const travel = Math.max(0, -portraitTrack.getBoundingClientRect().top);
      const progress = reduced.matches ? 0 : clamp(travel / (g.height * 2.8), 0, 1);
      const position = reduced.matches ? 0 : clamp((travel - g.height * 2.8) / (g.height * 1.1), 0, works.length - 1);
      if (!reduced.matches && travel >= g.height * 2.8) { renderExhibition(position); return; }
      ensureScene(0);
      active.clear(); active.add(0);
      scenes.forEach((scene, i) => { if (i) { scene.style.visibility = 'hidden'; scene.setAttribute('aria-hidden', 'true'); scene.classList.remove('is-visible'); } });
      const approach = smooth(progress / .42);
      const blend = eyePass(plane, artwork, g.portrait, g.art, eye, eyes['rara-avis'], progress);
      const mix = ready(0) ? blend : 0;
      artwork.style.opacity = mix.toFixed(4); artwork.style.zIndex = '1';
      artwork.style.visibility = mix > 0 ? 'visible' : 'hidden'; artwork.classList.toggle('is-visible', mix > 0);
      artwork.setAttribute('aria-hidden', String(mix < .5));
      plane.style.visibility = mix === 1 ? 'hidden' : 'visible'; plane.setAttribute('aria-hidden', String(mix >= .5));
      const closure = smooth((progress - .20) / .027) * (1 - smooth((progress - .235) / .035));
      wink.setAttribute('opacity', closure.toFixed(4));
      const visibility = 1 - smooth(progress / .13);
      copy.style.opacity = visibility.toFixed(3);
      copy.style.transform = reduced.matches ? '' : `translate3d(0,${(-smooth(progress / .18) * 80).toFixed(2)}px,0)`;
      cue.style.opacity = visibility.toFixed(3); cue.style.pointerEvents = visibility < .1 ? 'none' : ''; cue.tabIndex = visibility < .1 ? -1 : 0;
      const reveal = mix * smooth((progress - .84) / .10);
      showCaption(0, reveal); shade.style.opacity = (1 - approach * .90 + reveal * .65).toFixed(3);
      hero.dataset.transition = 'portrait';
      if (!reduced.matches) releaseDistant(0);
    }
    function schedulePortrait() { if (frame === null) frame = requestAnimationFrame(renderPortrait); }
    function goTo(index) {
      if (index < 0 || index >= works.length || reduced.matches) return;
      const top = portraitTrack.getBoundingClientRect().top + scrollY;
      window.scrollTo({ top: top + geometry.height * (2.8 + index * 1.1), behavior: Math.abs(index - current) <= 1 ? 'smooth' : 'auto' });
    }
    previous.addEventListener('click', () => goTo(current - 1)); next.addEventListener('click', () => goTo(current + 1));
    document.addEventListener('keydown', event => {
      if (reduced.matches || document.querySelector('dialog[open]') || artCopy.inert || event.target.closest?.('input,textarea,select,[contenteditable=true]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); goTo(current + (event.key === 'ArrowRight' ? 1 : -1)); }
    });
    gallery = { pause() {}, has: slug => !reduced.matches && works.some(work => work.slug === slug), select: slug => goTo(works.findIndex(work => work.slug === slug)) };
    addEventListener('scroll', schedulePortrait, { passive: true }); addEventListener('resize', measurePortrait, { passive: true });
    addEventListener('pageshow', measurePortrait, { passive: true }); reduced.addEventListener('change', measurePortrait);
    photograph.addEventListener('load', measurePortrait);
    $$('dialog').forEach(dialog => dialog.addEventListener('close', schedulePortrait));
    ensureScene(0); measurePortrait();
  }
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
