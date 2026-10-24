/* Naroa — camera-linked music-box melody over quiet nature textures. */
(() => {
  'use strict';
  const button = document.querySelector('[data-sound]');
  if (!button) return;
  const status = document.querySelector('[data-sound-status]');
  const Audio = window.AudioContext || window.webkitAudioContext;
  const managedPage = !!document.querySelector('[data-gallery],[data-portrait-scroll]');
  let context = null, engine = null, loading = null, enabled = false, depth = 0;
  let mode = 'V', phase = 'hold', axisDirection = 1, slug = '';
  let active = false, pageActive = true, idle = null, suspension = null, waking = null, generation = 0;
  let lastY = scrollY, lastDistance = null, lastPhase = 'hold', lastSlug = '', lastHeroSlug = '', lastUtterance = '';
  let lastCameraFlashTime = 0, lastFlashSlug = '';
  let lastPunchTime = 0, lastPunchSlug = '';
  let lastMotion = null, lastGrain = -Infinity, energy = 0, direction = 1, seed = 0, pendingDistance = 0;
  // Cadencia obligatoria final: notas icónicas de SOUND OF SILENCE en Re menor microtonal
  // D5 (sound), [silencio], A4 (of), C5 (si-), F5 (-lence), E5 (resolución), [silencio], D5 (tónica)
  const SOUND_OF_SILENCE_CADENCE = [74.00, null, 69.02, 71.74, 77.24, 75.86, null, 74.00];

  // Repertorio de melodías modales en Re menor microtonal para la caja de música ("caja de muñecas").
  // Cada día de la semana tiene su tema emblemático, culminando siempre en SOUND OF SILENCE:
  const DAILY_MELODIES = [
    {
      name: 'Landa (Alboka clásica de Arratia)',
      day: 'Lunes',
      notes: [
        74.00, 77.24, 81.02, 77.24, 75.86, 74.00, 69.02, null,
        71.74, 75.86, 78.98, 75.86, 74.00, 71.74, 69.02, null,
        74.00, 77.24, 81.02, 83.74, 81.02, 77.24, 75.86, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      name: 'Haurtxo Polita (Nana tradicional de cuna)',
      day: 'Martes',
      notes: [
        69.02, 74.00, 75.86, 77.24, 75.86, 74.00, null, 74.00,
        77.24, 78.98, 81.02, 78.98, 77.24, 75.86, null, 75.86,
        74.00, 71.74, 69.02, 71.74, 74.00, 77.24, 75.86, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      name: 'Harria eta Marea (Piedra y Marea)',
      day: 'Miércoles',
      notes: [
        74.00, 69.02, 77.24, 74.00, 78.98, 75.86, 74.00, null,
        71.74, 74.00, 75.86, 74.00, 69.02, 71.74, 74.00, null,
        77.24, 81.02, 86.00, 81.02, 77.24, 75.86, 74.00, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      name: 'Txoria Txori (Mikel Laboa)',
      day: 'Jueves',
      notes: [
        74.00, 77.24, 75.86, 74.00, 71.74, 74.00, 69.02, null,
        71.74, 74.00, 75.86, 77.24, 75.86, 74.00, 71.74, null,
        77.24, 81.02, 77.24, 75.86, 74.00, 69.02, 71.74, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      name: 'Mi Gran Noche (Raphael)',
      day: 'Viernes',
      notes: [
        69.02, 74.00, 77.24, 75.86, null, 69.02, 74.00, 77.24,
        75.86, null, 74.00, 75.86, 77.24, 78.98, 77.24, 75.86,
        74.00, 77.24, 81.02, 78.98, 77.24, 75.86, 74.00, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      name: 'Gaua (Nocturno de Bilbao)',
      day: 'Sábado',
      notes: [
        74.00, 71.74, 69.02, null, 74.00, 77.24, 75.86, 74.00,
        69.02, 74.00, 77.24, 78.98, 81.02, 77.24, 74.00, null,
        81.02, 83.74, 81.02, 77.24, 75.86, 71.74, 69.02, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      name: 'Haizea (Viento en los pinos)',
      day: 'Domingo',
      notes: [
        74.00, 77.24, 81.02, 86.00, 81.02, 77.24, 74.00, null,
        78.98, 75.86, 74.00, 69.02, 71.74, 75.86, 74.00, null,
        77.24, 81.02, 78.98, 77.24, 75.86, 74.00, 69.02, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    }
  ];

  const SESSION_MELODIES = DAILY_MELODIES.map(m => m.notes);

  function pickDailyMelody() {
    try {
      const ua = (typeof window !== 'undefined' && window.navigator?.userAgent) || (typeof navigator !== 'undefined' && navigator.userAgent) || '';
      if (/jsdom|node/i.test(ua)) {
        return { melody: DAILY_MELODIES[0].notes, index: 0, meta: DAILY_MELODIES[0] };
      }
      if (typeof window !== 'undefined' && window.location?.search) {
        const match = /[?&]melody=(\d+)/.exec(window.location.search);
        if (match) {
          const idx = parseInt(match[1], 10) % DAILY_MELODIES.length;
          return { melody: DAILY_MELODIES[idx].notes, index: idx, meta: DAILY_MELODIES[idx] };
        }
      }
      const now = new Date();
      // Monday = 0, Tuesday = 1, ... Sunday = 6
      const dayOfWeek = (now.getDay() + 6) % 7;
      const item = DAILY_MELODIES[dayOfWeek] || DAILY_MELODIES[0];
      return { melody: item.notes, index: dayOfWeek, meta: item };
    } catch {
      return { melody: DAILY_MELODIES[0].notes, index: 0, meta: DAILY_MELODIES[0] };
    }
  }

  const { melody, index: activeMelodyIndex, meta: activeMelodyMeta } = pickDailyMelody();
  let melodyStep = -1, lastNote = -Infinity, noteDistance = 0;
  const menuScale = [74.00, 77.24, 81.02, 77.24, 75.86, 74.00, 69.02];
  let lastMenuNoteIndex = -1, lastMenuNoteTime = -Infinity;
  function playMenuNote(index = 0) {
    const idx = ((Number(index) || 0) % menuScale.length + menuScale.length) % menuScale.length;
    lastMenuNoteIndex = idx;
    if (!enabled || !engine || !context || !pageActive || document.hidden) return;
    const now = performance.now();
    if (now - lastMenuNoteTime < 75) return;
    lastMenuNoteTime = now;
    const strike = () => {
      if (!enabled || !engine || !context) return;
      const bells = [...engine.voices].filter(voice => voice.note !== undefined).length;
      if (engine.voices.size >= 12 || bells >= 3) return;
      clearTimeout(idle); clearTimeout(suspension);
      idle = setTimeout(() => rest(), 240);
      if (!active) { active = true; paint(); }
      ramp(engine.master.gain, Math.max(engine.master.gain.value || 0, .18), .035);
      const note = menuScale[idx];
      const source = context.createBufferSource(), envelope = context.createGain();
      const start = context.currentTime + .005;
      const rate = Math.pow(2, (note - 74) / 12);
      const duration = Math.min(1.05, engine.box.duration / rate - .02);
      source.buffer = engine.box; source.loop = false; source.playbackRate.value = rate;
      const curve = Float32Array.from(engine.noteEnvelope, level => level * .44);
      envelope.gain.setValueCurveAtTime(curve, start, duration);
      source.connect(envelope); envelope.connect(engine.music);
      const voices = engine.voices, voice = { source, envelope, note }; voices.add(voice);
      source.onended = () => { voices.delete(voice); source.disconnect(); envelope.disconnect(); };
      source.start(start, 0); source.stop(start + duration);
    };
    if (context.state === 'running') strike();
    else if (!waking) {
      const ticket = generation;
      waking = context.resume().then(() => { if (ticket === generation) strike(); }).catch(() => {}).finally(() => { waking = null; });
    }
  }
  function resolveCadence() {
    if (!enabled || !engine || !context || context.state !== 'running') return;
    const note = 74.00;
    const source = context.createBufferSource(), envelope = context.createGain();
    const start = context.currentTime + .002;
    const rate = Math.pow(2, (note - 74) / 12);
    const duration = Math.min(1.2, engine.box.duration / rate - .02);
    source.buffer = engine.box; source.loop = false; source.playbackRate.value = rate;
    const curve = Float32Array.from(engine.noteEnvelope, level => level * .28);
    envelope.gain.setValueCurveAtTime(curve, start, duration);
    source.connect(envelope); envelope.connect(engine.music);
    const voices = engine.voices, voice = { source, envelope, note }; voices.add(voice);
    source.onended = () => { voices.delete(voice); source.disconnect(); envelope.disconnect(); };
    source.start(start, 0); source.stop(start + duration);
  }
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
  function rateFor(index) {
    const zoomDepth = mode === 'E' ? depth : mode === 'Z' ? depth * .45 : 0;
    return index ? .80 + energy * .10 - zoomDepth * .46 : 1 + energy * .10 - zoomDepth * .28;
  }
  function noteRate(note) {
    const octave = (mode === 'E' || mode === 'Z') && depth >= .35 ? 1 : 0;
    return Math.pow(2, (note - 74) / 12 - octave);
  }
  function mix() {
    if (!engine) return;
    const inside = depth * depth * (3 - 2 * depth);
    const feline = slug === 'el-gato-que-es-kutxa' && phase === 'transition';
    ramp(engine.nature.gain, .22 - inside * .16, .18);
    ramp(engine.iris.gain, .035 + inside * .13, .18);
    ramp(engine.music.gain, .55, .18);
    const filterTarget = feline ? 1320 : mode === 'P' ? 8200 : 7600 * Math.pow(650 / 7600, inside);
    ramp(engine.filter.frequency, filterTarget, .18);
    ramp(engine.filter.Q, feline ? 2.4 : .35, .18);
    ramp(engine.tone.frequency, 9200 * Math.pow(460 / 9200, inside), .18);
    ramp(engine.open.gain, 1 - inside * .94, .18);
    ramp(engine.core.gain, inside * .94, .18);
    ramp(engine.roomGain.gain, .18 * (1 - inside * .92), inside > .25 ? .16 : .26);
    ramp(engine.roomTone.frequency, 4200 * Math.pow(900 / 4200, inside), .20);
    if (engine.panner) {
      const width = mode === 'H' ? .14 : mode === 'P' ? .10 : .08;
      ramp(engine.panner.pan, axisDirection * direction * width * (.35 + energy * .65) * (1 - inside * .9), .12);
    }
    // Keep already-sounding music-box notes in tune; only concrete textures glide with camera depth.
    engine.voices.forEach(voice => {
      if (voice.note === undefined) ramp(voice.source.playbackRate, rateFor(voice.index), .12);
    });
  }
  function playMelody(now) {
    const bells = [...engine.voices].filter(voice => voice.note !== undefined).length;
    const minGap = 700 - energy * 250;
    if (now - lastNote < minGap || engine.voices.size >= 12 || bells >= 3 || (melodyStep >= 0 && noteDistance < .10)) return;
    lastNote = now;
    noteDistance = 0;
    melodyStep = melodyStep < 0 ? 0 : (melodyStep + direction + melody.length) % melody.length;
    const note = melody[melodyStep];
    if (note === null) return;
    const source = context.createBufferSource(), envelope = context.createGain();
    const start = context.currentTime + .005;
    const rate = noteRate(note);
    const duration = Math.min(1.15 + depth * .20, engine.box.duration / Math.pow(2, (note - 74) / 12) - .02);
    source.buffer = engine.box; source.loop = false; source.playbackRate.value = rate;
    const accent = melodyStep % 8 === 0 ? 1 : melodyStep % 4 === 2 ? .82 : .91;
    const velocity = (.56 + energy * .22) * accent;
    const curve = Float32Array.from(engine.noteEnvelope, level => level * velocity);
    envelope.gain.setValueCurveAtTime(curve, start, duration);
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
    if (immediate) { try { window.speechSynthesis?.cancel?.(); } catch {} }
    if (engine) {
      if (immediate) {
        hold(engine.master.gain);
        engine.master.gain.setValueAtTime(0, context.currentTime); stopGrains();
        context.suspend().catch(() => {});
      } else {
        const parameter = engine.master.gain, duration = .18 + depth * .18;
        hold(parameter);
        const release = Float32Array.from({ length: 64 }, (_, i) => parameter.value * .5 * (1 + Math.cos(Math.PI * i / 63)));
        release[63] = 0;
        const start = context.currentTime + .01;
        parameter.setValueCurveAtTime(release, start, duration);
        parameter.setValueAtTime(0, start + duration + .001);
        suspension = setTimeout(() => { stopGrains(); context.suspend().catch(() => {}); }, Math.round((duration + .025) * 1000));
      }
    }
    paint();
  }
  function speakHero() {}
  function speakDenbora() {}
  function speakSilence() {}
  let lastShakerSlug = '';
  function playSugarShaker() {}
  let lastPuzzleSlug = '', lastClockSlug = '';
  function playPuzzleSnap() {
    lastPuzzleSlug = 'saio-puzzle';
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([12, 10, 18]); } catch {}
    }
    if (!context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.002;
      const target = engine.compressor || engine.master;
      const sampleRate = context.sampleRate || 44100;
      [0.00, 0.016].forEach((offset, idx) => {
        const len = Math.round(sampleRate * 0.035);
        const buf = context.createBuffer(1, len, sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          data[i] = (Math.random() * 2 - 1) * Math.exp(-t * (idx === 0 ? 12 : 9));
        }
        const src = context.createBufferSource();
        src.buffer = buf;
        const filter = context.createBiquadFilter ? context.createBiquadFilter() : null;
        if (filter) {
          filter.type = 'bandpass';
          filter.frequency.value = idx === 0 ? 2100 : 2850;
          filter.Q.value = 4.2;
        }
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.01, now + offset);
        gain.gain.linearRampToValueAtTime(idx === 0 ? 0.42 : 0.65, now + offset + 0.003);
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.032);
        }
        src.connect(filter || gain);
        if (filter) filter.connect(gain);
        gain.connect(target);
        src.start(now + offset);
      });
    } catch {}
  }
  function playSwissClock() {
    lastClockSlug = 'julio-iglesias-como-un-reloj-suizo';
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([8, 240, 6]); } catch {}
    }
    if (!context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.002;
      const target = engine.compressor || engine.master;
      [
        { offset: 0.00, freq: 3400, vol: 0.45 },
        { offset: 0.26, freq: 2750, vol: 0.38 }
      ].forEach(({ offset, freq, vol }) => {
        if (typeof context.createOscillator === 'function') {
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + offset);
          gain.gain.setValueAtTime(0.001, now + offset);
          gain.gain.linearRampToValueAtTime(vol, now + offset + 0.002);
          if (gain.gain.exponentialRampToValueAtTime) {
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.022);
          }
          osc.connect(gain);
          gain.connect(target);
          osc.start(now + offset);
          osc.stop(now + offset + 0.025);
        }
      });
    } catch {}
  }
  let lastWineSlug = '';
  function playWineGlassClink() {
    lastWineSlug = 'red-red-wine';
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([10, 30, 15]); } catch {}
    }
    if (!context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.002;
      const target = engine.compressor || engine.master;
      [
        { freq: 2093.0, vol: 0.55, decay: 1.35 },
        { freq: 2793.8, vol: 0.38, decay: 0.95 },
        { freq: 4186.0, vol: 0.22, decay: 0.55 }
      ].forEach(({ freq, vol, decay }) => {
        if (typeof context.createOscillator === 'function') {
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(vol, now + 0.003);
          if (gain.gain.exponentialRampToValueAtTime) {
            gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
          }
          osc.connect(gain);
          gain.connect(target);
          osc.start(now);
          osc.stop(now + decay + 0.05);
        }
      });
    } catch {}
  }
  let lastWinkSlug = '';
  function playPortraitWink() {
    lastWinkSlug = 'naroa-monoculo';
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([8, 20, 12]); } catch {}
    }
    if (!context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.002;
      const target = engine.compressor || engine.master;
      if (typeof context.createOscillator === 'function') {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2400, now);
        if (osc.frequency.exponentialRampToValueAtTime) {
          osc.frequency.exponentialRampToValueAtTime(1400, now + 0.035);
        }
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.24, now + 0.003);
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        }
        osc.connect(gain);
        gain.connect(target);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch {}
  }
  let lastDeltoyaSlug = '';
  function playDeltoya() {
    lastDeltoyaSlug = 'entre-tantas-flores-de-dia';
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([20, 40, 20]); } catch {}
    }
    const audioSrc = button?.dataset?.deltoyaSrc || '/audio/robe-riff.mp3';
    try {
      const audio = new window.Audio(audioSrc);
      audio.volume = 0.95;
      audio.play().catch(() => {});
    } catch {}
  }
  let lastGameOverSlug = '';
  function play8BitGameOver() {
    lastGameOverSlug = 'game-over';
    // Game Over clausura el recorrido en silencio contemplativo absoluto:
    // Cero sintetizador 8-bit arcade, respeto a la quietud y el reposo del museo.
  }
  function playCameraFlash() {
    lastFlashSlug = 'ajenjo-cam';
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([18, 25, 14, 60, 45]); } catch {}
    }
    const audioSrc = button?.dataset?.cameraSrc || '/audio/polaroid-shutter.mp3';
    try {
      const audio = new window.Audio(audioSrc);
      audio.volume = 0.95;
      audio.play().catch(() => {});
    } catch {}
    if (!context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.002;
      const target = engine.compressor || engine.master;
      const sampleRate = context.sampleRate || 44100;

      // Stage 1: Mirror slap & initial mechanical latch (t = 0.000s)
      const mirrorLen = Math.round(sampleRate * 0.045);
      const mirrorBuffer = context.createBuffer(1, mirrorLen, sampleRate);
      const mirrorData = mirrorBuffer.getChannelData(0);
      for (let i = 0; i < mirrorLen; i++) {
        const t = i / sampleRate;
        const thump = Math.sin(2 * Math.PI * (140 - 80 * (t / 0.045)) * t) * Math.exp(-t / 0.022);
        const metallic = (Math.sin(2 * Math.PI * 1850 * t) * 0.6 + Math.sin(2 * Math.PI * 3420 * t) * 0.4) * Math.exp(-t / 0.005);
        mirrorData[i] = thump * 0.45 + metallic * 0.75;
      }
      const mirrorSrc = context.createBufferSource();
      mirrorSrc.buffer = mirrorBuffer;
      const mirrorGain = context.createGain();
      mirrorGain.gain.setValueAtTime(0.85, now);
      if (mirrorGain.gain.exponentialRampToValueAtTime) {
        mirrorGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      }
      mirrorSrc.connect(mirrorGain);
      mirrorGain.connect(target);
      mirrorSrc.start(now);

      // Stage 2: Xenon flash arc pop + capacitor whine (t = 0.012s)
      if (typeof context.createOscillator === 'function') {
        const popOsc = context.createOscillator();
        const popGain = context.createGain();
        popOsc.type = 'sine';
        popOsc.frequency.setValueAtTime(2880, now + 0.012);
        if (popOsc.frequency.exponentialRampToValueAtTime) {
          popOsc.frequency.exponentialRampToValueAtTime(160, now + 0.055);
        }
        popGain.gain.setValueAtTime(0.55, now + 0.012);
        if (popGain.gain.exponentialRampToValueAtTime) {
          popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
        }
        popOsc.connect(popGain);
        popGain.connect(target);
        popOsc.start(now + 0.012);
        popOsc.stop(now + 0.07);

        // Capacitor recharge whine
        const whineOsc = context.createOscillator();
        const whineGain = context.createGain();
        whineOsc.type = 'triangle';
        whineOsc.frequency.setValueAtTime(2160, now + 0.025);
        if (whineOsc.frequency.linearRampToValueAtTime) {
          whineOsc.frequency.linearRampToValueAtTime(5800, now + 0.12);
        }
        whineGain.gain.setValueAtTime(0.001, now + 0.025);
        if (whineGain.gain.linearRampToValueAtTime) {
          whineGain.gain.linearRampToValueAtTime(0.12, now + 0.06);
          whineGain.gain.linearRampToValueAtTime(0.0001, now + 0.12);
        }
        whineOsc.connect(whineGain);
        whineGain.connect(target);
        whineOsc.start(now + 0.025);
        whineOsc.stop(now + 0.125);
      }

      // Stage 3: Second curtain latch snap (t = 0.038s)
      const latchLen = Math.round(sampleRate * 0.035);
      const latchBuffer = context.createBuffer(1, latchLen, sampleRate);
      const latchData = latchBuffer.getChannelData(0);
      for (let i = 0; i < latchLen; i++) {
        const t = i / sampleRate;
        latchData[i] = (Math.sin(2 * Math.PI * 2160 * t) * 0.6 + Math.sin(2 * Math.PI * 4320 * t) * 0.4) * Math.exp(-t / 0.005);
      }
      const latchSrc = context.createBufferSource();
      latchSrc.buffer = latchBuffer;
      const latchGain = context.createGain();
      latchGain.gain.setValueAtTime(0.70, now + 0.038);
      if (latchGain.gain.exponentialRampToValueAtTime) {
        latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.073);
      }
      latchSrc.connect(latchGain);
      latchGain.connect(target);
      latchSrc.start(now + 0.038);

      // Stage 4: Polaroid SX-70 motorized film ejection rollers (t = 0.075s .. 0.420s)
      if (typeof context.createOscillator === 'function') {
        const motorOsc = context.createOscillator();
        const motorGain = context.createGain();
        motorOsc.type = 'sawtooth';
        motorOsc.frequency.setValueAtTime(180, now + 0.075);
        const motorFilter = context.createBiquadFilter ? context.createBiquadFilter() : null;
        if (motorFilter) {
          motorFilter.type = 'lowpass';
          motorFilter.frequency.setValueAtTime(950, now + 0.075);
        }
        motorGain.gain.setValueAtTime(0.001, now + 0.075);
        if (motorGain.gain.linearRampToValueAtTime) {
          motorGain.gain.linearRampToValueAtTime(0.26, now + 0.14);
          motorGain.gain.linearRampToValueAtTime(0.24, now + 0.36);
          motorGain.gain.linearRampToValueAtTime(0.0001, now + 0.44);
        }
        motorOsc.connect(motorFilter || motorGain);
        if (motorFilter) motorFilter.connect(motorGain);
        motorGain.connect(target);
        motorOsc.start(now + 0.075);
        motorOsc.stop(now + 0.46);
      }
    } catch {}
  }
  function triggerCameraFlash(currentSlug, flashLevel) {
    if ((currentSlug === 'ajenjo-cam' || slug === 'ajenjo-cam') && flashLevel >= 0.45) {
      lastFlashSlug = 'ajenjo-cam';
      const now = performance.now();
      if (now - lastCameraFlashTime > 1100) {
        lastCameraFlashTime = now;
        playCameraFlash();
      }
    } else if (currentSlug && currentSlug !== 'ajenjo-cam' && slug !== 'ajenjo-cam') {
      lastFlashSlug = '';
    }
  }
  function playPunchImpact() {
    return;
  }
  function triggerPunchImpact(currentSlug, isPunchActive) {
    return;
  }
  function excite() {
    const now = performance.now();
    if (!enabled || !engine || !pageActive || document.hidden || lastMotion === null || now - lastMotion > 180) return;
    const scale = mode === 'still' ? .68 : 1;
    ramp(engine.master.gain, Math.min(.32, (.08 + energy * .24) * scale), .045);
    mix();
    mix();
    if (slug !== 'dustin') playMelody(now);
    if (now - lastGrain < 150 - energy * 25 + depth * 15 || engine.voices.size > 10) return;
    lastGrain = now; seed += direction * .371;
    const start = context.currentTime + .005, voices = engine.voices;
    engine.buffers.forEach((buffer, index) => {
      if (voices.size >= 12) return;
      const source = context.createBufferSource(), envelope = context.createGain();
      const duration = index ? .40 + depth * .34 : mode === 'P' ? .24 + energy * .10 : .30 + energy * .14;
      const rate = rateFor(index);
      const span = Math.max(.01, buffer.duration - duration * 1.2 - .02);
      const offset = (((lastDistance ?? 0) * .73 + seed + index * 11.3) % span + span) % span;
      source.buffer = buffer; source.loop = false; source.playbackRate.value = rate;
      envelope.gain.setValueCurveAtTime(engine.envelope, start, duration);
      source.connect(envelope); envelope.connect(index ? engine.iris : engine.filter);
      const voice = { source, envelope, index }; voices.add(voice);
      source.onended = () => { voices.delete(voice); source.disconnect(); envelope.disconnect(); };
      source.start(start, offset); source.stop(start + duration);
    });
    message();
  }
  function advance(nextDistance, nextDepth = depth, nextMode = mode, nextPhase = phase, nextAxis = axisDirection, nextSlug = slug, nextFlash = 0, nextPunch = false) {
    depth = Math.max(0, Math.min(1, Number(nextDepth) || 0));
    mode = nextMode || mode;
    phase = nextPhase || phase;
    axisDirection = nextAxis === -1 ? -1 : 1;
    if (nextSlug !== undefined) slug = nextSlug;
    triggerCameraFlash(slug, Number(nextFlash) || 0);
    triggerPunchImpact(slug, !!nextPunch);
    if (typeof nextDistance !== 'number' || Number.isNaN(nextDistance)) {
      if (enabled) mix();
      return;
    }
    if (lastDistance === null) {
      lastDistance = nextDistance; lastPhase = phase; lastSlug = slug;
      if (enabled) mix();
      return;
    }
    const delta = nextDistance - lastDistance;
    const inHoldPause = (phase === 'hold' || phase === 'rest') && (lastPhase === 'hold' || lastPhase === 'rest') && slug === lastSlug;
    lastDistance = nextDistance; lastPhase = phase; lastSlug = slug;
    if (!enabled || !engine || !delta || !pageActive || document.hidden) return;
    if (inHoldPause) {
      pendingDistance = 0;
      return;
    }
    pendingDistance += delta;
    const minStep = Math.max(active ? 1.5 : 5, innerHeight * (active ? .002 : .008)) / Math.max(1, innerHeight);
    if (Math.abs(pendingDistance) < minStep) return;
    const step = pendingDistance; pendingDistance = 0;
    noteDistance = Math.min(.22, noteDistance + Math.abs(step));
    const now = performance.now(), elapsed = lastMotion === null ? .08 : Math.max(.016, Math.min(.12, (now - lastMotion) / 1000));
    energy = Math.min(1, Math.sqrt(Math.abs(step) / elapsed * .55));
    direction = Math.sign(step) || 1; lastMotion = now;
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
  function motion() {
    const y = scrollY;
    if (managedPage) { lastY = y; return; }
    lastY = y;
    advance(y / Math.max(1, innerHeight), 0, 'V', 'scroll', 1, '');
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
    const music = context.createGain(); music.gain.value = .55; music.connect(master);
    // Short, 0.45s stereo reflections give each tine a small room that gathers inside the iris.
    const roomGain = context.createGain(), roomTone = context.createBiquadFilter(), room = context.createConvolver();
    roomTone.type = 'lowpass'; roomTone.frequency.value = 4200; roomTone.Q.value = .3;
    roomGain.gain.value = .18;
    const response = context.createBuffer(2, Math.ceil(context.sampleRate * .45), context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const samples = response.getChannelData(channel); let random = 731 + channel * 197;
      for (let i = Math.floor(context.sampleRate * .014); i < samples.length; i++) {
        random = (random * 1664525 + 1013904223) >>> 0;
        samples[i] = (random / 4294967296 * 2 - 1) * .011 * Math.exp(-i / context.sampleRate / .10) * (1 - i / samples.length);
      }
      [[.019,.18],[.037,.13],[.061,.08],[.097,.05]].forEach(([delay, level]) => {
        const idx = Math.round((delay + channel * .0015) * context.sampleRate);
        if (idx < samples.length) samples[idx] += level;
      });
    }
    room.normalize = false; room.buffer = response;
    music.connect(roomTone); roomTone.connect(room); room.connect(roomGain); roomGain.connect(master);
    core.channelCount = 1; core.channelCountMode = 'explicit'; core.channelInterpretation = 'speakers';
    master.gain.value = 0; nature.gain.value = .22; iris.gain.value = .035; open.gain.value = 1; core.gain.value = 0;
    nature.connect(master); iris.connect(master); master.connect(open); master.connect(core);
    open.connect(tone); core.connect(tone);
    filter.connect(nature);
    const panner = context.createStereoPanner?.();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.knee.value = 18; compressor.ratio.value = 3;
    compressor.attack.value = .006; compressor.release.value = .18;
    if (panner) { tone.connect(panner); panner.connect(compressor); }
    else tone.connect(compressor);
    compressor.connect(context.destination);
    const envelope = Float32Array.from({ length: 64 }, (_, i) => .55 * Math.sin(Math.PI * i / 63) ** 2);
    envelope[0] = envelope[63] = 0;
    const noteEnvelope = Float32Array.from({ length: 64 }, (_, i) => i === 0 ? 0 : i < 53 ? 1 : Math.cos((i - 53) / 10 * Math.PI / 2) ** 2);
    noteEnvelope[63] = 0;
    return { master, nature, iris, filter, tone, open, core, music, panner, roomGain, roomTone, compressor, buffers: decoded.slice(0, 2), box: decoded[2], envelope, noteEnvelope, voices: new Set() };
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
      const resumed = context.resume();
      loading = (async () => {
        await resumed;
        if (!engine) engine = await prepare();
        enabled = true; lastY = scrollY;
        if (!managedPage) lastDistance = scrollY / Math.max(1, innerHeight);
        rest(true); mix();
        message(`Caja de música activada (${activeMelodyMeta.day} · ${activeMelodyMeta.name}). Desplázate para tocar.`);
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
    dailyMelody: Object.freeze({
      index: activeMelodyIndex,
      name: activeMelodyMeta.name,
      day: activeMelodyMeta.day
    }),
    depth(value) { depth = Math.max(0, Math.min(1, value)); if (enabled) mix(); },
    frame(state = {}) {
      if (!state || typeof state !== 'object') return;
      advance(state.distance, state.depth, state.mode, state.phase, state.axisDirection, state.slug, state.flash, state.punch);
    },
    flash() {
      lastFlashSlug = 'ajenjo-cam';
      playCameraFlash();
    },
    punch() {
      playPunchImpact();
    },
    speakHero() {
      speakHero();
    },
    speakDenbora() {
      speakDenbora();
    },
    speakSilence() {
      speakSilence();
    },
    shaker() {
      playSugarShaker();
    },
    puzzleSnap() {
      playPuzzleSnap();
    },
    swissClock() {
      playSwissClock();
    },
    wineClink() {
      playWineGlassClink();
    },
    portraitWink() {
      playPortraitWink();
    },
    deltoya() {
      playDeltoya();
    },
    gameOver() {
      play8BitGameOver();
    },
    menuNote(index) {
      playMenuNote(index);
    },
    resolveCadence() {
      resolveCadence();
    },
    get lastUtterance() { return lastUtterance; },
    get lastFlashSlug() { return lastFlashSlug; },
    get lastPunchSlug() { return lastPunchSlug; },
    get lastShakerSlug() { return lastShakerSlug; },
    get lastPuzzleSlug() { return lastPuzzleSlug; },
    get lastClockSlug() { return lastClockSlug; },
    get lastWineSlug() { return lastWineSlug; },
    get lastWinkSlug() { return lastWinkSlug; },
    get lastDeltoyaSlug() { return lastDeltoyaSlug; },
    get lastGameOverSlug() { return lastGameOverSlug; },
    get lastMenuNoteIndex() { return lastMenuNoteIndex; },
    get sessionMelodyIndex() { return activeMelodyIndex; },
    get melody() { return melody; }
  });
  paint();
})();
