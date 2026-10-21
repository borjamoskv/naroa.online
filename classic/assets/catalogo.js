/* Progressive enhancement: cards, project pages and original images work without JS. */
(() => {
  'use strict';
  const search = document.getElementById('catalog-search');
  if (search) {
    const buttons = [...document.querySelectorAll('[data-filter]')];
    const cards = [...document.querySelectorAll('#view-destacada .catalog-card')];
    const count = document.getElementById('catalog-count');
    const empty = document.getElementById('catalog-empty');
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let filter = 'todo';
    function render() {
      const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
      let visible = 0;
      cards.forEach(card => {
        const inCategory = filter === 'todo' || (filter === 'seleccion' ? card.dataset.selected === 'true' : card.dataset.category === filter);
        const matches = words.every(word => normalize(card.dataset.search).includes(word));
        card.hidden = !(inCategory && matches);
        if (!card.hidden) visible++;
      });
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
      count.textContent = `${visible} ${visible === 1 ? 'proyecto' : 'proyectos'}${filter === 'seleccion' ? ' en la selección' : ''}`;
      empty.hidden = visible !== 0;
    }
    buttons.forEach(button => button.addEventListener('click', () => {filter = button.dataset.filter; render();}));
    search.addEventListener('input', () => {
      if (filter === 'seleccion' && search.value.trim()) filter = 'todo';
      render();
    });
    document.getElementById('catalog-reset').addEventListener('click', () => {filter = 'todo'; search.value = ''; render(); search.focus();});
    render();
  }
  const dialog = document.getElementById('art-viewer');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const links = [...document.querySelectorAll('.project-photo')];
  if (!links.length) return;
  const photo = document.getElementById('viewer-image');
  const caption = document.getElementById('viewer-caption');
  const counter = document.getElementById('viewer-counter');
  const close = document.getElementById('viewer-close');
  const previous = document.getElementById('viewer-prev');
  const next = document.getElementById('viewer-next');
  const stage = dialog.querySelector('.viewer-stage');
  const information = document.createElement('button');
  information.type = 'button';
  information.className = 'viewer-information';
  information.textContent = 'Sobre esta imagen';
  information.setAttribute('aria-controls', 'viewer-caption');
  information.setAttribute('aria-expanded', 'false');
  close.before(information);
  caption.hidden = true;
  photo.decoding = 'async';
  photo.draggable = false;
  previous.hidden = next.hidden = links.length < 2;
  dialog.classList.add('art-viewer--immersive');
  let current = 0, trigger, previousOverflow, touch, preloadTimer;
  const warmed = new Set();

  function preloadNeighbours() {
    clearTimeout(preloadTimer);
    const connection = navigator.connection;
    if (!dialog.open || links.length < 2 || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
    // Only warm adjacent originals after the selected photograph has loaded.
    preloadTimer = setTimeout(() => {
      if (!dialog.open) return;
      [1, -1].forEach(offset => {
        const src = links[(current + offset + links.length) % links.length].dataset.image;
        if (warmed.has(src)) return;
        warmed.add(src);
        const neighbour = new Image();
        neighbour.decoding = 'async';
        neighbour.fetchPriority = 'low';
        neighbour.src = src;
      });
    }, 350);
  }

  function show(index) {
    clearTimeout(preloadTimer);
    current = (index + links.length) % links.length;
    photo.alt = links[current].dataset.caption;
    caption.textContent = photo.alt;
    counter.textContent = `${current + 1} / ${links.length}`;
    stage.setAttribute('aria-busy', 'true');
    photo.src = links[current].dataset.image;
    warmed.add(links[current].dataset.image);
  }
  photo.addEventListener('load', () => {
    stage.setAttribute('aria-busy', 'false');
    preloadNeighbours();
  });
  photo.addEventListener('error', () => stage.setAttribute('aria-busy', 'false'));
  information.addEventListener('click', () => {
    caption.hidden = !caption.hidden;
    information.setAttribute('aria-expanded', String(!caption.hidden));
    dialog.classList.toggle('viewer-has-caption', !caption.hidden);
  });
  links.forEach((link, index) => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    trigger = link;
    previousOverflow = document.body.style.overflow;
    caption.hidden = true;
    information.setAttribute('aria-expanded', 'false');
    dialog.classList.remove('viewer-has-caption');
    show(index);
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    close.focus({preventScroll: true});
    if (photo.complete && photo.naturalWidth) {
      stage.setAttribute('aria-busy', 'false');
      preloadNeighbours();
    }
  }));
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {event.preventDefault(); show(current - 1);}
    if (event.key === 'ArrowRight') {event.preventDefault(); show(current + 1);}
  });
  stage.addEventListener('touchstart', event => {
    touch = event.touches.length === 1 && !(window.visualViewport?.scale > 1.01) && !event.target.closest('button')
      ? {x: event.touches[0].clientX, y: event.touches[0].clientY, time: Date.now()}
      : null;
  }, {passive: true});
  stage.addEventListener('touchmove', event => {
    if (event.touches.length !== 1) touch = null;
  }, {passive: true});
  stage.addEventListener('touchend', event => {
    if (!touch || event.changedTouches.length !== 1 || links.length < 2 || window.visualViewport?.scale > 1.01) return;
    const dx = event.changedTouches[0].clientX - touch.x;
    const dy = event.changedTouches[0].clientY - touch.y;
    const intentional = Date.now() - touch.time < 800 && Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.8;
    touch = null;
    if (intentional) show(current + (dx < 0 ? 1 : -1));
  }, {passive: true});
  stage.addEventListener('touchcancel', () => {touch = null;}, {passive: true});
  dialog.addEventListener('close', () => {
    clearTimeout(preloadTimer);
    touch = null;
    document.body.style.overflow = previousOverflow || '';
    trigger?.focus({preventScroll: true});
  });
})();
