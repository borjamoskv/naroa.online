/* Exercise the generated site without requiring a browser or network access. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const output = path.resolve(__dirname, '../.deploy');
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'immersive/build-manifest.json')));
const errors = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function create(route = '/', reduce = false, viewport = { width: 1024, height: 768 }) {
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
  const step = w.innerHeight * .75;
  if (track) {
    const height = w.innerHeight + Number(track.style.getPropertyValue('--steps')) * step;
    track.getBoundingClientRect = () => ({ top: -w.scrollY, bottom: height - w.scrollY, height, width: viewport.width, left: 0, right: viewport.width });
    stage.getBoundingClientRect = () => ({ top: 0, bottom: w.innerHeight, height: w.innerHeight, width: viewport.width, left: 0, right: viewport.width });
  }
  const portraitTrack = document.querySelector('[data-portrait-scroll]');
  if (portraitTrack) {
    const height = w.innerHeight * (reduce ? 1 : 2.4);
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
      await Promise.resolve();
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
  ui.click('[data-fit]'); assert.equal(ui.find('[data-gallery]').classList.contains('is-fit'), true);
  assert.ok(ui.find('[data-scene="0"] img').src.endsWith(works[0].photos[0].src));
  ui.click('[data-fit]');
  ui.click('[data-open-photos]');
  assert.equal(ui.find('#photos-dialog').open, true);
  assert.ok(ui.find('[data-photo-caption]').textContent.includes('01 / 03'));
  ui.click('[data-photo-next]');
  assert.ok(ui.find('[data-photo-caption]').textContent.includes('02 / 03'));
  ui.click('#photos-dialog [data-close-dialog]');
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
    const initial = plane.style.transform;
    const wheel = new portrait.w.WheelEvent('wheel', { deltaY: 150, bubbles: true, cancelable: true });
    portrait.find('[data-eye-portrait]').dispatchEvent(wheel);
    assert.equal(wheel.defaultPrevented, false, 'Artist portrait preserves native scrolling');
    const scrollPortrait = async progress => { portrait.w.scrollTo({ top: progress * viewport.height * 1.4 }); await portrait.flush(); };
    await scrollPortrait(.6);
    assert.notEqual(plane.style.transform, initial, 'The portrait moves into its monocle eye');
    assert.equal(Number(wink.getAttribute('opacity')), 1, 'The wink closes during the approach');
    const closed = wink.getAttribute('opacity');
    await scrollPortrait(.9);
    assert.equal(Number(wink.getAttribute('opacity')), 0, 'The eye opens again before the biography');
    const pose = /translate3d\(([-\d.]+)px,([-\d.]+)px,0\) scale\(([\d.]+)\)/.exec(plane.style.transform);
    const [, tx, ty, scale] = pose.map(Number);
    assert.ok(scale > 5, 'The final framing has a pronounced eye close-up');
    const pupilX = parseFloat(plane.style.left) + tx + scale * 575 / 1248 * parseFloat(plane.style.width);
    const pupilY = parseFloat(plane.style.top) + ty + scale * 769 / 1966 * parseFloat(plane.style.height);
    assert.ok(Math.abs(pupilX - viewport.width * .5) < .03, 'The pupil is centred despite the responsive cover crop');
    assert.ok(Math.abs(pupilY - viewport.height * .46) < .03, 'The pupil remains below the navigation');
    assert.equal(portrait.find('.page-hero-copy').style.opacity, '0', 'Portrait text makes room for the eye');
    const stopped = plane.style.transform; await wait(50); await portrait.flush();
    assert.equal(plane.style.transform, stopped, 'The portrait stops when native scroll stops');
    await scrollPortrait(.6);
    assert.equal(wink.getAttribute('opacity'), closed, 'The wink reverses with scroll');
    portrait.click('[data-open-menu]'); assert.equal(portrait.find('#menu-dialog').open, true);
    portrait.click('#menu-dialog [data-close-dialog]');
    await scrollPortrait(0);
    assert.equal(plane.style.transform, initial, 'Returning to the beginning restores the full portrait');
    assert.equal(portrait.find('.page-hero-copy').style.opacity, '1');
    assert.equal(portrait.find('.hero-down').getAttribute('href'), '#contenido', 'The biography is directly reachable');
    portrait.dom.window.close();
  }
  const stillPortrait = create('/sobre-mi/', true); await stillPortrait.flush();
  stillPortrait.w.scrollTo({ top: 600 }); await stillPortrait.flush();
  assert.equal(stillPortrait.find('[data-portrait-plane]').style.transform, '');
  assert.equal(stillPortrait.find('[data-portrait-plane]').classList.contains('is-measured'), false);
  assert.equal(Number(stillPortrait.find('[data-portrait-wink]').getAttribute('opacity')), 0);
  assert.equal(stillPortrait.find('.page-hero-copy').style.opacity, '1');
  stillPortrait.dom.window.close();

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
  console.log('PASS: all 40 artwork flows, feathered depth transitions, 3 eye-to-eye pairs and mobile pupil alignment, kinetic titles, native scroll, free inertia, direct links, 3-image loading bound, search/filters, details/photos, quiet mode, reduced motion, Vaivenes, editorial reveals and responsive scroll-linked monocle zoom/wink with reduced motion.');
})().catch(error => { console.error(error); process.exitCode = 1; });
