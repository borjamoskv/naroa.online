/* Exercise the generated site without requiring a browser or network access. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const output = path.resolve(__dirname, '../.deploy');
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'immersive/build-manifest.json')));
const errors = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function create(route = '/', reduce = false, viewport = { width: 1024, height: 768 }, audio = null) {
  const file = path.join(output, route, 'index.html');
  let time = 0, id = 0;
  const observers = [];
  const callbacks = new Map(), native = new VirtualConsole();
  native.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
    runScripts: 'outside-only', url: 'https://portfolio.test' + route, virtualConsole: native,
    beforeParse(w) {
      Object.defineProperty(w, 'innerWidth', { value: viewport.width, configurable: true });
      Object.defineProperty(w, 'innerHeight', { value: viewport.height, configurable: true });
      w.matchMedia = () => ({ matches: reduce, addEventListener() {} });
      if (audio) {
        w.AudioContext = audio.Context; w.fetch = audio.fetch;
        w.performance.now = () => audio.now;
        w.setTimeout = audio.setTimeout; w.clearTimeout = audio.clearTimeout;
        Object.defineProperty(w.document, 'hidden', { value: false, configurable: true, writable: true });
      }
      w.requestAnimationFrame = callback => { const token = ++id; callbacks.set(token, callback); return token; };
      w.cancelAnimationFrame = token => callbacks.delete(token);
      w.IntersectionObserver = class {
        constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
        observe(target) { this.targets.add(target); }
        unobserve(target) { this.targets.delete(target); }
      };
      w.scrollTo = options => { w.scrollY = options.top; w.pageYOffset = options.top; w.dispatchEvent(new w.Event('scroll')); };
      Object.defineProperty(w.HTMLElement.prototype, 'inert', {
        get() { return this.hasAttribute('inert'); }, set(value) { this.toggleAttribute('inert', value); }
      });
      Object.defineProperty(w.HTMLImageElement.prototype, 'complete', { get: () => true });
      Object.defineProperty(w.HTMLImageElement.prototype, 'naturalWidth', { get: () => 1000 });
      Object.defineProperty(w.HTMLImageElement.prototype, 'naturalHeight', { get: () => 1000 });
      w.HTMLDialogElement.prototype.showModal = function () {
        this.returnFocus = w.document.activeElement; this.setAttribute('open', '');
        this.querySelector('button,input,a')?.focus();
      };
      w.HTMLDialogElement.prototype.close = function () {
        this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); this.returnFocus?.focus();
      };
    }
  });
  const w = dom.window, document = w.document;
  const track = document.querySelector('.art-scroll'), stage = document.querySelector('[data-gallery]');
  const step = w.innerHeight * 1.1;
  if (track) {
    const height = w.innerHeight + Number(track.style.getPropertyValue('--steps')) * step;
    track.getBoundingClientRect = () => ({ top: -w.scrollY, bottom: height - w.scrollY, height, width: viewport.width, left: 0, right: viewport.width });
    stage.getBoundingClientRect = () => ({ top: 0, bottom: w.innerHeight, height: w.innerHeight, width: viewport.width, left: 0, right: viewport.width });
  }
  const portraitTrack = document.querySelector('[data-portrait-scroll]');
  if (portraitTrack) {
    const height = w.innerHeight * (reduce ? 1 : 3.8 + Number(portraitTrack.style.getPropertyValue('--portrait-steps')) * 1.1);
    portraitTrack.getBoundingClientRect = () => ({ top: -w.scrollY, bottom: height - w.scrollY, height, width: w.innerWidth, left: 0, right: w.innerWidth });
    document.querySelector('[data-eye-portrait]').getBoundingClientRect = () => ({ top: 0, bottom: w.innerHeight, height: w.innerHeight, width: w.innerWidth, left: 0, right: w.innerWidth });
  }
  const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => new URL(s.src).pathname);
  scripts.forEach(src => w.eval(fs.readFileSync(path.join(output, src), 'utf8')));
  const find = selector => document.querySelector(selector);
  const click = selector => { const el = find(selector); assert.ok(el, selector); el.focus(); el.click(); };
  async function flush() {
    await new Promise(resolve => setImmediate(resolve));
    let frames = 0;
    while (callbacks.size && frames++ < 250) {
      time += 16; const next = Array.from(callbacks.values()); callbacks.clear(); next.forEach(callback => callback(time));
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.ok(frames < 250, 'Animation must settle');
  }
  function wheel(deltaY, options = {}) {
    const event = new w.WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true, ...options });
    find('[data-gallery]').dispatchEvent(event); return event;
  }
  const key = value => document.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  return { dom, w, document, find, click, flush, wheel, key, observers, step, scroll: index => w.scrollTo({top:index * step}) };
}

// Mock only the browser audio/network boundary; exercise real click, camera and lifecycle code.
function audioBoundary() {
  const audio = { contexts: [], requests: [], starts: [], failed: false, denied: false, now: 0 };
  const timers = new Map(); let timerId = 0;
  audio.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: audio.now + delay }); return id; };
  audio.clearTimeout = id => timers.delete(id);
  audio.advance = elapsed => {
    const end = audio.now + elapsed;
    for (let count = 0; count < 1000; count++) {
      const next = [...timers].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) { audio.now = end; return; }
      audio.now = next[1].at; timers.delete(next[0]); next[1].callback();
    }
    assert.fail('Audio timers must settle without a polling loop');
  };
  const parameter = value => ({ value, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }, setValueCurveAtTime(curve) { this.curve = curve; } });
  audio.Context = class {
    constructor() { this.state = 'suspended'; this.gains = []; this.filters = []; this.panners = []; audio.contexts.push(this); }
    get currentTime() { return audio.now / 1000; }
    async resume() { if (audio.denied) throw Error('Playback denied'); this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
    async decodeAudioData() { return { duration: 66 }; }
    createGain() { const node = { gain: parameter(1), connect() {}, disconnect() {} }; this.gains.push(node); return node; }
    createBiquadFilter() { const node = { frequency: parameter(0), Q: parameter(0), connect() {} }; this.filters.push(node); return node; }
    createStereoPanner() { const node = { pan: parameter(0), connect() {} }; this.panners.push(node); return node; }
    createBufferSource() {
      const context = this;
      return { playbackRate: parameter(1), connect() {}, disconnect() {},
        start(at, offset) { this.startAt = at; this.offset = offset; audio.starts.push(this); },
        stop(at = context.currentTime) {
          this.stopAt = at; audio.clearTimeout(this.endTimer);
          this.endTimer = audio.setTimeout(() => this.onended?.(), Math.max(0, (at - context.currentTime) * 1000));
        }
      };
    }
  };
  audio.fetch = async src => { audio.requests.push(src); return { ok: !audio.failed, arrayBuffer: async () => new ArrayBuffer(4) }; };
  return audio;
}

async function eyeMatch(ui, base, points) {
  ui.scroll(base + .5); await ui.flush();
  assert.equal(ui.find('[data-gallery]').dataset.transition, 'eyes');
  assert.equal(Number(ui.find(`[data-scene="${base + 1}"]`).style.opacity), .5);
  const width = ui.w.innerWidth + 20, height = ui.w.innerHeight + 20, cover = Math.max(width, height);
  points.forEach((point, offset) => {
    const scene = ui.find(`[data-scene="${base + offset}"]`), img = scene.querySelector('img');
    const pose = /translate3d\(([-\d.]+)px,([-\d.]+)px,0\) scale\(([\d.]+)\)/.exec(img.style.transform);
    assert.ok(pose, 'Eye transitions use a measurable image-space transform');
    const [, tx, ty, scale] = pose.map(Number);
    assert.ok(scale >= 2.6, 'The transition visibly moves into the eye');
    const focus = scene.style.getPropertyValue('--position').split(' ').map(v => parseFloat(v) / 100);
    const x = (width - cover) * focus[0] + point[0] * cover;
    const y = (height - cover) * focus[1] + point[1] * cover;
    assert.ok(Math.abs(-10 + tx + scale * x - ui.w.innerWidth * .5) < .03, 'Both pupils meet at the same horizontal viewport point');
    assert.ok(Math.abs(-10 + ty + scale * y - ui.w.innerHeight * .42) < .03, 'Both pupils meet at the same vertical viewport point');
  });
}

(async () => {
  const ui = create(); await ui.flush();
  const works = ui.w.NAROA_CATALOG.projects;
  assert.equal(works.length, 40);
  assert.equal(ui.find('[data-art-title]').textContent, 'Marilyn Rocks');
  assert.ok(ui.document.querySelectorAll('.art-scene img[src]').length <= 3, 'Do not eagerly decode the complete catalogue');
  const originalTransform = ui.find('.art-scene img').style.transform;
  assert.equal(ui.wheel(100).defaultPrevented, false, 'Do not hijack native wheel scrolling');
  assert.equal(ui.wheel(-100, { ctrlKey: true }).defaultPrevented, false, 'Preserve browser zoom');
  ui.scroll(.28); await ui.flush();
  assert.notEqual(ui.find('.art-scene img').style.transform, originalTransform);
  assert.equal(ui.find('[data-art-title]').textContent, 'Marilyn Rocks');
  assert.equal(ui.find('[data-scene="1"]').style.visibility, 'visible');
  assert.equal(ui.find('[data-gallery]').dataset.transition, 'eyes');
  assert.equal(ui.find('[data-scene="1"]').style.maskImage, 'none');
  assert.equal(ui.find('[data-kinetic-title]').textContent, 'Rara Avis');
  assert.ok(Number(ui.find('[data-art-copy]').style.opacity) >= .45, 'Captions remain legible if scrolling stops mid-transition');
  const stoppedTransform = ui.find('.art-scene img').style.transform;
  await wait(220); await ui.flush();
  assert.equal(ui.find('.art-scene img').style.transform, stoppedTransform, 'Stopping the scroll must not force another movement');
  assert.equal(ui.find('[data-art-title]').textContent, 'Marilyn Rocks');
  await eyeMatch(ui, 0, [[.635,.392],[.683,.417]]);
  ui.scroll(.49); await ui.flush(); const before = parseFloat(ui.find('[data-art-copy]').style.transform.slice(11));
  ui.scroll(.51); await ui.flush(); const after = parseFloat(ui.find('[data-art-copy]').style.transform.slice(11));
  assert.ok(Math.abs(after - before) < 3, 'Caption movement remains continuous when the title changes');
  ui.scroll(1); await ui.flush();
  assert.equal(ui.find('[data-art-title]').textContent, 'Rara Avis');
  assert.equal(ui.find('[data-kinetic-title]').textContent, '');
  assert.equal(ui.find('[data-art-copy]').style.opacity, '1');
  ui.scroll(1.28); await ui.flush();
  assert.match(ui.find('[data-scene="2"]').style.maskImage, /^linear-gradient\(110deg,/);
  assert.equal(ui.find('[data-gallery]').dataset.transition, 'depth');
  assert.equal(ui.key('ArrowDown'), true, 'Vertical keyboard scrolling remains native throughout the gallery');
  assert.equal(ui.key('ArrowUp'), true);
  const heldPosition = ui.w.scrollY, heldPose = ui.find('[data-scene="1"] img').style.transform;
  ui.click('[data-open-menu]'); await ui.flush();
  assert.equal(ui.w.scrollY, heldPosition, 'Opening a panel preserves the exact scroll position');
  assert.equal(ui.find('[data-scene="1"] img').style.transform, heldPose, 'Opening a panel preserves the camera pose');
  ui.click('#menu-dialog [data-close-dialog]'); await ui.flush();
  assert.equal(ui.w.scrollY, heldPosition, 'Closing a panel does not snap to an artwork');
  const distantWrites = [];
  const distantObserver = new ui.w.MutationObserver(records => distantWrites.push(...records));
  distantObserver.observe(ui.find('[data-scene="37"]'), { attributes: true, attributeFilter: ['style'] });
  for (const fraction of [.01, .2, .5, .8, .99]) {
    ui.scroll(1 + fraction); await ui.flush();
    for (const index of [1, 2]) {
      const image = ui.find(`[data-scene="${index}"] img`);
      const pose = /translate3d\(([-\d.]+)%?,([-\d.]+)%?,0\) scale\(([\d.]+)\)/.exec(image.style.transform);
      assert.ok(pose);
      const [, x, y, scale] = pose.map(Number), margin = (scale - 1) * 50;
      assert.ok(Math.abs(x) <= margin && Math.abs(y) <= margin, 'Parallax stays inside its overscan throughout the reveal');
    }
    assert.ok(ui.document.querySelectorAll('.art-scene[style*="will-change: opacity"]').length <= 2, 'Only the visible pair receives compositor hints');
  }
  distantObserver.disconnect(); assert.equal(distantWrites.length, 0, 'Scrolling does not rewrite styles on distant artwork layers');
  ui.scroll(6.2); await ui.flush();
  assert.equal(ui.find('[data-art-title]').textContent, works[6].title, 'Fast native scrolling can traverse several works without a gesture lock');
  ui.scroll(3.1); await ui.flush();
  assert.equal(ui.find('[data-art-title]').textContent, works[3].title, 'Reversing scroll follows the new position immediately');
  ui.scroll(7.3); ui.w.dispatchEvent(new ui.w.Event('resize')); await ui.flush();
  assert.equal(ui.w.scrollY, 7.3 * ui.step, 'A resize with unchanged geometry must not jump back to the last decoded frame');
  await eyeMatch(ui, 5, [[.583,.459],[.545,.402]]);
  await eyeMatch(ui, 10, [[.469,.463],[.678,.439]]);
  ui.click('[data-select="0"]'); await ui.flush();
  for (let i = 0; i < works.length; i++) {
    if (i) { ui.click('[data-next]'); await ui.flush(); }
    assert.equal(ui.find('[data-art-title]').textContent, works[i].title);
    assert.equal(ui.w.location.pathname, '/obra/' + works[i].slug + '/');
    assert.ok(ui.document.querySelectorAll('.art-scene img[src]').length <= 3, 'Release distant images after navigation');
    assert.equal(ui.find(`[data-select="${i}"]`).hidden, false);
    ui.click('[data-open-story]');
    assert.equal(ui.find('#story-dialog').open, true);
    assert.equal(ui.find('#story-title').textContent, works[i].title);
    assert.equal(ui.find('[data-story]').textContent, works[i].story);
    assert.ok(decodeURIComponent(ui.find('[data-art-email]').href).includes(works[i].title));
    ui.click('#story-dialog [data-close-dialog]');
    assert.equal(ui.find('#story-dialog').open, false);
  }
  assert.equal(ui.find('[data-next]').disabled, true);
  assert.equal(ui.wheel(100).defaultPrevented, false, 'Scrolling past the last work must leave the exhibition');
  assert.equal(ui.wheel(-100, { ctrlKey: true }).defaultPrevented, false, 'Preserve browser zoom');
  ui.click('[data-open-index]');
  const query = ui.find('#art-search'); query.value = 'marilyn'; query.dispatchEvent(new ui.w.Event('input'));
  assert.equal(ui.document.querySelectorAll('.index-work:not([hidden])').length, 1);
  query.value = 'nonexistent123'; query.dispatchEvent(new ui.w.Event('input'));
  assert.equal(ui.find('.index-empty').hidden, false);
  ui.click('[data-reset-index]');
  ui.click('[data-filter="Vaivenes"]');
  assert.equal(ui.document.querySelectorAll('.index-work:not([hidden])').length, 8);
  ui.click('[data-filter="all"]');
  ui.click('.index-work[data-work="marilyn-rocks"]'); await ui.flush();
  assert.equal(ui.find('[data-art-title]').textContent, 'Marilyn Rocks');
  assert.equal(ui.find('#work-gallery-dialog').open, true, 'The existing artwork photo overview is preserved');
  assert.equal(ui.document.querySelectorAll('.work-gallery-figure').length, works[0].photos.length);
  ui.click('.work-gallery-header button'); await ui.flush();
  ui.click('[data-fit]'); assert.equal(ui.find('[data-gallery]').classList.contains('is-fit'), true);
  assert.ok(ui.find('[data-scene="0"] img').src.endsWith(works[0].photos[0].src));
  ui.click('[data-fit]');
  ui.click('[data-open-photos]');
  assert.equal(ui.find('#work-gallery-dialog').open, true);
  ui.click('.work-gallery-image');
  assert.equal(ui.find('#photos-dialog').open, true);
  assert.ok(ui.find('[data-photo-caption]').textContent.includes('01 / 03'));
  ui.click('[data-photo-next]');
  assert.ok(ui.find('[data-photo-caption]').textContent.includes('02 / 03'));
  ui.click('#photos-dialog [data-close-dialog]');
  ui.click('.work-gallery-header button'); await ui.flush();
  ui.click('[data-quiet]'); assert.equal(ui.document.body.classList.contains('is-quiet'), true);
  ui.key('ArrowRight'); await ui.flush(); assert.equal(ui.find('[data-art-title]').textContent, 'Rara Avis');
  ui.key('Escape'); assert.equal(ui.document.body.classList.contains('is-quiet'), false);
  ui.dom.window.close();

  const mobile = create('/', false, { width: 390, height: 844 }); await mobile.flush();
  await eyeMatch(mobile, 0, [[.635,.392],[.683,.417]]); mobile.dom.window.close();

  const deepLink = create('/obra/amy-rocks/'); await deepLink.flush();
  assert.equal(deepLink.find('[data-art-title]').textContent, 'Amy Rocks');
  assert.equal(deepLink.w.scrollY, 3 * deepLink.step, 'Direct artwork URLs start at the correct document position');
  deepLink.dom.window.close();

  const series = create('/series/vaivenes/'); await series.flush();
  assert.equal(series.document.querySelectorAll('.art-scene').length, 8);
  series.click('[data-next]'); await series.flush();
  assert.equal(series.w.location.pathname, '/series/vaivenes/');
  series.dom.window.close();
  const reduced = create('/', true); await reduced.flush();
  reduced.click('[data-next]'); await reduced.flush();
  assert.equal(reduced.find('[data-art-title]').textContent, 'Rara Avis');
  assert.equal(reduced.find('[data-scene="1"] img').style.transform, '');
  assert.equal(reduced.find('[data-kinetic-title]').textContent, '');
  assert.equal(reduced.find('[data-art-copy]').style.opacity, '1'); reduced.dom.window.close();

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const portrait = create('/sobre-mi/', false, viewport); await portrait.flush();
    const plane = portrait.find('[data-portrait-plane]'), wink = portrait.find('[data-portrait-wink]');
    const artwork = portrait.find('[data-portrait-artwork]'), artCopy = portrait.find('[data-portrait-work-copy]');
    const initial = plane.style.transform;
    const wheel = new portrait.w.WheelEvent('wheel', { deltaY: 150, bubbles: true, cancelable: true });
    portrait.find('[data-eye-portrait]').dispatchEvent(wheel);
    assert.equal(wheel.defaultPrevented, false, 'Artist portrait preserves native scrolling');
    const scrollPortrait = async progress => { portrait.w.scrollTo({ top: progress * viewport.height * 2.8 }); await portrait.flush(); };
    function readPose(element, point, iris) {
      const pose = /translate3d\(([-\d.]+)px,([-\d.]+)px,0\) scale\(([\d.]+)\)/.exec(element.style.transform);
      assert.ok(pose, 'The camera transform can be measured in image coordinates');
      const [, tx, ty, scale] = pose.map(Number), width = parseFloat(element.style.width), height = parseFloat(element.style.height);
      return { tx, ty, scale, x: parseFloat(element.style.left) + tx + scale * point[0] * width, y: parseFloat(element.style.top) + ty + scale * point[1] * height, iris: scale * iris * width };
    }
    await scrollPortrait(.23);
    assert.notEqual(plane.style.transform, initial, 'The portrait moves into its monocle eye');
    assert.equal(Number(wink.getAttribute('opacity')), 1, 'The existing photographic wink remains in the approach');
    const closed = wink.getAttribute('opacity');
    let previousIris = 0;
    for (const progress of [.46, .51, .56]) {
      await scrollPortrait(progress);
      const source = readPose(plane, [571 / 1248, 766 / 1966], .032), target = readPose(artwork, [.685, .417], .025);
      assert.ok(source.scale > 5 && target.scale > 5, 'The camera travels inside both eyes');
      assert.ok(Math.abs(source.x - viewport.width * .5) < .03 && Math.abs(source.y - viewport.height * .46) < .03, 'Naroa pupil stays on the camera axis');
      assert.ok(Math.abs(source.x - target.x) < .03 && Math.abs(source.y - target.y) < .03, 'Both pupils coincide throughout the dissolve, including on mobile');
      assert.ok(Math.abs(source.iris - target.iris) < .03, 'Matched iris sizes prevent a jump between the two eyes');
      assert.ok(source.iris > Math.min(viewport.width, viewport.height) * 1.2, 'The camera reaches inside the iris rather than stopping at an eye close-up');
      assert.ok(source.iris > previousIris * 1.1, 'The same camera keeps advancing significantly throughout the dissolve');
      previousIris = source.iris;
      assert.equal(Number(wink.getAttribute('opacity')), 0, 'The eye reopens before the match');
    }
    // Measure the rendered camera, including on both sides of the blend boundaries.
    for (const progress of [.44, .51, .58]) {
      const distances = [];
      for (const delta of [-.001, 0, .001]) {
        await scrollPortrait(progress + delta);
        distances.push(Math.log(readPose(artwork, [.685, .417], .025).iris));
      }
      const before = distances[1] - distances[0], after = distances[2] - distances[1];
      assert.ok(before > 0 && after > 0, 'The camera does not stop or reverse at the eye handover');
      assert.ok(Math.abs(before - after) / Math.max(before, after) < .04, 'Camera velocity stays continuous across the eye handover');
    }
    await scrollPortrait(.64);
    const deepest = readPose(artwork, [.685, .417], .025);
    assert.ok(deepest.iris > Math.min(viewport.width, viewport.height) * 2, 'The deepest iris framing arrives after the dissolve');
    await scrollPortrait(.65);
    const turning = readPose(artwork, [.685, .417], .025);
    assert.ok(turning.iris < deepest.iris && turning.iris > deepest.iris * .995, 'The camera eases gently into its outward movement');
    await scrollPortrait(.51);
    assert.equal(Number(artwork.style.opacity), .5, 'The eye match dissolves through both photographs');
    const matching = [plane.style.transform, artwork.style.transform];
    const stopped = artwork.style.transform; await wait(50); await portrait.flush();
    assert.equal(artwork.style.transform, stopped, 'The camera stops when native scroll stops');
    await scrollPortrait(.8);
    const opening = readPose(artwork, [.685, .417], .025);
    assert.ok(opening.scale > 1 && opening.scale < 8, 'The camera opens out of the artwork eye');
    await scrollPortrait(.96);
    const final = readPose(artwork, [.685, .417], .025);
    assert.equal(final.scale, 1);
    assert.ok(Math.abs(final.tx) < .001 && Math.abs(final.ty) < .001, 'The artwork finishes in its original full-screen framing');
    assert.equal(artwork.style.opacity, '1'); assert.equal(plane.style.visibility, 'hidden');
    assert.equal(artCopy.style.opacity, '1'); assert.equal(artCopy.inert, false);
    assert.equal(artCopy.querySelector('a').getAttribute('href'), '/obra/rara-avis/');
    assert.equal(portrait.w.location.pathname, '/sobre-mi/', 'The transition remains one continuous artist page');
    await scrollPortrait(.51);
    assert.deepEqual([plane.style.transform, artwork.style.transform], matching, 'Reversing scroll retraces the same camera path');
    const artImage = artwork.querySelector('img');
    Object.defineProperty(artImage, 'complete', { configurable: true, get: () => false });
    portrait.w.dispatchEvent(new portrait.w.Event('scroll')); await portrait.flush();
    assert.equal(artwork.style.opacity, '0', 'A slow artwork image cannot fade to an empty frame');
    assert.equal(plane.style.visibility, 'visible');
    Object.defineProperty(artImage, 'complete', { configurable: true, get: () => true });
    artImage.dispatchEvent(new portrait.w.Event('load')); await portrait.flush();
    assert.equal(artwork.style.opacity, '0.5');
    await scrollPortrait(.23); assert.equal(wink.getAttribute('opacity'), closed, 'The wink also reverses with scroll');
    portrait.click('[data-open-menu]'); assert.equal(portrait.find('#menu-dialog').open, true);
    portrait.click('#menu-dialog [data-close-dialog]');
    await scrollPortrait(0);
    assert.equal(plane.style.transform, initial, 'Returning to the beginning restores the full portrait');
    assert.equal(portrait.find('.page-hero-copy').style.opacity, '1');
    assert.equal(artCopy.inert, true, 'An invisible artwork link cannot receive keyboard focus');
    assert.equal(portrait.find('.hero-down').getAttribute('href'), '#contenido', 'The biography remains directly reachable');
    const scenes = Array.from(portrait.document.querySelectorAll('[data-portrait-scene]'));
    assert.equal(scenes.length, 40, 'The artist page continues through the complete catalogue');
    const travel = async position => { portrait.w.scrollTo({ top: viewport.height * (2.8 + position * 1.1) }); await portrait.flush(); };
    await scrollPortrait(.9999); const lastPortalFrame = [artwork.style.transform, artwork.style.opacity];
    await travel(0);
    assert.deepEqual([artwork.style.transform, artwork.style.opacity], lastPortalFrame, 'The portal and exhibition share exactly the same Rara Avis element and camera pose');
    const checkpoints = [
      [ .685, .417, .025 ], [ .635, .392, .030 ], [ .512, .424, .018 ],
      [ .583, .459, .028 ], [ .545, .402, .018 ], [ .469, .463, .020 ],
      [ .678, .439, .025 ], [ .420, .345, .025 ], [ .487, .406, .029 ]
    ];
    for (let i = 0; i < checkpoints.length - 1; i++) {
      let previousDiameter = 0;
      for (const fraction of [.46, .51, .56]) {
        await travel(i + fraction);
        const from = readPose(scenes[i], checkpoints[i], checkpoints[i][2]);
        const to = readPose(scenes[i + 1], checkpoints[i + 1], checkpoints[i + 1][2]);
        assert.ok(Math.abs(from.x - to.x) < .03 && Math.abs(from.y - to.y) < .03, 'Every eye pair shares its camera axis throughout the blend');
        assert.ok(Math.abs(from.iris - to.iris) < .03, 'Every eye pair shares its camera distance throughout the blend');
        assert.ok(to.iris > Math.min(viewport.width, viewport.height) * 1.2, 'Every eye match enters the iris deeply');
        assert.ok(to.iris > previousDiameter * 1.1, 'Every eye match keeps moving forward during the dissolve');
        previousDiameter = to.iris;
      }
      await travel(i + .51);
      assert.equal(portrait.find('[data-eye-portrait]').dataset.transition, 'eyes');
      assert.equal(Number(scenes[i + 1].style.opacity), .5, 'Eye dissolve ' + i);
      assert.equal(artCopy.style.opacity, '0', 'Captions leave the iris unobstructed during the camera pass');
      assert.equal(artCopy.inert, true, 'Hidden camera-pass controls cannot receive keyboard focus');
      const from = readPose(scenes[i], checkpoints[i], checkpoints[i][2]);
      const to = readPose(scenes[i + 1], checkpoints[i + 1], checkpoints[i + 1][2]);
      assert.ok(Math.abs(from.x - to.x) < .03 && Math.abs(from.y - to.y) < .03, 'Additional eye pairs keep their pupils together');
      assert.ok(Math.abs(from.iris - to.iris) < .03, 'Additional eye pairs keep matching iris diameters');
      const saved = scenes[i + 1].style.transform;
      await travel(i + .9); await travel(i + .51);
      assert.equal(scenes[i + 1].style.transform, saved, 'Each eye transition reverses along the same path');
    }
    await travel(8.5);
    assert.equal(portrait.find('[data-eye-portrait]').dataset.transition, 'depth', 'Works without a measured eye continue through a depth dissolve');
    assert.equal(Number(scenes[9].style.opacity), .5);
    const visited = new Set();
    for (let i = 0; i < scenes.length; i++) {
      await travel(i);
      const slug = scenes[i].dataset.work, work = portrait.w.NAROA_CATALOG.projects.find(p => p.slug === slug);
      assert.ok(work); visited.add(slug);
      assert.equal(portrait.find('[data-portrait-title]').textContent, work.title);
      assert.equal(portrait.find('[data-portrait-link]').getAttribute('href'), '/obra/' + slug + '/');
      assert.equal(scenes[i].style.visibility, 'visible');
      assert.equal(scenes[i].style.opacity, '1');
      assert.ok(portrait.document.querySelectorAll('[data-portrait-scene] img[src]').length <= 3, 'Continuation loads only the current photograph and its neighbours');
      assert.equal(portrait.w.location.pathname, '/sobre-mi/', 'No route navigation interrupts the exhibition');
    }
    assert.equal(visited.size, 40); assert.equal(portrait.find('[data-portrait-next]').disabled, true);
    assert.equal(portrait.find('[data-portrait-controls] a').getAttribute('href'), '#contenido', 'Biography remains available throughout the exhibition');
    await travel(0);
    assert.equal(portrait.find('[data-portrait-prev]').disabled, true);
    assert.equal(portrait.key('ArrowDown'), true, 'Vertical keyboard scrolling stays native');
    assert.ok(portrait.document.documentElement.classList.contains('portrait-scroll-native'), 'Biography and distant index jumps use direct native scrolling');
    portrait.click('[data-portrait-next]'); await portrait.flush();
    assert.equal(portrait.find('[data-eye-portrait]').dataset.work, 'marilyn-rocks');
    await travel(2.51); const positionBeforeDialog = portrait.w.scrollY;
    portrait.click('[data-open-menu]'); await portrait.flush();
    assert.equal(portrait.w.scrollY, positionBeforeDialog, 'Opening a menu does not snap a transition to an artwork');
    portrait.click('#menu-dialog [data-close-dialog]'); await portrait.flush();
    portrait.click('[data-open-index]'); portrait.click('.index-work[data-work="amy-rocks"]'); await portrait.flush();
    assert.equal(portrait.find('[data-eye-portrait]').dataset.work, 'amy-rocks', 'Catalogue selections join the same continuous artist-page scroll');
    assert.equal(portrait.w.location.pathname, '/sobre-mi/');
    await travel(0); await scrollPortrait(0);
    assert.equal(plane.style.transform, initial, 'Scrolling back through the entire exhibition restores Naroa');
    portrait.dom.window.close();
  }
  const stillPortrait = create('/sobre-mi/', true); await stillPortrait.flush();
  stillPortrait.w.scrollTo({ top: 600 }); await stillPortrait.flush();
  assert.equal(stillPortrait.find('[data-portrait-plane]').style.transform, '');
  assert.equal(stillPortrait.find('[data-portrait-artwork]').style.transform, '');
  assert.equal(stillPortrait.find('[data-portrait-plane]').classList.contains('is-measured'), false);
  assert.equal(stillPortrait.find('[data-portrait-artwork]').style.visibility, 'hidden');
  assert.equal(Number(stillPortrait.find('[data-portrait-wink]').getAttribute('opacity')), 0);
  assert.equal(stillPortrait.find('.page-hero-copy').style.opacity, '1');
  stillPortrait.dom.window.close();

  const audio = audioBoundary(), music = create('/sobre-mi/', false, { width: 390, height: 844 }, audio);
  await music.flush();
  assert.equal(audio.contexts.length, 0, 'No audio context is created before a visitor gesture');
  assert.equal(audio.requests.length, 0, 'No sound files are downloaded before opt-in');
  music.click('[data-sound]');
  assert.equal(music.find('[data-sound]').disabled, true, 'Loading cannot create duplicate sound engines');
  await music.flush();
  const ctx = audio.contexts[0];
  assert.equal(audio.requests.length, 2); assert.equal(audio.starts.length, 0, 'Enabling sound never starts a background track');
  assert.equal(ctx.state, 'suspended'); assert.equal(ctx.gains[0].gain.value, 0);
  assert.equal(music.find('[data-sound]').getAttribute('aria-pressed'), 'true');
  assert.equal(music.find('[data-sound]').dataset.state, 'ready');
  audio.advance(1000); await music.flush();
  assert.equal(audio.starts.length, 0, 'Standing still produces no sound');
  const field = ctx.gains[1].gain.value, iris = ctx.gains[2].gain.value, clarity = ctx.filters[0].frequency.value;
  music.w.scrollTo({ top: 20 }); await music.flush();
  assert.equal(audio.starts.length, 2, 'A real scroll excites a pair of short field fragments');
  const gentleGain = ctx.gains[0].gain.value, gentleRate = audio.starts[0].playbackRate.value;
  assert.ok(gentleGain > 0); assert.equal(ctx.state, 'running');
  assert.equal(music.find('[data-sound-status]').hidden, true);
  const startsBeforeNoop = audio.starts.length;
  music.w.dispatchEvent(new music.w.Event('scroll')); await music.flush();
  assert.equal(audio.starts.length, startsBeforeNoop, 'A scroll event without displacement is silent');
  audio.advance(100);
  music.w.scrollTo({ top: 844 * 2.8 * .64 }); await music.flush();
  assert.ok(ctx.gains[0].gain.value > gentleGain, 'Faster scrolling increases sound intensity');
  assert.ok(audio.starts[2].playbackRate.value > gentleRate, 'Scroll speed changes the field playback rate');
  assert.ok(ctx.gains[1].gain.value < field && ctx.gains[2].gain.value > iris, 'The iris changes the concrete texture mix');
  assert.ok(ctx.filters[0].frequency.value < clarity, 'The deeper camera closes the field recording filter');
  assert.ok(ctx.panners[0].pan.value > 0);
  audio.advance(100); music.w.scrollTo({ top: 0 }); await music.flush();
  assert.ok(ctx.panners[0].pan.value < 0, 'Reversing scroll changes the stereo direction');
  assert.equal(ctx.gains[1].gain.value, field); assert.equal(ctx.gains[2].gain.value, iris);
  for (const source of audio.starts) {
    assert.equal(source.loop, false, 'No source is a constantly looping track');
    assert.ok(source.stopAt - source.startAt <= .73 && source.stopAt > source.startAt, 'Each fragment has a finite short lifetime');
    assert.ok(source.offset >= 0 && source.offset < 66);
  }
  const windowCurve = ctx.gains[3].gain.curve;
  assert.equal(windowCurve[0], 0); assert.equal(windowCurve[windowCurve.length - 1], 0, 'Fragment edges taper to silence');
  const countBeforeDenseInput = audio.starts.length;
  for (let i = 1; i <= 20; i++) { audio.advance(1); music.w.scrollTo({ top: i }); }
  await music.flush();
  assert.equal(audio.starts.length, countBeforeDenseInput, 'Dense scroll events cannot flood the audio graph');
  for (let i = 1; i <= 50; i++) {
    audio.advance(40); music.w.scrollTo({ top: 20 + i * 4 }); await music.flush();
    assert.ok(audio.starts.filter(source => source.stopAt > ctx.currentTime).length <= 20, 'Sustained scrolling keeps the number of active fragments bounded');
  }
  const sustainedCount = audio.starts.length;
  audio.advance(161); await music.flush();
  assert.equal(ctx.gains[0].gain.value, 0, 'Stopping scroll releases the sound to silence');
  assert.equal(music.find('[data-sound]').dataset.state, 'ready');
  audio.advance(600); await music.flush(); assert.equal(ctx.state, 'suspended');
  const restingCount = audio.starts.length;
  audio.advance(5000); await music.flush();
  assert.equal(audio.starts.length, restingCount, 'No timer or camera depth keeps producing music while idle');
  assert.equal(restingCount, sustainedCount);
  music.w.scrollTo({ top: 100 });
  music.document.hidden = true; music.document.dispatchEvent(new music.w.Event('visibilitychange')); await music.flush();
  assert.equal(ctx.state, 'suspended'); assert.equal(ctx.gains[0].gain.value, 0);
  assert.equal(audio.starts.length, restingCount, 'Hiding while a context is waking cannot start a stale fragment');
  music.document.hidden = false; music.document.dispatchEvent(new music.w.Event('visibilitychange')); await music.flush();
  assert.equal(ctx.state, 'suspended', 'Returning to the tab waits for new movement');
  music.click('[data-sound]'); audio.advance(600); await music.flush();
  music.w.scrollTo({ top: 200 }); await music.flush();
  assert.equal(audio.starts.length, restingCount, 'Disabled sound ignores movement');
  music.click('[data-sound]'); await music.flush();
  assert.equal(audio.requests.length, 2); assert.equal(audio.starts.length, restingCount, 'Reactivation reuses the material and stays silent');
  music.w.dispatchEvent(new music.w.Event('pagehide')); await music.flush();
  music.w.dispatchEvent(new music.w.Event('pageshow')); await music.flush();
  assert.equal(ctx.state, 'suspended', 'Restoring a cached page does not start idle audio');
  music.click('[data-sound]'); audio.advance(600); music.dom.window.close();
  const galleryAudio = audioBoundary();
  const reactiveGallery = create('/obra/rockagipsy/', false, { width: 1024, height: 768 }, galleryAudio); await reactiveGallery.flush();
  reactiveGallery.click('[data-sound]'); await reactiveGallery.flush();
  assert.equal(galleryAudio.starts.length, 0, 'A direct artwork URL starts silent');
  reactiveGallery.scroll(6.1); await reactiveGallery.flush();
  assert.equal(galleryAudio.starts.length, 2, 'The artwork gallery reacts to actual native scrolling too');
  reactiveGallery.click('[data-sound]'); galleryAudio.advance(600); reactiveGallery.dom.window.close();
  const failingAudio = audioBoundary(); failingAudio.failed = true;
  const retryMusic = create('/', true, { width: 1024, height: 768 }, failingAudio); await retryMusic.flush();
  retryMusic.click('[data-sound]'); await retryMusic.flush();
  assert.equal(retryMusic.find('[data-sound]').getAttribute('aria-pressed'), 'false');
  assert.equal(retryMusic.find('[data-sound]').disabled, false); assert.equal(retryMusic.find('[data-sound-status]').hidden, false);
  failingAudio.failed = false; retryMusic.click('[data-sound]'); await retryMusic.flush();
  assert.equal(retryMusic.find('[data-sound]').getAttribute('aria-pressed'), 'true', 'A failed load can be retried, including with reduced motion');
  retryMusic.click('[data-sound]'); failingAudio.advance(600); retryMusic.dom.window.close();
  const denied = audioBoundary(); denied.denied = true;
  const deniedMusic = create('/', false, { width: 1024, height: 768 }, denied); await deniedMusic.flush();
  deniedMusic.click('[data-sound]'); await deniedMusic.flush();
  assert.equal(deniedMusic.find('[data-sound]').getAttribute('aria-pressed'), 'false');
  assert.equal(denied.requests.length, 0, 'Blocked playback does not start downloading audio');
  assert.equal(deniedMusic.find('[data-sound]').disabled, false); deniedMusic.dom.window.close();

  for (const route of ['/sobre-mi/', '/trayectoria/', '/cuaderno/', '/retratos-por-encargo-bilbao/', '/contacto/']) {
    const page = create(route); await page.flush(); page.click('[data-open-menu]'); assert.equal(page.find('#menu-dialog').open, true); page.click('#menu-dialog [data-close-dialog]');
    const reveals = Array.from(page.document.querySelectorAll('.motion-reveal'));
    assert.ok(reveals.length, 'Editorial content participates in viewport reveals');
    page.observers.forEach(observer => observer.callback(Array.from(observer.targets, target => ({ target, isIntersecting: true }))));
    assert.ok(reveals.every(el => el.classList.contains('is-revealed')), 'Visible editorial content is revealed');
    if (route === '/trayectoria/') { page.click('[data-year="2026"]'); assert.equal(page.document.querySelectorAll('[data-exhibition-year]:not([hidden])').length, 3); }
    if (route === '/cuaderno/') assert.equal(page.document.querySelectorAll('.notebook-posts article').length, 6);
    page.dom.window.close();
  }
  assert.equal(manifest.projects, 40); assert.deepEqual(errors, []);
  console.log('PASS: all 40 artwork flows, feathered depth transitions, 3 gallery eye pairs, kinetic titles, native scroll, free inertia, direct links, 3-image loading bound, search/filters, details/photos, quiet mode, reduced motion, Vaivenes, editorial reveals, responsive Naroa-to-Rara Avis pupil/iris alignment, photographic wink, cinematic deep-iris camera with continuous forward velocity across the blend, eased outward turn, reversible reveal, image-load guard, seamless continuation through all 40 works, 8 additional deep eye matches embedded catalogue navigation, opt-in reactive sound fragments, speed and direction response, bounded voices, silence at rest and safe audio lifecycle.');
})().catch(error => { console.error(error); process.exitCode = 1; });
