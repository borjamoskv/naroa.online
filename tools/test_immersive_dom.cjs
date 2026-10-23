/* Exercise the generated site without requiring a browser or network access. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const output = path.resolve(__dirname, '../.deploy');
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'immersive/build-manifest.json')));
const errors = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function create(route = '/', reduce = false) {
  const file = path.join(output, route, 'index.html');
  let clock = 1000, time = 0, id = 0;
  const observers = [];
  const callbacks = new Map(), native = new VirtualConsole();
  native.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
    runScripts: 'outside-only', url: 'https://portfolio.test' + route, virtualConsole: native,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: reduce, addEventListener() {} });
      w.requestAnimationFrame = callback => { const token = ++id; callbacks.set(token, callback); return token; };
      w.cancelAnimationFrame = token => callbacks.delete(token);
      w.IntersectionObserver = class {
        constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
        observe(target) { this.targets.add(target); }
        unobserve(target) { this.targets.delete(target); }
      };
      w.Date.now = () => clock;
      Object.defineProperty(w.HTMLElement.prototype, 'inert', {
        get() { return this.hasAttribute('inert'); }, set(value) { this.toggleAttribute('inert', value); }
      });
      Object.defineProperty(w.HTMLImageElement.prototype, 'complete', { get: () => true });
      Object.defineProperty(w.HTMLImageElement.prototype, 'naturalWidth', { get: () => 1000 });
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
    clock += 30;
    const event = new w.WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true, ...options });
    find('[data-gallery]').dispatchEvent(event); return event;
  }
  const key = value => document.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  return { dom, w, document, find, click, flush, wheel, key, observers, gap: () => { clock += 200; } };
}

(async () => {
  const ui = create(); await ui.flush();
  const works = ui.w.NAROA_CATALOG.projects;
  assert.equal(works.length, 40);
  assert.equal(ui.find('[data-art-title]').textContent, 'Marilyn Rocks');
  assert.ok(ui.document.querySelectorAll('.art-scene img[src]').length <= 3, 'Do not eagerly decode the complete catalogue');
  const originalTransform = ui.find('.art-scene img').style.transform;
  ui.wheel(100); await ui.flush();
  assert.notEqual(ui.find('.art-scene img').style.transform, originalTransform);
  assert.equal(ui.find('[data-art-title]').textContent, 'Marilyn Rocks');
  assert.equal(ui.find('[data-scene="1"]').style.visibility, 'visible');
  assert.match(ui.find('[data-scene="1"]').style.clipPath, /^polygon\(0 [\d.]+%,100% [\d.]+%,100% 100%,0 100%\)$/);
  assert.equal(ui.find('[data-kinetic-title]').textContent, 'Rara Avis');
  assert.ok(Number(ui.find('[data-kinetic-title]').style.opacity) > 0, 'A transient title follows the transition');
  assert.ok(Number(ui.find('[data-art-copy]').style.opacity) < 1, 'Artwork captions separate from image movement');
  await wait(190); await ui.flush();
  assert.equal(ui.find('[data-art-title]').textContent, 'Rara Avis');
  assert.equal(ui.find('[data-kinetic-title]').textContent, '', 'Transient text clears when the work settles');
  assert.equal(ui.find('[data-art-copy]').style.opacity, '1');
  ui.gap();
  ui.wheel(100); await ui.flush();
  assert.match(ui.find('[data-scene="2"]').style.clipPath, /^polygon\([\d.]+% 0,100% 0,100% 100%,[\d.]+% 100%\)$/);
  assert.match(ui.find('[data-scene="2"] img').style.transform, /^translate3d\([\d.]+%,0,0\)/, 'The next work enters laterally');
  for (let i = 0; i < 11; i++) { ui.wheel(100); await ui.flush(); }
  assert.equal(ui.find('[data-art-title]').textContent, 'Amor en Conserva', 'One gesture must not skip several works');
  await wait(190); await ui.flush();
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
  console.log('PASS: all 40 artwork flows, alternating scroll reveals, kinetic titles, gesture limits, 3-image loading bound, search/filters, details/photos, quiet mode, reduced motion, Vaivenes and editorial reveals.');
})().catch(error => { console.error(error); process.exitCode = 1; });
