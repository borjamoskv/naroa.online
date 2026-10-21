/* Scroll reveals iris texture from the same photograph. No strokes or canvas. */
(() => {
 'use strict';
 const NS = 'http://www.w3.org/2000/svg', states = new WeakMap();
 const clamp = n => Math.max(0, Math.min(1, n));
 let saved = {}, serial = 0;
 try { saved = JSON.parse(sessionStorage.getItem('naroa-vaivenes-irises-v1') || '{}'); } catch (_) {}
 const persist = () => { try { sessionStorage.setItem('naroa-vaivenes-irises-v1', JSON.stringify(saved)); } catch (_) {} };
 addEventListener('pagehide', persist);
 function svg(tag, attributes = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  return el;
 }
 function attach(figure) {
  if (states.has(figure)) return;
  const image = figure.querySelector('.project-photo img'), target = figure.querySelector('.project-photo');
  let irises;
  try { irises = JSON.parse(figure.dataset.irises || '[]'); } catch (_) { return; }
  if (!image || !irises.length) return;
  const key = image.getAttribute('src');
  const width = Number(image.getAttribute('width')), height = Number(image.getAttribute('height'));
  if (!width || !height) return;
  const scene = svg('svg', {class:'vaivenes-irises', viewBox:`0 0 ${width} ${height}`, preserveAspectRatio:'xMidYMid meet', 'aria-hidden':'true', focusable:'false'});
  const defs = svg('defs'), clipID = `vaivenes-irises-${++serial}`, clip = svg('clipPath', {id:clipID, clipPathUnits:'userSpaceOnUse'});
  for (const [x,y,rx,ry] of irises) clip.append(svg('ellipse', {cx:x*width, cy:y*height, rx:rx*width, ry:ry*height}));
  defs.append(clip); scene.append(defs);
  const original = svg('image', {href:key, x:0, y:0, width, height, 'clip-path':`url(#${clipID})`});
  original.dataset.tone = figure.dataset.eyeTone || 'original'; scene.append(original);
  target.classList.add('vaivenes-iris-photo'); target.append(scene);
  const state = {image, scene, key, progress:clamp(Number(saved[key]) || 0)};
  states.set(figure, state);
  function align() {
   // Match the untransformed image box; then share its exact parallax transform.
   Object.assign(scene.style, {left:`${image.offsetLeft}px`, top:`${image.offsetTop}px`, width:`${image.offsetWidth}px`, height:`${image.offsetHeight}px`, transform:image.style.transform, transformOrigin:getComputedStyle(image).transformOrigin});
  }
  new ResizeObserver(align).observe(image); image.addEventListener('load', align);
  state.align = align; align(); reveal(figure, state.progress);
 }
 function reveal(figure, amount) {
  const state = states.get(figure); if (!state) return;
  const previous = state.progress;
  state.progress = Math.max(previous, clamp(amount), clamp(Number(saved[state.key]) || 0));
  saved[state.key] = state.progress;
  state.scene.style.opacity = String(state.progress * state.progress * (3 - 2 * state.progress));
  state.scene.dataset.revealed = state.progress.toFixed(5);
  state.scene.style.transform = state.image.style.transform;
  if (state.progress === 1 && previous < 1) persist();
 }
 window.NaroaVaivenesEyes = {attach, reveal};
})();
