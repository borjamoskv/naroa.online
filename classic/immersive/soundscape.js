/* Naroa — scroll winds an original music-box melody over quiet nature textures. */
(() => {
  'use strict';
  const button = document.querySelector('[data-sound]');
  if (!button) return;
  const status = document.querySelector('[data-sound-status]');
  const Audio = window.AudioContext || window.webkitAudioContext;
  let context = null, engine = null, loading = null, enabled = false, depth = 0;
  let active = false, pageActive = true, idle = null, suspension = null, waking = null, generation = 0;
  let lastY = scrollY, lastMotion = null, lastGrain = -Infinity, energy = 0, direction = 1, seed = 0, pendingDistance = 0;
  // Original four-phrase motif in D minor. Null steps let the mechanism breathe.
  const melody = [74,77,81,77,76,74,69,null,72,76,79,76,74,72,69,null,74,77,81,84,81,77,76,null,74,null,69,72,77,76,null,74];
  let melodyStep = -1, lastNote = -Infinity;
  function message(text = '') { status.textContent = text; status.hidden = !text; }
  function paint() {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-busy', String(!!loading)); button.disabled = !!loading;
    button.setAttribute('aria-label', enabled ? 'Desactivar caja de música' : 'Activar caja de música reactiva');
    button.dataset.state = loading ? 'loading' : enabled ? active ? 'playing' : 'ready' : 'off';
  }
  function hold(parameter) {
    const now = context.currentTime, value = parameter.value;
    if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(now);
    else { parameter.cancelScheduledValues(0); parameter.setValueAtTime(value, now); }
    return now;
  }
  function ramp(parameter, value, time = .3) {
    const now = hold(parameter);
    parameter.setTargetAtTime(value, now, time);
  }
  function rateFor(index) { return index ? .80 + energy * .12 - depth * .46 : 1 + energy * .12 - depth * .28; }
  function noteRate(note) { return Math.pow(2, (note - 74) / 12 - depth); }
  function mix() {
    if (!engine) return;
    const inside = depth * depth * (3 - 2 * depth);
    ramp(engine.nature.gain, .12 - inside * .105, .18);
    ramp(engine.iris.gain, .025 + inside * .12, .18);
    ramp(engine.music.gain, .86 + inside * .04, .18);
    ramp(engine.filter.frequency, 7600 * Math.pow(650 / 7600, inside), .18);
    ramp(engine.tone.frequency, 9200 * Math.pow(460 / 9200, inside), .18);
    ramp(engine.open.gain, 1 - inside * .94, .18);
    ramp(engine.core.gain, inside * .94, .18);
    if (engine.panner) ramp(engine.panner.pan, direction * energy * .22 * (1 - inside * .9), .12);
    engine.voices.forEach(voice => ramp(voice.source.playbackRate, voice.note === undefined ? rateFor(voice.index) : noteRate(voice.note), .12));
  }
  function playMelody(now) {
    if (now - lastNote < 360 - energy * 130 || engine.voices.size >= 18) return;
    lastNote = now;
    melodyStep = melodyStep < 0 ? 0 : (melodyStep + direction + melody.length) % melody.length;
    const note = melody[melodyStep];
    if (note === null) return;
    const source = context.createBufferSource(), envelope = context.createGain();
    const start = context.currentTime + .005;
    const duration = Math.min(1.25 + depth * .25, engine.box.duration / Math.pow(2, (note - 74) / 12) - .02);
    source.buffer = engine.box; source.loop = false; source.playbackRate.value = noteRate(note);
    envelope.gain.setValueCurveAtTime(engine.noteEnvelope, start, duration);
    source.connect(envelope); envelope.connect(engine.music);
    const voices = engine.voices, voice = { source, envelope, note }; voices.add(voice);
    source.onended = () => { voices.delete(voice); source.disconnect(); envelope.disconnect(); };
    source.start(start, 0); source.stop(start + duration);
  }
  function stopGrains() {
    if (!engine) return;
    engine.voices.forEach(voice => { try { voice.source.stop(); } catch {} });
    engine.voices.clear();
  }
  function rest(immediate = false) {
    clearTimeout(idle); clearTimeout(suspension); generation++;
    active = false; lastMotion = null; lastGrain = -Infinity; pendingDistance = 0;
    if (engine) {
      if (immediate) {
        hold(engine.master.gain);
        engine.master.gain.setValueAtTime(0, context.currentTime); stopGrains();
        context.suspend().catch(() => {});
      } else {
        const parameter = engine.master.gain, duration = .26 + depth * .22;
        hold(parameter);
        const release = Float32Array.from({ length: 64 }, (_, i) => parameter.value * .5 * (1 + Math.cos(Math.PI * i / 63)));
        release[63] = 0;
        // A future audio-clock boundary prevents the browser from clamping a
        // just-expired start time and overlapping the zero event with the curve.
        const start = context.currentTime + .02;
        parameter.setValueCurveAtTime(release, start, duration);
        parameter.setValueAtTime(0, start + duration + .001);
        suspension = setTimeout(() => { stopGrains(); context.suspend().catch(() => {}); }, duration * 1000 + 60);
      }
    }
    paint();
  }
  function excite() {
    const now = performance.now();
    if (!enabled || !engine || !pageActive || document.hidden || lastMotion === null || now - lastMotion > 200) return;
    ramp(engine.master.gain, .10 + energy * .48, .035);
    mix();
    playMelody(now);
    if (now - lastGrain < 90 || engine.voices.size >= 18) return;
    lastGrain = now; seed += direction * .371;
    const start = context.currentTime + .005, voices = engine.voices;
    engine.buffers.forEach((buffer, index) => {
      const source = context.createBufferSource(), envelope = context.createGain();
      const duration = index ? .44 + depth * .40 : .32 + energy * .16;
      const rate = rateFor(index);
      const span = Math.max(.01, buffer.duration - duration * 1.2 - .02);
      const offset = ((lastY / Math.max(1, innerHeight) * .73 + seed + index * 11.3) % span + span) % span;
      source.buffer = buffer; source.loop = false; source.playbackRate.value = rate;
      envelope.gain.setValueCurveAtTime(engine.envelope, start, duration);
      source.connect(envelope); envelope.connect(index ? engine.iris : engine.filter);
      const voice = { source, envelope, index }; voices.add(voice);
      source.onended = () => { voices.delete(voice); source.disconnect(); envelope.disconnect(); };
      source.start(start, offset); source.stop(start + duration);
    });
    message();
  }
  function motion() {
    const y = scrollY; let delta = y - lastY; lastY = y;
    if (!enabled || !engine || !delta || !pageActive || document.hidden) return;
    pendingDistance += delta;
    if (Math.abs(pendingDistance) < Math.max(active ? 1.5 : 5, innerHeight * (active ? .002 : .008))) return;
    delta = pendingDistance; pendingDistance = 0;
    const now = performance.now(), elapsed = lastMotion === null ? .08 : Math.max(.016, Math.min(.12, (now - lastMotion) / 1000));
    energy = Math.min(1, Math.sqrt(Math.abs(delta) / Math.max(1, innerHeight) / elapsed * .55));
    direction = Math.sign(delta); lastMotion = now;
    clearTimeout(idle); clearTimeout(suspension);
    idle = setTimeout(() => rest(), 180);
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
    const decoded = await Promise.all([button.dataset.natureSrc, button.dataset.irisSrc, button.dataset.musicboxSrc].map(async src => {
      const response = await fetch(src);
      if (!response.ok) throw new Error('Soundscape could not load');
      return context.decodeAudioData(await response.arrayBuffer());
    }));
    const master = context.createGain(), nature = context.createGain(), iris = context.createGain();
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 7600; filter.Q.value = .35;
    const tone = context.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 9200; tone.Q.value = .4;
    const open = context.createGain(), core = context.createGain();
    const music = context.createGain(); music.gain.value = .86; music.connect(master);
    core.channelCount = 1; core.channelCountMode = 'explicit'; core.channelInterpretation = 'speakers';
    master.gain.value = 0; nature.gain.value = .12; iris.gain.value = .025; open.gain.value = 1; core.gain.value = 0;
    nature.connect(master); iris.connect(master); master.connect(open); master.connect(core);
    open.connect(tone); core.connect(tone);
    filter.connect(nature);
    const panner = context.createStereoPanner?.();
    if (panner) { tone.connect(panner); panner.connect(context.destination); }
    else tone.connect(context.destination);
    const envelope = Float32Array.from({ length: 64 }, (_, i) => .7 * Math.sin(Math.PI * i / 63) ** 2);
    envelope[0] = envelope[63] = 0;
    const noteEnvelope = Float32Array.from({ length: 64 }, (_, i) => i === 0 ? 0 : i < 53 ? 1 : Math.cos((i - 53) / 10 * Math.PI / 2) ** 2);
    noteEnvelope[63] = 0;
    return { master, nature, iris, filter, tone, open, core, music, panner, buffers: decoded.slice(0, 2), box: decoded[2], envelope, noteEnvelope, voices: new Set() };
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
        message('Caja de música activada. Desplázate para tocar.');
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
