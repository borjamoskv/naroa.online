/* Naroa — optional nature / musique concrète soundscape. */
(() => {
  'use strict';
  const button = document.querySelector('[data-sound]');
  if (!button) return;
  const status = document.querySelector('[data-sound-status]');
  const Audio = window.AudioContext || window.webkitAudioContext;
  let context = null, engine = null, loading = null, enabled = false, depth = 0, suspension = null;
  function message(text = '') { status.textContent = text; status.hidden = !text; }
  function paint() {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-busy', String(!!loading)); button.disabled = !!loading;
    button.setAttribute('aria-label', enabled ? 'Silenciar paisaje sonoro' : 'Activar paisaje sonoro de naturaleza');
    button.dataset.state = loading ? 'loading' : enabled ? 'playing' : 'off';
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
    const start = context.currentTime + .03;
    buffers.forEach((buffer, i) => {
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
      source.connect(i ? iris : filter); source.start(start);
    });
    return { master, nature, iris, filter };
  }
  button.addEventListener('click', () => {
    if (loading) return;
    clearTimeout(suspension);
    if (enabled) {
      enabled = false; ramp(engine.master.gain, 0, .07); paint();
      suspension = setTimeout(() => { if (!enabled) context.suspend().catch(() => {}); }, 400);
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
        enabled = true; mix(); ramp(engine.master.gain, .65, .4);
        if (document.hidden) await context.suspend();
        message();
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
    if (!context || !enabled) return;
    if (document.hidden) context.suspend().catch(() => {});
    else context.resume().catch(() => { enabled = false; paint(); message('Pulsa Sonido para volver a escuchar.'); });
  }
  document.addEventListener('visibilitychange', visibility);
  addEventListener('pagehide', () => { if (context) context.suspend().catch(() => {}); });
  addEventListener('pageshow', visibility);
  window.NAROA_SOUND = Object.freeze({
    depth(value) { depth = Math.max(0, Math.min(1, value)); if (enabled) mix(); }
  });
  paint();
})();
