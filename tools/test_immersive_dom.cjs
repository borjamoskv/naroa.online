/* Exercise the generated site without requiring a browser or network access. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const output = path.resolve(__dirname, '../.deploy');
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'immersive/build-manifest.json')));
const errors = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function create(route = '/', reduce = false, viewport = { width: 1024, height: 768 }, audio = null, effects = null, storageDenied = false) {
  const file = path.join(output, route, 'index.html');
  let time = 0, id = 0;
  const observers = [];
  const callbacks = new Map(), native = new VirtualConsole();
  native.on('jsdomError', error => {
    if (!error.message.includes('HTMLMediaElement.prototype.play')) errors.push(error.message);
  });
  const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
    runScripts: 'outside-only', url: 'https://portfolio.test' + route, virtualConsole: native,
    beforeParse(w) {
      Object.defineProperty(w, 'innerWidth', { value: viewport.width, configurable: true });
      Object.defineProperty(w, 'innerHeight', { value: viewport.height, configurable: true });
      w.matchMedia = () => ({ matches: reduce, addEventListener() {} });
      if (effects) w.localStorage.setItem('naroa-effects', effects);
      if (storageDenied) Object.defineProperty(w, 'localStorage', { get() { throw new Error('Storage unavailable'); } });
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
      w.HTMLMediaElement.prototype.play = async () => {};
      w.HTMLMediaElement.prototype.pause = () => {};
      w.HTMLMediaElement.prototype.load = () => {};
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
      if (w.HTMLMediaElement) {
        w.HTMLMediaElement.prototype.play = () => Promise.resolve();
        w.HTMLMediaElement.prototype.pause = () => {};
        w.HTMLMediaElement.prototype.load = () => {};
      }
    }
  });
  const w = dom.window, document = w.document;
  const track = document.querySelector('.art-scroll'), stage = document.querySelector('[data-gallery]');
  const step = w.innerHeight * 1.1;
  if (track) {
    track.getBoundingClientRect = () => { const height = w.innerHeight * (1 + parseFloat(track.style.getPropertyValue('--journey-length') || '0') / 100); return { top: -w.scrollY, bottom: height - w.scrollY, height, width: viewport.width, left: 0, right: viewport.width }; };
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
  const journey = stage ? w.NAROA_JOURNEY.create(w.NAROA_CATALOG.projects.filter(p => stage.dataset.subset !== 'Vaivenes' || p.series === 'Vaivenes'), w.NAROA_CATALOG.journey) : null;
  const distance = index => journey.at(index) * w.innerHeight;
  return { dom, w, document, find, click, flush, wheel, key, observers, step, journey, distance, scroll: index => w.scrollTo({top:distance(index)}) };
}

// Mock only the browser audio/network boundary; exercise real click, camera and lifecycle code.
function audioBoundary() {
  const audio = { contexts: [], requests: [], starts: [], notes: [], sources: [], failed: false, denied: false, now: 0 };
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
  const parameter = value => {
    const scheduled = new Set();
    const later = (callback, at) => {
      if (at <= audio.now / 1000) { callback(); return; }
      const id = audio.setTimeout(() => { scheduled.delete(id); callback(); }, at * 1000 - audio.now); scheduled.add(id);
    };
    return { value,
      cancelScheduledValues() { scheduled.forEach(audio.clearTimeout); scheduled.clear(); },
      setValueAtTime(v, at = audio.now / 1000) { later(() => { this.value = v; }, at); },
      setTargetAtTime(v) { this.value = v; },
      setValueCurveAtTime(curve, at, duration) {
        this.curve = curve; this.curveDuration = duration; this.value = curve[0];
        later(() => { this.value = curve[curve.length - 1]; }, at + duration);
      }
    };
  };
  audio.Context = class {
    constructor() { this.state = 'suspended'; this.gains = []; this.filters = []; this.panners = []; this.rooms = []; this.compressors = []; this.sampleRate = 24000; audio.contexts.push(this); }
    get currentTime() { return audio.now / 1000; }
    async resume() { if (audio.denied) throw Error('Playback denied'); this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
    async decodeAudioData(data) { return { duration: data.url.includes('caja-musica') ? 2.4 : 66, url: data.url }; }
    createGain() { const node = { gain: parameter(1), connect() {}, disconnect() {} }; this.gains.push(node); return node; }
    createBiquadFilter() { const node = { frequency: parameter(0), Q: parameter(0), connect() {} }; this.filters.push(node); return node; }
    createStereoPanner() { const node = { pan: parameter(0), connect() {} }; this.panners.push(node); return node; }
    createBuffer(channels, length, sampleRate) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { length, sampleRate, getChannelData: channel => data[channel] }; }
    createConvolver() { const node = { connect(target) { this.target = target; }, disconnect() {} }; this.rooms.push(node); return node; }
    createDynamicsCompressor() { const node = { threshold: parameter(0), knee: parameter(0), ratio: parameter(0), attack: parameter(0), release: parameter(0), connect() {}, disconnect() {} }; this.compressors.push(node); return node; }
    createOscillator() { return { frequency: parameter(440), connect() {}, disconnect() {}, start() {}, stop() {} }; }
    createBufferSource() {
      const context = this;
      return { playbackRate: parameter(1), connect(node) { this.target = node; }, disconnect() {},
        start(at, offset) {
          this.startAt = at; this.offset = offset; audio.sources.push(this);
          (this.buffer.url.includes('caja-musica') ? audio.notes : audio.starts).push(this);
        },
        stop(at = context.currentTime) {
          this.stopAt = at; audio.clearTimeout(this.endTimer);
          this.endTimer = audio.setTimeout(() => this.onended?.(), Math.max(0, (at - context.currentTime) * 1000));
        }
      };
    }
  };
  audio.fetch = async src => { audio.requests.push(src); return { ok: !audio.failed, arrayBuffer: async () => Object.assign(new ArrayBuffer(4), { url: src }) }; };
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
  assert.equal(works.length, manifest.projects);
  for (const slug of ['la-llorona', 'pablo', 'euskolander-no-hay-mas-que-uno', 'idoia-arkatz-bihotz', 'little-adi', 'lauralore', 'izei', 'the-love-boat', 'marian-de-miranda', 'can-dy-queen', 'el-hombre-que-susurraba-a-las-estrellas', 'olinga-a-la-naranja', 'i-got-you-babe', 'jose-manuel-ezquerra', 'billy-saw', 'out-por-los-pelos', 'the-munsters', 'denbora-nora-zoaz', 'la-famiglia', 'smile-and-the-world-smiles-back', 'luis-and-sis', 'de-color', 'el-reencuentro', 'papitxulo', 'starchild', 'las-rosalias']) {
    assert.equal(works.filter(p => p.slug === slug).length, 1, 'Every supplied artwork has one stable route');
  }
  assert.equal(works.find(p => p.slug === 'la-llorona').photos.length, 3);
  assert.ok(works.find(p => p.slug === 'la-llorona').materials.includes('sal rosa'));
  for (const slug of ['rosetta', 'dustin', 'pippilotta', 'roisin']) {
    const work = works.find(p => p.slug === slug);
    assert.equal(work.stage, 'obra'); assert.ok(work.photos.length >= 2, 'Completed works retain their process drawing');
  }
  const puzzle = create('/obra/saio-puzzle/'); await puzzle.flush();
  const puzzleIndex = works.findIndex(p => p.slug === 'saio-puzzle');
  const pieces = () => Array.from(puzzle.document.querySelectorAll('[data-puzzle-piece]'));
  assert.equal(pieces().length, 25);
  const assembled = pieces().map(p => p.getAttribute('transform'));
  puzzle.scroll(puzzleIndex + .39); await puzzle.flush();
  const scattered = pieces().map(p => p.getAttribute('transform'));
  assert.notDeepEqual(scattered, assembled, 'Native scroll mixes the pieces');
  assert.equal(puzzle.find('[data-gallery]').dataset.transition, 'puzzle');
  puzzle.scroll(puzzleIndex + .78); await puzzle.flush();
  assert.deepEqual(pieces().map(p => p.getAttribute('transform')), assembled, 'The pieces reassemble before leaving the work');
  assert.equal(puzzle.find('[data-art-title]').textContent, 'Saio Puzzle');
  puzzle.scroll(puzzleIndex + .39); await puzzle.flush();
  assert.deepEqual(pieces().map(p => p.getAttribute('transform')), scattered, 'Reverse scroll follows exactly the same piece paths');
  puzzle.scroll(puzzleIndex); await puzzle.flush();
  assert.deepEqual(pieces().map(p => p.getAttribute('transform')), assembled);
  puzzle.click('[data-fit]'); assert.ok(puzzle.find('.is-puzzle').classList.contains('puzzle-still'));
  puzzle.dom.window.close();
  const stillPuzzle = create('/obra/saio-puzzle/', true); await stillPuzzle.flush();
  assert.equal(stillPuzzle.document.querySelectorAll('[data-puzzle-piece]').length, 0, 'Reduced motion shows the intact photograph');
  stillPuzzle.dom.window.close();
  const llorona = create('/obra/la-llorona/'); await llorona.flush();
  llorona.click('[data-open-story]');
  assert.equal(llorona.find('[data-art-source]').hidden, true, 'An attachment without a public URL does not produce a fabricated source link');
  assert.ok(llorona.find('[data-facts]').textContent.includes('sal rosa'));
  llorona.dom.window.close();
  assert.equal(ui.journey.entries.length, manifest.projects);
  assert.deepEqual(Array.from(ui.w.NAROA_CATALOG.journey.scenes, e => e.mode).join(' '), 'E H V Z V E H Z V Z E V H H V Z H V Z P V H Z V H Z V H Z V H H Z E Z V H Z H Z Z V Z H Z H V Z H V Z V Z V Z H V H Z H H Z H H Z V H V Z Z V F');
  const modes = { E: 'eyes', H: 'horizontal', V: 'vertical', Z: 'zoom', P: 'puzzle' };
  let horizontalDirection = -1, inHorizontal = false;
  for (let index = 0; index < works.length; index++) {
    const entry = ui.journey.entries[index];
    assert.equal(entry.hold, index ? .25 : .45, 'Every artwork has the agreed viewing pause');
    if (index) assert.ok(Math.abs(entry.start - ui.journey.entries[index - 1].end) < 1e-8, 'Camera sections join with no scroll gap');
    if (index > 0) {
      ui.w.scrollTo({ top: (entry.start + entry.hold * .25) * ui.w.innerHeight }); await ui.flush();
      const image = ui.find(`[data-scene="${index}"] img`), fixedPose = image.style.transform;
      ui.w.scrollTo({ top: (entry.start + entry.hold * .75) * ui.w.innerHeight }); await ui.flush();
      assert.equal(image.style.transform, fixedPose, 'Scrolling during the viewing pause leaves the camera fixed');
    } else {
      ui.w.scrollTo({ top: 0.38 * ui.w.innerHeight }); await ui.flush();
      const image = ui.find(`[data-scene="${index}"] img`), fixedPose = image.style.transform;
      ui.w.scrollTo({ top: 0.44 * ui.w.innerHeight }); await ui.flush();
      assert.equal(image.style.transform, fixedPose, 'Scrolling during the post-threshold pause leaves Marilyn fixed');
    }
    assert.equal(ui.find('[data-art-title]').textContent, works[index].title);
    if (index === works.length - 1) continue;
    ui.scroll(index + .3); await ui.flush();
    assert.equal(ui.find('[data-gallery]').dataset.transition, modes[entry.mode]);
    const before = ui.find(`[data-scene="${index}"]`).style.cssText;
    ui.scroll(index + .7); await ui.flush(); ui.scroll(index + .3); await ui.flush();
    assert.equal(ui.find(`[data-scene="${index}"]`).style.cssText, before, 'Every camera pass reverses along the same path');
    if ((entry.mode === 'H' || entry.mode === 'V') && entry.slug !== 'rockagipsy' && entry.slug !== 'ajenjo-cam') {
      const translation = scene => /translate3d\(([-\d.]+)px,([-\d.]+)px,0\)/.exec(scene.style.transform).slice(1).map(Number);
      const from = translation(ui.find(`[data-scene="${index}"]`)), to = translation(ui.find(`[data-scene="${index + 1}"]`));
      const axis = entry.mode === 'H' ? 0 : 1, size = axis ? ui.w.innerHeight : ui.w.innerWidth;
      assert.ok(Math.abs(Math.abs(to[axis] - from[axis]) - size) < .002, 'Full-screen panels meet exactly without an uncovered seam');
    } else if (entry.slug === 'rockagipsy') {
      const rockaScene = ui.find(`[data-scene="${index}"]`);
      assert.ok(rockaScene.style.transform.includes('rotate('), 'RockaGipsy tilts and falls laterally to reveal Hugo Box');
    } else if (entry.slug === 'ajenjo-cam') {
      const nextImg = ui.find(`[data-scene="${index + 1}"] img`);
      assert.ok(nextImg.style.filter.includes('brightness(') && nextImg.style.filter.includes('saturate('), 'Ajenjo Cam snaps a photo and chemically develops Beatriz de Pandora');
      assert.ok(parseFloat(ui.find('[data-gallery]').style.getPropertyValue('--camera-flash')) > 0, 'Ajenjo Cam emits a camera flash during transition');
    }
    if (entry.slug === 'entre-tantas-flores-de-dia') {
      const stickman = ui.find('[data-stickman]');
      const runner = ui.find('[data-stick-runner]');
      assert.ok(stickman && runner, 'White stickman runway and runner elements are present in DOM');
      assert.ok(stickman.classList.contains('is-running'), 'Stickman runs during Flores to Johnny transition');
      assert.ok(!stickman.hasAttribute('hidden'), 'Stickman is visible during the black void transition');
      assert.ok(runner.style.transform.includes('translate3d('), 'Stickman runner translates horizontally across the black void');
      assert.ok(ui.find('[data-stick-scarf]')?.getAttribute('d')?.startsWith('M'), 'Stickman scarf waves dynamically during sprint');
    }
    if (entry.slug === 'i-got-you-babe') {
      const punchEl = ui.find('[data-punch-impact]');
      assert.ok(punchEl, 'Punch impact element is present in DOM');
      const outgoingImg = ui.find(`[data-scene="${index}"] img`);
      assert.ok(outgoingImg.style.transform.includes('scale('), 'Bill Murray lunges with punch scale');
    }
    if (entry.mode === 'H') {
      const specDir = ui.w.NAROA_CATALOG.journey.scenes.find(s => s.slug === entry.slug)?.direction;
      if (specDir !== undefined) {
        horizontalDirection = specDir;
      } else if (!inHorizontal) {
        horizontalDirection *= -1;
      }
      assert.equal(entry.direction, horizontalDirection, 'Consecutive lateral panels share direction; a new block reverses it');
    }
    inHorizontal = entry.mode === 'H';
  }
  ui.w.scrollTo({ top: .45 * ui.w.innerHeight }); await ui.flush();
  const surfaceStart = ui.find('[data-scene="0"] img').style.transform;
  ui.w.scrollTo({ top: .70 * ui.w.innerHeight }); await ui.flush();
  assert.equal(ui.find('[data-gallery]').dataset.transition, 'explore');
  assert.notEqual(ui.find('[data-scene="0"] img').style.transform, surfaceStart, 'The opening explores Marilyn vertically before entering the iris');
  ui.w.scrollTo({ top: ui.distance(20) - .4 }); await ui.flush();
  assert.equal(ui.find('[data-gallery]').dataset.transition, 'hold', 'Native pixel rounding preserves the viewing pause at a direct-link boundary');
  assert.equal(ui.find('[data-art-title]').textContent, 'Custom Jaio');
  ui.scroll(0); await ui.flush();
  assert.equal(ui.find('[data-art-title]').textContent, 'Marilyn Rocks');
  assert.ok(ui.find('[data-hero-threshold]'), 'Home route renders H1+H5 artist threshold overture');
  assert.equal(ui.find('[data-hero-threshold]').style.visibility, 'visible');
  assert.equal(Number(ui.find('[data-hero-threshold]').style.opacity), 1);
  assert.equal(ui.find('[data-threshold-plane]').style.transform, 'scale(1.0000)');
  assert.equal(ui.find('[data-threshold-wink]').style.opacity, '0');
  const mLipsOrigin = ui.find('[data-scene="0"] img').style.transformOrigin;
  assert.equal(mLipsOrigin, '50.4% 51.7%', 'Marilyn enters through her iconic lips');
  assert.ok(ui.find('[data-scene="0"] img').style.transform.includes('scale'), 'Marilyn camera unrolls smoothly from the lips');
  ui.w.scrollTo({ top: 0.09 * ui.w.innerHeight }); await ui.flush();
  assert.equal(ui.find('[data-threshold-wink]').style.opacity, '1', 'Naroa winks as the viewer crosses the monocle threshold');
  assert.notEqual(ui.find('[data-threshold-plane]').style.transform, 'scale(1.0000)', 'Monocle plane zooms exponentially into the lens');
  ui.click('[data-threshold-enter]'); await ui.flush();
  assert.equal(ui.find('[data-hero-threshold]').style.visibility, 'hidden', 'Clicking threshold CTA crosses into Marilyn Rocks');
  assert.equal(ui.find('[data-scene="0"] img').style.transform, 'scale(1.08000)', 'Marilyn reveals full portrait in reverse zoom-out');
  ui.scroll(0); await ui.flush();
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
  assert.equal(ui.find('[data-kinetic-title]').textContent, '', 'Floating kinetic titles are retired');
  assert.equal(ui.find('[data-art-copy]').style.opacity, '1', 'The reading layer remains available when the camera rests');
  assert.ok(Number(ui.find('[data-gallery]').style.getPropertyValue('--camera-veil')) <= .65, 'Caption attenuation never drops below 35% opacity');
  assert.ok(ui.find('[data-gallery]').classList.contains('is-camera-moving'), 'Actual scrolling gives the camera the frame');
  const stoppedTransform = ui.find('.art-scene img').style.transform;
  await wait(220); await ui.flush();
  assert.equal(ui.find('.art-scene img').style.transform, stoppedTransform, 'Stopping the scroll must not force another movement');
  assert.equal(ui.find('[data-gallery]').classList.contains('is-camera-moving'), false, 'Controls return automatically when scroll stops, including inside an iris');
  assert.equal(ui.find('[data-art-title]').textContent, 'Marilyn Rocks');
  await eyeMatch(ui, 0, [[.635,.392],[.683,.417]]);
  ui.scroll(.49); await ui.flush(); const before = ui.find('[data-art-copy]').style.transform;
  ui.scroll(.51); await ui.flush(); const after = ui.find('[data-art-copy]').style.transform;
  assert.equal(after, before, 'Changing titles does not displace the reading layer');
  ui.scroll(1); await ui.flush();
  assert.equal(ui.find('[data-art-title]').textContent, 'Rara Avis');
  assert.equal(ui.find('[data-kinetic-title]').textContent, '');
  assert.equal(ui.find('[data-art-copy]').style.opacity, '1');
  ui.scroll(1.28); await ui.flush();
  assert.equal(ui.find('[data-scene="2"]').style.maskImage, 'none');
  assert.ok(parseFloat(ui.find('[data-scene="2"]').style.transform.slice(12)) > 0, 'The next work enters from a full horizontal viewport');
  assert.equal(ui.find('[data-gallery]').dataset.transition, 'horizontal');
  assert.equal(ui.key('ArrowDown'), true, 'Vertical keyboard scrolling remains native throughout the gallery');
  assert.equal(ui.key('ArrowUp'), true);
  const heldPosition = ui.w.scrollY, heldPose = ui.find('[data-scene="1"] img').style.transform;
  ui.click('[data-open-menu]'); await ui.flush();
  assert.equal(ui.find('[data-open-menu]').getAttribute('aria-expanded'), 'true');
  assert.equal(ui.find('[data-menu-item][aria-current]').getAttribute('href'), '/obra/');
  assert.equal(ui.document.querySelectorAll('[data-menu-item]').length, 7);
  assert.equal(ui.find('[data-menu-preview-title]').textContent, 'Amy Rocks');
  assert.equal(ui.find('[data-menu-reel]').hidden, false, 'Obras displays the 4-frame curated filmstrip');
  assert.equal(ui.document.querySelectorAll('[data-menu-reel] [data-reel-index]').length, 4);
  ui.find('[data-menu-reel] [data-reel-index="1"]').click(); await ui.flush();
  assert.equal(ui.find('[data-menu-preview-title]').textContent, 'Marilyn Rocks', 'Selecting a filmstrip frame updates the main preview');
  const vaivenesMenu = ui.find('[data-menu-item][href="/series/vaivenes/"]');
  vaivenesMenu.dispatchEvent(new ui.w.Event('pointerenter')); await ui.flush();
  assert.equal(ui.find('[data-menu-reel]').hidden, false, 'Vaivenes also displays its 4-frame series filmstrip');
  assert.equal(ui.document.querySelectorAll('[data-menu-reel] [data-reel-index]').length, 4);
  const artistMenu = ui.find('[data-menu-item][href="/sobre-mi/"]');
  artistMenu.dispatchEvent(new ui.w.Event('pointerenter')); await ui.flush();
  assert.equal(ui.find('[data-menu-reel]').hidden, true, 'Non-collection sections hide the filmstrip cleanly');
  assert.equal(ui.find('[data-menu-preview-title]').textContent, 'Naroa Gutiérrez Gil', 'Preview follows the requested menu item');
  assert.equal(ui.find('[data-menu-quote]').textContent, 'Me encontré a mí en los demás.', 'Handwritten quote updates per section');
  assert.equal(ui.find('[data-menu-picture]').dataset.portraitMode, 'true', 'Portrait mode avoids colliding with the physical naroa sign');
  assert.equal(ui.w.NAROA_SOUND.lastMenuNoteIndex, 2, 'Pointer hover triggers the matching scale degree');
  assert.equal(ui.find('[data-menu-item][aria-current]').getAttribute('href'), '/obra/', 'A preview never changes the current location');
  ui.find('[data-menu-item][href="/contacto/"]').focus(); await ui.flush();
  assert.equal(ui.find('[data-menu-preview-label]').textContent, 'Contacto', 'A shared photograph still updates the focused section label');
  assert.equal(ui.find('[data-menu-picture]').classList.contains('is-winking'), true, 'Contacto activates the complicit portrait wink');
  ui.find('#menu-dialog').dispatchEvent(new ui.w.KeyboardEvent('keydown', { key: '4', bubbles: true, cancelable: true })); await ui.flush();
  assert.equal(ui.find('[data-menu-preview-label]').textContent, 'Trayectoria', 'Numeric shortcut 1-7 previews and focuses the corresponding section');
  assert.equal(ui.find('[data-menu-preview-meta]').textContent, 'Exposiciones colectivas e individuales');
  assert.equal(ui.w.scrollY, heldPosition, 'Opening a panel preserves the exact scroll position');
  assert.equal(ui.find('[data-scene="1"] img').style.transform, heldPose, 'Opening a panel preserves the camera pose');
  ui.click('#menu-dialog [data-close-dialog]'); await ui.flush();
  assert.equal(ui.w.scrollY, heldPosition, 'Closing a panel does not snap to an artwork');
  assert.equal(ui.find('[data-open-menu]').getAttribute('aria-expanded'), 'false');
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
  assert.equal(ui.w.scrollY, ui.distance(7.3), 'A resize with unchanged geometry must not jump back to the last decoded frame');
  await eyeMatch(ui, 5, [[.583,.459],[.545,.402]]);
  await eyeMatch(ui, 10, [[.469,.463],[.678,.439]]);
  await eyeMatch(ui, 33, [[.2985,.4192],[.7633,.8232]]);
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
  const searchLabel = ui.find('label[for="art-search"]');
  assert.ok(searchLabel, 'Art search input must have an explicit <label for="art-search">');
  const mcpLink = ui.find('link[rel="mcp"]');
  assert.ok(mcpLink, 'HTML head must contain a WebMCP <link rel="mcp">');
  assert.equal(mcpLink.getAttribute('href'), 'https://naroagutierrezgil.com/.well-known/mcp.json');
  const inDomMcp = ui.find('script#webmcp-schema');
  assert.ok(inDomMcp, 'HTML must contain in-DOM WebMCP schema script');
  const inDomMcpData = JSON.parse(inDomMcp.textContent);
  assert.equal(inDomMcpData.tools.length, 5, 'In-DOM WebMCP schema must declare 5 tools');
  assert.ok(ui.w.WebMCP, 'WebMCP runtime dispatcher must be attached to window');
  const searchResults = await ui.w.WebMCP.callTool('search_catalogue', { query: 'marilyn' });
  assert.equal(searchResults.length, 1, 'WebMCP search_catalogue must return matching artwork');
  assert.equal(searchResults[0].slug, 'marilyn-rocks');
  const artistProfile = await ui.w.WebMCP.callTool('get_artist_profile');
  assert.equal(artistProfile.name, 'Naroa Gutiérrez Gil');
  const commQuote = await ui.w.WebMCP.callTool('configure_commission_inquiry', { support: 'Pizarra natural rústica', motif: 'Retrato individual' });
  assert.ok(commQuote.whatsapp_url.includes('Pizarra'), 'WebMCP configure_commission_inquiry returns formatted whatsapp link');
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
  assert.ok(ui.find('[data-photo-caption]').textContent.includes(`01 / ${String(works[0].photos.length).padStart(2, '0')}`));
  ui.click('[data-photo-next]');
  assert.ok(ui.find('[data-photo-caption]').textContent.includes(`02 / ${String(works[0].photos.length).padStart(2, '0')}`));
  ui.click('#photos-dialog [data-close-dialog]');
  ui.click('.work-gallery-header button'); await ui.flush();
  ui.click('[data-quiet]'); assert.equal(ui.document.body.classList.contains('is-quiet'), true);
  ui.key('ArrowRight'); await ui.flush(); assert.equal(ui.find('[data-art-title]').textContent, 'Rara Avis');
  ui.key('Escape'); assert.equal(ui.document.body.classList.contains('is-quiet'), false);
  const roisinIdx = works.findIndex(p => p.slug === 'roisin');
  const roisinEntry = ui.journey.entries[roisinIdx];
  ui.w.scrollTo({ top: roisinEntry.start * ui.w.innerHeight }); await ui.flush();
  assert.equal(ui.find('[data-art-title]').textContent, 'Róisín');
  const roisinScene = ui.find(`[data-scene="${roisinIdx}"]`);
  const roisinBw = roisinScene.querySelector('.roisin-bw-layer');
  assert.ok(roisinBw, 'Róisín has an authentic B&W layer with pink lips');
  assert.equal(parseFloat(roisinBw.style.opacity), 1, 'Róisín starts in black and white with pink lips');
  ui.w.scrollTo({ top: (roisinEntry.start + roisinEntry.hold + roisinEntry.explore * 0.5) * ui.w.innerHeight }); await ui.flush();
  const midOpacity = parseFloat(roisinBw.style.opacity);
  assert.ok(midOpacity < 0.95 && midOpacity > 0.05, 'Róisín transitions smoothly from B&W into color');
  ui.w.scrollTo({ top: roisinEntry.transitionStart * ui.w.innerHeight }); await ui.flush();
  assert.equal(parseFloat(roisinBw.style.opacity), 0, 'Róisín blooms fully into full-color collage');
  const hugoIdx = works.findIndex(p => p.slug === 'hugo-box');
  const hugoEntry = ui.journey.entries[hugoIdx];
  assert.equal(hugoEntry.mode, 'Z', 'Hugo Box transitions into James Rocks via zoom');
  ui.w.scrollTo({ top: (hugoEntry.start + hugoEntry.hold * 0.5) * ui.w.innerHeight }); await ui.flush();
  const hugoScene = ui.find(`[data-scene="${hugoIdx}"]`);
  const hugoImg = hugoScene.querySelector('img');
  assert.ok(hugoImg.style.transformOrigin.includes('47.8%'), 'Hugo Box zoom origin is centered on the pink metallic lens');
  ui.dom.window.close();

  const mobile = create('/', false, { width: 390, height: 844 }); await mobile.flush();
  await eyeMatch(mobile, 0, [[.635,.392],[.683,.417]]); mobile.dom.window.close();

  const deepLink = create('/obra/amy-rocks/'); await deepLink.flush();
  assert.equal(deepLink.find('[data-art-title]').textContent, 'Amy Rocks');
  assert.ok(Math.abs(deepLink.w.scrollY - deepLink.distance(3)) < 1e-4, 'Direct artwork URLs start at the correct document position');
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

  const effectsUI = create('/', true); await effectsUI.flush();
  assert.equal(effectsUI.find('[data-effects]').textContent, 'Activar efectos');
  assert.equal(effectsUI.find('[data-effects]').getAttribute('aria-pressed'), 'false');
  effectsUI.click('[data-effects]'); await effectsUI.flush();
  assert.equal(effectsUI.w.matchMedia('(prefers-reduced-motion: reduce)').matches, true, 'The visitor’s system preference is not modified');
  assert.equal(effectsUI.w.localStorage.getItem('naroa-effects'), 'on');
  assert.ok(effectsUI.document.documentElement.classList.contains('motion-opt-in'));
  effectsUI.scroll(1.5); await effectsUI.flush();
  assert.equal(effectsUI.find('[data-gallery]').dataset.transition, 'horizontal', 'Explicit opt-in enables the complete camera score even under system reduction');
  effectsUI.click('[data-effects]'); await effectsUI.flush();
  assert.equal(effectsUI.find('[data-gallery]').dataset.transition, 'still');
  assert.equal(effectsUI.w.localStorage.getItem('naroa-effects'), 'off');
  effectsUI.dom.window.close();
  const savedEffects = create('/obra/custom-jaio/', true, { width: 390, height: 844 }, null, 'on'); await savedEffects.flush();
  assert.equal(savedEffects.find('[data-effects]').textContent, 'Pausar efectos');
  savedEffects.scroll(20.5); await savedEffects.flush();
  assert.equal(savedEffects.find('[data-gallery]').dataset.transition, 'vertical', 'The choice persists on a direct artwork URL');
  savedEffects.dom.window.close();
  const savedPause = create('/', false, { width: 1024, height: 768 }, null, 'off'); await savedPause.flush();
  savedPause.scroll(.5); await savedPause.flush();
  assert.equal(savedPause.find('[data-gallery]').dataset.transition, 'still', 'An explicit pause also works without system reduction'); savedPause.dom.window.close();
  const privateEffects = create('/', true, { width: 1024, height: 768 }, null, null, true); await privateEffects.flush();
  privateEffects.click('[data-effects]'); privateEffects.scroll(.5); await privateEffects.flush();
  assert.equal(privateEffects.find('[data-gallery]').dataset.transition, 'eyes', 'Storage restrictions do not prevent activation'); privateEffects.dom.window.close();
  const unchangedArtist = create('/sobre-mi/', true, { width: 1024, height: 768 }, null, 'on'); await unchangedArtist.flush();
  assert.equal(unchangedArtist.find('[data-effects]'), null);
  assert.equal(unchangedArtist.document.documentElement.classList.contains('motion-opt-in'), false, 'The gallery override does not alter the artist page'); unchangedArtist.dom.window.close();

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
      assert.ok(source.iris > Math.min(viewport.width, viewport.height) * 1.05, 'The camera reaches inside the iris rather than stopping at an eye close-up');
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
    assert.ok(Math.abs(deepest.iris - Math.hypot(viewport.width, viewport.height) * 1.02) < .05, 'The deepest iris framing covers the frame with a 2% margin');
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
    assert.equal(scenes.length, manifest.projects, 'The artist page continues through the complete catalogue');
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
        assert.ok(to.iris > Math.min(viewport.width, viewport.height) * 1.05, 'Every eye match enters the iris deeply');
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
    assert.equal(visited.size, manifest.projects); assert.equal(portrait.find('[data-portrait-next]').disabled, true);
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
  assert.equal(audio.requests.length, 3); assert.equal(audio.sources.length, 0, 'Enabling sound never starts a background track');
  assert.equal(ctx.rooms.length, 1); assert.equal(ctx.rooms[0].normalize, false);
  const leftRoom = ctx.rooms[0].buffer.getChannelData(0), rightRoom = ctx.rooms[0].buffer.getChannelData(1);
  assert.ok(leftRoom.some((value, i) => value !== rightRoom[i]), 'The music box opens into distinct stereo reflections');
  assert.ok(ctx.compressors[0].ratio.value > 1 && ctx.compressors[0].attack.value < .01, 'A short-attack compressor controls overlapping accents');
  assert.equal(ctx.state, 'suspended'); assert.equal(ctx.gains[0].gain.value, 0);
  assert.equal(music.find('[data-sound]').getAttribute('aria-pressed'), 'true');
  assert.equal(music.find('[data-sound]').dataset.state, 'ready');
  audio.advance(1000); await music.flush();
  assert.equal(audio.starts.length, 0, 'Standing still produces no sound');
  for (let i = 0; i < 20; i++) { audio.advance(30); music.w.scrollTo({ top: i % 2 }); await music.flush(); }
  assert.equal(audio.starts.length, 0, 'Tiny alternating scroll tremors preserve silence');
  assert.equal(ctx.state, 'suspended', 'Tremors do not wake audio processing');
  const field = ctx.gains[1].gain.value, iris = ctx.gains[2].gain.value, clarity = ctx.filters[0].frequency.value, roomLevel = ctx.gains[6].gain.value;
  assert.equal(ctx.rooms[0].buffer.length, Math.ceil(ctx.sampleRate * .45), 'Room resonance is shortened to 0.45 seconds');
  assert.equal(ctx.gains[5].gain.value, .55, 'Musical gain is set to 0.55');
  assert.equal(typeof music.w.NAROA_SOUND.frame, 'function', 'NAROA_SOUND.frame interface is exposed');
  assert.equal(typeof music.w.NAROA_SOUND.portraitWink, 'function', 'portraitWink interface is exposed');
  assert.ok(music.w.NAROA_SOUND.dailyMelody?.name, 'Music box daily melody name is present');
  music.click('[data-portrait-plane]'); await music.flush();
  assert.equal(music.w.NAROA_SOUND.lastWinkSlug, 'naroa-monoculo', 'Clicking portrait plane triggers monocle wink acoustic cue');
  music.w.scrollTo({ top: 20 }); await music.flush();
  assert.equal(audio.starts.length, 2, 'A real scroll excites a pair of short field fragments');
  assert.equal(audio.notes.length, 1, 'The same scroll plays the first tuned music-box note');
  assert.ok(Math.abs(audio.notes[0].playbackRate.value - 1) < .00003, 'The melody starts on D5 as the camera begins its approach');
  const gentleGain = ctx.gains[0].gain.value, gentleRate = audio.starts[0].playbackRate.value;
  assert.ok(gentleGain > 0 && gentleGain <= .32); assert.equal(ctx.state, 'running');
  assert.equal(music.find('[data-sound-status]').hidden, true);
  const startsBeforeNoop = audio.starts.length;
  music.w.dispatchEvent(new music.w.Event('scroll')); await music.flush();
  assert.equal(audio.starts.length, startsBeforeNoop, 'A scroll event without displacement is silent');
  audio.advance(150);
  music.w.scrollTo({ top: 120 }); await music.flush();
  assert.ok(ctx.gains[0].gain.value > gentleGain && ctx.gains[0].gain.value <= .32, 'Faster scrolling increases sound intensity within 0.32 master cap');
  assert.ok(audio.starts[2].playbackRate.value > gentleRate, 'Scroll speed changes playback rate at the same camera depth');
  const clearRate = audio.starts[3].playbackRate.value;
  audio.advance(700);
  music.w.scrollTo({ top: 844 * 2.8 * .64 }); await music.flush();
  assert.ok(ctx.gains[1].gain.value < field && ctx.gains[2].gain.value > iris, 'The iris changes the concrete texture mix');
  assert.ok(ctx.filters[0].frequency.value < clarity, 'The deeper camera closes the field recording filter');
  assert.ok(ctx.filters[1].frequency.value <= 500, 'Inside the iris the complete soundscape becomes low and enclosed');
  assert.ok(Math.abs(audio.notes[0].playbackRate.value - 1) < .00003, 'Already-sounding music-box notes remain in tune inside the iris');
  assert.ok([64, 65].includes(Math.round(74 + 12 * Math.log2(audio.notes[1].playbackRate.value))), 'A new music-box note struck inside the iris drops one octave (F4 = 65)');
  assert.ok(audio.starts[5].playbackRate.value < clearRate * .65, 'The concrete layer falls substantially in pitch inside the iris');
  assert.ok(ctx.gains[3].gain.value < .1 && ctx.gains[4].gain.value > .9, 'The iris narrows the field to a central mono core');
  assert.equal(ctx.gains[4].channelCount, 1);
  assert.ok(ctx.gains[6].gain.value < roomLevel * .1, 'Entering the iris closes the reflected room as well as the direct field');
  assert.ok(ctx.panners[0].pan.value > 0);
  audio.advance(181); await music.flush();
  const deepRelease = ctx.gains[0].gain.curveDuration;
  assert.ok(deepRelease > .3, 'The deepest silence receives a soft, longer decay');
  audio.advance(150); music.w.scrollTo({ top: 0 }); await music.flush();
  assert.ok(ctx.panners[0].pan.value < 0, 'Reversing scroll changes the stereo direction');
  assert.ok(Math.abs(ctx.gains[1].gain.value - field) < 1e-12 && Math.abs(ctx.gains[2].gain.value - iris) < 1e-12, 'Reversing the camera restores the open-eye mix');
  assert.equal(ctx.gains[6].gain.value, roomLevel, 'Leaving the iris restores the music-box space');
  assert.ok(ctx.filters[1].frequency.value >= 9000 && ctx.gains[3].gain.value === 1 && ctx.gains[4].gain.value === 0, 'Exiting the eye restores clarity and the stereo field');
  assert.ok(Math.abs(audio.notes[0].playbackRate.value - 1) < .00003, 'Previously played notes never have their pitch dragged');
  for (const source of audio.starts) {
    assert.equal(source.loop, false, 'No source is a constantly looping track');
    assert.ok(source.stopAt - source.startAt <= .85 && source.stopAt > source.startAt, 'Each fragment has a finite short lifetime');
    assert.ok(source.offset >= 0 && source.offset < 66);
  }
  const windowCurve = audio.starts[0].target.gain.curve;
  assert.equal(windowCurve[0], 0); assert.equal(windowCurve[windowCurve.length - 1], 0, 'Fragment edges taper to silence');
  const countBeforeDenseInput = audio.starts.length;
  for (let i = 1; i <= 20; i++) { audio.advance(1); music.w.scrollTo({ top: i }); }
  await music.flush();
  assert.equal(audio.starts.length, countBeforeDenseInput, 'Dense scroll events cannot flood the audio graph');
  for (let i = 1; i <= 50; i++) {
    audio.advance(40); music.w.scrollTo({ top: 20 + i * 4 }); await music.flush();
    assert.ok(audio.sources.filter(source => source.stopAt > ctx.currentTime).length <= 12, 'Sustained scrolling keeps notes and nature fragments within 12 total voices');
    assert.ok(audio.notes.filter(source => source.stopAt > ctx.currentTime).length <= 3, 'Simultaneous music-box bells stay within 3');
  }
  const sustainedCount = audio.starts.length;
  audio.advance(181); await music.flush();
  const release = ctx.gains[0].gain.curve;
  assert.ok(release[0] > 0 && release[63] === 0, 'Silence starts from the current level and reaches an exact zero');
  assert.ok(release[1] > release[0] * .995 && release[62] < release[0] * .005, 'The release has soft edges');
  assert.ok(ctx.gains[0].gain.curveDuration < deepRelease, 'An open eye returns to silence sooner than the deep iris');
  assert.equal(music.find('[data-sound]').dataset.state, 'ready');
  audio.advance(150); music.w.scrollTo({ top: 260 }); await music.flush();
  assert.ok(ctx.gains[0].gain.value > 0, 'Movement can interrupt a fading silence smoothly');
  audio.advance(200); await music.flush();
  assert.ok(ctx.gains[0].gain.value > 0, 'A cancelled release cannot cut off a resumed gesture');
  audio.advance(390); await music.flush(); assert.equal(ctx.state, 'suspended', 'Engine suspends within 600ms of stopping');
  assert.equal(ctx.gains[0].gain.value, 0, 'The final pause is exact silence');
  const restingCount = audio.starts.length;
  const restingNotes = audio.notes.length;
  audio.advance(5000); await music.flush();
  assert.equal(audio.starts.length, restingCount, 'No timer or camera depth keeps producing music while idle');
  assert.equal(audio.notes.length, restingNotes, 'The melody does not advance during silence');
  assert.ok(restingCount >= sustainedCount && restingCount <= sustainedCount + 2);
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
  assert.equal(audio.requests.length, 3); assert.equal(audio.starts.length, restingCount, 'Reactivation reuses the material and stays silent');
  music.w.dispatchEvent(new music.w.Event('pagehide')); await music.flush();
  music.w.dispatchEvent(new music.w.Event('pageshow')); await music.flush();
  assert.equal(ctx.state, 'suspended', 'Restoring a cached page does not start idle audio');
  music.click('[data-sound]'); audio.advance(600); music.dom.window.close();
  const galleryAudio = audioBoundary();
  const reactiveGallery = create('/obra/rockagipsy/', false, { width: 1024, height: 768 }, galleryAudio); await reactiveGallery.flush();
  reactiveGallery.click('[data-sound]'); await reactiveGallery.flush();
  assert.equal(galleryAudio.starts.length, 0, 'A direct artwork URL starts silent');
  const holdEntry = reactiveGallery.journey.entries[6];
  reactiveGallery.w.scrollTo({ top: (holdEntry.start + holdEntry.hold * .5) * reactiveGallery.w.innerHeight }); await reactiveGallery.flush();
  assert.equal(galleryAudio.starts.length, 0, 'Contemplation pauses (hold phase) remain silent');
  reactiveGallery.scroll(6.1); await reactiveGallery.flush();
  assert.equal(galleryAudio.starts.length, 2, 'The artwork gallery reacts once the camera leaves the pause');
  const galleryContext = galleryAudio.contexts[0];
  galleryAudio.advance(150); reactiveGallery.scroll(5.5); await reactiveGallery.flush();
  assert.ok(galleryContext.filters[1].frequency.value <= 500 && galleryContext.gains[4].gain.value > .9, 'Johnny-to-Rocka iris closes the sound at the camera peak');
  const innerRate = galleryAudio.starts[3].playbackRate.value;
  galleryAudio.advance(150); reactiveGallery.scroll(5.93); await reactiveGallery.flush();
  assert.ok(galleryContext.filters[1].frequency.value > 8500 && galleryContext.gains[3].gain.value > .99, 'Leaving through Rocka opens brightness and stereo before the full framing returns');
  assert.ok(galleryAudio.starts[5].playbackRate.value > innerRate * 1.7, 'The next eye opens the pitch along with its framing');
  const ezquerraIndex = works.findIndex(w => w.slug === 'jose-manuel-ezquerra');
  reactiveGallery.scroll(ezquerraIndex); await reactiveGallery.flush();
  assert.equal(reactiveGallery.find('.art-stage').classList.contains('has-ezquerra-brake'), false, 'Navigation through Ezquerra is fluid with zero artificial locking');
  assert.equal(reactiveGallery.wheel(100).defaultPrevented, false, 'Forward wheel flows without artificial interruption');
  const robeIndex = works.findIndex(w => w.slug === 'entre-tantas-flores-de-dia');
  reactiveGallery.scroll(robeIndex); await reactiveGallery.flush();
  assert.equal(reactiveGallery.find('.art-stage').classList.contains('has-deltoya-pulse'), false, 'Robe maintains sober pictorial atmosphere without pop distortions or shout badges');
  assert.equal(reactiveGallery.w.NAROA_SOUND.lastDeltoyaSlug, 'entre-tantas-flores-de-dia', 'Arriving at Robe triggers authentic autotuned Deltoya shout');
  const saioIdx = works.findIndex(w => w.slug === 'saio-puzzle');
  if (saioIdx >= 0) {
    galleryAudio.advance(150); reactiveGallery.scroll(saioIdx); await reactiveGallery.flush();
    assert.equal(reactiveGallery.w.NAROA_SOUND.lastPuzzleSlug, 'saio-puzzle', 'Arriving at Saio Puzzle triggers puzzle snap');
  }
  const swissIdx = works.findIndex(w => w.slug === 'julio-iglesias-como-un-reloj-suizo');
  if (swissIdx >= 0) {
    galleryAudio.advance(150); reactiveGallery.scroll(swissIdx); await reactiveGallery.flush();
    assert.equal(reactiveGallery.w.NAROA_SOUND.lastClockSlug, 'julio-iglesias-como-un-reloj-suizo', 'Arriving at Julio Iglesias triggers Swiss clock escapement');
  }
  const wineIdx = works.findIndex(w => w.slug === 'red-red-wine');
  if (wineIdx >= 0) {
    galleryAudio.advance(150); reactiveGallery.scroll(wineIdx); await reactiveGallery.flush();
    assert.equal(reactiveGallery.w.NAROA_SOUND.lastWineSlug, 'red-red-wine', 'Arriving at Red Red Wine triggers crystal glass clink');
  }
  reactiveGallery.click('[data-sound]'); galleryAudio.advance(600); reactiveGallery.dom.window.close();
  const boxAudio = audioBoundary();
  const box = create('/contacto/', false, { width: 1024, height: 768 }, boxAudio); await box.flush();
  box.click('[data-sound]'); await box.flush();
  for (let i = 0; i < 8; i++) { boxAudio.advance(700); box.w.scrollTo({ top: (i + 1) * 300 }); await box.flush(); }
  const played = boxAudio.notes.map(source => 74 + 12 * Math.log2(source.playbackRate.value));
  assert.deepEqual(played.map(Math.round), [74,77,81,77,76,74,69], 'Scroll plays a coherent, tuned seven-note phrase followed by a rest');
  const expectedMicro = [74.00, 77.24, 81.02, 77.24, 75.86, 74.00, 69.02];
  assert.ok(played.every((note, i) => Math.abs(note - expectedMicro[i]) < 1e-4), 'Movement speed preserves deterministic microtonal scale degrees');
  assert.ok(played.some(note => Math.abs(note - Math.round(note)) > 0.01), 'Melody features authentic microtonal intervals');
  const strikes = boxAudio.notes.map(source => Math.max(...source.target.gain.curve));
  assert.ok(new Set(strikes.map(value => value.toFixed(3))).size >= 3, 'The phrase has a leading accent and gentler answering notes');
  assert.ok(strikes.every(value => value <= .851), 'Even fast gestures leave headroom in each bell');
  assert.ok(boxAudio.notes.every(source => !source.loop && source.stopAt > source.startAt && source.stopAt - source.startAt <= 1.51), 'Every bell has a finite, tapered lifetime');
  boxAudio.advance(700); box.w.scrollTo({ top: 2100 }); await box.flush();
  assert.equal(Math.round(74 + 12 * Math.log2(boxAudio.notes.at(-1).playbackRate.value)), 69, 'Reverse scroll walks back to the note before the rest');
  boxAudio.advance(700); box.w.scrollTo({ top: 1800 }); await box.flush();
  assert.equal(Math.round(74 + 12 * Math.log2(boxAudio.notes.at(-1).playbackRate.value)), 74, 'Reverse scroll continues through the melodic phrase');
  const noteCount = boxAudio.notes.length;
  for (let i = 0; i < 10; i++) { boxAudio.advance(5); box.w.scrollTo({ top: 1800 + (i + 1) * 20 }); await box.flush(); }
  assert.equal(boxAudio.notes.length, noteCount, 'Dense scroll events cannot turn the melody into a note flood');
  boxAudio.advance(5000); await box.flush();
  assert.equal(boxAudio.notes.length, noteCount); assert.equal(boxAudio.contexts[0].gains[0].gain.value, 0);
  box.click('[data-sound]'); boxAudio.advance(600); box.dom.window.close();
  const slowAudio = audioBoundary(), slowBox = create('/contacto/', false, { width: 1024, height: 768 }, slowAudio);
  await slowBox.flush(); slowBox.click('[data-sound]'); await slowBox.flush();
  slowBox.w.scrollTo({ top: 100 }); await slowBox.flush();
  assert.equal(slowAudio.notes.length, 1);
  slowAudio.advance(700); slowBox.w.scrollTo({ top: 108 }); await slowBox.flush();
  assert.equal(slowAudio.notes.length, 1, 'Elapsed time and a tiny new gesture cannot retrigger the melody without winding distance');
  slowAudio.advance(700); slowBox.w.scrollTo({ top: 190 }); await slowBox.flush();
  assert.equal(slowAudio.notes.length, 2, 'The next deliberate movement (>=10svh) continues the phrase');
  slowBox.click('[data-sound]'); slowAudio.advance(700); slowBox.dom.window.close();
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
    const page = create(route); await page.flush(); page.click('[data-open-menu]'); await page.flush();
    assert.equal(page.find('#menu-dialog').open, true);
    assert.equal(page.find('[data-menu-item][aria-current]').getAttribute('href'), route, 'The menu identifies the current editorial section');
    page.click('#menu-dialog [data-close-dialog]');
    const reveals = Array.from(page.document.querySelectorAll('.motion-reveal'));
    assert.ok(reveals.length, 'Editorial content participates in viewport reveals');
    page.observers.forEach(observer => observer.callback(Array.from(observer.targets, target => ({ target, isIntersecting: true }))));
    assert.ok(reveals.every(el => el.classList.contains('is-revealed')), 'Visible editorial content is revealed');
    if (route === '/trayectoria/') { page.click('[data-year="2026"]'); assert.equal(page.document.querySelectorAll('[data-exhibition-year]:not([hidden])').length, 3); }
    if (route === '/cuaderno/') assert.equal(page.document.querySelectorAll('.notebook-posts article').length, 6);
    if (route === '/retratos-por-encargo-bilbao/') {
      assert.equal(page.document.querySelectorAll('.commission-faq-item').length, 4, 'Commissions landing includes 4 buyer-intent FAQs');
      assert.ok(page.find('.commission-compare-table'), 'Commissions landing includes comparative technical support table');
      assert.equal(page.document.querySelectorAll('.commission-compare-table tbody tr').length, 4, 'Comparative table lists 4 primary supports');
      assert.ok(page.find('.closing a[href^="https://wa.me/"]'), 'Commissions landing includes direct WhatsApp CTA');
      assert.ok(page.find('[data-commission-configurator]'), 'Commissions landing includes interactive configurator');
      assert.ok(page.find('#cfg-support'), 'Configurator includes support selector');
      assert.ok(page.find('#cfg-whatsapp-btn'), 'Configurator includes dynamic WhatsApp button');
      assert.ok(page.find('#cfg-email-btn'), 'Configurator includes dynamic Email button');
      assert.ok(page.find('#cfg-preview'), 'Configurator includes live message preview');
      page.find('#cfg-support').value = 'Caja personalizada u objeto';
      page.find('#cfg-support').dispatchEvent(new page.w.Event('change'));
      assert.ok(page.find('#cfg-whatsapp-btn').href.includes(encodeURIComponent('Caja personalizada u objeto')), 'Changing support updates WhatsApp query parameter');
      assert.ok(page.find('#cfg-email-btn').href.includes(encodeURIComponent('Caja personalizada u objeto')), 'Changing support updates Email query parameter');
      assert.ok(page.find('#cfg-preview').textContent.includes('Caja personalizada u objeto'), 'Changing support updates live message preview');
      assert.ok(page.w.NAROA_ATTRIBUTION, 'First-party attribution telemetry exposed on window');
      assert.ok(page.w.WebMCP, 'WebMCP interface exposed on window');
      const catalogResults = await page.w.WebMCP.callTool('search_catalogue', { query: 'pizarra' });
      assert.ok(catalogResults.length > 0, 'WebMCP search_catalogue returns matches');
      const amyDetails = await page.w.WebMCP.callTool('get_artwork_details', { slug: 'amy-rocks' });
      assert.equal(amyDetails.slug, 'amy-rocks', 'WebMCP get_artwork_details returns target artwork');
      const configInquiry = await page.w.WebMCP.callTool('configure_commission_inquiry', { support: 'Pizarra natural rústica', motif: 'Retrato individual' });
      assert.ok(configInquiry.whatsapp_url.includes('wa.me'), 'WebMCP configure_commission_inquiry generates valid WhatsApp URL');
      const faqReply = await page.w.WebMCP.callTool('answer_commission_faq', { topic: 'precios' });
      assert.ok(faqReply.answer.includes('Presupuesto cerrado'), 'WebMCP answer_commission_faq resolves pricing intent in O(1)');
      const artistProfile = await page.w.WebMCP.callTool('get_artist_profile');
      assert.equal(artistProfile.name, 'Naroa Gutiérrez Gil', 'WebMCP get_artist_profile returns artist name');
      assert.equal(artistProfile.entity_id, 'https://naroagutierrezgil.com/#artist', 'WebMCP get_artist_profile returns canonical entity ID');
      assert.equal(artistProfile.studio_id, 'https://naroagutierrezgil.com/#studio', 'WebMCP get_artist_profile returns canonical studio ID');
    }
    page.dom.window.close();
  }
  assert.equal(manifest.projects, works.length); assert.deepEqual(errors, []);
  console.log(`PASS: ${works.length} variable camera scores, fixed viewing pauses, full-viewport vertical and horizontal seams, deterministic reverse motion, three deep iris passes, zoom and puzzle chapters; all ${works.length} artwork flows, 3 gallery eye pairs, kinetic titles, native scroll, free inertia, direct links, 3-image loading bound, search/filters, details/photos, quiet mode, reduced motion, Vaivenes, editorial reveals, responsive Naroa-to-Rara Avis pupil/iris alignment, photographic wink, cinematic deep-iris camera with continuous forward velocity across the blend, eased outward turn, reversible reveal, image-load guard, seamless continuation through all ${works.length} works, 8 additional deep eye matches embedded catalogue navigation, opt-in reactive sound fragments, speed and direction response, bounded voices, silence at rest and safe audio lifecycle.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
