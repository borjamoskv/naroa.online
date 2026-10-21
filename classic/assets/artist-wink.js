/* One short, deliberate wink. The original portrait and artwork stay untouched. */
(() => {
  'use strict';
  const portrait = document.querySelector('.artist-hero');
  const photo = portrait?.querySelector('img');
  if (!photo) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const layer = document.createElement('div');
  layer.className = 'artist-wink-layer';
  layer.setAttribute('aria-hidden', 'true');
  const closed = document.createElement('img');
  closed.src = '/images/sobre-mi/naroa-guino-v1.webp';
  closed.alt = '';
  closed.decoding = 'async';
  layer.append(closed);
  photo.after(layer);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'artist-wink-button';
  button.textContent = 'Un guiño 😉';
  button.setAttribute('aria-label', 'Hacer que Naroa guiñe un ojo');
  portrait.append(button);
  let animation = null, lastWink = -Infinity;
  const enabled = () => document.documentElement.dataset.brushEnabled === 'true';
  function measure() {
    const width = photo.clientWidth, height = photo.clientHeight;
    if (!width || !height) return;
    const scale = Math.max(width / 2201, height / 3468);
    const w = 2201 * scale, h = 3468 * scale;
    const position = getComputedStyle(photo).objectPosition.split(' ').map(parseFloat);
    Object.assign(closed.style, {width: `${w}px`, height: `${h}px`, left: `${(width-w)*(position[0] || 50)/100}px`, top: `${(height-h)*(position[1] || 34)/100}px`});
    mirror();
  }
  function mirror() {
    layer.style.transform = photo.style.transform;
    layer.style.transformOrigin = photo.style.transformOrigin;
  }
  async function wink() {
    if (!enabled() || animation || performance.now() - lastWink < 1800) return;
    try { await closed.decode(); } catch (_) { return; }
    if (!enabled() || animation) return;
    lastWink = performance.now();
    animation = closed.animate([
      {opacity: 0, offset: 0}, {opacity: 1, offset: .22},
      {opacity: 1, offset: .65}, {opacity: 0, offset: 1}
    ], {duration: 420, easing: 'ease-in-out'});
    try { await animation.finished; } catch (_) {}
    animation = null;
  }
  function update() {
    button.hidden = !enabled();
    if (!enabled()) animation?.cancel();
    measure();
  }
  button.addEventListener('click', wink);
  photo.addEventListener('pointerenter', wink);
  new ResizeObserver(measure).observe(portrait);
  new MutationObserver(mirror).observe(photo, {attributes: true, attributeFilter: ['style']});
  photo.addEventListener('load', measure);
  document.addEventListener('naroa:motionchange', update);
  motion.addEventListener('change', update);
  update();
})();
