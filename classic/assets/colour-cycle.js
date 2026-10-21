/* Scroll reveals the photograph's original colour, reversibly and without a timer. */
(() => {
  'use strict';
  const selector = '.home-art .project-photo img, .catalog-card__image img, .project-photos .project-photo img, .project-editorial .project-photo img, .series-work .project-photo img, .artist-wide > a > img, .local-artwork > a > img';
  const states = new Map(), images = new WeakMap(), active = new Set();
  let frame = 0, printing = false;
  const clamp = value => Math.max(0, Math.min(1, value));
  const enabled = () => document.documentElement.dataset.brushEnabled === 'true' && !printing;
  function paint(state, progress) {
    if (!enabled()) { reset(state); return; }
    const amount = clamp(progress), eased = amount * amount * (3 - 2 * amount);
    // Only remove saturation: the colour endpoint is exactly the original photo.
    state.target.style.filter = `grayscale(${(1 - eased).toFixed(4)})`;
    state.target.dataset.colourCycle = 'active';
    state.target.dataset.colourProgress = amount.toFixed(4);
  }
  function reset(state) {
    state.target.style.filter = state.originalFilter;
    delete state.target.dataset.colourCycle;
    delete state.target.dataset.colourProgress;
  }
  function measure(state) {
    const box = state.target.getBoundingClientRect();
    const intro = state.image.closest('.home-art, .project-photos > figure:first-child, .project-editorial > figure:first-child');
    state.intro = !!intro;
    // On mobile the portrait follows the title, so its reveal starts when it is visible.
    state.start = Math.max(0, box.top + scrollY - innerHeight * .48);
  }
  function render() {
    frame = 0;
    if (document.hidden) return;
    for (const state of active) {
      if (!enabled()) { reset(state); continue; }
      // Pinned galleries provide their own scroll progress, including the settling frames.
      if (state.image.closest('.vaivenes-scroll__track, .artist-journey__track')) continue;
      const box = state.target.getBoundingClientRect();
      if (!box.height || !state.image.naturalWidth) continue;
      const amount = state.intro
        ? (scrollY - state.start) / Math.max(140, innerHeight * .32)
        : (innerHeight * .88 - box.top) / Math.max(140, Math.min(innerHeight * .56, box.height * .65));
      paint(state, amount);
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(render); }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = states.get(entry.target);
      if (entry.isIntersecting) active.add(state); else active.delete(state);
    });
    schedule();
  }, {rootMargin:'30% 0px'});
  function attach(image) {
    const target = image.closest('.project-photo, .catalog-card__image, .artist-wide > a, .local-artwork > a');
    if (!target || states.has(target)) return;
    const state = {target,image,intro:false,start:0,originalFilter:target.style.filter};
    states.set(target,state);images.set(image,state);measure(state);observer.observe(target);
    image.addEventListener('load', () => { measure(state); schedule(); });
  }
  document.querySelectorAll(selector).forEach(attach);
  // Called by both horizontal galleries using the same progress as their artwork movement.
  window.NaroaColourScroll = {
    reveal(image, amount) {
      if (!image) return;
      if (!images.has(image) && image.matches(selector)) attach(image);
      const state = images.get(image);
      if (state) paint(state, amount);
    }
  };
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.matches(selector)) attach(node);
      node.querySelectorAll(selector).forEach(attach);
    }));
    schedule();
  }).observe(document.querySelector('main') || document.body,{childList:true,subtree:true});
  document.addEventListener('naroa:motionchange', () => {
    if (!enabled()) states.forEach(reset);
    schedule();
  });
  document.dispatchEvent(new CustomEvent('naroa:colour-ready'));
  addEventListener('pageshow',schedule);
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize', () => { states.forEach(measure); schedule(); },{passive:true});
  document.addEventListener('visibilitychange',schedule);
  addEventListener('beforeprint', () => { printing=true; states.forEach(reset); });
  addEventListener('afterprint', () => { printing=false; schedule(); });
})();
