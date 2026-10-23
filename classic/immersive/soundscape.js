/* Naroa — scroll excites short nature / musique concrète fragments. */
(() => {
  'use strict';
  const button = document.querySelector('[data-sound]');
  if (!button) return;
  const status = document.querySelector('[data-sound-status]');
  const Audio = window.AudioContext || window.webkitAudioContext;
  let context = null, engine = null, loading = null, enabled = false, depth = 0;
  let active = false, pageActive = true, idle = null, suspension = null, waking = null, generation = 0;
  let lastY = scrollY, lastMotion = null, lastGrain = -Infinity, energy = 0, direction = 1, seed = 0;
  function message(text = '') { status.textContent = text; status.hidden = !text; }
  function paint() {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-busy', String(!!loading)); button.disabled = !!loading;
    button.setAttribute('aria-label', enabled ? 'Desactivar sonido reactivo' : 'Activar sonido reactivo de naturaleza');
    button.dataset.state = loading ? 'loading' : enabled ? active ? 'playing' : 'ready' : 'off';
  }
  function ramp(parameter, value, time = .3) {
    const now = context.currentTime;
    if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(now);
    else { parameter.cancelScheduledValues(now); parameter.setValueAtTime(parameter.value, now); }
    parameter.setTargetAtTime(value, now, time);
  }
  function mix() {
    if (!engine) return;
    ramp(engine.nature.gain, .88 - depth * .68);
    ramp(engine.iris.gain, .10 + depth * .66);
    ramp(engine.filter.frequency, 7200 - depth * 5700, .4);
  }
  function stopGrains() {
    if (!engine) return;
    engine.voices.forEach(voice => { try { voice.source.stop(); } catch {} });
    engine.voices.clear();
  }
  function rest(immediate = false) {
    clearTimeout(idle); clearTimeout(suspension); generation++;
    active = false; lastMotion = null; lastGrain = -Infinity;
    if (engine) {
      if (immediate) {
        engine.master.gain.cancelScheduledValues(context.currentTime);
        engine.master.gain.setValueAtTime(0, context.currentTime); stopGrains();
        context.suspend().catch(() => {});
      } else {
        ramp(engine.master.gain, 0, .07);
        suspension = setTimeout(() => { stopGrains(); context.suspend().catch(() => {}); }, 500);
      }
    }
    paint();
  }
  function excite() {
    const now = performance.now();
    if (!enabled || !engine || !pageActive || document.hidden || lastMotion === null || now - lastMotion > 180) return;
    ramp(engine.master.gain, .10 + energy * .48, .035);
    if (engine.panner) ramp(engine.panner.pan, direction * energy * .22, .09);
    if (now - lastGrain < 90 || engine.voices.size >= 20) return;
    lastGrain = now; seed += direction * .371;
    const start = context.currentTime + .005, voices = engine.voices;
    engine.buffers.forEach((buffer, index) => {
      const source = context.createBufferSource(), envelope = context.createGain();
      const duration = index ? .44 + depth * .28 : .32 + energy * .16;
      const rate = index ? .65 + energy * .20 - depth * .12 : .90 + energy * .18;
      const span = Math.max(.01, buffer.duration - duration * rate - .02);
      const offset = ((lastY / Math.max(1, innerHeight) * .73 + seed + index * 11.3) % span + span) % span;
      source.buffer = buffer; source.loop = false; source.playbackRate.value = rate;
      envelope.gain.setValueCurveAtTime(engine.envelope, start, duration);
      source.connect(envelope); envelope.connect(index ? engine.iris : engine.filter);
      const voice = { source, envelope }; voices.add(voice);
      source.onended = () => { voices.delete(voice); source.disconnect(); envelope.disconnect(); };
      source.start(start, offset); source.stop(start + duration);
    });
    message();
  }
  function motion() {
    const y = scrollY, delta = y - lastY; lastY = y;
    if (!enabled || !engine || !delta || !pageActive || document.hidden) return;
    const now = performance.now(), elapsed = lastMotion === null ? .08 : Math.max(.016, Math.min(.12, (now - lastMotion) / 1000));
    energy = Math.min(1, Math.sqrt(Math.abs(delta) / Math.max(1, innerHeight) / elapsed * .55));
    direction = Math.sign(delta); lastMotion = now;
    clearTimeout(idle); clearTimeout(suspension);
    idle = setTimeout(() => rest(), 160);
    if (!active) { active = true; paint(); }
    if (context.state === 'running') excite();
    else if (!waking) {
      const ticket = generation;
      waking = context.resume().then(() => { if (ticket === generation) excite(); }).catch(() => {
        enabled = false; rest(true); message('Pulsa Sonido para volver a activar la respuesta al scroll.');
      }).finally(() => { waking = null; });
    }
  }
  async function prepare() {
    const buffers = await Promise.all([button.dataset.natureSrc, button.dataset.irisSrc].map(async src => {
      const response = await fetch(src);
      if (!response.ok) throw new Error('Soundscape could not load');
      return context.decodeAudioData(await response.arrayBuffer());
    }));
    const master = context.createGain(), nature = context.createGain(), iris = context.createGain();
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 7200; filter.Q.value = .35;
    master.gain.value = 0; nature.gain.value = .88; iris.gain.value = .10;
    nature.connect(master); iris.connect(master); master.connect(context.destination);
    filter.connect(nature);
    const panner = context.createStereoPanner?.();
    if (panner) { master.disconnect(); master.connect(panner); panner.connect(context.destination); }
    const envelope = Float32Array.from({ length: 64 }, (_, i) => .7 * Math.sin(Math.PI * i / 63) ** 2);
    envelope[0] = envelope[63] = 0;
    return { master, nature, iris, filter, panner, buffers, envelope, voices: new Set() };
  }
  button.addEventListener('click', () => {
    if (loading) return;
    clearTimeout(suspension);
    if (enabled) {
      enabled = false; rest(); message();
      return;
    }
    if (!Audio) { message('El sonido no está disponible en este navegador.'); return; }
    message('Preparando el paisaje sonoro…');
    try {
      if (!context) context = new Audio();
      // Unlock the context in the click itself, before any network/decode work.
      const resumed = context.resume();
      loading = (async () => {
        await resumed;
        if (!engine) engine = await prepare();
        enabled = true; lastY = scrollY; rest(true); mix();
        message('Sonido reactivo activado. Desplázate para escucharlo.');
      })().catch(async () => {
        enabled = false;
        if (context) await context.close().catch(() => {});
        context = null; engine = null;
        message('No se pudo cargar el sonido. Vuelve a pulsar Sonido para intentarlo.');
      }).finally(() => { loading = null; paint(); });
      paint();
    } catch {
      context = null; message('No se pudo activar el sonido. Vuelve a pulsar Sonido.'); paint();
    }
  });
  function visibility() {
    lastY = scrollY;
    if (document.hidden) rest(true);
  }
  document.addEventListener('visibilitychange', visibility);
  addEventListener('scroll', motion, { passive: true });
  addEventListener('pagehide', () => { pageActive = false; rest(true); });
  addEventListener('pageshow', () => { pageActive = true; lastY = scrollY; });
  window.NAROA_SOUND = Object.freeze({
    depth(value) { depth = Math.max(0, Math.min(1, value)); if (enabled) mix(); }
  });
  paint();
})();
