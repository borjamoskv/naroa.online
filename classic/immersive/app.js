/* Naroa — the reviewed catalogue, shown one artwork at a time. */
(() => {
  'use strict';
  const catalogue = window.NAROA_CATALOG;
  if (!catalogue) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const soundscape = window.NAROA_SOUND;
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const galleryPage = !!$('[data-gallery]'), motionListeners = new Set();
  const effectsKey = 'naroa-effects';
  let effectsPreference = null;
  try { effectsPreference = localStorage.getItem(effectsKey); } catch {}
  const reduced = {
    get matches() { return galleryPage && effectsPreference === 'on' ? false : galleryPage && effectsPreference === 'off' ? true : systemMotion.matches; },
    addEventListener(type, listener) { if (type === 'change') motionListeners.add(listener); }
  };
  function paintEffects() {
    const active = !reduced.matches;
    document.documentElement.classList.toggle('motion-opt-in', galleryPage && active);
    document.documentElement.classList.toggle('motion-off', galleryPage && !active);
    $$('[data-effects]').forEach(button => {
      button.setAttribute('aria-pressed', String(active));
      button.textContent = active ? 'Pausar efectos' : 'Activar efectos';
      button.title = active ? 'Mostrar las obras sin movimiento' : 'Activar el viaje de scroll en esta web';
    });
  }
  function motionChanged() {
    paintEffects();
    motionListeners.forEach(listener => listener({ matches: reduced.matches }));
  }
  $$('[data-effects]').forEach(button => button.addEventListener('click', () => {
    effectsPreference = reduced.matches ? 'on' : 'off';
    try { localStorage.setItem(effectsKey, effectsPreference); } catch {}
    motionChanged();
  }));
  systemMotion.addEventListener('change', motionChanged);
  paintEffects();
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
    if (selector === '#menu-dialog') refreshMenu();
    if (selector === '#index-dialog') $('#art-search').focus();
  }
  $$('[data-close-dialog]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  $$('dialog').forEach(d => d.addEventListener('click', e => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  }));
  const menu = $('#menu-dialog'), menuLinks = $$('[data-menu-item]', menu), menuImages = $$('[data-menu-image]', menu);
  const menuPicture = $('[data-menu-picture]', menu), menuReel = $('[data-menu-reel]', menu);
  const menuQuote = $('[data-menu-quote]', menu), menuMeta = $('[data-menu-preview-meta]', menu), menuLoupe = $('[data-menu-loupe]', menu);
  const menuButtons = $$('[data-open-menu]');
  let menuRequest = 0, menuImageIndex = -1, reelTimer = 0, activeReel = null, activeReelIndex = 0, activeReelLabel = '', activeMenuLink = null;
  function clearReelTimer() {
    if (reelTimer) { clearTimeout(reelTimer); reelTimer = 0; }
  }
  function currentMenuLink() {
    const path = location.pathname;
    return path === '/' ? menuLinks[0] : menuLinks.find(link => path.startsWith(new URL(link.href).pathname));
  }
  function labelMenu(title, label, quoteText, metaText) {
    $('[data-menu-preview-title]', menu).textContent = title;
    $('[data-menu-preview-label]', menu).textContent = label;
    if (menuQuote && quoteText) menuQuote.textContent = quoteText;
    if (menuMeta && metaText) menuMeta.textContent = metaText;
  }
  async function showMenuFrame(source, title, label, quoteText, metaText) {
    if (!source || !menu.open) return;
    if (menuLoupe) menuLoupe.style.backgroundImage = `url("${source}")`;
    const request = ++menuRequest;
    if (menuImages.some(image => image.classList.contains('is-visible') && image.getAttribute('src') === source)) {
      labelMenu(title, label, quoteText, metaText);
      return;
    }
    const picture = new Image(); picture.src = source;
    try {
      if (picture.decode) await picture.decode();
      else if (!picture.complete) await new Promise((resolve, reject) => { picture.onload = resolve; picture.onerror = reject; });
    } catch { return; }
    if (request !== menuRequest || !menu.open) return;
    menuImageIndex = (menuImageIndex + 1) % menuImages.length;
    const image = menuImages[menuImageIndex];
    image.src = source; image.alt = title;
    menuImages.forEach(item => item.classList.toggle('is-visible', item === image));
    labelMenu(title, label, quoteText, metaText);
  }
  function syncReelButtons() {
    if (!menuReel) return;
    $$('[data-reel-index]', menuReel).forEach((btn, idx) => btn.classList.toggle('is-active', idx === activeReelIndex));
  }
  function scheduleReelStep() {
    clearReelTimer();
    if (!menu.open || !activeReel || activeReel.length < 2) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches && !document.documentElement.classList.contains('motion-opt-in')) return;
    reelTimer = setTimeout(() => {
      if (!menu.open || !activeReel) return;
      activeReelIndex = (activeReelIndex + 1) % activeReel.length;
      const frame = activeReel[activeReelIndex];
      syncReelButtons();
      showMenuFrame(frame.src, frame.title, activeReelLabel, null, frame.meta);
      scheduleReelStep();
    }, 1800);
  }
  function renderReel(link) {
    clearReelTimer();
    if (!menuReel) return;
    const raw = link.dataset.previewReel;
    if (!raw) {
      activeReel = null;
      menuReel.hidden = true;
      menuReel.replaceChildren();
      return;
    }
    try { activeReel = JSON.parse(raw); } catch { activeReel = null; }
    if (!activeReel || !activeReel.length) {
      menuReel.hidden = true;
      menuReel.replaceChildren();
      return;
    }
    activeReelIndex = 0;
    activeReelLabel = link.dataset.previewLabel;
    menuReel.hidden = false;
    menuReel.replaceChildren(...activeReel.map((frame, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-reel-frame' + (idx === 0 ? ' is-active' : '');
      btn.dataset.reelIndex = String(idx);
      btn.dataset.reelTitle = frame.title;
      btn.tabIndex = -1;
      btn.title = frame.title;
      btn.style.backgroundImage = `url("${frame.src}")`;
      const selectFrame = e => {
        e.stopPropagation();
        activeReelIndex = idx;
        syncReelButtons();
        showMenuFrame(frame.src, frame.title, activeReelLabel, null, frame.meta);
        scheduleReelStep();
      };
      btn.addEventListener('pointerenter', selectFrame);
      btn.addEventListener('click', selectFrame);
      return btn;
    }));
    scheduleReelStep();
  }
  async function previewMenu(link, playSound = false) {
    if (!link || !menu.open) return;
    activeMenuLink = link;
    const isPortrait = link.getAttribute('href') === '/sobre-mi/' || link.getAttribute('href') === '/contacto/';
    const isWink = link.dataset.previewWink === 'true';
    if (menuPicture) {
      menuPicture.dataset.portraitMode = String(isPortrait);
      menuPicture.classList.toggle('is-winking', isWink);
    }
    if (playSound) {
      window.NAROA_SOUND?.menuNote?.(Number(link.dataset.menuIndex) || 0);
      if (isWink) window.NAROA_SOUND?.portraitWink?.();
    }
    renderReel(link);
    await showMenuFrame(link.dataset.previewSrc, link.dataset.previewTitle, link.dataset.previewLabel, link.dataset.previewQuote, link.dataset.previewMeta);
  }
  function refreshMenu() {
    const current = currentMenuLink();
    menuLinks.forEach(link => { if (link === current) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
    menuButtons.forEach(button => button.setAttribute('aria-expanded', 'true'));
    previewMenu(current || menuLinks[0], false);
  }
  menuLinks.forEach(link => {
    link.addEventListener('pointerenter', () => previewMenu(link, true));
    link.addEventListener('focus', () => previewMenu(link, false));
  });
  if (menuPicture) {
    menuPicture.addEventListener('pointermove', e => {
      const r = menuPicture.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
      menuPicture.style.setProperty('--loupe-x', `${x.toFixed(1)}%`);
      menuPicture.style.setProperty('--loupe-y', `${y.toFixed(1)}%`);
      menuPicture.classList.add('is-loupe-active');
      if (menuPicture.dataset.portraitMode === 'true') menuPicture.classList.add('is-winking');
    });
    menuPicture.addEventListener('pointerleave', () => {
      menuPicture.classList.remove('is-loupe-active');
      if (activeMenuLink?.dataset.previewWink !== 'true') menuPicture.classList.remove('is-winking');
    });
  }
  $('[data-menu-open-index]', menu)?.addEventListener('click', () => {
    menu.close();
    openDialog('#index-dialog');
  });
  menu.addEventListener('keydown', e => {
    if (!menu.open || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key >= '1' && e.key <= '7') {
      const idx = Number(e.key) - 1;
      const target = menuLinks[idx];
      if (target) {
        e.preventDefault();
        target.classList.add('is-key-flash');
        setTimeout(() => target.classList.remove('is-key-flash'), 260);
        target.focus();
        previewMenu(target, true);
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIdx = Math.max(0, menuLinks.indexOf(activeMenuLink || currentMenuLink() || menuLinks[0]));
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = menuLinks[(currentIdx + step + menuLinks.length) % menuLinks.length];
      if (next) {
        next.focus();
        previewMenu(next, true);
      }
    } else if (e.key === '/' || e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      menu.close();
      openDialog('#index-dialog');
    }
  });
  menu.addEventListener('close', () => {
    clearReelTimer();
    activeReel = null;
    if (menuPicture) menuPicture.classList.remove('is-loupe-active', 'is-winking');
    window.NAROA_SOUND?.resolveCadence?.();
    menuRequest++;
    menuButtons.forEach(button => button.setAttribute('aria-expanded', 'false'));
  });
  menuButtons.forEach(button => button.addEventListener('click', () => openDialog('#menu-dialog')));
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
  indexItems.forEach(a => {
    a.href = '/obra/' + encodeURIComponent(a.dataset.work) + '/#fotos';
    a.addEventListener('click', e => {
      if (!gallery || !gallery.has(a.dataset.work) || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault(); $('#index-dialog').close();
      (gallery.inspect || gallery.select)(a.dataset.work);
    });
  });

  const stage = $('[data-gallery]');
  if (stage) {
    const works = catalogue.projects.filter(p => stage.dataset.subset !== 'Vaivenes' || p.series === 'Vaivenes');
    const ezquerraIndex = works.findIndex(w => w.slug === 'jose-manuel-ezquerra');
    const scenes = $$('.art-scene', stage), images = scenes.map(s => $('img', s));
    scenes.forEach((s, i) => { if (works[i]) s.dataset.work = works[i].slug; });
    const kineticTitle = $('[data-kinetic-title]', stage), caption = $('[data-art-copy]', stage);
    const state = { index: Number(stage.dataset.initial) || 0, fit: false, quiet: false, photo: 0 };
    const journey = window.NAROA_JOURNEY.create(works, catalogue.journey);
    const initialDistance = journey.at(state.index);
    const motion = {
      pose: journey.read(initialDistance),
      position: state.index,
      desired: state.index,
      current: initialDistance,
      target: initialDistance,
      frame: null,
      request: 0,
      navigation: null
    };
    const track = stage.closest('.art-scroll'), geometry = { top: 0, unit: 1, width: 0, height: 0 };
    track.style.setProperty('--journey-length', `${journey.total * 100}svh`);
    document.documentElement.classList.add('gallery-scroll');
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const pan = { x: 0, y: 0, tx: 0, ty: 0, frame: null };
    let cameraRestTimer = null, lastScrollPixels = 0;
    function restCamera() {
      clearTimeout(cameraRestTimer);
      cameraRestTimer = null;
      stage.classList.remove('is-camera-moving');
      stage.style.setProperty('--velocity-skew', '0deg');
    }
    function travelCamera() {
      if (reduced.matches || state.fit) { restCamera(); return; }
      stage.classList.add('is-camera-moving', 'has-travelled');
      clearTimeout(cameraRestTimer);
      cameraRestTimer = setTimeout(restCamera, 180);
    }
    const pendingImages = new Map();
    const puzzles = new Map();
    const svgNode = (name, attrs = {}) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', name);
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
      return node;
    };
    function puzzleScene(index) {
      if (puzzles.has(index)) return puzzles.get(index);
      const svg = svgNode('svg', { viewBox: '-120 -120 1240 1240', 'aria-hidden': 'true', focusable: 'false', class: 'puzzle-camera' });
      const defs = svgNode('defs'), picture = svgNode('image', { id: `puzzle-photo-${index}`, width: 1000, height: 1000, preserveAspectRatio: 'none', href: works[index].cover });
      defs.append(picture); svg.append(defs);
      const pieces = [];
      // Adjacent edges share one curve, traversed in the opposite direction.
      const edge = (x, y, dx, dy, tab) => {
        const point = (t, n = 0) => `${(x + dx * t - dy * n).toFixed(3)},${(y + dy * t + dx * n).toFixed(3)}`;
        return tab ? `L${point(.35)} C${point(.46)} ${point(.31, tab * .16)} ${point(.5, tab * .16)} C${point(.69, tab * .16)} ${point(.54)} ${point(.65)} L${point(1)}` : `L${point(1)}`;
      };
      for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
        const n = row * 5 + col, x = col * 200, y = row * 200;
        const h = r => r === 0 || r === 5 ? 0 : (r + col) % 2 ? 1 : -1;
        const v = c => c === 0 || c === 5 ? 0 : (row + c) % 2 ? -1 : 1;
        const path = `M${x},${y}` + edge(x, y, 200, 0, h(row)) + edge(x + 200, y, 0, 200, v(col + 1)) + edge(x + 200, y + 200, -200, 0, -h(row + 1)) + edge(x, y + 200, 0, -200, -v(col)) + 'Z';
        const clip = svgNode('clipPath', { id: `puzzle-cut-${index}-${n}`, clipPathUnits: 'userSpaceOnUse' });
        clip.append(svgNode('path', { d: path })); defs.append(clip);
        const group = svgNode('g', { 'data-puzzle-piece': n });
        group.append(svgNode('use', { href: `#puzzle-photo-${index}`, 'clip-path': `url(#puzzle-cut-${index}-${n})` }));
        svg.append(group);
        const destination = (n * 7 + 9) % 25;
        pieces.push({ group, cx: x + 100, cy: y + 100, dx: ((destination % 5 - col) * 155 + Math.sin(n * 2.4) * 65) * .45, dy: (Math.floor(destination / 5) - row) * 155 * .45, turn: (n % 7 - 3) * 12 * .45, arc: Math.sin(n * 1.7) * 100 * .45 });
      }
      const puzzle = { svg, picture, pieces };
      $('.art-pan', scenes[index]).append(svg); scenes[index].classList.add('is-puzzle');
      puzzles.set(index, puzzle); return puzzle;
    }
    function drawPuzzle(index, fraction, still) {
      const puzzle = puzzleScene(index);
      puzzle.picture.setAttribute('href', works[index].cover);
      const phase = clamp(fraction / .78, 0, 1);
      const scatter = still ? 0 : Math.pow(Math.sin(phase * Math.PI), 2);
      const amount = scatter < 1e-8 ? 0 : scatter;
      puzzle.svg.dataset.scatter = amount.toFixed(4);
      puzzle.svg.style.visibility = still ? 'hidden' : 'visible';
      scenes[index].classList.toggle('puzzle-still', still);
      puzzle.pieces.forEach(({ group, cx, cy, dx, dy, turn, arc }) => {
        const a = amount, lift = Math.sin(phase * Math.PI * 2) * a;
        group.setAttribute('transform', `translate(${(dx * a).toFixed(3)} ${(dy * a + arc * lift).toFixed(3)}) rotate(${(turn * a).toFixed(3)} ${cx} ${cy})`);
      });
      return puzzle;
    }
    const paintedScenes = new Set(scenes.map((_, index) => index));
    const photosDialog = $('#photos-dialog');
    const createGalleryElement = (tag, className, text) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    };
    const galleryTrigger = createGalleryElement('button', 'art-gallery-trigger');
    galleryTrigger.type = 'button';
    galleryTrigger.setAttribute('aria-haspopup', 'dialog');
    galleryTrigger.setAttribute('aria-controls', 'work-gallery-dialog');
    $('.art-layers', stage).after(galleryTrigger);
    const workGallery = createGalleryElement('dialog', 'work-gallery-dialog');
    workGallery.id = 'work-gallery-dialog';
    workGallery.setAttribute('aria-labelledby', 'work-gallery-title');
    workGallery.setAttribute('aria-describedby', 'work-gallery-meta');
    const galleryHeader = createGalleryElement('div', 'work-gallery-header');
    const galleryClose = createGalleryElement('button', '', 'Cerrar ×');
    galleryClose.type = 'button'; galleryClose.autofocus = true;
    galleryHeader.append(createGalleryElement('p', 'eyebrow', 'La obra, de cerca'), galleryClose);
    const galleryIntro = createGalleryElement('div', 'work-gallery-intro');
    const galleryTitle = createGalleryElement('h2'); galleryTitle.id = 'work-gallery-title';
    const galleryMeta = createGalleryElement('p');
    galleryMeta.id = 'work-gallery-meta'; galleryMeta.dataset.workGalleryMeta = '';
    galleryIntro.append(galleryTitle, galleryMeta);
    const galleryGrid = createGalleryElement('div', 'work-gallery-grid');
    workGallery.append(galleryHeader, galleryIntro, galleryGrid,
      createGalleryElement('p', 'work-gallery-footer', 'Pulsa una imagen para ampliarla'));
    document.body.append(workGallery);
    let galleryReturnFocus = null, photoReturnFocus = null;
    galleryClose.addEventListener('click', () => workGallery.close());
    workGallery.addEventListener('click', event => {
      if (event.target !== workGallery) return;
      const bounds = workGallery.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) workGallery.close();
    });
    workGallery.addEventListener('close', () => {
      if (photosDialog.open) photosDialog.close();
      if (!document.querySelector('dialog[open]') && galleryReturnFocus?.isConnected) galleryReturnFocus.focus({ preventScroll: true });
      galleryReturnFocus = null;
      scheduleScroll();
    });
    const focals = { 'rara-avis': '56% 42%', 'amor-en-conserva': '50% 54%', 'entre-tantas-flores-de-dia': '50% 36%', 'johnny-rocks': '50% 42%', 'rockagipsy': '50% 43%', 'hugo-box': '50% 38%', 'el-hombre-que-susurraba-a-las-estrellas': '65.2% 57.4%', 'i-got-you-babe': '38% 46%', 'jose-manuel-ezquerra': '62% 42%', 'dar-la-lata': '54% 44%' };
    const mobileFocals = { 'rara-avis': '61% 40%', 'amor-en-conserva': '48% 54%', 'denbora-nora-zoaz': '18% 45%', 'el-hombre-que-susurraba-a-las-estrellas': '65.2% 57.4%', 'i-got-you-babe': '38% 46%', 'jose-manuel-ezquerra': '62% 42%', 'dar-la-lata': '56% 44%' };
    // Pupil centres measured on the unaltered cover photographs, in source-image coordinates.
    const eyes = {
      'marilyn-rocks': { x: .635, y: .392, iris: .030 },
      'rara-avis': { x: .683, y: .417, iris: .025 },
      'johnny-rocks': { x: .583, y: .459, iris: .028 },
      'rockagipsy': { x: .545, y: .402, iris: .018 },
      'infusion-de-berto': { x: .469, y: .463, iris: .020 },
      'buena-fuente': { x: .678, y: .439, iris: .025 }
    };
    const eyeLinks = { 'marilyn-rocks': 'rara-avis', 'johnny-rocks': 'rockagipsy', 'infusion-de-berto': 'buena-fuente' };
    const ease = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
    const smooth = value => { const t = clamp(value, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
    function eyeGeometry(index) {
      const eye = eyes[works[index].slug], img = images[index];
      const width = geometry.width + 20, height = geometry.height + 20;
      const naturalWidth = img.naturalWidth || 1000, naturalHeight = img.naturalHeight || 1000;
      const cover = Math.max(width / naturalWidth, height / naturalHeight);
      const pictureWidth = naturalWidth * cover, pictureHeight = naturalHeight * cover;
      const focus = scenes[index].style.getPropertyValue('--position').split(' ').map(v => parseFloat(v) / 100);
      return { width, height, x: (width - pictureWidth) * focus[0] + eye.x * pictureWidth, y: (height - pictureHeight) * focus[1] + eye.y * pictureHeight, iris: eye.iris * pictureWidth };
    }
    function eyePose(index, diameter, focus, offset = 0) {
      const point = eyeGeometry(index), zoom = diameter / point.iris, img = images[index];
      const tx = -(zoom - 1) * point.width / 2 * (1 - focus) + (geometry.width * .5 + 10 - point.x * zoom) * focus;
      const ty = -(zoom - 1) * point.height / 2 * (1 - focus) + (geometry.height * .42 + 10 - point.y * zoom) * focus + offset * (1 - focus);
      img.style.transformOrigin = '0px 0px';
      img.style.transform = `translate3d(${tx.toFixed(3)}px,${ty.toFixed(3)}px,0) scale(${zoom.toFixed(5)})`;
    }
    let dustinVisited = false, dustinEpilogueTimer = null;
    let puzzleVisited = false, clockVisited = false, wineVisited = false;
    function firePuzzleSnap() {
      soundscape?.puzzleSnap?.();
    }
    function fireSwissClock() {
      soundscape?.swissClock?.();
    }
    function fireWineClink() {
      soundscape?.wineClink?.();
    }
    let lastQuartile = 0;
    function checkMilestone(ratio) {
      const q = Math.floor(ratio * 4) / 4;
      if (q > 0 && q !== lastQuartile && ratio >= q) {
        lastQuartile = q;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(q >= 1 ? [20, 40, 30] : [15]); } catch {}
        }
      }
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
          puzzles.get(i)?.picture.removeAttribute('href');
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
      const ouroboros = $('[data-ouroboros]', stage);
      if (ouroboros) ouroboros.hidden = (state.index !== works.length - 1);
      stage.style.setProperty('--count', works.length);
      stage.classList.toggle('is-fit', state.fit); document.body.classList.toggle('is-quiet', state.quiet);
      $('[data-restore]', stage).hidden = !state.quiet;
      const fit = $('[data-fit]', stage); fit.setAttribute('aria-pressed', String(state.fit)); fit.textContent = state.fit ? 'Volver a la inmersión ↙' : 'Ver imagen completa ↗';
      $('[data-open-photos]', stage).textContent = `Ver ${p.photos.length} ${p.photos.length === 1 ? 'fotografía' : 'fotografías'} ↗`;
      galleryTrigger.setAttribute('aria-label', p.photos.length === 1 ? `Ver la fotografía de ${p.title}` : `Ver las ${p.photos.length} fotografías de ${p.title}`);
      galleryTrigger.dataset.work = p.slug;
      $$('.site-nav,.art-index,.art-bottom').forEach(el => { el.inert = state.quiet; });
      $('#story-title').textContent = p.title; $('[data-story-category]').textContent = p.label; $('[data-story]').textContent = p.story;
      const facts = $('[data-facts]'); facts.replaceChildren();
      [['Técnica', p.technique], ['Soporte', p.support], ['Medidas', p.dimensions], ['Materiales', p.materials], ['Serie', p.series], ['Año', p.year]].forEach(([label, value]) => {
        if (!value) return;
        const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; row.append(dt, dd); facts.append(row);
      });
      const credit = $('[data-credit]'); credit.textContent = p.credit || ''; credit.hidden = !p.credit;
      $('[data-art-email]').href = 'mailto:naroa@naroa.eu?subject=' + encodeURIComponent('Consulta sobre ' + p.title);
      const waLink = $('[data-art-whatsapp]');
      if (waLink) waLink.href = 'https://wa.me/34636060609?text=' + encodeURIComponent('Hola Naroa, me gustaría consultar sobre la obra ' + p.title);
      const source = $('[data-art-source]'); source.hidden = !p.source;
      if (p.source) source.href = p.source; else source.removeAttribute('href');
      const video = $('[data-art-video]');
      if (video) {
        video.hidden = !p.video;
        if (p.video) video.href = p.video; else video.removeAttribute('href');
      }
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
      const pose = motion.pose, { entry, phase, progress: fraction } = pose;
      const base = entry.index, incoming = Math.min(base + 1, works.length - 1);
      const still = state.fit || reduced.matches;
      const transition = !still && phase === 'transition' && fraction > 0;
      const mode = entry.mode, progress = smooth(fraction), eyeMatch = transition && mode === 'E';
      stage.dataset.transition = still ? 'still' : phase === 'explore' ? 'explore' : !transition ? 'hold' : ({ E: 'eyes', H: 'horizontal', V: 'vertical', Z: 'zoom', P: 'puzzle' })[mode];
      stage.dataset.journeyPhase = phase;
      const visible = new Set(still ? [state.index] : transition ? [base, incoming] : [base]);
      paintedScenes.forEach(index => {
        if (visible.has(index)) return;
        scenes[index].style.visibility = 'hidden'; scenes[index].style.willChange = images[index].style.willChange = 'auto';
      });
      paintedScenes.clear();
      let depth = 0, diameter = 0, focus = 0;
      if (eyeMatch) {
        const from = eyeGeometry(base).iris * 1.08, to = eyeGeometry(incoming).iris * 1.08;
        const deep = Math.hypot(geometry.width, geometry.height) * 1.02;
        const approach = smooth(fraction / .64), reveal = smooth((fraction - .64) / .36);
        diameter = Math.exp(fraction <= .64 ? Math.log(from) + Math.log(deep / from) * approach : Math.log(deep) + Math.log(to / deep) * reveal);
        focus = smooth(fraction / .34) * (1 - reveal); depth = approach * (1 - reveal);
      } else if (transition && mode === 'Z') depth = smooth(fraction / .55) * (1 - smooth((fraction - .55) / .45));
      visible.forEach(index => {
        const scene = scenes[index], image = images[index], outgoing = index === base;
        paintedScenes.add(index);
        scene.style.visibility = 'visible'; scene.style.zIndex = outgoing ? '1' : '2';
        scene.style.willChange = transition ? 'opacity,transform' : 'auto'; image.style.willChange = still ? 'auto' : 'transform';
        scene.style.clipPath = 'inset(0)'; scene.style.opacity = '1'; scene.style.transform = 'translate3d(0px,0px,0)';
        scene.style.maskImage = scene.style.webkitMaskImage = 'none';
        image.style.transformOrigin = works[index].slug === 'el-hombre-que-susurraba-a-las-estrellas' ? '65.2% 57.4%'
          : works[index].slug === 'i-got-you-babe' ? '38% 46%'
          : works[index].slug === 'jose-manuel-ezquerra' ? '62% 42%'
          : '50% 50%';
        if (works[index].interaction === 'puzzle' && (!still || puzzles.has(index))) drawPuzzle(index, outgoing && transition ? fraction : 0, still);
        if (works[index].slug === 'custom-jaio' && !state.fit) {
          const step = outgoing && transition ? (fraction < .34 ? 0 : fraction < .67 ? 1 : 2) : 0;
          const nextSrc = works[index].photos[step]?.src || works[index].cover;
          if (image.getAttribute('src') !== nextSrc) image.src = nextSrc;
        }
        if (still) { image.style.transform = ''; return; }
        if (!transition) {
          const isBowie = works[index].slug === 'el-hombre-que-susurraba-a-las-estrellas';
          const isMarilyn = index === 0;
          if (isBowie) {
            image.style.transformOrigin = '65.2% 57.4%';
            const holdZoom = 1.25 + smooth(pose.explore) * 0.50;
            image.style.transform = `scale(${holdZoom.toFixed(5)})`;
          } else if (isMarilyn) {
            image.style.transformOrigin = '50.4% 51.7%';
            const lipsZoom = 1.08 + smooth(pose.explore) * 0.40;
            image.style.transform = `scale(${lipsZoom.toFixed(5)})`;
          } else {
            image.style.transform = `translate3d(0,${(-smooth(pose.explore) * 3).toFixed(3)}%,0) scale(1.08000)`;
          }
        } else if (mode === 'E') {
          eyePose(index, diameter, focus, outgoing && entry.explore ? -(geometry.height + 20) * .03 : 0);
          if (!outgoing) scene.style.opacity = smooth((fraction - .42) / .16).toFixed(4);
        } else if (mode === 'H' || mode === 'V') {
          const displacement = outgoing ? -progress : 1 - progress;
          const x = mode === 'H' ? displacement * geometry.width * entry.direction : 0;
          const y = mode === 'V' ? displacement * geometry.height : 0;
          scene.style.transform = `translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0)`;
          // Subtle interior parallax (max 2%) and lens scale between 1.08 and 1.12.
          const parallax = displacement * 2;
          const lens = 1.08 + .04 * (outgoing ? progress : 1 - progress);
          image.style.transform = `translate3d(${mode === 'H' ? parallax.toFixed(3) : '0'}%,${mode === 'V' ? parallax.toFixed(3) : '0'}%,0) scale(${lens.toFixed(5)})`;
        } else if (mode === 'Z') {
          const close = outgoing ? smooth(fraction / .65) : 1 - smooth((fraction - .35) / .65);
          const isBowie = works[index].slug === 'el-hombre-que-susurraba-a-las-estrellas';
          const isBillToEzquerra = (works[base].slug === 'i-got-you-babe' && works[incoming].slug === 'jose-manuel-ezquerra');
          let maxScale = 1.65;
          if (isBowie) maxScale = 2.45;
          else if (isBillToEzquerra) maxScale = 2.65;
          image.style.transform = `scale(${Math.exp(Math.log(1.08) + Math.log(maxScale / 1.08) * close).toFixed(5)})`;
          if (!outgoing) scene.style.opacity = smooth((fraction - .40) / .20).toFixed(4);
        } else if (mode === 'P') {
          const exit = smooth((fraction - .80) / .20);
          if (!outgoing) scene.style.opacity = exit.toFixed(4);
          scene.style.transform = `translate3d(0,${(outgoing ? -exit * geometry.height : (1 - exit) * geometry.height).toFixed(3)}px,0)`;
          image.style.transform = 'scale(1.08000)';
        }
      });
      const activeSlug = transition && fraction >= .5 ? works[incoming].slug : works[base].slug;
      const heroThreshold = $('[data-hero-threshold]', stage);
      if (heroThreshold) {
        const thresholdPlane = $('[data-threshold-plane]', heroThreshold);
        const thresholdWink = $('[data-threshold-wink]', heroThreshold);
        if (still || pose.distance >= 0.36) {
          heroThreshold.style.visibility = 'hidden';
          heroThreshold.style.opacity = '0';
        } else {
          const tRaw = clamp(pose.distance / 0.36, 0, 1);
          const t = smooth(tRaw);
          const scale = Math.exp(Math.log(7.2) * t);
          const fade = 1 - smooth((tRaw - 0.45) / 0.55);
          heroThreshold.style.visibility = 'visible';
          heroThreshold.style.opacity = fade.toFixed(4);
          if (thresholdPlane) thresholdPlane.style.transform = `scale(${scale.toFixed(4)})`;
          if (thresholdWink) thresholdWink.style.opacity = (tRaw >= 0.08 && tRaw <= 0.48) ? '1' : '0';
        }
      }
      const artBottom = $('.art-bottom', stage);
      if (artBottom) {
        if (!still && pose.distance < 0.36) {
          const bottomFade = smooth((pose.distance - 0.20) / 0.16);
          artBottom.style.opacity = bottomFade.toFixed(4);
          artBottom.style.pointerEvents = bottomFade > 0.5 ? 'auto' : 'none';
        } else {
          artBottom.style.opacity = '';
          artBottom.style.pointerEvents = '';
        }
      }
      if (works[base].slug === 'dustin' || works[incoming].slug === 'dustin') {
        if (!dustinVisited && (works[state.index].slug === 'dustin' || (transition && works[incoming].slug === 'dustin' && fraction >= 0.45))) {
          dustinVisited = true;
          clearTimeout(dustinEpilogueTimer);
          dustinEpilogueTimer = setTimeout(() => {
            if (works[state.index]?.slug === 'dustin') {
              stage.classList.add('is-silent-epilogue');
            }
          }, 2400);
        }
        stage.dataset.finale = 'silence';
      } else {
        dustinVisited = false;
        clearTimeout(dustinEpilogueTimer);
        stage.classList.remove('is-silent-epilogue');
        delete stage.dataset.finale;
      }
      if (works[base].slug === 'saio-puzzle' || works[incoming].slug === 'saio-puzzle') {
        if (!puzzleVisited && (works[state.index].slug === 'saio-puzzle' || (transition && works[incoming].slug === 'saio-puzzle' && fraction >= 0.70))) {
          puzzleVisited = true;
          firePuzzleSnap();
        }
      } else {
        puzzleVisited = false;
      }
      if (works[base].slug === 'julio-iglesias-como-un-reloj-suizo' || works[incoming].slug === 'julio-iglesias-como-un-reloj-suizo') {
        if (!clockVisited && (works[state.index].slug === 'julio-iglesias-como-un-reloj-suizo' || (transition && works[incoming].slug === 'julio-iglesias-como-un-reloj-suizo' && fraction >= 0.35))) {
          clockVisited = true;
          fireSwissClock();
        }
      } else {
        clockVisited = false;
      }
      if (works[base].slug === 'red-red-wine' || works[incoming].slug === 'red-red-wine') {
        if (!wineVisited && (works[state.index].slug === 'red-red-wine' || (transition && works[incoming].slug === 'red-red-wine' && fraction >= 0.35))) {
          wineVisited = true;
          fireWineClink();
        }
      } else {
        wineVisited = false;
      }
      soundscape?.frame({
        distance: still ? scrollY / Math.max(1, geometry.height) : pose.distance,
        depth: still ? 0 : depth,
        mode: still ? 'still' : mode,
        phase: still ? 'scroll' : transition ? 'transition' : phase === 'explore' ? 'explore' : 'hold',
        axisDirection: mode === 'H' ? entry.direction : 1,
        slug: activeSlug,
        flash: 0,
        punch: false
      });
      if (kineticTitle.textContent) kineticTitle.textContent = '';
      kineticTitle.style.opacity = '0';
      kineticTitle.style.transform = '';
      caption.style.opacity = '1';
      caption.style.transform = '';
      // Attenuate reading controls down to a minimum of 35% opacity while moving, recovering to 100% at rest.
      const veil = transition ? Math.sin(fraction * Math.PI) : phase === 'explore' ? Math.sin(pose.explore * Math.PI) * .5 : 0;
      stage.style.setProperty('--camera-veil', (veil * .65).toFixed(4));
      if (still) restCamera();
      const cue = $('[data-journey-cue]', stage);
      if (works[state.index]?.slug === 'dustin' && !transition) {
        cue.textContent = 'La última nota ya es silencio · Volver al origen ↺';
      } else {
        cue.textContent = still ? reduced.matches ? 'Activa los efectos para ver el viaje ↓' : 'Desplázate para recorrer ↕' : !transition ? phase === 'explore' ? 'Explora la superficie ↓' : 'Una pausa para mirar · sigue ↓' : ({ E: 'Entra en la mirada ↓', H: 'Atravesar · sigue bajando ↓', V: 'Déjate llevar ↓', Z: 'Acércate ↓', P: 'Mezclar y volver a unir ↓' })[mode];
      }
      stage.classList.toggle('is-travelling', transition);
      stage.style.setProperty('--progress', (pose.distance / journey.total * (works.length - 1) * 100).toFixed(3) + '%');
      checkMilestone(pose.distance / Math.max(1, journey.total));
    }
    function measure() {
      const bounds = track.getBoundingClientRect(), viewport = stage.getBoundingClientRect(), height = viewport.height || innerHeight;
      geometry.width = viewport.width || innerWidth; geometry.height = height;
      geometry.top = bounds.top + scrollY;
      geometry.unit = (bounds.height - height) / journey.total || height;
    }
    function leaveFit() { if (state.fit) { state.fit = false; images[state.index].src = works[state.index].cover; } }
    function syncScroll() {
      if (document.querySelector('dialog[open]')) return;
      let pixels = scrollY - geometry.top;
      // Native scroll positions round to device pixels, including direct-link jumps.
      const boundary = journey.entries.find(entry => Math.abs(entry.start * geometry.unit - pixels) < 1);
      const targetDist = clamp(boundary ? boundary.start : pixels / geometry.unit, 0, journey.total);
      motion.target = targetDist;
      if (reduced.matches || state.fit) {
        motion.current = targetDist;
      }
      scheduleMotion();
    }
    function scheduleMotion() {
      if (motion.frame === null) motion.frame = requestAnimationFrame(stepMotion);
    }
    function stepMotion() {
      motion.frame = null;
      if (document.querySelector('dialog[open]')) return;
      const still = state.fit || reduced.matches;
      const delta = motion.target - motion.current;
      if (still || Math.abs(delta) < 0.00015) {
        motion.current = motion.target;
      } else {
        // High-density sub-step damping (0.16 per frame) generates silky-smooth minipasos across any scroll gesture
        motion.current += delta * 0.16;
      }
      const pose = journey.read(motion.current);
      const position = pose.position;
      motion.desired = position;
      if (motion.navigation !== null && Math.abs(position - motion.navigation) < .002) motion.navigation = null;
      if (Math.abs(pose.distance - motion.pose.distance) > .0008) {
        const pixels = motion.current * geometry.unit;
        const skew = clamp((pixels - lastScrollPixels) * 0.035, -3.2, 3.2);
        stage.style.setProperty('--velocity-skew', `${skew.toFixed(2)}deg`);
        leaveFit(); resetPan(); travelCamera();
        lastScrollPixels = pixels;
      }
      motion.pose = pose;
      motion.position = position;
      const base = Math.floor(position);
      const index = !reduced.matches && works[base].interaction === 'puzzle' && position - base < .9 ? base : clamp(Math.round(position), 0, works.length - 1);
      if (index !== state.index) { state.index = index; metadata(); saveRoute(); }
      else stage.classList.toggle('is-fit', state.fit);
      render();
      ensureImage(Math.floor(position));
      ensureImage(Math.ceil(position));
      if (motion.current !== motion.target) {
        motion.frame = requestAnimationFrame(stepMotion);
      }
    }
    function scheduleScroll() { syncScroll(); }
    function moveTo(index, smooth = false) {
      const targetDist = journey.at(index);
      if (!smooth || reduced.matches) {
        motion.current = motion.target = targetDist;
      } else {
        motion.target = targetDist;
      }
      window.scrollTo({ top: geometry.top + targetDist * geometry.unit, behavior: smooth && !reduced.matches ? 'smooth' : 'auto' });
      scheduleScroll();
    }
    function pause() {
      restCamera();
      motion.request++;
      motion.navigation = null;
      if (motion.frame !== null) cancelAnimationFrame(motion.frame);
      motion.frame = null;
      motion.current = motion.target;
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
    addEventListener('wheel', e => {
      interruptNavigation();
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 4) {
        window.scrollBy({ top: e.deltaX, behavior: 'auto' });
      }
    }, { passive: true });
    let touchStartY = 0;
    addEventListener('touchstart', e => {
      interruptNavigation();
      if (e.touches?.length) touchStartY = e.touches[0].clientY;
    }, { passive: true });
    addEventListener('touchmove', () => {}, { passive: true });
    $$('[data-select]', stage).forEach(b => b.addEventListener('click', () => change(Number(b.dataset.select))));
    $('[data-prev]', stage).addEventListener('click', () => {
      const cur = motion.navigation ?? motion.desired;
      change(Math.floor(cur) === Math.ceil(cur) ? Math.round(cur) - 1 : Math.floor(cur));
    });
    $('[data-next]', stage).addEventListener('click', () => {
      const cur = motion.navigation ?? motion.desired;
      change(Math.floor(cur) + 1);
    });
    $('[data-ouroboros]', stage)?.addEventListener('click', () => change(0));
    $('[data-journey-cue]', stage)?.addEventListener('click', () => {
      if (works[state.index]?.slug === 'dustin') change(0);
    });
    $('[data-fit]', stage).addEventListener('click', () => { pause(); state.fit = !state.fit; images[state.index].src = state.fit ? works[state.index].photos[0].src : works[state.index].cover; resetPan(); metadata(); render(); });
    $('[data-threshold-enter]', stage)?.addEventListener('click', () => {
      window.NAROA_SOUND?.menuNote?.(0);
      window.scrollTo({ top: Math.ceil(geometry.top + 0.38 * geometry.unit), behavior: reduced.matches ? 'auto' : 'smooth' });
      scheduleScroll();
    });
    $('[data-open-story]', stage).addEventListener('click', () => openDialog('#story-dialog'));
    document.querySelector('[data-share-link]')?.addEventListener('click', e => {
      const p = works[state.index];
      const url = location.origin + '/obra/' + p.slug + '/';
      const btn = e.currentTarget;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          const prev = btn.textContent;
          btn.textContent = '¡Enlace copiado! ✓';
          setTimeout(() => { btn.textContent = prev; }, 2000);
        }).catch(() => {
          window.prompt('Copia el enlace directo:', url);
        });
      } else {
        window.prompt('Copia el enlace directo:', url);
      }
    });
    function showPhoto() {
      const p = works[state.index];
      state.photo = clamp(state.photo, 0, p.photos.length - 1);
      const photo = p.photos[state.photo], image = $('[data-photo-image]', photosDialog);
      $('#photos-heading').textContent = p.title;
      $('[data-close-dialog]', photosDialog).textContent = 'Volver a las fotos ↙';
      image.width = photo.width; image.height = photo.height;
      image.src = photo.original || photo.src;
      image.alt = p.title + ' — ' + photo.caption;
      image.style.gridColumn = p.photos.length === 1 ? '1 / -1' : '';
      const description = $('[data-photo-caption]', photosDialog);
      description.setAttribute('aria-atomic', 'true');
      description.textContent = `${String(state.photo + 1).padStart(2, '0')} / ${String(p.photos.length).padStart(2, '0')} · ${photo.caption}`;
      const previous = $('[data-photo-prev]', photosDialog), next = $('[data-photo-next]', photosDialog);
      previous.hidden = next.hidden = p.photos.length < 2;
      previous.disabled = state.photo === 0; next.disabled = state.photo === p.photos.length - 1;
    }
    function openWorkGallery(trigger = galleryTrigger) {
      const p = works[state.index];
      if (workGallery.open || !p.photos.length) return;
      galleryReturnFocus = trigger;
      state.photo = 0;
      workGallery.dataset.work = p.slug;
      galleryTitle.textContent = p.title;
      galleryMeta.textContent = `${p.label} · ${p.photos.length} ${p.photos.length === 1 ? 'fotografía' : 'fotografías'}`;
      galleryGrid.dataset.count = String(p.photos.length);
      const figures = p.photos.map((photo, index) => {
        const figure = createGalleryElement('figure', 'work-gallery-figure');
        const link = createGalleryElement('a', 'work-gallery-image');
        link.href = photo.original || photo.src;
        link.setAttribute('aria-label', `Ampliar ${p.title}: ${photo.caption}`);
        link.setAttribute('aria-haspopup', 'dialog');
        link.setAttribute('aria-controls', 'photos-dialog');
        const image = createGalleryElement('img');
        image.width = photo.width; image.height = photo.height;
        image.alt = p.title + ' — ' + photo.caption;
        image.decoding = 'async'; image.loading = index === 0 ? 'eager' : 'lazy';
        image.src = photo.src || photo.original;
        image.addEventListener('error', () => {
          if (photo.original && image.getAttribute('src') !== photo.original) image.src = photo.original;
        }, { once: true });
        link.append(image);
        const openPhoto = event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          state.photo = index; photoReturnFocus = event.currentTarget;
          showPhoto(); openDialog('#photos-dialog');
        };
        link.addEventListener('click', openPhoto);
        const expand = createGalleryElement('a', 'work-gallery-expand', 'Ampliar ↗');
        expand.href = link.href;
        expand.setAttribute('aria-label', link.getAttribute('aria-label'));
        expand.setAttribute('aria-haspopup', 'dialog');
        expand.setAttribute('aria-controls', 'photos-dialog');
        expand.addEventListener('click', openPhoto);
        const description = createGalleryElement('figcaption');
        description.append(
          createGalleryElement('span', 'work-gallery-number', `${String(index + 1).padStart(2, '0')} / ${String(p.photos.length).padStart(2, '0')}`),
          createGalleryElement('span', '', photo.caption), expand);
        figure.append(link, description);
        return figure;
      });
      galleryGrid.replaceChildren(...figures);
      openDialog('#work-gallery-dialog');
      workGallery.scrollTop = 0;
    }
    function inspect(slug) {
      const index = works.findIndex(work => work.slug === slug);
      if (index < 0) return;
      // Commit an index jump before opening the dialog; an older decode cannot
      // overwrite the selection while syncScroll is waiting for an image.
      motion.request++;
      if (motion.frame !== null) cancelAnimationFrame(motion.frame);
      motion.frame = null; motion.navigation = null;
      leaveFit(); resetPan();
      state.index = index; state.photo = 0;
      motion.position = motion.desired = index;
      motion.current = motion.target = journey.at(index);
      motion.pose = journey.read(journey.at(index));
      metadata(); saveRoute(); render(); moveTo(index);
      openWorkGallery(galleryTrigger);
    }
    function photoStep(d) { state.photo = clamp(state.photo + d, 0, works[state.index].photos.length - 1); showPhoto(); }
    galleryTrigger.addEventListener('click', () => {
      openWorkGallery(galleryTrigger);
    });
    const progressBar = $('.art-progress', stage);
    if (progressBar) {
      const tooltip = createGalleryElement('div', 'scrubber-tooltip');
      tooltip.hidden = true;
      progressBar.append(tooltip);
      const indexFromEvent = e => {
        const rect = progressBar.getBoundingClientRect();
        const ratio = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
        return { ratio, idx: Math.round(ratio * (works.length - 1)) };
      };
      progressBar.addEventListener('pointermove', e => {
        const { ratio, idx } = indexFromEvent(e);
        const w = works[idx];
        if (!w) return;
        tooltip.hidden = false;
        tooltip.style.left = `${(ratio * 100).toFixed(2)}%`;
        tooltip.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(works.length).padStart(2, '0')} · ${w.title}`;
        if (e.buttons === 1) change(idx);
      });
      progressBar.addEventListener('pointerleave', () => { tooltip.hidden = true; });
      progressBar.addEventListener('click', e => {
        const { idx } = indexFromEvent(e);
        change(idx);
      });
    }
    $('[data-ouroboros]', stage)?.addEventListener('click', () => change(0));
    $('[data-journey-cue]', stage)?.addEventListener('click', () => {
      if (works[state.index]?.slug === 'dustin') change(0);
    });
    $('[data-open-photos]', stage).addEventListener('click', event => openWorkGallery(event.currentTarget));
    $('[data-photo-prev]').addEventListener('click', () => photoStep(-1)); $('[data-photo-next]').addEventListener('click', () => photoStep(1));
    photosDialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); photoStep(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); photoStep(-1); }
    });
    photosDialog.addEventListener('close', () => {
      if (workGallery.open && photoReturnFocus?.isConnected) photoReturnFocus.focus({ preventScroll: true });
      photoReturnFocus = null;
    });
    function quiet(value) { state.quiet = value; metadata(); (value ? $('[data-restore]', stage) : $('[data-quiet]')).focus(); }
    $('[data-quiet]').addEventListener('click', () => quiet(true)); $('[data-restore]', stage).addEventListener('click', () => quiet(false));
    document.addEventListener('keydown', e => {
      if (document.querySelector('dialog[open]') || e.target.closest?.('input,textarea,select,[contenteditable=true]')) return;
      if (e.key === 'Escape' && state.quiet) { e.preventDefault(); quiet(false); return; }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const cur = motion.navigation ?? motion.desired;
        change(Math.floor(cur) + 1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const cur = motion.navigation ?? motion.desired;
        change(Math.floor(cur) === Math.ceil(cur) ? Math.round(cur) - 1 : Math.floor(cur));
      }
    });
    function resetPan() { if (pan.frame !== null) cancelAnimationFrame(pan.frame); pan.x = pan.y = pan.tx = pan.ty = 0; pan.frame = null; stage.style.setProperty('--pan-x', '0px'); stage.style.setProperty('--pan-y', '0px'); }
    reduced.addEventListener('change', () => { resetPan(); pause(); if (reduced.matches) $('.art-layers', stage).getAnimations?.().forEach(animation => animation.cancel()); });
    addEventListener('resize', () => {
      const distance = (scrollY - geometry.top) / geometry.unit;
      const oldUnit = geometry.unit, oldTop = geometry.top;
      focusPictures(); measure();
      if (Math.abs(oldUnit - geometry.unit) > .5 || Math.abs(oldTop - geometry.top) > .5) window.scrollTo({ top: geometry.top + distance * geometry.unit, behavior: 'auto' });
      scheduleScroll();
    }, { passive: true });
    addEventListener('pageshow', scheduleScroll, { passive: true });
    $$('dialog').forEach(dialog => dialog.addEventListener('close', scheduleScroll));
    gallery = { pause, inspect, has: slug => works.some(w => w.slug === slug), select: slug => change(works.findIndex(w => w.slug === slug)) };
    measure(); metadata(); render(); moveTo(state.index);
    if (location.hash === '#fotos') openWorkGallery(galleryTrigger);
    addEventListener('hashchange', () => {
      if (location.hash === '#fotos' && !workGallery.open && !document.querySelector('dialog[open]')) openWorkGallery(galleryTrigger);
    });
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
    let interactiveWinkTimer = null, interactiveWinkVal = 0, hasWinkedOnScroll = false;
    function triggerInteractiveWink() {
      const travel = Math.max(0, -portraitTrack.getBoundingClientRect().top);
      if (travel > 60 || interactiveWinkTimer) return;
      soundscape?.portraitWink?.();
      const startTime = performance.now();
      const duration = 520;
      function step(now) {
        const elapsed = now - startTime;
        if (elapsed >= duration) {
          interactiveWinkVal = 0;
          interactiveWinkTimer = null;
          schedulePortrait();
          return;
        }
        const t = elapsed / duration;
        interactiveWinkVal = t < 0.35 ? smooth(t / 0.35) : t > 0.65 ? 1 - smooth((t - 0.65) / 0.35) : 1;
        schedulePortrait();
        interactiveWinkTimer = requestAnimationFrame(step);
      }
      interactiveWinkTimer = requestAnimationFrame(step);
    }
    plane.addEventListener('click', triggerInteractiveWink);
    plane.style.cursor = 'pointer';
    let mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    function onPointerMove(e) {
      if (reduced.matches) return;
      const rect = hero.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      mouse.tx = clamp((e.clientX - rect.left) / rect.width - 0.5, -0.5, 0.5);
      mouse.ty = clamp((e.clientY - rect.top) / rect.height - 0.5, -0.5, 0.5);
      schedulePortrait();
    }
    function onPointerLeave() {
      mouse.tx = 0; mouse.ty = 0;
      schedulePortrait();
    }
    hero.addEventListener('pointermove', onPointerMove, { passive: true });
    hero.addEventListener('pointerleave', onPointerLeave, { passive: true });
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
      // Minimum iris immersion needed to cover the viewport frame with a 2% margin.
      const deep = Math.hypot(geometry.width, geometry.height) * 1.02;
      const approach = smooth(progress / .64), reveal = smooth((progress - .64) / .32);
      const diameter = Math.exp(progress <= .64
        ? Math.log(start) + Math.log(deep / start) * approach
        : Math.log(deep) + Math.log(finish / deep) * reveal);
      const focus = smooth(progress / .34) * (1 - reveal);
      const depth = approach * (1 - reveal);
      pose(from, fromBox, fromEye, Math.max(1, diameter / start), focus);
      pose(target, targetBox, targetEye, Math.max(1, diameter / finish), focus);
      return { blend: smooth((progress - .44) / .14), depth };
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
      artCopy.style.transform = reduced.matches ? '' : `translate3d(0,${((1 - opacity) * 12).toFixed(2)}px,0)`;
    }
    function renderExhibition(position, totalDistance) {
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
      const activeSlug = pair && fraction >= .5 ? works[incoming].slug : works[base].slug;
      hero.dataset.transition = eyeMatch ? 'eyes' : pair ? 'depth' : 'still';
      if (eyeMatch) {
        const pass = eyePass(outgoing, target, g.boxes[base], g.boxes[incoming], fromEye, toEye, fraction);
        target.style.opacity = pass.blend.toFixed(4);
        soundscape?.frame({ distance: totalDistance, depth: pass.depth, mode: 'E', phase: 'transition', axisDirection: 1, slug: activeSlug });
      } else {
        const progress = smooth(fraction), centre = { x: .5, y: .5 };
        pose(outgoing, g.boxes[base], centre, 1 + progress * .06, 0, -g.height * .025 * progress);
        if (pair) {
          pose(target, g.boxes[incoming], centre, 1 + (1 - progress) * .06, 0, g.height * .025 * (1 - progress));
          target.style.opacity = smooth((fraction - .10) / .80).toFixed(4);
        }
        soundscape?.frame({ distance: totalDistance, depth: 0, mode: 'Z', phase: pair ? 'transition' : 'hold', axisDirection: 1, slug: activeSlug });
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
      if (!reduced.matches && travel >= g.height * 2.8) { renderExhibition(position, travel / g.height); return; }
      ensureScene(0);
      active.clear(); active.add(0);
      scenes.forEach((scene, i) => { if (i) { scene.style.visibility = 'hidden'; scene.setAttribute('aria-hidden', 'true'); scene.classList.remove('is-visible'); } });
      const approach = smooth(progress / .42);
      const { blend, depth } = eyePass(plane, artwork, g.portrait, g.art, eye, eyes['rara-avis'], progress);
      const mix = ready(0) ? blend : 0;
      artwork.style.opacity = mix.toFixed(4); artwork.style.zIndex = '1';
      artwork.style.visibility = mix > 0 ? 'visible' : 'hidden'; artwork.classList.toggle('is-visible', mix > 0);
      artwork.setAttribute('aria-hidden', String(mix < .5));
      plane.style.visibility = mix === 1 ? 'hidden' : 'visible'; plane.setAttribute('aria-hidden', String(mix >= .5));
      const closure = smooth((progress - .10) / .08) * (1 - smooth((progress - .28) / .10));
      const effectiveClosure = Math.max(closure, interactiveWinkVal);
      wink.setAttribute('opacity', effectiveClosure.toFixed(4));
      if (closure >= 0.8 && !hasWinkedOnScroll) {
        hasWinkedOnScroll = true;
        soundscape?.portraitWink?.();
      } else if (closure < 0.1) {
        hasWinkedOnScroll = false;
      }
      const reveal = mix * smooth((progress - .84) / .10);
      const visibility = 1 - smooth((progress - .12) / .16);
      mouse.x += (mouse.tx - mouse.x) * 0.15;
      mouse.y += (mouse.ty - mouse.y) * 0.15;
      const parallaxFactor = smooth(1 - progress / 0.28);
      const copyPx = mouse.x * 24 * parallaxFactor;
      const copyPy = mouse.y * 18 * parallaxFactor;
      const copyScrollY = -smooth(progress / .24) * 45;
      copy.style.opacity = visibility.toFixed(3);
      copy.style.transform = reduced.matches ? '' : `translate3d(${copyPx.toFixed(2)}px,${(copyScrollY + copyPy).toFixed(2)}px,0)`;
      const shadePx = -mouse.x * 16 * parallaxFactor;
      const shadePy = -mouse.y * 12 * parallaxFactor;
      const shadeScrollY = progress * 32;
      shade.style.opacity = (1 - approach * .90 + reveal * .65).toFixed(3);
      shade.style.transform = reduced.matches ? '' : `translate3d(${shadePx.toFixed(2)}px,${(shadeScrollY + shadePy).toFixed(2)}px,0)`;
      const tiltX = -mouse.y * 3.5 * parallaxFactor;
      const tiltY = mouse.x * 3.5 * parallaxFactor;
      const portraitFrame = $('.portrait-frame', hero);
      if (portraitFrame) portraitFrame.style.transform = reduced.matches ? '' : `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
      cue.style.opacity = visibility.toFixed(3); cue.style.pointerEvents = visibility < .1 ? 'none' : ''; cue.tabIndex = visibility < .1 ? -1 : 0;
      showCaption(0, reveal);
      hero.dataset.transition = 'portrait';
      if (reduced.matches) soundscape?.frame({ distance: scrollY / Math.max(1, g.height), depth: 0, mode: 'still', phase: 'scroll', axisDirection: 1, slug: 'rara-avis' });
      else if (progress <= .44 || ready(0)) soundscape?.frame({ distance: travel / g.height, depth, mode: 'E', phase: progress > 0 && progress < .96 ? 'transition' : 'hold', axisDirection: 1, slug: 'rara-avis' });
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
        const shift = (progress - .5) * 2 * vh * .07;
        target.style.transform = reduced.matches ? '' : `translate3d(0,${shift.toFixed(2)}px,0) scale(1.08)`;
        const copy = $('.page-hero-copy', section);
        if (copy) {
          const exit = clamp(-r.top / vh, 0, 1);
          copy.style.transform = reduced.matches ? '' : `translate3d(0,${(-exit * vh * .035).toFixed(2)}px,0)`;
          copy.style.opacity = reduced.matches ? '1' : (1 - exit * .75).toFixed(3);
        }
      });
      $('.site-nav').classList.toggle('is-scrolled', scrollY > vh * .72);
    }
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(pageParallax); };
    addEventListener('scroll', schedule, { passive: true }); addEventListener('resize', schedule, { passive: true }); reduced.addEventListener('change', schedule); schedule();
  }
  const notebookSync = $('[data-notebook-sync]'), notebookGrid = $('[data-notebook-posts]');
  if (notebookSync && notebookGrid && typeof fetch === 'function') {
    const endpoint = notebookSync.dataset.notebookSync;
    const plain = value => {
      const doc = new DOMParser().parseFromString(String(value || ''), 'text/html');
      return (doc.body?.textContent || '').trim();
    };
    const safeUrl = (value, isImage = false) => {
      try {
        const u = new URL(value);
        return u.protocol === 'https:' && u.hostname === 'naroagutierrez.wordpress.com' && (!isImage || u.pathname.startsWith('/wp-content/uploads/')) ? u.href : null;
      } catch { return null; }
    };
    async function syncNotebook() {
      if (!endpoint || document.hidden) return;
      try {
        const res = await fetch(endpoint, { credentials: 'omit' });
        if (!res.ok) return;
        const data = await res.json();
        const posts = (data?.posts || []).filter(p => safeUrl(p.URL) && p.title && !Number.isNaN(Date.parse(p.date))).slice(0, 6);
        if (posts.length < 6) return;
        const existingImages = new Map($$('[data-notebook-entry]', notebookGrid).map(card => {
          const link = $('h3 a', card)?.getAttribute('href'), img = $('.notebook-photo img', card);
          return [link, img ? { src: img.getAttribute('src'), width: img.width || 1080, height: img.height || 1080, alt: img.alt } : null];
        }));
        const cards = posts.map(post => {
          const title = plain(post.title), url = safeUrl(post.URL);
          const localImg = existingImages.get(url);
          const remoteSrc = safeUrl(post.featured_image, true);
          const imgSrc = localImg?.src || remoteSrc;
          const article = document.createElement('article');
          article.className = 'notebook-card is-revealed';
          article.dataset.notebookEntry = '';
          if (imgSrc) {
            const photoLink = document.createElement('a');
            photoLink.className = 'notebook-photo'; photoLink.href = url; photoLink.target = '_blank'; photoLink.rel = 'noopener noreferrer';
            const img = document.createElement('img');
            img.src = imgSrc; img.alt = localImg?.alt || title; img.loading = 'lazy'; img.decoding = 'async';
            img.width = localImg?.width || 1080; img.height = localImg?.height || 1080;
            photoLink.append(img); article.append(photoLink);
          }
          const body = document.createElement('div'); body.className = 'notebook-card-body';
          const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow';
          const cat = document.createElement('span'); cat.textContent = 'Del cuaderno de Naroa';
          const time = document.createElement('time');
          const iso = String(post.date).slice(0, 10);
          time.dateTime = iso;
          time.textContent = new Intl.DateTimeFormat('es', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(post.date));
          eyebrow.append(cat, ' · ', time);
          const h3 = document.createElement('h3'), titleLink = document.createElement('a');
          titleLink.href = url; titleLink.target = '_blank'; titleLink.rel = 'noopener noreferrer'; titleLink.textContent = `${title} ↗`;
          h3.append(titleLink);
          const excerpt = plain(post.excerpt).replace(/\s+/g, ' ');
          const summary = document.createElement('p');
          summary.textContent = excerpt.length > 170 ? excerpt.slice(0, 170).replace(/\s+\S*$/, '') + '…' : excerpt;
          const readLink = document.createElement('a');
          readLink.className = 'text-link'; readLink.href = url; readLink.target = '_blank'; readLink.rel = 'noopener noreferrer';
          readLink.textContent = 'Leer en el cuaderno de Naroa ↗';
          body.append(eyebrow, h3, summary, readLink); article.append(body);
          return article;
        });
        notebookGrid.replaceChildren(...cards);
      } catch {}
    }
    syncNotebook();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNotebook(); });
  }
  const configurator = $('[data-commission-configurator]');
  if (configurator) {
    const supportEl = $('#cfg-support');
    const motifEl = $('#cfg-motif');
    const timingEl = $('#cfg-timing');
    const btn = $('#cfg-whatsapp-btn');
    const updateLink = () => {
      if (!supportEl || !motifEl || !timingEl || !btn) return;
      const s = supportEl.value;
      const m = motifEl.value;
      const t = timingEl.value;
      const msg = `Hola Naroa, me gustaría consultar un encargo de retrato sobre ${s} para ${m} con plazo ${t}.`;
      btn.href = `https://wa.me/34636060609?text=${encodeURIComponent(msg)}`;
    };
    [supportEl, motifEl, timingEl].forEach(el => el?.addEventListener('change', updateLink));
  }
  const reveals = $$('.chapter>div,.chapter>.eyebrow,.section-opening,.editorial blockquote,.timeline-entry,.notebook-posts article,.commission-example,.commission-steps article,.commission-configurator,.commission-faq-item,.closing,.contact-channel,.contact-details');
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
