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
    let filter = 'seleccion';
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
  const photo = document.getElementById('viewer-image');
  let current = 0, trigger, previousOverflow;
  function show(index) {
    current = (index + links.length) % links.length;
    photo.src = links[current].dataset.image;
    photo.alt = links[current].dataset.caption;
    document.getElementById('viewer-caption').textContent = photo.alt;
    document.getElementById('viewer-counter').textContent = `${current + 1} / ${links.length}`;
  }
  links.forEach((link, index) => link.addEventListener('click', event => {
    event.preventDefault();
    trigger = link;
    previousOverflow = document.body.style.overflow;
    show(index); dialog.showModal(); document.body.style.overflow = 'hidden';
    document.getElementById('viewer-close').focus();
  }));
  document.getElementById('viewer-prev').addEventListener('click', () => show(current - 1));
  document.getElementById('viewer-next').addEventListener('click', () => show(current + 1));
  document.getElementById('viewer-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {if (event.target === dialog) dialog.close();});
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {event.preventDefault(); show(current - 1);}
    if (event.key === 'ArrowRight') {event.preventDefault(); show(current + 1);}
  });
  dialog.addEventListener('close', () => {document.body.style.overflow = previousOverflow || ''; trigger?.focus();});
})();
