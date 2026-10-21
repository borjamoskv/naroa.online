/* Progressive, scroll-led decoration. Artwork and navigation work without it. */
(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Give the series invitation its own image frame, keeping the caption outside it.
  document.querySelectorAll('.series-entry > a > img').forEach(image => {
    const wrapper = document.createElement('div');
    wrapper.className = 'brush-series-image';
    image.before(wrapper);
    wrapper.append(image);
  });
  const targets = [...document.querySelectorAll('.editorial-catalog .catalog-card__image, .project-photo, .brush-series-image')];
  if (!targets.length || !('IntersectionObserver' in window) || !('ResizeObserver' in window)) return;

  const SVG = 'http://www.w3.org/2000/svg';
  const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
  const active = new Set();
  const states = new Map();
  let scheduled = 0;
  let listening = false;
  let lastY = window.scrollY;
  let explicitChoice = null;
  try { explicitChoice = sessionStorage.getItem('naroa-brush-motion'); } catch (_) {}
  const requested = new URLSearchParams(window.location.search).get('brocha');
  if (requested === '1' || requested === '0') {
    explicitChoice = requested === '1' ? 'on' : 'off';
    try { sessionStorage.setItem('naroa-brush-motion', explicitChoice); } catch (_) {}
  }
  let enabled = explicitChoice ? explicitChoice === 'on' : !motion.matches;
  const buttons = [];

  function addControl(host, after = false) {
    if (!host) return;
    const controls = document.createElement('div');
    controls.className = 'brush-controls';
    const label = document.createElement('p');
    label.textContent = 'Una pincelada al bajar';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'brush-toggle';
    button.addEventListener('click', () => {
      enabled = !enabled;
      explicitChoice = enabled ? 'on' : 'off';
      try { sessionStorage.setItem('naroa-brush-motion', explicitChoice); } catch (_) {}
      if (enabled) states.forEach(state => {
        state.progress = 0;
        state.scene.classList.remove('brush-scene--complete');
        state.paths.forEach(path => { path.style.strokeDashoffset = '1'; });
      });
      updateMotion();
    });
    buttons.push(button);
    controls.append(label, button);
    if (after) host.after(controls);
    else host.prepend(controls);
  }

  addControl(document.querySelector('main'));
  addControl(document.querySelector('.catalog-intro'), true);


  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function createFrame(target, index) {
    const scene = document.createElement('div');
    scene.className = 'brush-scene';
    scene.setAttribute('aria-hidden', 'true');
    const frame = svgElement('svg', {class: 'brush-frame', focusable: 'false'});
    const paths = ['shadow', 'body', 'grain'].map(part => {
      const path = svgElement('path', {class: `brush-frame__${part}`, pathLength: '1'});
      frame.append(path);
      return path;
    });
    const brush = svgElement('svg', {class: 'painting-brush', viewBox: '0 0 36 96', focusable: 'false'});
    // Small traditional flat brush: wood, ferrule, individual bristles and a loaded tip.
    const id = `paint-wood-${index}`;
    brush.innerHTML = `<defs><linearGradient id="${id}" x1="0" x2="1"><stop stop-color="#5f321d"/><stop offset=".45" stop-color="#c48a4d"/><stop offset=".72" stop-color="#dfb577"/><stop offset="1" stop-color="#754329"/></linearGradient><linearGradient id="${id}-metal" x1="0" x2="1"><stop stop-color="#74736b"/><stop offset=".3" stop-color="#ece7d8"/><stop offset=".68" stop-color="#aaa99d"/><stop offset="1" stop-color="#62645d"/></linearGradient></defs><path d="M18 3C13 3 13 9 14 17L15 50H23L22 17C23 9 23 3 18 3Z" fill="url(#${id})"/><path d="M18 8L19 41" stroke="#eed0a1" stroke-width=".7" opacity=".6"/><path d="M13 46L25 46L29 66L8 66Z" fill="url(#${id}-metal)" stroke="#55594f" stroke-width=".6"/><path d="M12 51L26 51M9 63L28 63" stroke="#5f6257" stroke-width=".8"/><path d="M8 65L29 65L31 85L27 90L23 88L19 92L15 89L11 91L6 86Z" fill="#c5b28a"/><path d="M10 67L9 84M13 67L12 87M16 67L16 86M20 67L20 89M23 67L24 86M27 67L28 85" stroke="#756448" stroke-width=".75"/><path d="M7 82L11 84L15 82L19 85L23 82L28 84L31 83L31 87L27 91L23 89L19 93L15 90L11 92L6 87Z" fill="#d8b779"/><path d="M9 86L12 88M17 87L19 90M25 86L28 88" stroke="#f7e3b5" stroke-width="1"/>`;
    scene.append(frame, brush);
    target.classList.add('brush-reveal-target');
    target.append(scene);
    const state = {target, scene, frame, paths, brush, progress: 0, width: 0, height: 0, inset: 0};
    states.set(target, state);
    return state;
  }

  function measure(state, width, height) {
    state.width = width;
    state.height = height;
    state.inset = width <= 640 ? 12 : 20;
    const i = state.inset;
    const right = Math.max(i, width - i), bottom = Math.max(i, height - i);
    // Slightly uneven lines suggest a loaded brush without changing the photograph.
    const d = `M${i} ${i + 1}L${width * .38} ${i - .7}L${right} ${i + .3}L${right - .8} ${height * .48}L${right} ${bottom}L${width * .46} ${bottom - .9}L${i} ${bottom}L${i + .8} ${height * .43}Z`;
    state.frame.setAttribute('viewBox', `0 0 ${width} ${height}`);
    state.paths.forEach(path => path.setAttribute('d', d));
    state.paths[0].setAttribute('transform', 'translate(1.3 1.3)');
    state.paths[2].setAttribute('transform', 'translate(-.8 -.8)');
  }

  function pointOnFrame(state, progress) {
    const i = state.inset;
    const w = Math.max(1, state.width - i * 2), h = Math.max(1, state.height - i * 2);
    let distance = progress * (w + h) * 2;
    if (distance < w) return {x: i + distance, y: i, angle: 180};
    distance -= w;
    if (distance < h) return {x: i + w, y: i + distance, angle: 270};
    distance -= h;
    if (distance < w) return {x: i + w - distance, y: i + h, angle: 360};
    return {x: i, y: i + h - (distance - w), angle: 450};
  }

  function scrollProgress(state, rect, viewport) {
    const w = Math.max(1, state.width - state.inset * 2);
    const h = Math.max(1, state.height - state.inset * 2);
    const top = rect.top + state.inset;
    const bottom = rect.bottom - state.inset;
    const paintLine = viewport * .55;
    let distance;
    if (top >= paintLine) {
      distance = w * clamp((viewport * .88 - top) / (viewport * .33));
    } else if (bottom > paintLine) {
      // Keep the working tip in view while a tall artwork passes the visitor.
      distance = w + h * clamp((paintLine - top) / h);
    } else if (bottom > viewport * .19) {
      distance = w + h + w * clamp((paintLine - bottom) / (viewport * .36));
    } else {
      distance = w * 2 + h + h * clamp((viewport * .19 - bottom) / (viewport * .24));
    }
    return clamp(distance / ((w + h) * 2));
  }

  function render() {
    scheduled = 0;
    if (!enabled || document.hidden) return;
    const viewport = window.innerHeight;
    const travel = clamp((window.scrollY - lastY) * .05, -3, 3);
    lastY = window.scrollY;
    const reads = [];
    // Read geometry together, then write, avoiding a layout cycle for each artwork.
    active.forEach(state => {
      const rect = state.target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) reads.push({state, rect});
    });
    reads.forEach(({state, rect}) => {
      if (state.width !== rect.width || state.height !== rect.height) measure(state, rect.width, rect.height);
      const progress = scrollProgress(state, rect, viewport);
      state.progress = Math.max(state.progress, progress);
      const p = state.progress;
      state.paths.forEach(path => { path.style.strokeDashoffset = String(1 - p); });
      // A separate fine edge has a few pixels of depth; the artwork stays still.
      state.paths[2].setAttribute('transform', `translate(-.8 ${(-.8 + (progress - .5) * 3).toFixed(2)})`);
      const point = pointOnFrame(state, p);
      const scale = rect.width <= 640 ? 1.18 : 1.7;
      const tipY = rect.top + point.y;
      const visible = p > .002 && p < .997 && tipY > 10 && tipY < viewport - 10 && progress >= p - .002;
      state.brush.style.opacity = visible ? String(Math.min(1, p * 35, (1 - p) * 35)) : '0';
      state.brush.style.transform = `translate(${(point.x - 18).toFixed(2)}px, ${(point.y - 88).toFixed(2)}px) rotate(${point.angle + travel}deg) scale(${scale})`;
      if (p >= .997) {
        state.paths.forEach(path => { path.style.strokeDashoffset = '0'; });
        state.scene.classList.add('brush-scene--complete');
        active.delete(state);
        observer.unobserve(state.target);
      }
    });
  }

  function schedule() {
    if (!scheduled && enabled && !document.hidden) scheduled = requestAnimationFrame(render);
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = states.get(entry.target);
      if (entry.isIntersecting) active.add(state);
      else {
        active.delete(state);
        state.brush.style.opacity = '0';
      }
    });
    schedule();
  }, {rootMargin: '30% 0px 30% 0px', threshold: 0});

  const resizeObserver = new ResizeObserver(() => schedule());

  function enable() {
    if (!enabled || listening) return;
    listening = true;
    lastY = window.scrollY;
    targets.forEach((target, index) => {
      const state = states.get(target) || createFrame(target, index);
      if (state.progress < .997) observer.observe(target);
      resizeObserver.observe(target);
    });
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule, {passive: true});
    document.addEventListener('visibilitychange', schedule);
    schedule();
  }

  function disable() {
    if (!listening) return;
    listening = false;
    cancelAnimationFrame(scheduled);
    scheduled = 0;
    observer.disconnect();
    resizeObserver.disconnect();
    active.clear();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('visibilitychange', schedule);
    states.forEach(state => { state.brush.style.opacity = '0'; });
  }

  function updateMotion() {
    document.documentElement.dataset.brushEnabled = String(enabled);
    buttons.forEach(button => {
      button.textContent = enabled ? 'Pausar brocha' : 'Activar brocha';
      button.setAttribute('aria-pressed', String(enabled));
    });
    if (enabled) enable();
    else disable();
  }

  motion.addEventListener('change', () => {
    if (explicitChoice === null) {
      enabled = !motion.matches;
      updateMotion();
    }
  });
  updateMotion();
})();
