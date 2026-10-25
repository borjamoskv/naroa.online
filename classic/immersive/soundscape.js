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
  let lastDistance = null, lastPhase = 'hold', lastSlug = '', lastUtterance = '';
  let lastCameraFlashTime = 0, lastFlashSlug = '';
  let lastPunchSlug = '', lastPunchTime = 0;
  let lastMotion = null, lastGrain = -Infinity, energy = 0, direction = 1, seed = 0, pendingDistance = 0;
  // Cadencia obligatoria final: notas icónicas de SOUND OF SILENCE en Re menor microtonal
  // D5 (sound), [silencio], A4 (of), C5 (si-), F5 (-lence), E5 (resolución), [silencio], D5 (tónica)
  const SOUND_OF_SILENCE_CADENCE = [74.00, null, 69.02, 71.74, 77.24, 75.86, null, 74.00];

  // Repertorio de melodías modales cálidas en Re menor microtonal (Estética Aphex Twin / Boards of Canada).
  // Cada día de la semana tiene su tema emblemático, culminando siempre en SOUND OF SILENCE:
  const DAILY_MELODIES = [
    {
      name: 'Landa (Alboka pastoral de Arratia)',
      day: 'Lunes',
      notes: [
        74.00, 77.24, 81.02, 77.24, 75.86, 74.00, 69.02, null,
        71.74, null, 75.86, 78.98, 75.86, null, 71.74, 69.02,
        74.00, null, 77.24, 81.02, null, 78.98, 75.86, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      name: 'Haurtxo Polita (Nana tradicional en cinta cálida)',
      day: 'Martes',
      notes: [
        69.02, null, 74.00, 75.86, 77.24, null, 75.86, 74.00,
        77.24, null, 78.98, 81.02, null, 78.98, 77.24, 75.86,
        null, 74.00, 71.74, 69.02, null, 71.74, 75.86, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      name: 'Harria eta Marea (Deriva ambiental tipo Rhubarb / Olson)',
      day: 'Miércoles',
      notes: [
        74.00, 69.02, null, 77.24, 74.00, null, 78.98, 75.86,
        71.74, null, 74.00, 75.86, null, 69.02, 71.74, 74.00,
        77.24, null, 81.02, 86.00, null, 81.02, 77.24, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      name: 'Txoria Txori (Mikel Laboa en piano de fieltro)',
      day: 'Jueves',
      notes: [
        74.00, null, 77.24, 75.86, null, 74.00, 71.74, 74.00,
        null, 69.02, 71.74, null, 74.00, 75.86, 77.24, 75.86,
        74.00, null, 81.02, 78.98, null, 77.24, 71.74, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      name: 'Mi Gran Noche (Raphael en piano íntimo Avril 14th)',
      day: 'Viernes',
      notes: [
        69.02, 74.00, null, 77.24, 75.86, null, 69.02, 74.00,
        77.24, 75.86, null, 74.00, 75.86, null, 78.98, 77.24,
        74.00, null, 77.24, 81.02, null, 78.98, 75.86, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      name: 'Gaua (Nocturno analógico de Bilbao)',
      day: 'Sábado',
      notes: [
        74.00, null, 71.74, 69.02, null, 74.00, 77.24, 74.00,
        69.02, 74.00, null, 78.98, 81.02, null, 77.24, 74.00,
        81.02, null, 83.74, 81.02, null, 75.86, 71.74, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      name: 'Haizea (Viento cálido Boards of Canada en los pinos)',
      day: 'Domingo',
      notes: [
        74.00, 77.24, null, 81.02, 86.00, null, 83.74, 77.24,
        78.98, null, 75.86, 74.00, 69.02, null, 71.74, 74.00,
        77.24, null, 81.02, 78.98, null, 75.86, 69.02, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    }
  ];

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
    const accent = melodyStep % 8 === 0 ? 1 : melodyStep % 5 === 3 ? .94 : melodyStep % 4 === 2 ? .82 : .91;
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

  /**
   * Convolutive Gallery Space (Vector V4 - Espacio Acústico de Techos Altos de Museo)
   * Procedural impulse response (~1.35s) modeling a 6-meter ceiling European art museum.
   * Stereo exponential decay with 1800 Hz lowpass damping (INV_WARMTH_ACOUSTIC_GATE).
   * Guarded against missing Web Audio, suspended state, and headless JSDOM environments.
   */
  function getGalleryReverb() {
    if (!context || !engine || context.state !== 'running') return null;
    if (engine.galleryReverb) return engine.galleryReverb;
    if (typeof context.createConvolver !== 'function' || typeof context.createBuffer !== 'function' || typeof context.createGain !== 'function') return null;
    try {
      const sampleRate = context.sampleRate || 44100;
      const duration = 1.35; // 1.35s high-ceiling museum acoustics (6-meter European gallery)
      const length = Math.ceil(sampleRate * duration);
      const buffer = context.createBuffer(2, length, sampleRate);
      const fc = 1800; // 1800 Hz lowpass damping (INV_WARMTH_ACOUSTIC_GATE)
      const alpha = 1 - Math.exp(-2 * Math.PI * fc / sampleRate);

      for (let channel = 0; channel < 2; channel++) {
        const samples = buffer.getChannelData(channel);
        let random = (1337 + channel * 9973) >>> 0;
        let lp = 0;
        const preDelay = Math.floor(sampleRate * 0.018); // 18ms pre-delay

        for (let i = preDelay; i < length; i++) {
          random = (random * 1664525 + 1013904223) >>> 0;
          const noise = (random / 4294967296 * 2 - 1);
          lp += alpha * (noise - lp);
          const t = i / sampleRate;
          const decay = Math.exp(-t / 0.30) * (1 - i / length);
          samples[i] = lp * 0.028 * decay;
        }

        // Discrete early reflections of a 6-meter ceiling stone/parquet hall
        const reflections = [
          [0.024, 0.16],
          [0.045, 0.12],
          [0.072, 0.08],
          [0.108, 0.05],
          [0.145, 0.03]
        ];
        reflections.forEach(([delay, level]) => {
          const idx = Math.round((delay + channel * 0.0024) * sampleRate);
          if (idx < length) {
            samples[idx] += level * (channel === 0 ? 0.9 : 0.7);
          }
        });
      }

      const convolver = context.createConvolver();
      convolver.normalize = false;
      convolver.buffer = buffer;

      const input = context.createGain();
      input.gain.value = 1.0;

      const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
      if (filter) {
        filter.type = 'lowpass';
        if (filter.frequency.setValueAtTime) {
          filter.frequency.setValueAtTime(1800, context.currentTime);
        } else {
          filter.frequency.value = 1800;
        }
        if (filter.Q.setValueAtTime) {
          filter.Q.setValueAtTime(0.5, context.currentTime);
        } else {
          filter.Q.value = 0.5;
        }
      }

      const wetGain = context.createGain();
      // Subtle wet level (~18-22%) for natural museum room resonance
      if (wetGain.gain.setValueAtTime) {
        wetGain.gain.setValueAtTime(0.20, context.currentTime);
      } else {
        wetGain.gain.value = 0.20;
      }

      const target = engine.compressor || engine.master;
      if (filter) {
        input.connect(filter);
        filter.connect(convolver);
      } else {
        input.connect(convolver);
      }
      convolver.connect(wetGain);
      wetGain.connect(target);

      engine.galleryReverb = { input, convolver, filter, wetGain };
      return engine.galleryReverb;
    } catch {
      return null;
    }
  }

  function playPuzzleSnap() {
    lastPuzzleSlug = 'saio-puzzle';
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([14, 18]); } catch {}
    }
    if (!context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.002;
      const target = engine.compressor || engine.master;
      const gallery = getGalleryReverb();

      // Impulso sordo de madera noble sobre caballete (96 Hz -> 62 Hz en caída amortiguada)
      if (typeof context.createOscillator === 'function') {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(96, now);
        if (osc.frequency.exponentialRampToValueAtTime) {
          osc.frequency.exponentialRampToValueAtTime(62, now + 0.038);
        }
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.55, now + 0.003);
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.048);
        }
        osc.connect(gain);
        gain.connect(target);
        if (gallery?.input) {
          try { gain.connect(gallery.input); } catch {}
        }
        osc.start(now);
        osc.stop(now + 0.052);

        // Resonancia de fieltro amortiguado (240 Hz con corte paso-bajo suave)
        const thudOsc = context.createOscillator();
        const thudFilter = context.createBiquadFilter ? context.createBiquadFilter() : null;
        const thudGain = context.createGain();
        thudOsc.type = 'triangle';
        thudOsc.frequency.setValueAtTime(240, now);
        if (thudFilter) {
          thudFilter.type = 'lowpass';
          thudFilter.frequency.setValueAtTime(380, now);
          thudFilter.Q.setValueAtTime(1.1, now);
        }
        thudGain.gain.setValueAtTime(0.28, now);
        if (thudGain.gain.exponentialRampToValueAtTime) {
          thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.034);
        }
        thudOsc.connect(thudFilter || thudGain);
        if (thudFilter) thudFilter.connect(thudGain);
        thudGain.connect(target);
        if (gallery?.input) {
          try { thudGain.connect(gallery.input); } catch {}
        }
        thudOsc.start(now);
        thudOsc.stop(now + 0.038);
      }
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
      const gallery = getGalleryReverb();
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
          if (gallery?.input) {
            try { gain.connect(gallery.input); } catch {}
          }
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
      const gallery = getGalleryReverb();
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
          if (gallery?.input) {
            try { gain.connect(gallery.input); } catch {}
          }
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
      const gallery = getGalleryReverb();
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
        if (gallery?.input) {
          try { gain.connect(gallery.input); } catch {}
        }
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch {}
  }
  let lastDeltoyaSlug = '';
  let lastPhonographCategory = '', lastPhonographFreq = 0, lastPhonographTime = -Infinity, lastStencilSprayFilter = '';

  function playStencilRollerWipe(filterCategory = 'all') {
    lastStencilSprayFilter = String(filterCategory || 'all');
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([12, 18, 8]); } catch {}
    }
    if (!enabled || !context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.002;
      const target = engine.compressor || engine.master;
      const gallery = getGalleryReverb();
      const freqMap = {
        all: 92,
        pizarra: 76,
        collage: 108,
        objetos: 84,
        caracterizacion: 116,
        Vaivenes: 98
      };
      const baseFreq = freqMap[filterCategory] || 92;
      if (typeof context.createOscillator === 'function') {
        const osc = context.createOscillator();
        const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * 1.45, now);
        if (osc.frequency.exponentialRampToValueAtTime) {
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.62, now + 0.14);
        }
        if (filter) {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(420, now);
          filter.Q.setValueAtTime(0.45, now);
        }
        gain.gain.setValueAtTime(0.001, now);
        if (gain.gain.linearRampToValueAtTime) {
          gain.gain.linearRampToValueAtTime(0.34, now + 0.018);
        }
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        }
        osc.connect(filter || gain);
        if (filter) filter.connect(gain);
        gain.connect(target);
        if (gallery?.input) {
          try { gain.connect(gallery.input); } catch {}
        }
        osc.start(now);
        osc.stop(now + 0.17);
      }
    } catch {}
  }

  function playPhonographGrain(roughness = 0.5, luminance = 0.5, category = 'pizarra') {
    const cat = String(category || 'pizarra');
    const r = Math.max(0, Math.min(1, Number(roughness) || 0));
    const l = Math.max(0, Math.min(1, Number(luminance) || 0));
    // Registro grave-medio cálido (146 Hz - 410 Hz, Re3 - Sol#4, INV_WARMTH_ACOUSTIC_GATE)
    const scaleNotes = [62.00, 65.24, 69.02, 71.74, 74.00, 67.86, 63.86];
    const degIdx = Math.floor((r * 0.65 + l * 0.35) * (scaleNotes.length - 0.01));
    const midiNote = scaleNotes[Math.max(0, Math.min(scaleNotes.length - 1, degIdx))];
    const freq = Number((440 * Math.pow(2, (midiNote - 69) / 12)).toFixed(2));
    lastPhonographCategory = cat;
    lastPhonographFreq = freq;

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    // Anti-saturación: guarda mínima de 110ms (INV_WARMTH_ACOUSTIC_GATE #4)
    if (nowMs - lastPhonographTime < 110) return { category: cat, frequency: freq, gated: true };
    lastPhonographTime = nowMs;

    if (!enabled || !context || !engine || context.state !== 'running') {
      return { category: cat, frequency: freq, gated: false };
    }
    try {
      const now = context.currentTime + 0.003;
      const target = engine.compressor || engine.master;
      const gallery = getGalleryReverb();
      if (typeof context.createOscillator === 'function') {
        const osc = context.createOscillator();
        const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
        const gain = context.createGain();
        // Pizarra = resonancia mineral senoidal profunda; Objetos/Kintsugi = armónico cálido triangle con filtro de seda
        osc.type = (cat === 'objetos' || cat === 'kintsugi' || l > 0.72) ? 'triangle' : 'sine';
        // Deriva Tape Wow sutil (±2.8 cents)
        const tapeWow = 1 + Math.sin(nowMs * 0.0037) * 0.0016;
        osc.frequency.setValueAtTime(freq * tapeWow, now);
        if (filter) {
          filter.type = 'lowpass';
          const cutoff = cat === 'pizarra' || cat === 'rocks' ? 380 + r * 240 : 520 + l * 310;
          filter.frequency.setValueAtTime(Math.min(860, cutoff), now);
          filter.Q.setValueAtTime(0.42, now);
        }
        const attack = 0.038; // Ataque de fieltro suave (30ms - 55ms)
        const decay = 0.42 + r * 0.28;
        const peakGain = Math.min(0.18, 0.055 + r * 0.11);
        gain.gain.setValueAtTime(0.0001, now);
        if (gain.gain.linearRampToValueAtTime) {
          gain.gain.linearRampToValueAtTime(peakGain, now + attack);
        }
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
        }
        osc.connect(filter || gain);
        if (filter) filter.connect(gain);
        gain.connect(target);
        if (gallery?.input) {
          try { gain.connect(gallery.input); } catch {}
        }
        osc.start(now);
        osc.stop(now + attack + decay + 0.02);
      }
    } catch {}
    return { category: cat, frequency: freq, gated: false };
  }
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
    // Game Over permanece en silencio contemplativo absoluto (directiva de diseño)
    return;
  }
  function playCameraFlash() {
    lastFlashSlug = 'ajenjo-cam';
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([22, 30, 16, 45]); } catch {}
    }
    if (!context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.002;
      const target = engine.compressor || engine.master;
      const gallery = getGalleryReverb();
      const sampleRate = context.sampleRate || 44100;

      // Stage 1: Obturador mecánico de titanio / Leica M3 sear release (t = 0.000s)
      const mirrorLen = Math.round(sampleRate * 0.038);
      const mirrorBuffer = context.createBuffer(1, mirrorLen, sampleRate);
      const mirrorData = mirrorBuffer.getChannelData(0);
      for (let i = 0; i < mirrorLen; i++) {
        const t = i / sampleRate;
        const thump = Math.sin(2 * Math.PI * (185 - 110 * (t / 0.038)) * t) * Math.exp(-t / 0.016);
        const metallic = (Math.sin(2 * Math.PI * 2450 * t) * 0.55 + Math.sin(2 * Math.PI * 4600 * t) * 0.45) * Math.exp(-t / 0.004);
        mirrorData[i] = thump * 0.55 + metallic * 0.85;
      }
      const mirrorSrc = context.createBufferSource();
      mirrorSrc.buffer = mirrorBuffer;
      const mirrorGain = context.createGain();
      mirrorGain.gain.setValueAtTime(0.92, now);
      if (mirrorGain.gain.exponentialRampToValueAtTime) {
        mirrorGain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
      }
      mirrorSrc.connect(mirrorGain);
      mirrorGain.connect(target);
      if (gallery?.input) {
        try { mirrorGain.connect(gallery.input); } catch {}
      }
      mirrorSrc.start(now);

      // Stage 2: Arco de ionización de xenón + pop de presión (t = 0.010s)
      if (typeof context.createOscillator === 'function') {
        const popOsc = context.createOscillator();
        const popGain = context.createGain();
        popOsc.type = 'sine';
        popOsc.frequency.setValueAtTime(3200, now + 0.010);
        if (popOsc.frequency.exponentialRampToValueAtTime) {
          popOsc.frequency.exponentialRampToValueAtTime(110, now + 0.048);
        }
        popGain.gain.setValueAtTime(0.68, now + 0.010);
        if (popGain.gain.exponentialRampToValueAtTime) {
          popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
        }
        popOsc.connect(popGain);
        popGain.connect(target);
        if (gallery?.input) {
          try { popGain.connect(gallery.input); } catch {}
        }
        popOsc.start(now + 0.010);
        popOsc.stop(now + 0.06);

        // Chisporroteo de xenón mediante micro-ruido blanco filtrado
        const noiseLen = Math.round(sampleRate * 0.018);
        const noiseBuffer = context.createBuffer(1, noiseLen, sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseLen; i++) {
          const t = i / sampleRate;
          noiseData[i] = ((Math.random() * 2) - 1) * Math.exp(-t / 0.006);
        }
        const noiseSrc = context.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        const noiseFilter = context.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(2800, now + 0.010);
        noiseFilter.Q.setValueAtTime(3.2, now + 0.010);
        const noiseGain = context.createGain();
        noiseGain.gain.setValueAtTime(0.38, now + 0.010);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(target);
        noiseSrc.start(now + 0.010);

        // Stage 3: Zumbido ascendente de condensador electrolítico analógico (t = 0.040s .. 0.240s)
        const whineOsc = context.createOscillator();
        const whineFilter = context.createBiquadFilter();
        const whineGain = context.createGain();
        whineOsc.type = 'sine';
        whineOsc.frequency.setValueAtTime(1450, now + 0.040);
        if (whineOsc.frequency.exponentialRampToValueAtTime) {
          whineOsc.frequency.exponentialRampToValueAtTime(4950, now + 0.220);
        }
        whineFilter.type = 'lowpass';
        whineFilter.frequency.setValueAtTime(3800, now + 0.040);
        whineFilter.Q.setValueAtTime(0.65, now + 0.040);

        whineGain.gain.setValueAtTime(0.0001, now + 0.040);
        if (whineGain.gain.linearRampToValueAtTime) {
          whineGain.gain.linearRampToValueAtTime(0.095, now + 0.080);
          whineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.240);
        }
        whineOsc.connect(whineFilter);
        whineFilter.connect(whineGain);
        whineGain.connect(target);
        whineOsc.start(now + 0.040);
        whineOsc.stop(now + 0.250);
      }

      // Stage 4: Segunda cortinilla / Cierre mecánico seco (t = 0.035s)
      const latchLen = Math.round(sampleRate * 0.028);
      const latchBuffer = context.createBuffer(1, latchLen, sampleRate);
      const latchData = latchBuffer.getChannelData(0);
      for (let i = 0; i < latchLen; i++) {
        const t = i / sampleRate;
        latchData[i] = (Math.sin(2 * Math.PI * 2600 * t) * 0.65 + Math.sin(2 * Math.PI * 4800 * t) * 0.35) * Math.exp(-t / 0.005);
      }
      const latchSrc = context.createBufferSource();
      latchSrc.buffer = latchBuffer;
      const latchGain = context.createGain();
      latchGain.gain.setValueAtTime(0.78, now + 0.035);
      if (latchGain.gain.exponentialRampToValueAtTime) {
        latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.063);
      }
      latchSrc.connect(latchGain);
      latchGain.connect(target);
      if (gallery?.input) {
        try { latchGain.connect(gallery.input); } catch {}
      }
      latchSrc.start(now + 0.035);

      // Stage 5: Carraca táctil de arrastre de película (3 micro-ticks de rueda dentada)
      [0.115, 0.165, 0.215].forEach((tickDelay, idx) => {
        const tickTime = now + tickDelay;
        const tickOsc = context.createOscillator();
        const tickGain = context.createGain();
        tickOsc.type = 'triangle';
        tickOsc.frequency.setValueAtTime(3200 - idx * 280, tickTime);
        tickGain.gain.setValueAtTime(0.08, tickTime);
        if (tickGain.gain.exponentialRampToValueAtTime) {
          tickGain.gain.exponentialRampToValueAtTime(0.0001, tickTime + 0.012);
        }
        tickOsc.connect(tickGain);
        tickGain.connect(target);
        tickOsc.start(tickTime);
        tickOsc.stop(tickTime + 0.015);
      });
    } catch {}
  }
  function triggerCameraFlash(currentSlug, flashLevel) {
    if ((currentSlug === 'ajenjo-cam' || slug === 'ajenjo-cam') && flashLevel >= 0.45) {
      lastFlashSlug = 'ajenjo-cam';
      const now = performance.now();
      if (now - lastCameraFlashTime > 650) {
        lastCameraFlashTime = now;
        playCameraFlash();
      }
    } else if (currentSlug && currentSlug !== 'ajenjo-cam' && slug !== 'ajenjo-cam') {
      lastFlashSlug = '';
    }
  }
  function playPunchImpact() {
    lastPunchSlug = 'jose-manuel-ezquerra';
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([60, 40, 25]); } catch {}
    }
    if (!context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.002;
      const target = engine.compressor || engine.master;
      const gallery = getGalleryReverb();
      const sampleRate = context.sampleRate || 44100;

      // 1. Manotazo en cristal del monitor (flesh slap on screen glass)
      const slapLen = Math.round(sampleRate * 0.085);
      const slapBuffer = context.createBuffer(1, slapLen, sampleRate);
      const slapData = slapBuffer.getChannelData(0);
      for (let i = 0; i < slapLen; i++) {
        const t = i / sampleRate;
        const noise = ((Math.random() * 2) - 1) * Math.exp(-t / 0.012);
        const glassCrack = Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t / 0.008);
        const thump = Math.sin(2 * Math.PI * (160 - 90 * (t / 0.085)) * t) * Math.exp(-t / 0.028);
        slapData[i] = noise * 0.70 + glassCrack * 0.65 + thump * 0.85;
      }
      const slapSrc = context.createBufferSource();
      slapSrc.buffer = slapBuffer;
      const slapFilter = context.createBiquadFilter();
      slapFilter.type = 'bandpass';
      slapFilter.frequency.setValueAtTime(1650, now);
      slapFilter.Q.setValueAtTime(2.2, now);
      const slapGain = context.createGain();
      slapGain.gain.setValueAtTime(0.92, now);
      slapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      slapSrc.connect(slapFilter);
      slapFilter.connect(slapGain);
      slapGain.connect(target);
      if (gallery) slapGain.connect(gallery);
      slapSrc.start(now);

      // 2. PUMBA! Sub-bajo de impacto masivo en monitor (38 Hz)
      const subOsc = context.createOscillator();
      const subGain = context.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(140, now);
      subOsc.frequency.exponentialRampToValueAtTime(36, now + 0.16);
      subGain.gain.setValueAtTime(0.95, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      subOsc.connect(subGain);
      subGain.connect(target);
      subOsc.start(now);
      subOsc.stop(now + 0.16);

      // 3. Resonancia del marco del monitor (96 Hz)
      const bodyOsc = context.createOscillator();
      const bodyGain = context.createGain();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(96, now);
      bodyGain.gain.setValueAtTime(0.45, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(target);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.22);

      // 4. Zumbido armónico aturdido (3 segundos de mareo oscilante)
      const dazeOsc = context.createOscillator();
      const dazeGain = context.createGain();
      const dazeLFO = context.createOscillator();
      const dazeLFOGain = context.createGain();
      dazeLFO.frequency.setValueAtTime(4.5, now);
      dazeLFOGain.gain.setValueAtTime(22, now);
      dazeLFOGain.gain.exponentialRampToValueAtTime(1, now + 2.8);
      dazeLFO.connect(dazeOsc.frequency);
      dazeOsc.type = 'triangle';
      dazeOsc.frequency.setValueAtTime(587.33, now);
      dazeGain.gain.setValueAtTime(0.22, now + 0.04);
      dazeGain.gain.exponentialRampToValueAtTime(0.001, now + 2.9);
      dazeOsc.connect(dazeGain);
      dazeGain.connect(target);
      if (gallery) dazeGain.connect(gallery);
      dazeLFO.start(now);
      dazeLFO.stop(now + 3.0);
      dazeOsc.start(now);
      dazeOsc.stop(now + 3.0);
    } catch {}
  }
  function triggerPunchImpact(currentSlug, hasPunch) {
    if (!hasPunch) return;
    const now = performance.now();
    if (currentSlug === 'i-got-you-babe' || currentSlug === 'jose-manuel-ezquerra') {
      if (now - lastPunchTime > 800) {
        lastPunchTime = now;
        playPunchImpact();
      }
    }
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
    if (managedPage) return;
    advance(scrollY / Math.max(1, innerHeight), 0, 'V', 'scroll', 1, '');
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
    return { master, nature, iris, filter, tone, open, core, music, panner, roomGain, roomTone, compressor, buffers: decoded.slice(0, 2), box: decoded[2], envelope, noteEnvelope, voices: new Set(), galleryReverb: null };
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
        enabled = true;
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
    if (document.hidden) rest(true);
  }
  document.addEventListener('visibilitychange', visibility);
  addEventListener('scroll', motion, { passive: true });
  addEventListener('pagehide', () => { pageActive = false; rest(true); });
  addEventListener('pageshow', () => { pageActive = true; });
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
      const now = performance.now();
      if (now - lastCameraFlashTime > 650) {
        lastCameraFlashTime = now;
        playCameraFlash();
      }
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
    phonographGrain(roughness, luminance, category) {
      return playPhonographGrain(roughness, luminance, category);
    },
    stencilRollerWipe(filterCategory) {
      playStencilRollerWipe(filterCategory);
    },
    async createStoryLoopStream(durationSec = 6) {
      const loopNotes = melody.filter(n => n !== null).slice(0, 7);
      loopNotes.push(74.00); // Tónica final D5 (Sound of Silence / Re menor)
      const fallbackResult = {
        stream: null,
        melodyName: activeMelodyMeta.name,
        melodyDay: activeMelodyMeta.day,
        notesScheduled: loopNotes.length,
        stop() {}
      };
      if (!Audio) return fallbackResult;
      try {
        if (!context) context = new Audio();
        if (context.state !== 'running') {
          await context.resume().catch(() => {});
        }
        if (!engine) {
          engine = await prepare();
        }
      } catch {
        return fallbackResult;
      }
      if (!context || !engine) return fallbackResult;
      const streamDest = typeof context.createMediaStreamDestination === 'function'
        ? context.createMediaStreamDestination()
        : null;
      if (streamDest) {
        try { engine.master.connect(streamDest); } catch {}
        try { engine.compressor.connect(streamDest); } catch {}
      }
      clearTimeout(idle);
      clearTimeout(suspension);
      const prevGain = engine.master.gain.value || 0;
      const now = context.currentTime + 0.015;
      try {
        hold(engine.master.gain);
        engine.master.gain.setValueAtTime(Math.max(prevGain, 0.26), now);
      } catch {}

      const stepTime = (durationSec - 0.55) / loopNotes.length;
      const scheduledVoices = [];

      loopNotes.forEach((note, idx) => {
        if (!engine.box) return;
        const start = now + idx * stepTime;
        const source = context.createBufferSource();
        const envelope = context.createGain();
        // Registro grave-medio cálido (-12 semitonos en cadencia / notas alternas para textura Boards of Canada)
        const octaveShift = idx === loopNotes.length - 1 ? 1 : (idx % 3 === 1 ? 1 : 0);
        const rate = Math.pow(2, (note - 74) / 12 - octaveShift);
        const noteDur = Math.min(1.45, engine.box.duration / Math.pow(2, (note - 74) / 12) - 0.02);
        source.buffer = engine.box;
        source.loop = false;
        source.playbackRate.value = rate;
        const accent = idx === 0 || idx === loopNotes.length - 1 ? 0.68 : 0.52;
        const curve = Float32Array.from(engine.noteEnvelope, level => level * accent);
        envelope.gain.setValueCurveAtTime(curve, start, noteDur);
        source.connect(envelope);
        envelope.connect(engine.music);
        if (streamDest) {
          try { envelope.connect(streamDest); } catch {}
        }
        const voice = { source, envelope, note };
        engine.voices.add(voice);
        scheduledVoices.push(voice);
        source.onended = () => {
          engine.voices.delete(voice);
          try { source.disconnect(); envelope.disconnect(); } catch {}
        };
        source.start(start, 0);
        source.stop(start + noteDur);
      });

      // Textura de vinilo / campo ambiental suave durante los 6s
      if (engine.buffers?.[0]) {
        try {
          const ambSource = context.createBufferSource();
          const ambGain = context.createGain();
          ambSource.buffer = engine.buffers[0];
          ambSource.loop = false;
          ambSource.playbackRate.value = 0.88;
          ambGain.gain.setValueAtTime(0.08, now);
          ambSource.connect(ambGain);
          ambGain.connect(engine.filter);
          if (streamDest) {
            try { ambGain.connect(streamDest); } catch {}
          }
          ambSource.start(now, 0);
          ambSource.stop(now + durationSec);
          scheduledVoices.push({ source: ambSource, envelope: ambGain });
        } catch {}
      }

      return {
        stream: streamDest?.stream || null,
        melodyName: activeMelodyMeta.name,
        melodyDay: activeMelodyMeta.day,
        notesScheduled: loopNotes.length,
        stop() {
          scheduledVoices.forEach(v => {
            try { v.source.stop(); } catch {}
            engine?.voices?.delete(v);
          });
          if (streamDest) {
            try { engine.master.disconnect(streamDest); } catch {}
            try { engine.compressor.disconnect(streamDest); } catch {}
          }
          if (!enabled) rest(true);
        }
      };
    },
    get galleryReverb() { return engine?.galleryReverb || null; },
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
    get lastPhonographCategory() { return lastPhonographCategory; },
    get lastPhonographFreq() { return lastPhonographFreq; },
    get lastStencilSprayFilter() { return lastStencilSprayFilter; },
    get sessionMelodyIndex() { return activeMelodyIndex; },
    get melody() { return melody; }
  });
  paint();
})();
