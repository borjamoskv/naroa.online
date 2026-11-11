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
    if (!error.message.includes('HTMLMediaElement.prototype.play') &&
        !error.message.includes('HTMLCanvasElement.prototype.getContext')) {
      errors.push(error.message);
    }
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
  const audio = { contexts: [], requests: [], oscillators: [], sources: [], denied: false, now: 0 };
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
  // Parameters apply every scheduled value at once: the tests assert wiring and lifecycle, not envelopes.
  const parameter = value => ({ value,
    cancelScheduledValues() {},
    setValueAtTime(v) { this.value = v; },
    linearRampToValueAtTime(v) { this.value = v; },
    exponentialRampToValueAtTime(v) { this.value = v; },
    setTargetAtTime(v) { this.value = v; }
  });
  const node = (extra = {}) => ({ connect() {}, disconnect() {}, start() {}, stop() {}, ...extra });
  audio.Context = class {
    constructor() { this.state = 'suspended'; this.rooms = []; this.delays = []; this.sampleRate = 24000; this.destination = node(); audio.contexts.push(this); }
    get currentTime() { return audio.now / 1000; }
    async resume() { if (audio.denied) throw Error('Playback denied'); this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
    createPeriodicWave() { return {}; }
    createGain() { return node({ gain: parameter(1) }); }
    createBiquadFilter() { return node({ frequency: parameter(350), Q: parameter(1), gain: parameter(0) }); }
    createStereoPanner() { return node({ pan: parameter(0) }); }
    createWaveShaper() { return node(); }
    createAnalyser() { return node({ fftSize: 2048, frequencyBinCount: 1024 }); }
    createDelay() { const delay = node({ delayTime: parameter(0) }); this.delays.push(delay); return delay; }
    createDynamicsCompressor() { return node({ threshold: parameter(0), knee: parameter(0), ratio: parameter(0), attack: parameter(0), release: parameter(0) }); }
    createBuffer(channels, length, sampleRate) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { length, sampleRate, getChannelData: channel => data[channel] }; }
    createConvolver() { const room = node(); this.rooms.push(room); return room; }
    createOscillator() { const osc = node({ frequency: parameter(440), detune: parameter(0), setPeriodicWave() {} }); audio.oscillators.push(osc); return osc; }
    createBufferSource() { const source = node({ playbackRate: parameter(1) }); audio.sources.push(source); return source; }
  };
  audio.fetch = async src => { audio.requests.push(src); return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) }; };
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
  for (const slug of ['la-llorona', 'pablo', 'euskolander-no-hay-mas-que-uno', 'idoia-arkatz-bihotz', 'little-adi', 'lauralore', 'izei', 'the-love-boat', 'marian-de-miranda', 'can-dy-queen', 'el-hombre-que-susurraba-a-las-estrellas', 'olinga-a-la-naranja', 'i-got-you-babe', 'jose-manuel-ezquerra', 'billy-saw', 'out-por-los-pelos', 'lily-munster', 'denbora-nora-zoaz', 'la-famiglia', 'smile-and-the-world-smiles-back', 'luis-and-sis', 'de-color', 'el-reencuentro', 'papitxulo', 'starchild', 'las-rosalias']) {
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
  assert.deepEqual(Array.from(ui.w.NAROA_CATALOG.journey.scenes, e => e.mode).join(' '), 'E H V Z V E H Z V Z E V H H V Z H V Z P V H Z V H Z V H Z V H H Z E Z V H Z H Z Z V Z V Z H V Z H Z V Z H Z H H H H H Z H V Z V Z V Z H V H Z H H Z H H Z V H V Z Z V Z F');
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
    if ((entry.mode === 'H' || entry.mode === 'V') && entry.slug !== 'rockagipsy' && entry.slug !== 'ajenjo-cam' && entry.slug !== 'i-got-you-babe') {
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
    if (entry.slug === 'beatriz-de-pandora') {
      const stickman = ui.find('[data-stickman]');
      const kutxaBox = ui.find('[data-stick-kutxa]');
      assert.ok(stickman && kutxaBox && !kutxaBox.hasAttribute('hidden'), 'Kutxa box is revealed during Beatriz de Pandora -> El Gato que es Kutxa transition');
      assert.ok(stickman.classList.contains('is-kutxa-jump'), 'Stickman activates the If-It-Fits-I-Sits kutxa box dive');
      assert.ok(ui.find('[data-kutxa-lid]')?.getAttribute('transform')?.includes('rotate('), 'Kutxa wooden box lid articulates during the dive');
    }
    if (entry.slug === 'la-pensadora') {
      const kissStage = ui.find('[data-kiss-stage]');
      assert.ok(kissStage && !kissStage.hasAttribute('hidden'), 'La Pensadora activates the collage lip-cutout kiss stage toward Freddie');
      assert.ok(kissStage.classList.contains('is-kissing'), 'Kiss stage has active kissing class');
      const volleyAfterBackAndForth = Number(kissStage.dataset.kissVolley);
      assert.ok(volleyAfterBackAndForth >= 2, 'Scrolling back and forth in La Pensadora -> Baroque Farrokh multiplies the number of lip cutouts launched');
      const activeKisses = ui.document.querySelectorAll('[data-kiss-cutout].is-active');
      assert.equal(activeKisses.length, volleyAfterBackAndForth, 'Active lip-cutout elements match the back-and-forth volley multiplier');
    }
    if (entry.slug === 'pippilotta') {
      const monkeyStage = ui.find('[data-monkey-stage]');
      const monkeyEl = ui.find('[data-pippi-monkey]');
      const stringEls = ui.document.querySelectorAll('[data-guitar-string]');
      assert.ok(monkeyStage && !monkeyStage.hasAttribute('hidden'), 'Pippilotta activates Mr. Nilsson monkey leap stage toward Rosetta');
      assert.ok(monkeyStage.classList.contains('is-leaping'), 'Monkey stage has active leaping class');
      assert.ok(monkeyEl && monkeyEl.classList.contains('is-active'), 'Pippi monkey cutout is active and leaping');
      assert.equal(stringEls.length, 6, 'Rosetta guitar stage renders 6 vibrating rainbow strings');
      assert.ok(stringEls[0].getAttribute('d')?.startsWith('M '), 'Rosetta rainbow guitar strings bend via quadratic Bezier wave during strum');
      assert.ok(Number(monkeyStage.dataset.monkeyStrums) >= 2, 'Scrolling back and forth in Pippilotta -> Rosetta increments the guitar strum counter');
    }
    if (entry.slug === 'cantinflowers') {
      const cantinRig = ui.find(`[data-scene="${index}"] [data-cantinflowers-rig]`);
      assert.ok(cantinRig, 'Cantinflowers renders the reactive cigarette ember and smoke SVG rig');
      assert.ok(Number(cantinRig.dataset.dragProgress) > 0, 'Cantinflowers tracks scroll drag progress for the cigarette puff');
      assert.ok(Number(cantinRig.dataset.emberGlow) > 0, 'Cantinflowers cigarette ember glows during scroll drag');
      assert.ok(Number(cantinRig.dataset.puffCount) >= 2, 'Scrolling back and forth on Cantinflowers increments the puff counter');

      const kintsugiBtn = ui.find('[data-kintsugi-toggle]');
      assert.ok(kintsugiBtn && !kintsugiBtn.hidden, 'Cantinflowers reveals the Rasgado Kintsugi toggle button');
      const kintsugiDialog = ui.find('#kintsugi-dialog');
      assert.ok(kintsugiDialog, 'Cantinflowers mounts the Rasgado Kintsugi dual-state scraper dialog');
      kintsugiBtn.click();
      assert.equal(kintsugiDialog.open, true, 'Clicking Rasgado Kintsugi opens the dual-state split dialog');
      const kintsugiHandle = ui.find('[data-kintsugi-handle]');
      assert.ok(kintsugiHandle, 'Kintsugi scraper provides accessible gold fracture handle');
      assert.equal(kintsugiHandle.getAttribute('aria-valuenow'), '50', 'Kintsugi scraper defaults to 50% split');
      kintsugiHandle.dispatchEvent(new ui.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      assert.equal(kintsugiHandle.getAttribute('aria-valuenow'), '55', 'ArrowRight steps Kintsugi split to 55%');
      kintsugiDialog.close();
      assert.equal(kintsugiDialog.open, false, 'Closing dialog hides the Kintsugi scraper');
    }
    if (entry.slug === 'lauralore') {
      const lauraScene = ui.find(`[data-scene="${index}"]`);
      assert.ok(Number(lauraScene.dataset.vaivenCount) >= 2, 'Scrolling back and forth on LauraLore increments the vaivén counter');
      assert.ok(Number(lauraScene.dataset.vaivenZoom) > 1.68, 'Each LauraLore vaivén increases the progressive zoom into the eguzkilore');
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
  // The app clears is-camera-moving on a real 180 ms timer; on slow CI the flush alone can outlast it.
  // Record the class while the scroll is processed instead of sampling it afterwards.
  let cameraTookFrame = false;
  const cameraWatch = new ui.w.MutationObserver(() => { if (ui.find('[data-gallery]').classList.contains('is-camera-moving')) cameraTookFrame = true; });
  cameraWatch.observe(ui.find('[data-gallery]'), { attributes: true, attributeFilter: ['class'] });
  ui.scroll(.28); await ui.flush();
  cameraWatch.disconnect();
  assert.notEqual(ui.find('.art-scene img').style.transform, originalTransform);
  assert.equal(ui.find('[data-art-title]').textContent, 'Marilyn Rocks');
  assert.equal(ui.find('[data-scene="1"]').style.visibility, 'visible');
  assert.equal(ui.find('[data-gallery]').dataset.transition, 'eyes');
  assert.equal(ui.find('[data-scene="1"]').style.maskImage, 'none');
  assert.equal(ui.find('[data-kinetic-title]').textContent, '', 'Floating kinetic titles are retired');
  assert.equal(ui.find('[data-art-copy]').style.opacity, '1', 'The reading layer remains available when the camera rests');
  assert.ok(Number(ui.find('[data-gallery]').style.getPropertyValue('--camera-veil')) <= .65, 'Caption attenuation never drops below 35% opacity');
  assert.ok(cameraTookFrame || ui.find('[data-gallery]').classList.contains('is-camera-moving'), 'Actual scrolling gives the camera the frame');
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
  assert.equal(ui.document.querySelectorAll('[data-menu-item]').length, 4, 'The menu has four sections: Obras, Naroa, Blog and Encargos');
  assert.deepEqual(Array.from(ui.document.querySelectorAll('[data-menu-item] .menu-name'), el => el.firstChild.textContent), ['Obras', 'Naroa', 'Blog', 'Encargos']);
  assert.equal(ui.find('[data-menu-preview-title]').textContent, 'Amy Rocks');
  assert.equal(ui.find('[data-menu-reel]').hidden, false, 'Obras displays the 4-frame curated filmstrip');
  assert.equal(ui.document.querySelectorAll('[data-menu-reel] [data-reel-index]').length, 4);
  ui.find('[data-menu-reel] [data-reel-index="1"]').click(); await ui.flush();
  assert.equal(ui.find('[data-menu-preview-title]').textContent, 'Marilyn Rocks', 'Selecting a filmstrip frame updates the main preview');
  assert.equal(ui.find('[data-menu-open-work]').getAttribute('href'), '/obra/marilyn-rocks/', 'Selecting a filmstrip frame syncs the direct entry link');
  assert.equal(ui.find('[data-menu-item][href="/series/vaivenes/"]'), null, 'Vaivenes lives inside Obras, not as its own menu section');
  assert.equal(ui.find('[data-menu-item][href="/trayectoria/"]'), null, 'Trayectoria lives inside Naroa, not as its own menu section');
  assert.ok(ui.find('#index-dialog a[href="/series/vaivenes/"]'), 'The works index still leads to the Vaivenes series');
  const artistMenu = ui.find('[data-menu-item][href="/sobre-mi/"]');
  artistMenu.dispatchEvent(new ui.w.Event('pointerenter')); await ui.flush();
  assert.equal(ui.find('[data-menu-reel]').hidden, true, 'Non-collection sections hide the filmstrip cleanly');
  assert.equal(ui.find('[data-menu-preview-title]').textContent, 'Naroa Gutiérrez Gil', 'Preview follows the requested menu item');
  assert.equal(ui.find('[data-menu-quote]').textContent, 'Me encontré a mí en los demás.', 'Handwritten quote updates per section');
  assert.equal(ui.find('[data-menu-picture]').dataset.portraitMode, 'true', 'Portrait mode avoids colliding with the physical naroa sign');
  assert.equal(ui.find('[data-menu-item][aria-current]').getAttribute('href'), '/obra/', 'A preview never changes the current location');
  ui.find('[data-menu-item][href="/retratos-por-encargo-bilbao/"]').focus(); await ui.flush();
  assert.equal(ui.find('[data-menu-preview-label]').textContent, 'Encargos', 'A shared photograph still updates the focused section label');
  assert.equal(ui.find('[data-menu-picture]').classList.contains('is-winking'), true, 'Encargos activates the complicit portrait wink');
  ui.find('#menu-dialog').dispatchEvent(new ui.w.KeyboardEvent('keydown', { key: '3', bubbles: true, cancelable: true })); await ui.flush();
  assert.equal(ui.find('[data-menu-preview-label]').textContent, 'Blog', 'Numeric shortcut 1-4 previews and focuses the corresponding section');
  assert.equal(ui.find('[data-menu-preview-meta]').textContent, 'Historias de obras, procesos y encuentros');
  assert.equal(ui.find('[data-menu-reel]').hidden, false, 'Blog renders its 4-frame curated filmstrip');
  assert.equal(ui.find('#menu-dialog').style.getPropertyValue('--menu-glow'), '#1b7874', 'Menu atmosphere glow adapts dynamically to the active section');
  ui.click('[data-menu-sound-credits]'); await ui.flush();
  assert.equal(ui.find('[data-menu-sound-drawer]').hidden, false, 'Sound credits drawer opens inline inside the menu dialog');
  ui.click('[data-close-sound-drawer]'); await ui.flush();
  assert.equal(ui.find('[data-menu-sound-drawer]').hidden, true, 'Sound credits drawer closes cleanly');
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
  assert.ok(ui.find('#story-remix-dialog'), 'Story remix dialog must exist in DOM');
  ui.click('[data-share-network="instagram"]');
  assert.equal(ui.find('#story-remix-dialog').open, true, 'Instagram button opens story remix dialog');
  assert.ok(ui.find('[data-remix-shuffle]'), 'Shuffle button exists');
  assert.ok(ui.find('[data-remix-share]'), 'Share button exists');
  assert.ok(ui.find('[data-remix-download]'), 'Download button exists');
  assert.equal(ui.find('[data-remix-title]').textContent, ui.find('[data-art-title]').textContent, 'The story dialog names the artwork it is about');
  assert.ok(ui.find('[data-remix-status]'), 'Story messages are shown inside the dialog, not in alerts');
  assert.equal(ui.document.querySelectorAll('#story-remix-dialog .remix-btn').length, 0, 'Story actions are a typographic list, not pill buttons');
  ui.click('#story-remix-dialog [data-close-dialog]');
  assert.equal(ui.find('#story-remix-dialog').open, false);
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
  assert.ok(ui.find('[data-index-backdrop]'), 'Disruptive Obra index includes live stage backdrop');
  assert.ok(ui.find('[data-index-spotlight-hud]'), 'Disruptive Obra index includes live curatorial spotlight HUD');
  ui.click('[data-obra-mode="mesa"]');
  assert.equal(ui.find('#index-dialog').dataset.obraView, 'mesa', 'Obra index switches to Lightbox Contact Sheet mode (Mesa de Luz)');
  ui.click('[data-obra-mode="constelacion"]');
  assert.equal(ui.find('#index-dialog').dataset.obraView, 'constelacion', 'Obra index switches to Kintsugi Constellation mode');
  ui.click('[data-obra-mode="muro"]');
  ui.click('[data-index-oracle]');
  assert.ok(ui.w.NAROA_STENCIL_WALL.getState().oracleRolls >= 1 && Boolean(ui.w.NAROA_STENCIL_WALL.getState().oracleSlug), 'Obra Oracle selects a surprise artwork on the wall');
  ui.click('.index-work[data-work="marilyn-rocks"]'); await ui.flush();
  assert.equal(ui.find('[data-art-title]').textContent, 'Marilyn Rocks');
  assert.equal(ui.find('#work-gallery-dialog').open, true, 'The existing artwork photo overview is preserved');
  assert.equal(ui.document.querySelectorAll('.work-gallery-figure').length, works[0].photos.length);
  assert.ok(ui.find('[data-work-dissection]'), 'Work gallery dialog includes curatorial dissection deck');
  assert.ok(ui.find('[data-work-loupe]'), 'Work gallery plates include 3x pigment magnifying loupe');
  ui.click('[data-gallery-xray-toggle]');
  assert.equal(ui.find('#work-gallery-dialog').dataset.xrayActive, 'true', 'Work gallery toggles raking relief X-Ray light');
  ui.click('[data-gallery-xray-toggle]');
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
  series.click('[data-open-menu]'); await series.flush();
  assert.equal(series.find('[data-menu-item][aria-current]').getAttribute('href'), '/obra/', 'Inside the Vaivenes series the menu marks Obras as current');
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
    await scrollPortrait(.09);
    assert.equal(Number(wink.getAttribute('opacity')), 1, 'First Naroa winks her left eye immediately as scroll begins');
    assert.ok(readPose(plane, [0.4516, 0.4005], .030).scale < 1.15, 'Portrait stays at full framing during the initial left-eye wink');
    await scrollPortrait(.23);
    assert.notEqual(plane.style.transform, initial, 'The portrait moves into its monocle eye');
    assert.equal(Number(wink.getAttribute('opacity')), 1, 'The existing photographic wink remains in the approach');
    assert.ok(readPose(plane, [0.4516, 0.4005], .030).scale < 1.15, 'Monocle zoom waits until the left-eye wink completes');
    assert.ok(Number(portrait.find('[data-portrait-monocle-glint]').getAttribute('opacity')) > 0.3, 'Optical monocle glint ignites to cue the monocle plunge');
    const closed = wink.getAttribute('opacity');
    let previousIris = 0;
    for (const progress of [.46, .51, .56]) {
      await scrollPortrait(progress);
      const source = readPose(plane, [0.4516, 0.4005], .030), target = readPose(artwork, [.670, .391], .025);
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
        distances.push(Math.log(readPose(artwork, [.670, .391], .025).iris));
      }
      const before = distances[1] - distances[0], after = distances[2] - distances[1];
      assert.ok(before > 0 && after > 0, 'The camera does not stop or reverse at the eye handover');
      assert.ok(Math.abs(before - after) / Math.max(before, after) < .04, 'Camera velocity stays continuous across the eye handover');
    }
    await scrollPortrait(.64);
    const deepest = readPose(artwork, [.670, .391], .025);
    assert.ok(Math.abs(deepest.iris - Math.hypot(viewport.width, viewport.height) * 1.02) < .05, 'The deepest iris framing covers the frame with a 2% margin');
    await scrollPortrait(.65);
    const turning = readPose(artwork, [.670, .391], .025);
    assert.ok(turning.iris < deepest.iris && turning.iris > deepest.iris * .995, 'The camera eases gently into its outward movement');
    await scrollPortrait(.51);
    assert.equal(Number(artwork.style.opacity), .5, 'The eye match dissolves through both photographs');
    const matching = [plane.style.transform, artwork.style.transform];
    const stopped = artwork.style.transform; await wait(50); await portrait.flush();
    assert.equal(artwork.style.transform, stopped, 'The camera stops when native scroll stops');
    await scrollPortrait(.8);
    const opening = readPose(artwork, [.670, .391], .025);
    assert.ok(opening.scale > 1 && opening.scale < 8, 'The camera opens out of the artwork eye');
    await scrollPortrait(.96);
    const final = readPose(artwork, [.670, .391], .025);
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
      [ .670, .391, .025 ], [ .635, .392, .030 ], [ .512, .424, .018 ],
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
  assert.equal(music.find('[data-sound]').getAttribute('aria-pressed'), 'false');
  assert.equal(music.find('[data-sound-status]').hidden, true, 'No sound card or notice is shown at rest');
  music.click('[data-sound]');
  assert.equal(music.find('[data-sound]').disabled, true, 'Starting cannot create duplicate sound engines');
  await music.flush();
  const ctx = audio.contexts[0];
  assert.equal(audio.contexts.length, 1); assert.equal(ctx.state, 'running');
  assert.equal(audio.requests.length, 0, 'The soundtrack is synthesised: it never downloads audio');
  assert.equal(music.find('[data-sound]').disabled, false);
  assert.equal(music.find('[data-sound]').getAttribute('aria-pressed'), 'true');
  assert.equal(music.find('[data-sound]').dataset.state, 'playing');
  assert.equal(music.find('[data-sound-status]').hidden, true, 'Playing shows no visual card');
  assert.equal(music.find('[data-sound-card]'), null, 'The analog sound card is gone');
  const score = music.w.NAROA_SCORE;
  assert.equal(score.title, 'Apirila'); assert.equal(score.playing, true);
  assert.ok(score.state.intensity < .35, 'By default the right hand stays silent');
  assert.ok(audio.oscillators.length > 0, 'Starting schedules the first piano notes');
  assert.ok(ctx.rooms.length === 1 && ctx.delays.length === 5, 'The piano runs through a room and five tape delays');
  const leftRoom = ctx.rooms[0].buffer.getChannelData(0), rightRoom = ctx.rooms[0].buffer.getChannelData(1);
  assert.ok(leftRoom.some((value, i) => value !== rightRoom[i]), 'The room has distinct stereo reflections');
  assert.equal(typeof music.w.NAROA_SOUND.frame, 'function', 'NAROA_SOUND.frame interface is exposed');
  music.w.NAROA_SOUND.frame({ slug: 'game-over' });
  assert.equal(score.state.silent, true, 'Game Over demands contemplative silence');
  music.w.NAROA_SOUND.frame({ slug: 'rockagipsy' });
  assert.equal(score.state.silent, false, 'Leaving Game Over lets the music return');
  music.w.scrollTo({ top: 400 }); await music.flush();
  assert.equal(score.playing, true, 'Scrolling does not interrupt the soundtrack');
  music.document.hidden = true; music.document.dispatchEvent(new music.w.Event('visibilitychange')); await music.flush();
  assert.equal(score.playing, false, 'Hiding the tab fades the music out');
  assert.equal(music.find('[data-sound]').getAttribute('aria-pressed'), 'false');
  music.document.hidden = false; music.document.dispatchEvent(new music.w.Event('visibilitychange')); await music.flush();
  assert.equal(score.playing, true, 'Returning to the tab brings the music back');
  music.click('[data-sound]'); await music.flush();
  assert.equal(score.playing, false); assert.equal(music.find('[data-sound]').dataset.state, 'off');
  assert.equal(music.find('[data-sound]').getAttribute('aria-pressed'), 'false');
  audio.advance(6000); await music.flush();
  assert.equal(ctx.state, 'suspended', 'The engine suspends after the fade-out');
  music.document.hidden = true; music.document.dispatchEvent(new music.w.Event('visibilitychange'));
  music.document.hidden = false; music.document.dispatchEvent(new music.w.Event('visibilitychange')); await music.flush();
  assert.equal(score.playing, false, 'A visitor who stopped the music is not surprised by it later');
  music.click('[data-sound]'); await music.flush();
  assert.equal(audio.contexts.length, 1, 'Reactivation reuses the same engine');
  assert.equal(score.playing, true);
  music.click('[data-sound]'); audio.advance(6000); music.dom.window.close();
  const galleryAudio = audioBoundary();
  const reactiveGallery = create('/obra/rockagipsy/', false, { width: 1024, height: 768 }, galleryAudio); await reactiveGallery.flush();
  reactiveGallery.click('[data-sound]'); await reactiveGallery.flush();
  assert.equal(reactiveGallery.w.NAROA_SCORE.playing, true, 'The soundtrack plays over the artwork gallery');
  const ezquerraIndex = works.findIndex(w => w.slug === 'jose-manuel-ezquerra');
  reactiveGallery.scroll(ezquerraIndex); await reactiveGallery.flush();
  assert.equal(reactiveGallery.find('.art-stage').classList.contains('has-ezquerra-brake'), false, 'Navigation through Ezquerra is fluid with zero artificial locking');
  assert.equal(reactiveGallery.wheel(100).defaultPrevented, false, 'Forward wheel flows without artificial interruption');
  const robeIndex = works.findIndex(w => w.slug === 'entre-tantas-flores-de-dia');
  reactiveGallery.scroll(robeIndex); await reactiveGallery.flush();
  assert.equal(reactiveGallery.find('.art-stage').classList.contains('has-deltoya-pulse'), false, 'Robe maintains sober pictorial atmosphere without pop distortions or shout badges');
  assert.equal(reactiveGallery.w.NAROA_SCORE.state.silent, false);
  const gameOverIndex = works.findIndex(w => w.slug === 'game-over');
  if (gameOverIndex >= 0) {
    reactiveGallery.scroll(gameOverIndex); await reactiveGallery.flush();
    assert.equal(reactiveGallery.w.NAROA_SCORE.state.silent, true, 'Arriving at Game Over silences the soundtrack');
    reactiveGallery.scroll(robeIndex); await reactiveGallery.flush();
    assert.equal(reactiveGallery.w.NAROA_SCORE.state.silent, false, 'Leaving Game Over restores it');
  }
  assert.equal(galleryAudio.requests.length, 0, 'No artwork triggers an audio download');
  reactiveGallery.click('[data-sound]'); galleryAudio.advance(6000); reactiveGallery.dom.window.close();
  // «Apirila» follows the visitor's scroll: a fast scroll hurries it, a slow stroll settles it, stillness returns it to 96.
  const paceAudio = audioBoundary(), paced = create('/obra/rockagipsy/', false, { width: 1024, height: 768 }, paceAudio); await paced.flush();
  const pacedScore = paced.w.NAROA_SCORE, pacedSound = paced.w.NAROA_SOUND;
  // Each step is 0.9 s of camera frames on the audio clock, then one real turn of the engine's own scheduler.
  const perform = async (audio, score, seconds, eachFrame = () => {}) => {
    for (let step = 0; step < seconds / .9; step++) {
      for (let f = 0; f < 56; f++) { audio.now += 16; eachFrame(); }
      await wait(70);
    }
    return score.state.tempo;
  };
  const report = state => () => pacedSound.frame(state);
  pacedSound.frame({ slug: 'rockagipsy', mode: 'V', velocity: 4 });
  assert.equal(paceAudio.contexts.length, 0, 'Scrolling with the sound off creates no audio');
  paced.click('[data-sound]'); await paced.flush();
  assert.equal(pacedScore.bpm, 96); assert.equal(pacedScore.state.tempo, 96, 'The piece starts at its base tempo');
  assert.equal(await perform(paceAudio, pacedScore, 2.7), 96, 'Without scrolling the tempo stays at 96');
  const hurried = await perform(paceAudio, pacedScore, .9, report({ slug: 'rockagipsy', mode: 'V', velocity: 4 }));
  assert.ok(hurried > 96 && hurried < 110, 'A fast scroll speeds the piece up gradually, never in one jump');
  const fast = await perform(paceAudio, pacedScore, 4.5, report({ slug: 'rockagipsy', mode: 'V', velocity: -4 }));
  assert.ok(fast > 110 && fast <= 116, 'A sustained fast scroll, in either direction, reaches at most 116 beats per minute');
  const slow = await perform(paceAudio, pacedScore, 9, report({ slug: 'rockagipsy', mode: 'V', velocity: .3 }));
  assert.ok(slow >= 84 && slow < 90, 'A slow, sustained stroll calms the piece down to no less than 84');
  assert.equal(await perform(paceAudio, pacedScore, 9), 96, 'When the scroll stops the tempo returns to 96 by itself');
  assert.equal(await perform(paceAudio, pacedScore, 2.7, report({ slug: 'rockagipsy', mode: 'V', velocity: 90 })), 96, 'A jump across the catalogue is not a gesture');
  assert.equal(await perform(paceAudio, pacedScore, 2.7, report({ slug: 'rockagipsy', mode: 'still', velocity: 4 })), 96, 'Without motion effects the tempo never reacts');
  await perform(paceAudio, pacedScore, 1.8, report({ slug: 'rockagipsy', mode: 'V', velocity: 4 }));
  pacedSound.frame({ slug: 'game-over', mode: 'V', velocity: 4 });
  assert.equal(pacedScore.state.silent, true);
  await perform(paceAudio, pacedScore, 1.8, report({ slug: 'game-over', mode: 'V', velocity: 4 }));
  const notesBeforeSilence = paceAudio.oscillators.length;
  assert.equal(await perform(paceAudio, pacedScore, 7.2, report({ slug: 'game-over', mode: 'V', velocity: 4 })), 96, 'Game Over rests at the base tempo however fast the scroll');
  assert.equal(paceAudio.oscillators.length, notesBeforeSilence, 'Game Over stays silent while the visitor scrolls');
  pacedSound.frame({ mode: 'page', velocity: 0 });
  assert.equal(pacedScore.state.silent, true, 'A speed-only report does not break the silence');
  pacedSound.frame({ slug: 'rockagipsy', mode: 'V', velocity: 0 });
  assert.equal(pacedScore.state.silent, false);
  // The gallery camera reports its own speed: drive real scroll frames by hand to sample the music mid-gesture.
  const drive = (ui, audio, speed) => {
    const frames = [], native = ui.w.requestAnimationFrame; let top = ui.w.scrollY, clock = 1e6;
    ui.w.requestAnimationFrame = callback => frames.push(callback);
    return {
      frame() { top += ui.w.innerHeight * speed * .016; clock += 16; ui.w.scrollTo({ top }); frames.splice(0).forEach(callback => callback(clock)); },
      async release() { ui.w.requestAnimationFrame = native; frames.splice(0).forEach(callback => native(callback)); await ui.flush(); }
    };
  };
  const rush = drive(paced, paceAudio, 3.4);
  assert.ok(await perform(paceAudio, pacedScore, 2.7, rush.frame) > 100, 'Scrolling fast through the gallery hurries the soundtrack');
  await rush.release();
  assert.equal(await perform(paceAudio, pacedScore, 9), 96, 'Once the camera rests the soundtrack is back at 96');
  paced.click('[data-sound]'); await paced.flush();
  const restingNotes = paceAudio.oscillators.length;
  await perform(paceAudio, pacedScore, 1.8, report({ slug: 'rockagipsy', mode: 'V', velocity: 4 }));
  assert.equal(paceAudio.oscillators.length, restingNotes, 'With the sound off, scrolling schedules nothing');
  assert.equal(paceAudio.contexts.length, 1); paceAudio.advance(6000); paced.dom.window.close();
  const strollAudio = audioBoundary(), strolled = create('/sobre-mi/', false, { width: 1024, height: 768 }, strollAudio); await strolled.flush();
  strolled.click('[data-sound]'); await strolled.flush();
  const stroll = drive(strolled, strollAudio, .3);
  assert.ok(await perform(strollAudio, strolled.w.NAROA_SCORE, 5.4, stroll.frame) < 93, 'Strolling slowly down an editorial page calms the soundtrack');
  await stroll.release();
  strolled.click('[data-sound]'); strollAudio.advance(6000); strolled.dom.window.close();
  const calmAudio = audioBoundary(), calm = create('/obra/rockagipsy/', true, { width: 1024, height: 768 }, calmAudio); await calm.flush();
  calm.click('[data-sound]'); await calm.flush();
  const calmRush = drive(calm, calmAudio, 3.4);
  assert.equal(await perform(calmAudio, calm.w.NAROA_SCORE, 2.7, calmRush.frame), 96, 'With reduced motion a fast scroll leaves the tempo untouched');
  await calmRush.release();
  calm.click('[data-sound]'); calmAudio.advance(6000); calm.dom.window.close();
  const denied = audioBoundary(); denied.denied = true;
  const deniedMusic = create('/', true, { width: 1024, height: 768 }, denied); await deniedMusic.flush();
  deniedMusic.click('[data-sound]'); await deniedMusic.flush();
  assert.equal(deniedMusic.find('[data-sound]').getAttribute('aria-pressed'), 'false');
  assert.equal(deniedMusic.find('[data-sound]').disabled, false);
  assert.equal(deniedMusic.find('[data-sound-status]').hidden, false, 'Blocked playback explains itself in plain text');
  assert.equal(denied.requests.length, 0, 'Blocked playback does not start downloading audio');
  denied.denied = false; deniedMusic.click('[data-sound]'); await deniedMusic.flush();
  assert.equal(deniedMusic.find('[data-sound]').getAttribute('aria-pressed'), 'true', 'Blocked playback can be retried, including with reduced motion');
  assert.equal(deniedMusic.find('[data-sound-status]').hidden, true);
  deniedMusic.click('[data-sound]'); denied.advance(6000); deniedMusic.dom.window.close();

  for (const route of ['/sobre-mi/', '/trayectoria/', '/cuaderno/', '/retratos-por-encargo-bilbao/']) {
    const page = create(route); await page.flush(); page.click('[data-open-menu]'); await page.flush();
    assert.equal(page.find('#menu-dialog').open, true);
    assert.equal(page.find('[data-menu-item][aria-current]').getAttribute('href'), route === '/trayectoria/' ? '/sobre-mi/' : route, 'The menu identifies the current editorial section (Trayectoria belongs to Naroa)');
    page.click('#menu-dialog [data-close-dialog]');
    const reveals = Array.from(page.document.querySelectorAll('.motion-reveal'));
    assert.ok(reveals.length, 'Editorial content participates in viewport reveals');
    page.observers.forEach(observer => observer.callback(Array.from(observer.targets, target => ({ target, isIntersecting: true }))));
    assert.ok(reveals.every(el => el.classList.contains('is-revealed')), 'Visible editorial content is revealed');
    if (route === '/sobre-mi/') {
      assert.ok(page.find('[data-kintsugi-editorial]'), 'Sobre mí includes Kintsugi editorial scroll container');
      assert.ok(page.find('.kintsugi-seam-svg'), 'Sobre mí injects SVG golden Kintsugi seam');
      assert.equal(page.document.querySelectorAll('[data-hand-margin]').length, 4, 'Sobre mí includes 4 first-person handwritten margin notes');
      assert.equal(page.document.querySelectorAll('.kintsugi-shard--top').length, 4, 'Sobre mí splits chapters into upper tectonic shards');
      assert.equal(page.document.querySelectorAll('.kintsugi-shard--bottom').length, 4, 'Sobre mí splits chapters into lower tectonic shards');
      assert.equal(page.document.querySelectorAll('.kintsugi-chasm-crack').length, 4, 'Sobre mí injects liquid gold SVG cracks inside every chasm');
      assert.ok(page.find('[data-reverse-portrait]'), 'Sobre mí includes Reverse Portrait diagnostic section');
      assert.ok(page.w.NAROA_ABOUT_SCROLL, 'NAROA_ABOUT_SCROLL API exposed on window');
      const scrollState = page.w.NAROA_ABOUT_SCROLL.triggerSampleScroll(1400);
      assert.equal(scrollState.backend, 'kintsugi-tectonic-fracture-v8', 'Sobre mí uses V8 tectonic fracture + golden suture scroll backend');
      assert.equal(scrollState.fractureStates.espejo, 'sutured', 'Scrolling past chapter sutures the tectonic fracture with liquid gold');
      assert.ok(scrollState.dwellChapters.espejo >= 12, 'Reverse portrait tracks chapter dwell telemetry');
      assert.ok(page.find('[data-gaze-work]').textContent.includes('Rara Avis'), 'Reverse portrait updates mirror artwork from scroll dwell');
    }
    if (route === '/trayectoria/') { page.click('[data-year="2026"]'); assert.equal(page.document.querySelectorAll('[data-exhibition-year]:not([hidden])').length, 3);
      assert.equal(page.document.querySelectorAll('[data-timeline-year]:not([hidden])').length, 1, 'Only the year marker with visible entries remains');
      assert.equal(page.document.querySelectorAll('[data-exhibition-year]:not([data-wall])').length, 0, 'Every encounter names its background wall');
      const cromoSlugs = Array.from(page.document.querySelectorAll('.timeline-cromo[data-cromo-slug]'), el => el.dataset.cromoSlug);
      assert.equal(new Set(cromoSlugs).size, cromoSlugs.length, 'No artwork is repeated across encounters');
      assert.equal(page.document.querySelectorAll('.career-wall [data-wall-layer].is-on').length, 1, 'Exactly one wall texture is shown at a time');
      assert.equal(page.find('[data-wall-year]').textContent, '2026', 'The giant background year follows the encounter on screen');
      assert.equal(page.find('.career-wall').getAttribute('aria-hidden'), 'true', 'The parallax wall is decorative');
      page.click('[data-career-kind="group"]');
      assert.equal(page.document.querySelectorAll('[data-exhibition-year]:not([hidden])').length, 2, 'Year and kind filters combine');
      assert.equal(page.find('[data-career-kind="group"]').getAttribute('aria-pressed'), 'true');
      page.click('[data-year="all"]');
      assert.equal(page.document.querySelectorAll('[data-exhibition-kind="group"]:not([hidden])').length, 7, 'Kind filter alone lists every group show');
      assert.equal(page.document.querySelectorAll('[data-exhibition-kind="solo"]:not([hidden])').length, 0);
      page.click('[data-career-kind="all"]');
      assert.equal(page.document.querySelectorAll('[data-exhibition-year]:not([hidden])').length, page.document.querySelectorAll('[data-exhibition-year]').length); }
    if (route === '/cuaderno/') assert.equal(page.document.querySelectorAll('.notebook-posts article').length, 6);
    if (route === '/retratos-por-encargo-bilbao/') {
      assert.equal(page.document.querySelectorAll('.commission-example').length, 4, 'Commissions landing displays 4 monumental artworks');
      assert.equal(page.document.querySelectorAll('.commission-detail-pip').length, 4, 'Every commission artwork has a macro detail PIP');
      assert.ok(page.find('.commission-horizontal-progress'), 'Commissions includes horizontal progress bar');
      assert.ok(page.find('.closing a[href^="https://wa.me/"]'), 'Commissions landing includes direct WhatsApp CTA');
      assert.ok(page.w.NAROA_COMMISSION_HORIZONTAL, 'NAROA_COMMISSION_HORIZONTAL horizontal parallax engine exposed on window');
      assert.equal(page.document.querySelectorAll('[data-commission-actor]').length, 5, 'Commissions mounts 5 real photographic cutout actors across the horizontal bridges');
      const b0 = page.w.NAROA_COMMISSION_HORIZONTAL.scrollToProgress(0.125);
      assert.equal(b0.activeBridge, 'jaio-amy', 'First horizontal bridge activates Custom Jaio -> Amy Rocks button transition');
      assert.ok(Number(page.find('[data-commission-actor="jaio-button"]').style.opacity) > 0.8, 'Jaio sewn red button cutout is visible mid-flight');
      page.w.NAROA_COMMISSION_HORIZONTAL.scrollToProgress(0.0);
      const b0Vaiven = page.w.NAROA_COMMISSION_HORIZONTAL.scrollToProgress(0.125);
      assert.equal(b0Vaiven.bridgeCounts['jaio-amy'], 2, 'Scrolling back and forth across Custom Jaio -> Amy Rocks increments vaivén counter');
      const b1 = page.w.NAROA_COMMISSION_HORIZONTAL.scrollToProgress(0.375);
      assert.equal(b1.activeBridge, 'amy-amor', 'Second horizontal bridge activates Amy Rocks -> Amor en Conserva paper roses transition');
      assert.ok(Number(page.find('[data-commission-actor="amor-purple-rose"]').style.opacity) > 0.8, 'Purple paper rose cutout floats across Amy -> Amor bridge');
      assert.ok(Number(page.find('[data-commission-actor="amor-red-rose"]').style.opacity) > 0.7, 'Crimson paper rose cutout floats across Amy -> Amor bridge');
      const b2 = page.w.NAROA_COMMISSION_HORIZONTAL.scrollToProgress(0.625);
      assert.equal(b2.activeBridge, 'amor-rara', 'Third horizontal bridge activates Amor en Conserva -> Rara Avis white Calla lily transition');
      assert.ok(Number(page.find('[data-commission-actor="amor-calla"]').style.opacity) > 0.8, 'White Calla lily cutout arcs toward Rara Avis');
      const b3 = page.w.NAROA_COMMISSION_HORIZONTAL.scrollToProgress(0.875);
      assert.equal(b3.activeBridge, 'rara-closing', 'Fourth horizontal bridge activates Rara Avis -> Closing iridescent peacock feather transition');
      assert.ok(Number(page.find('[data-commission-actor="rara-peacock"]').style.opacity) > 0.8, 'Iridescent peacock feather cutout floats into closing stage');
      const hParallax = page.w.NAROA_COMMISSION_HORIZONTAL.scrollToProgress(0.5);
      assert.equal(hParallax.backend, 'substep-horizontal-parallax-v1', 'Commissions uses substep horizontal parallax backend');
      assert.ok(hParallax.translateX < 0, 'Scrolling advances horizontal parallax track');
      assert.equal(hParallax.hasDetailPips, 4, 'Telemetry reports 4 detail pips active in horizontal parallax');
      assert.equal(hParallax.cutoutActors, 5, 'Telemetry reports 5 real photographic cutout actors');
      assert.equal(hParallax.dots, 5, 'Horizontal progress dock includes 5 dots covering 4 works + closing stage');
      assert.equal(page.document.querySelectorAll('.commission-support-tag').length, 4, 'Every commission showcase card displays its tactile material badge');
      assert.equal(page.document.querySelectorAll('.commission-seed-btn[data-pick-support]').length, 4, 'Every commission showcase card includes a direct material-seed CTA to #configurador');
      page.click('.commission-seed-btn[data-pick-support="Pizarra natural rústica"]');
      assert.equal(page.w.NAROA_COMMISSION.getState().selectedSupport, 'Pizarra natural rústica', 'Clicking showcase material seed button pre-selects support in #configurador');
      assert.ok(page.find('#cfg-swatch-cutout').getAttribute('src').includes('commission-amor-red-rose.webp'), 'Order card swatch updates to match selected support');
      assert.equal(page.document.querySelectorAll('.enc-sentence [data-cfg-cycle]').length, 3, 'The commission sentence exposes three tappable words (who, material, timing)');
      assert.equal(page.find('[data-cfg-cycle="support"]').textContent, 'pizarra natural', 'The sentence word follows a material picked from the showcase');
      page.click('[data-cfg-cycle="support"]');
      assert.equal(page.w.NAROA_COMMISSION.getState().selectedSupport, 'Caja personalizada u objeto', 'Tapping the material word advances to the next support');
      assert.equal(page.find('[data-cfg-cycle="support"]').textContent, 'una lata de conserva', 'The tapped word is rewritten inside the sentence');
      page.click('[data-cfg-cycle="timing"]'); page.click('[data-cfg-cycle="timing"]');
      assert.equal(page.w.NAROA_COMMISSION.getState().selectedTiming, 'Sin prisa (2 a 4 semanas)', 'Tapping past the last option wraps back to the first');
      page.find('[data-cfg-cycle="motif"]').dispatchEvent(new page.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      assert.equal(page.w.NAROA_COMMISSION.getState().selectedMotif, 'Pareja o familia', 'Sentence words respond to the keyboard');
      assert.ok(page.find('#cfg-preview').textContent.includes('Caja personalizada u objeto') && page.find('#cfg-preview').textContent.includes('Pareja o familia'), 'The WhatsApp draft follows the sentence');
      page.w.NAROA_COMMISSION.setNote('Canción de Robe y entradas del concierto');
      assert.ok(page.find('#cfg-preview').textContent.includes('Canción de Robe y entradas del concierto'), 'Personal story note is interpolated live into the handwritten order preview');
      assert.ok(decodeURIComponent(page.find('#cfg-whatsapp-btn').getAttribute('href')).includes('Canción de Robe'), 'Personal story note is encoded into the WhatsApp CTA URL');
      assert.ok(page.find('[data-atelier-mobile-cta]'), 'Sticky mobile commission CTA bar is mounted in DOM');
      page.click('#cfg-copy-btn');
      await page.flush();
      assert.ok(page.w.NAROA_COMMISSION.getState().lastCopiedMessage.includes('Aupa Naroa!'), 'Copy button captures the live handwritten draft');
      assert.ok(page.w.NAROA_ATTRIBUTION, 'First-party attribution telemetry exposed on window');
      assert.ok(page.w.WebMCP, 'WebMCP interface exposed on window');
      const catalogResults = await page.w.WebMCP.callTool('search_catalogue', { query: 'pizarra' });
      assert.ok(catalogResults.length > 0, 'WebMCP search_catalogue returns matches');
      const amyDetails = await page.w.WebMCP.callTool('get_artwork_details', { slug: 'amy-rocks' });
      assert.equal(amyDetails.slug, 'amy-rocks', 'WebMCP get_artwork_details returns target artwork');
      const configInquiry = await page.w.WebMCP.callTool('configure_commission_inquiry', { support: 'Pizarra natural rústica', motif: 'Retrato individual', note: 'Boda en Getxo' });
      assert.ok(configInquiry.whatsapp_url.includes('wa.me'), 'WebMCP configure_commission_inquiry generates valid WhatsApp URL');
      assert.equal(configInquiry.note, 'Boda en Getxo', 'WebMCP configure_commission_inquiry preserves custom note');
      const faqReply = await page.w.WebMCP.callTool('answer_commission_faq', { topic: 'precios' });
      assert.ok(faqReply.answer.includes('Presupuesto cerrado'), 'WebMCP answer_commission_faq resolves pricing intent in O(1)');
      const artistProfile = await page.w.WebMCP.callTool('get_artist_profile');
      assert.equal(artistProfile.name, 'Naroa Gutiérrez Gil', 'WebMCP get_artist_profile returns artist name');
      assert.equal(artistProfile.entity_id, 'https://naroagutierrezgil.com/#artist', 'WebMCP get_artist_profile returns canonical entity ID');
      assert.equal(artistProfile.studio_id, 'https://naroagutierrezgil.com/#studio', 'WebMCP get_artist_profile returns canonical studio ID');
      assert.ok(page.find('[data-fluid-canvas]'), 'Navier-Stokes FBO fluid canvas is mounted');
      assert.ok(page.w.NAROA_FLUID, 'NAROA_FLUID Eulerian solver API is exposed on window');
      page.w.NAROA_FLUID.pulseCenter();
      const fluidTelemetry = page.w.NAROA_FLUID.getState();
      assert.equal(fluidTelemetry.backend, 'eulerian-fbo-pingpong', 'Fluid engine uses Eulerian FBO Ping-Pong backend');
      assert.ok(fluidTelemetry.splatCount >= 2, 'Fluid splat impulses increment splatCount');
      assert.ok(fluidTelemetry.kineticEnergy > 0, 'Fluid splat injects positive kinetic energy and vorticity');

      assert.ok(page.find('[data-portal-canvas]'), 'Secondary RenderTarget Portal Scrollytelling canvas is mounted');
      assert.ok(page.w.NAROA_SPLINE_PORTAL, 'NAROA_SPLINE_PORTAL 3D Catmull-Rom spline rig API is exposed on window');
      page.w.NAROA_SPLINE_PORTAL.pushWheel(180, 0);
      await page.flush();
      const splineTelemetry = page.w.NAROA_SPLINE_PORTAL.getState();
      assert.equal(splineTelemetry.backend, 'catmull-rom-3d-portal-fbo', 'Spline portal engine uses Catmull-Rom 3D + Portal FBO backend');
      assert.equal(splineTelemetry.waypointCount, works.length, 'Catmull-Rom 3D spline covers all resonance chambers');
      assert.ok(splineTelemetry.u > 0, 'Wheel impulse advances camera rig along the 3D Catmull-Rom spline');
      const midPose = page.w.NAROA_SPLINE_PORTAL.evaluateAt(0.015);
      assert.ok(typeof midPose.axisInversion === 'number' && typeof midPose.portalAperture === 'number', 'Spline evaluation computes axis inversion and portal aperture');
      assert.ok(page.find('[data-liquid-lens]'), 'Liquid Glass IOR refractive lens is mounted');
      assert.ok(page.w.NAROA_LIQUID_LENS, 'NAROA_LIQUID_LENS API exposed on window');
    }
    page.dom.window.close();
  }

  // Verificar #9 Iluminación Táctil Especular (V1 BRDF) + V2 Fonógrafo de Pizarra + V3 Stencil Wall + V5 Audio-Vinyl Loop 6s + Giro Atómico 720º en El Armigo Atómico (Obra 25/85)
  {
    const armigoPage = create('/obra/el-armigo-atomico/', false, { width: 1280, height: 800 }, null, 'on');
    await armigoPage.flush();
    assert.ok(armigoPage.w.NAROA_RELIEF, 'NAROA_RELIEF 2.5D normal-mapped specular lighting API exposed');
    armigoPage.w.NAROA_RELIEF.update(0.75, 0.25, 0.9);
    const relief = armigoPage.w.NAROA_RELIEF.getState();
    assert.equal(relief.x, 75, 'Tactile relief updates specular X coordinate');
    assert.equal(relief.backend, 'micro-facet-brdf-v1', 'V1 Relief uses Micro-Facet BRDF backend');
    assert.ok(relief.micaGlint > 0 && relief.goldBrdf > 0, 'V1 BRDF computes non-zero mica glint and gold leaf specular terms');

    assert.ok(armigoPage.w.NAROA_PHONOGRAPH, 'V2 NAROA_PHONOGRAPH tactile slate sonification API exposed');
    const phono = armigoPage.w.NAROA_PHONOGRAPH.sampleAt(0.62, 0.38, 'Pizarra');
    assert.equal(phono.backend, 'slate-phonograph-dsp-v1', 'V2 Phonograph uses slate-phonograph-dsp-v1 backend');
    assert.ok(phono.roughness > 0 && phono.luminance > 0 && phono.sampleCount >= 1, 'V2 Phonograph samples micro-topography roughness and luminance');

    assert.ok(armigoPage.w.NAROA_STENCIL_WALL, 'V3 NAROA_STENCIL_WALL API exposed');
    const wipeState = armigoPage.w.NAROA_STENCIL_WALL.triggerWipe('Retratos');
    assert.equal(wipeState.backend, 'stencil-roller-wheatpaste-v1', 'V3 Stencil Wall uses stencil-roller-wheatpaste-v1 backend');
    assert.equal(wipeState.activeFilter, 'Retratos', 'V3 Stencil Roller Wipe updates active filter ink');
    const peelState = armigoPage.w.NAROA_STENCIL_WALL.peelCard('el-armigo-atomico', 0.8, 0.2);
    assert.equal(peelState.peeledSlug, 'el-armigo-atomico', 'V3 Wheatpaste Peel targets requested index card');
    assert.ok(peelState.tapeLift < 0, 'V3 Wheatpaste Peel lifts masking tape and tilts 3D card');

    assert.ok(armigoPage.find('[data-remix-video-loop]'), 'V5 Story 9:16 Audio-Vinyl Loop 6s button mounted in DOM');
    assert.ok(armigoPage.w.NAROA_STORY_LOOP, 'V5 NAROA_STORY_LOOP API exposed');
    const loopResult = await armigoPage.w.NAROA_STORY_LOOP.record('el-armigo-atomico', 1200);
    assert.equal(loopResult.backend, 'canvas-capture-mediastream-v1', 'V5 Story Loop uses canvas-capture-mediastream-v1 backend');
    assert.equal(loopResult.lastRecordedSlug, 'el-armigo-atomico', 'V5 Story Loop records target artwork slug');
    assert.ok(loopResult.framesRendered >= 12 && loopResult.notesScheduled >= 3 && loopResult.melodyName === 'Apirila', 'V5 Story Loop renders orbital macro frames and takes an excerpt of the soundtrack');

    assert.ok(armigoPage.find('[data-journey-cue]').textContent.includes('720°'), 'El Armigo Atómico displays 720° atomic spin cue');
    const armigoScene = armigoPage.find('.art-scene[data-work="el-armigo-atomico"]');
    assert.ok(armigoScene.classList.contains('is-armigo-spinning'), 'El Armigo Atómico triggers 720° spin on arrival');

    assert.ok(armigoPage.w.NAROA_KINETICS, 'NAROA_KINETICS telemetry API exposed');
    const kinInit = armigoPage.w.NAROA_KINETICS.getState();
    assert.equal(kinInit.backend, 'c5-substep-inertial-kinetics-v6', 'Kinetics uses C5 substep inertial kinetics v6 backend');
    assert.equal(kinInit.scrollFeel, 'critically-damped-substep-v6', 'Critically-damped 2nd-order velocity blending v6 is active');
    assert.equal(kinInit.substepScroll, true, 'Substep scroll is active');
    assert.equal(kinInit.holdOpticalBreath, true, 'Continuous optical breath during viewing hold is active');
    assert.equal(kinInit.zeroScrollLock, true, 'Zero scroll hijacking lock is enforced');
    assert.equal(kinInit.microPan25D, true, '2.5D micro-pan is active on gallery');
    assert.equal(kinInit.springPan2ndOrder, true, '2nd-order spring-damped pointer micro-inertia is active');
    assert.equal(kinInit.velocityDepthCoupling, true, 'Optical velocity depth coupling is active');
    assert.equal(kinInit.differentialLayerParallax, true, 'Multi-layer differential parallax is active');
    assert.equal(kinInit.fluidScrollCoupling, true, 'Scroll-to-Navier-Stokes fluid vorticity coupling is active');
    assert.equal(kinInit.secondOrderMagnet, true, '2nd-order dt-invariant magnetic spring-damper is active');
    assert.equal(kinInit.secondOrderSpline, true, '2nd-order dt-invariant Catmull-Rom 3D spline rig is active');
    assert.equal(kinInit.secondOrderLens, true, '2nd-order dt-invariant Liquid Glass IOR lens is active');
    assert.equal(armigoPage.find('[data-gallery]').style.getPropertyValue('--velocity-depth'), '0px', '--velocity-depth converges to 0px at rest');
    assert.equal(armigoPage.find('[data-gallery]').style.getPropertyValue('--velocity-tilt-x'), '0deg', '--velocity-tilt-x converges to 0deg at rest');
    assert.equal(kinInit.gyroPan3D, true, '3D gyroscopic tilt is active on gallery');
    assert.equal(kinInit.indexGaussianWave, true, 'Gaussian proximity wave is active on vertical index spine');
    assert.ok(kinInit.magneticCount >= 6, 'Magnetic spring-damper controls registered');
    const activeIndexBtn = armigoPage.find('[data-select][aria-pressed="true"]');
    assert.equal(Number(activeIndexBtn.style.getPropertyValue('--index-proximity')), 1, 'Active index button has peak Gaussian proximity wave');
    armigoPage.find('[data-gallery]').dispatchEvent(new armigoPage.w.MouseEvent('pointermove', { bubbles: true, clientX: 220, clientY: 160 }));
    await armigoPage.flush();
    const kinPan = armigoPage.w.NAROA_KINETICS.getState();
    assert.ok(Math.abs(kinPan.panX) > 1 && Math.abs(kinPan.panY) > 1, '2.5D micro-pan suspends artwork in response to resting pointer');
    assert.ok(Math.abs(kinPan.panRx) > 0.2 && Math.abs(kinPan.panRy) > 0.2, '3D perspective tilt rotates artwork plane at rest');
    const splatsBeforeScroll = armigoPage.w.NAROA_FLUID.getState().splatCount;
    armigoPage.scroll(25.55);
    await armigoPage.flush();
    assert.ok(armigoPage.w.NAROA_FLUID.getState().splatCount > splatsBeforeScroll, 'Camera scroll momentum injects laminar vorticity splats into NAROA_FLUID');
    assert.equal(armigoPage.find('[data-gallery]').style.getPropertyValue('--velocity-depth'), '0px', '--velocity-depth returns to 0px after scroll settles');
    armigoPage.dom.window.close();

    const julioPage = create('/obra/julio-iglesias-como-un-reloj-suizo/', false, { width: 1280, height: 800 }, null, 'on');
    await julioPage.flush();
    const julioRig = julioPage.find('.art-scene[data-work="julio-iglesias-como-un-reloj-suizo"] [data-julio-rig]');
    assert.ok(julioRig, 'Julio Iglesias mounts SVG articulated puppet rig');
    const julioArm = julioRig.querySelector('[data-julio-arm]');
    assert.ok(julioArm && julioArm.getAttribute('transform')?.includes('1022 1317'), 'Julio Iglesias articulated arm pivots around elbow rivet (1022, 1317)');
    julioPage.dom.window.close();

    const portalAudio = audioBoundary();
    const portalEncargos = create('/retratos-por-encargo-bilbao/', false, { width: 1280, height: 800 }, portalAudio);
    await portalEncargos.flush();
    portalEncargos.click('[data-sound]'); await portalEncargos.flush();
    assert.equal(portalEncargos.w.NAROA_SCORE.playing, true, 'The same soundtrack plays on editorial pages');
    assert.equal(portalAudio.requests.length, 0, 'Editorial pages download no audio either');
    portalEncargos.click('[data-sound]'); portalAudio.advance(6000);
    portalEncargos.dom.window.close();
  }
  {
    // Miradas por permanencia: 2,5 s con el scroll parado en una obra con varias fotos cambian la imagen.
    const clock = audioBoundary(), lingered = create('/', false, { width: 1024, height: 768 }, clock);
    await lingered.flush();
    const shown = index => lingered.find(`[data-scene="${index}"] img`).getAttribute('src');
    const stem = photo => photo.src.replace(/-view\.webp$/, '-w');
    const ticks = () => lingered.find('.art-dwell-ticks');
    const idle = async ms => { clock.advance(ms); await lingered.flush(); };
    const plain = (p, i) => i > 0 && !p.interaction && p.slug !== 'can-dy-queen' && p.photos[0].src === p.cover;
    const many = works.findIndex((p, i) => plain(p, i) && p.photos.length === 3);
    const single = works.findIndex((p, i) => plain(p, i) && p.photos.length === 1);
    assert.ok(many > 0 && single > 0, 'The catalogue has both multi-photo and single-photo works to linger on');
    const hero = shown(0);
    await idle(9000);
    assert.equal(shown(0), hero, 'The opening portrait never rotates');
    assert.equal(ticks().hidden, true, 'The opening portrait carries no photo marks');
    lingered.scroll(many); await lingered.flush();
    const cover = shown(many);
    assert.ok(cover.includes(stem(works[many].photos[0])), 'A work opens on its main photograph');
    assert.equal(ticks().hidden, false);
    assert.equal(ticks().children.length, 3, 'One mark per photograph');
    await idle(2499);
    assert.equal(shown(many), cover, 'Nothing changes before 2.5 s of stillness');
    await idle(1);
    assert.ok(shown(many).includes(stem(works[many].photos[1])), 'After 2.5 s the scene shows the next photograph of the same work');
    assert.equal(ticks().children[1].classList.contains('is-on'), true, 'The marks follow the photograph on screen');
    assert.ok(lingered.find(`[data-scene="${many}"] img`).alt.includes(works[many].photos[1].caption), 'The description follows the photograph');
    assert.ok(lingered.document.querySelectorAll('.art-scene img[src]').length <= 3, 'Lingering adds no decoded image to the stage');
    assert.equal(lingered.find('[data-art-title]').textContent, works[many].title);
    await idle(3399);
    assert.ok(shown(many).includes(stem(works[many].photos[1])), 'Each photograph stays for its fade plus another 2.5 s');
    await idle(1);
    assert.ok(shown(many).includes(stem(works[many].photos[2])), 'It keeps rotating while the visitor stays');
    await idle(3400);
    assert.equal(shown(many), cover, 'After the last photograph it returns to the first');
    await idle(3400);
    assert.ok(shown(many).includes(stem(works[many].photos[1])));
    lingered.w.scrollTo({ top: lingered.distance(many) + 40 }); await lingered.flush();
    assert.equal(shown(many), cover, 'Moving the scroll brings the main photograph back');
    assert.equal(ticks().children[0].classList.contains('is-on'), true);
    await idle(2499);
    assert.equal(shown(many), cover, 'Moving restarts the 2.5 s count');
    await idle(1);
    assert.ok(shown(many).includes(stem(works[many].photos[1])));
    lingered.click('[data-open-story]'); await idle(9000);
    assert.ok(shown(many).includes(stem(works[many].photos[1])), 'An open dialog freezes the rotation');
    lingered.click('#story-dialog [data-close-dialog]'); await idle(2500);
    assert.ok(shown(many).includes(stem(works[many].photos[2])), 'Closing the dialog resumes it');
    lingered.click('[data-quiet]'); await lingered.flush();
    assert.equal(shown(many), cover, '"Solo obra" shows the main photograph');
    await idle(9000);
    assert.equal(shown(many), cover, '"Solo obra" stays still');
    lingered.click('[data-restore]'); await idle(2500);
    assert.ok(shown(many).includes(stem(works[many].photos[1])), 'Leaving "Solo obra" resumes the rotation');
    lingered.scroll(many + 1); await lingered.flush();
    assert.equal(shown(many), cover, 'The work left behind is back on its main photograph');
    assert.ok(shown(many + 1).includes(stem(works[many + 1].photos.find(photo => photo.src === works[many + 1].cover))), 'The next work starts on its main photograph');
    lingered.scroll(single); await lingered.flush();
    const only = shown(single);
    await idle(9000);
    assert.equal(shown(single), only, 'A work with a single photograph never changes');
    assert.equal(ticks().hidden, true, 'A single photograph needs no marks');
    const finale = works.findIndex(p => p.slug === 'game-over');
    assert.ok(works[finale].photos.length > 1);
    lingered.scroll(finale); await lingered.flush();
    const blackout = shown(finale);
    assert.equal(ticks().hidden, true, 'Game Over carries no photo marks');
    await idle(2500);
    assert.equal(shown(finale), blackout, 'Game Over stays still');
    lingered.dom.window.close();
    const stillClock = audioBoundary(), stilled = create('/', true, { width: 1024, height: 768 }, stillClock);
    await stilled.flush(); stilled.scroll(many); await stilled.flush();
    const stillCover = stilled.find(`[data-scene="${many}"] img`).getAttribute('src');
    stillClock.advance(9000); await stilled.flush();
    assert.equal(stilled.find(`[data-scene="${many}"] img`).getAttribute('src'), stillCover, 'Reduced motion never changes the photograph by itself');
    assert.equal(stilled.find('.art-dwell-ticks').hidden, true);
    stilled.dom.window.close();
    // Enlace directo: la obra abierta rota igual, sin que el visitante haya tocado el scroll.
    const directClock = audioBoundary(), direct = create(`/obra/${works[many].slug}/`, false, { width: 1024, height: 768 }, directClock);
    await direct.flush();
    const directShown = () => direct.find(`[data-scene="${many}"] img`).getAttribute('src');
    const directCover = directShown();
    assert.equal(direct.find('[data-art-title]').textContent, works[many].title);
    assert.equal(direct.find('.art-dwell-ticks').hidden, false, 'A direct link shows the photo marks at once');
    directClock.advance(2499); await direct.flush();
    assert.equal(directShown(), directCover, 'A direct link also waits 2.5 s');
    directClock.advance(1); await direct.flush();
    assert.ok(directShown().includes(stem(works[many].photos[1])), 'A direct link rotates without any scroll');
    direct.dom.window.close();
  }
  assert.equal(manifest.projects, works.length); assert.deepEqual(errors, []);
  console.log(`PASS: ${works.length} variable camera scores, fixed viewing pauses, full-viewport vertical and horizontal seams, deterministic reverse motion, three deep iris passes, zoom and puzzle chapters; all ${works.length} artwork flows, 3 gallery eye pairs, kinetic titles, native scroll, free inertia, direct links, 3-image loading bound, search/filters, details/photos, quiet mode, reduced motion, Vaivenes, editorial reveals, responsive Naroa-to-Rara Avis pupil/iris alignment, photographic wink, cinematic deep-iris camera with continuous forward velocity across the blend, eased outward turn, reversible reveal, image-load guard, seamless continuation through all ${works.length} works, 8 additional deep eye matches embedded catalogue navigation, opt-in reactive sound fragments, speed and direction response, bounded voices, silence at rest and safe audio lifecycle.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
