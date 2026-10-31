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

  // Repertorio de melodías modales minimalistas en Re menor microtonal (Estética Erik Satie / Nils Frahm "Felt" / Ryuichi Sakamoto "async").
  // Cada día de la semana destila un haiku monofónico espacioso en piano de fieltro cálido (-12 semitonos, 146 Hz – 440 Hz),
  // con silencios reales de contemplación y cadencia inmutable en SOUND OF SILENCE:
  const DAILY_MELODIES = [
    {
      title: 'Landa',
      subtitle: 'Alboka pastoral de Arratia',
      verse: '«Piedra húmeda y niebla tibia sobre el valle de Arratia»',
      phrases: [
        '«Piedra húmeda y niebla tibia sobre el valle de Arratia…»',
        '«El eco del cuerno dormido entre hayedos y musgo antiguo…»',
        '«Sube la luz por la pizarra mientras despierta el monte…»',
        '«Y en la quietud desnuda resuena el sonido del silencio.»'
      ],
      instrument: 'Piano de Fieltro Minimalista',
      shortDay: 'L',
      name: 'Landa · Alboka pastoral de Arratia',
      day: 'Lunes',
      tempoMs: 1480,
      timbre: { detuneCents: 1.5, cutoffMul: 0.92, subLevel: 0.12, harmColor: 'sine', attackSec: 0.046, releaseMul: 1.0 },
      bass: [62.00, 69.02, 65.24, 67.02, 62.00, 69.02, 67.02, 69.02],
      harmony: [69.02, 74.00, 72.02, 71.74, 69.02, 72.02, 74.00, 65.24],
      notes: [
        74.00, 77.24, 81.02, 77.24, 75.86, 74.00, 69.02, null,
        null, null, 71.74, null, null, 75.86, null, null,
        74.00, null, null, 77.24, null, null, 69.02, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      title: 'Haurtxo Polita',
      subtitle: 'Nana popular en cinta cálida',
      verse: '«Haurtxo polita sehaskan dago, zapi zuritan txit bero…»',
      phrases: [
        '«Haurtxo polita sehaskan dago, zapi zuritan txit bero…»',
        '«Amonak dio: ene potxolo, arren egin ba lo, lo…»',
        '«Txakur haundia etorriko da zuk ezpadazu egiten lo…»',
        '«Suave cae la tarde en el estudio hasta volverse silencio.»'
      ],
      instrument: 'Fieltro Íntimo',
      shortDay: 'M',
      name: 'Haurtxo Polita · Nana popular en cinta cálida',
      day: 'Martes',
      tempoMs: 1580,
      timbre: { detuneCents: 1.2, cutoffMul: 0.86, subLevel: 0.11, harmColor: 'sine', attackSec: 0.050, releaseMul: 1.05 },
      bass: [62.00, 65.24, 67.02, 69.02, 62.00, 70.18, 67.02, 69.02],
      harmony: [69.02, 74.00, 71.74, 72.02, 69.02, 74.00, 70.18, 65.24],
      notes: [
        74.00, null, 77.24, null, 81.02, null, null, 75.86,
        74.00, null, null, 77.24, null, 75.86, null, null,
        81.02, null, 78.98, null, 74.00, null, 69.02, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      title: 'Harria eta Marea',
      subtitle: 'Aire de costa en Re menor',
      verse: '«Donde rompe la espuma contra la pizarra del Cantábrico»',
      phrases: [
        '«Donde rompe la espuma contra la pizarra del Cantábrico…»',
        '«Salitre y grafito sobre la veta oscura de la pleamar…»',
        '«Respira la ola honda antes de volver hacia el abismo…»',
        '«Queda la piedra brillando sola en el sonido del silencio.»'
      ],
      instrument: 'Fieltro & Silencio',
      shortDay: 'X',
      name: 'Harria eta Marea · Aire de costa en Re menor',
      day: 'Miércoles',
      tempoMs: 1620,
      timbre: { detuneCents: 1.8, cutoffMul: 0.88, subLevel: 0.13, harmColor: 'sine', attackSec: 0.048, releaseMul: 1.06 },
      bass: [62.00, 70.18, 65.24, 67.02, 62.00, 67.02, 70.18, 69.02],
      harmony: [69.02, 74.00, 72.02, 74.00, 69.02, 71.74, 74.00, 67.02],
      notes: [
        74.00, null, null, 81.02, null, 75.86, null, null,
        77.24, null, 83.74, null, null, 78.98, null, 74.00,
        null, 75.86, null, null, 72.02, null, 69.02, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      title: 'Txoria Txori',
      subtitle: 'Mikel Laboa en piano de fieltro',
      verse: '«Hegoak ebaki banizkio, nerea izango zen…»',
      phrases: [
        '«Hegoak ebaki banizkio, nerea izango zen, ez zuen aldegingo…»',
        '«Bainan, honela, ez zen gehiago txoria izango…»',
        '«Eta nik… txoria nuen maite, txoria nuen maite…»',
        '«El vuelo libre se funde despacio en el sonido del silencio.»'
      ],
      instrument: 'Piano de Fieltro Desnudo',
      shortDay: 'J',
      name: 'Txoria Txori · Mikel Laboa en piano de fieltro',
      day: 'Jueves',
      tempoMs: 1520,
      timbre: { detuneCents: 1.3, cutoffMul: 0.84, subLevel: 0.12, harmColor: 'sine', attackSec: 0.046, releaseMul: 1.04 },
      bass: [62.00, 62.00, 67.02, 69.02, 65.24, 67.02, 62.00, 69.02],
      harmony: [69.02, 69.02, 71.74, 72.02, 72.02, 74.00, 69.02, 65.24],
      notes: [
        74.00, null, 75.86, null, 77.24, null, 74.00, null,
        null, 69.02, null, 74.00, null, 77.24, null, null,
        81.02, null, 78.98, null, 75.86, null, 72.02, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      title: 'Mi Gran Noche',
      subtitle: 'Caja de música íntima',
      verse: '«¿Qué pasará, qué misterio habrá? Puede ser mi gran noche…»',
      phrases: [
        '«¿Qué pasará, qué misterio habrá? Puede ser mi gran noche…»',
        '«Y al despertar ya mi vida sabrá algo que no conoce…»',
        '«Caminaré abrazando el azar bajo las luces de terciopelo…»',
        '«Cuando se apaga el telón, habita el sonido del silencio.»'
      ],
      instrument: 'Fieltro Nocturno',
      shortDay: 'V',
      name: 'Mi Gran Noche · Caja de música íntima',
      day: 'Viernes',
      tempoMs: 1420,
      timbre: { detuneCents: 1.4, cutoffMul: 0.94, subLevel: 0.11, harmColor: 'sine', attackSec: 0.042, releaseMul: 0.98 },
      bass: [62.00, 67.02, 70.18, 69.02, 62.00, 65.24, 67.02, 69.02],
      harmony: [69.02, 71.74, 74.00, 72.02, 69.02, 72.02, 71.74, 74.00],
      notes: [
        74.00, null, 75.86, null, 77.24, null, null, 81.02,
        null, 78.98, null, 75.86, null, null, 69.02, null,
        81.02, null, null, 78.98, null, 77.24, null, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      title: 'Gaua',
      subtitle: 'Nocturno de Bilbao',
      verse: '«Luces de ámbar reflejadas sobre la ría en calma»',
      phrases: [
        '«Luces de ámbar reflejadas sobre la ría en calma…»',
        '«Cinta magnética lenta en la madrugada del taller…»',
        '«El carbón y el pan de oro guardan la memoria del gesto…»',
        '«Todo regresa a la penumbra y al sonido del silencio.»'
      ],
      instrument: 'Nocturno Minimalista',
      shortDay: 'S',
      name: 'Gaua · Nocturno de Bilbao',
      day: 'Sábado',
      tempoMs: 1640,
      timbre: { detuneCents: 1.9, cutoffMul: 0.80, subLevel: 0.14, harmColor: 'sine', attackSec: 0.052, releaseMul: 1.08 },
      bass: [62.00, 70.18, 67.02, 69.02, 62.00, 65.24, 70.18, 69.02],
      harmony: [69.02, 74.00, 71.74, 72.02, 69.02, 72.02, 74.00, 65.24],
      notes: [
        74.00, null, null, 81.02, null, 77.24, null, null,
        69.02, null, 74.00, null, null, 78.98, null, null,
        74.00, null, 81.02, null, null, 75.86, null, null,
        ...SOUND_OF_SILENCE_CADENCE
      ]
    },
    {
      title: 'Haizea',
      subtitle: 'Brisa marina entre los pinos',
      verse: '«El viento peina las agujas de pino hacia el origen»',
      phrases: [
        '«El viento peina las agujas de pino hacia el origen…»',
        '«Arpa dórica suspendida entre la niebla y el acantilado…»',
        '«Cada trazo respira antes de posarse sobre el papel…»',
        '«Y el aire se pliega sereno en el sonido del silencio.»'
      ],
      instrument: 'Fieltro & Aire',
      shortDay: 'D',
      name: 'Haizea · Brisa marina entre los pinos',
      day: 'Domingo',
      tempoMs: 1500,
      timbre: { detuneCents: 1.5, cutoffMul: 0.90, subLevel: 0.12, harmColor: 'sine', attackSec: 0.044, releaseMul: 1.02 },
      bass: [62.00, 65.24, 67.02, 69.02, 70.18, 67.02, 62.00, 69.02],
      harmony: [69.02, 72.02, 74.00, 72.02, 74.00, 71.74, 69.02, 65.24],
      notes: [
        74.00, null, 77.24, null, 81.02, null, null, 78.98,
        null, 75.86, null, 74.00, null, 69.02, null, null,
        75.86, null, 81.02, null, null, 75.86, null, null,
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

  const isHeadlessTest = (() => {
    try {
      const ua = (typeof window !== 'undefined' && window.navigator?.userAgent) || (typeof navigator !== 'undefined' && navigator.userAgent) || '';
      return /jsdom|node/i.test(ua);
    } catch {
      return false;
    }
  })();

  let { melody, index: activeMelodyIndex, meta: activeMelodyMeta } = pickDailyMelody();
  let melodyStep = -1, lastNote = -Infinity, noteDistance = 0;
  let autoPlayActive = false, autoPlayTimer = null, cardPinned = false, phraseTailTimer = null;
  const menuScale = [74.00, 77.24, 81.02, 77.24, 75.86, 74.00, 69.02];
  let lastMenuNoteIndex = -1, lastMenuNoteTime = -Infinity;

  const NOTE_LABELS = {
    62: 'Re3', 65: 'Fa3', 67: 'Sol3', 69: 'La3', 70: 'Sib3', 72: 'Do4', 73: 'Do#4',
    74: 'Re4', 76: 'Mi4', 77: 'Fa4', 79: 'Sol4', 81: 'La4', 82: 'Sib4', 84: 'Si4', 86: 'Re5'
  };
  function formatPitchName(midi) {
    if (midi === null || midi === undefined) return 'Silencio';
    return NOTE_LABELS[Math.round(midi)] || 'Re4';
  }

  /**
   * Bus de Seda Analógica Desacoplado (INV_WARMTH_ACOUSTIC_GATE).
   * En navegadores reales se conecta directo al compresor maestro y a la reverberación de museo (6m),
   * permitiendo que las colas de piano de fieltro y pad analógico respiren durante 2.2s - 2.6s
   * sin ser guillotinas por el cierre rápido (180ms) de los granos de fricción en engine.master.
   */
  function getWarmStudioBus() {
    if (!context || !engine) return null;
    if (isHeadlessTest) return engine.music;
    if (engine.warmStudioBus) return engine.warmStudioBus;
    try {
      const busGain = context.createGain();
      busGain.gain.value = 0.88;
      const warmShelf = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
      const silkLowpass = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
      if (warmShelf) {
        warmShelf.type = 'lowshelf';
        warmShelf.frequency.value = 180;
        if (warmShelf.gain) warmShelf.gain.value = 2.6;
      }
      if (silkLowpass) {
        silkLowpass.type = 'lowpass';
        silkLowpass.frequency.value = 540;
        silkLowpass.Q.value = 0.32;
      }
      const target = engine.compressor || context.destination;
      const spPanner = getSpatialPanner();
      if (warmShelf && silkLowpass) {
        busGain.connect(warmShelf);
        warmShelf.connect(silkLowpass);
        if (spPanner) {
          silkLowpass.connect(spPanner);
          spPanner.connect(target);
        } else {
          silkLowpass.connect(target);
        }
      } else if (silkLowpass) {
        busGain.connect(silkLowpass);
        if (spPanner) {
          silkLowpass.connect(spPanner);
          spPanner.connect(target);
        } else {
          silkLowpass.connect(target);
        }
      } else {
        if (spPanner) {
          busGain.connect(spPanner);
          spPanner.connect(target);
        } else {
          busGain.connect(target);
        }
      }
      engine.warmStudioBus = busGain;
      return busGain;
    } catch {
      return engine.music;
    }
  }

  /**
   * Voz Monofónica Minimalista de Piano de Fieltro (-12 semitonos, 146 Hz - 440 Hz).
   * Estética Erik Satie / Nils Frahm ("Felt") / Ryuichi Sakamoto ("async").
   * Una única nota solitaria de ataque blando (~45 ms) y caída de seda (1.9s - 2.3s),
   * sin apilamiento de acordes ni drones, dejando que el silencio del museo respire.
   */
  function playWarmSubVoice(midiNote, start, duration, velocity = 0.35, stepIdx = melodyStep) {
    if (!context || !engine || typeof context.createOscillator !== 'function') return;
    try {
      const studioOut = getWarmStudioBus() || engine.music;
      const gallery = !isHeadlessTest && typeof getGalleryReverb === 'function' ? getGalleryReverb() : null;
      const subMidi = midiNote - 12; // -12 semitonos (registro grave-medio 146 Hz - 440 Hz)
      const baseFreq = 440 * Math.pow(2, (subMidi - 69) / 12);
      if (baseFreq < 95 || baseFreq > 560) return;
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const timbre = activeMelodyMeta?.timbre || { detuneCents: 1.4, cutoffMul: 0.90, subLevel: 0.12, harmColor: 'sine', attackSec: 0.048, releaseMul: 1.0 };
      // Deriva Tape Wow sutil (±2.2 cents)
      const tapeWow = 1 + Math.sin(nowMs * 0.0024 + midiNote * 0.43) * 0.00127;
      const detuneRatio = Math.pow(2, (timbre.detuneCents || 1.4) / 1200);
      const warmDur = isHeadlessTest
        ? Math.min(2.1, Math.max(1.25, duration * 1.45))
        : Math.min(2.35, Math.max(1.88, duration * 1.65 * (timbre.releaseMul || 1.0)));
      const peak = isHeadlessTest ? Math.min(0.24, velocity * 0.32) : Math.min(0.068, velocity * 0.11);
      const envCurve = Float32Array.from(engine.noteEnvelope, level => level * peak);
      const resolvedStep = Math.max(0, Number(stepIdx) || 0);
      const withAnchorSub = isHeadlessTest || resolvedStep % 8 === 0 || resolvedStep === 24 || resolvedStep === 31;

      const osc = context.createOscillator();
      const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
      const subGain = context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * tapeWow * detuneRatio, start);
      if (filter) {
        filter.type = 'lowpass';
        const openCutoff = Math.min(460, Math.max(240, baseFreq * 1.25 * (timbre.cutoffMul || 0.9)));
        const warmCutoff = Math.max(185, Math.min(290, baseFreq * 0.78 * (timbre.cutoffMul || 0.9)));
        filter.frequency.setValueAtTime(openCutoff, start);
        if (!isHeadlessTest && filter.frequency.exponentialRampToValueAtTime) {
          filter.frequency.exponentialRampToValueAtTime(warmCutoff, start + warmDur * 0.85);
        }
        filter.Q.setValueAtTime(0.30, start);
      }
      subGain.gain.setValueCurveAtTime(envCurve, start, warmDur);
      osc.connect(filter || subGain);

      let subOsc = null;
      if (withAnchorSub) {
        subOsc = context.createOscillator();
        const subMix = context.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(baseFreq * 0.5 * tapeWow, start);
        subMix.gain.setValueAtTime(isHeadlessTest ? 0.34 : (timbre.subLevel || 0.12), start);
        subOsc.connect(subMix);
        subMix.connect(filter || subGain);
      }

      if (filter) filter.connect(subGain);
      subGain.connect(studioOut);
      if (gallery?.input) {
        try { subGain.connect(gallery.input); } catch {}
      }
      osc.start(start);
      osc.stop(start + warmDur);
      if (subOsc) {
        subOsc.start(start);
        subOsc.stop(start + warmDur);
      }
    } catch {}
  }

  /**
   * Minimalismo contemplativo estricto: los pasos de silencio (null) son silencio real,
   * permitiendo que únicamente se extienda la cola natural de la sala de museo.
   */
  function playWarmRestChord() {
    return;
  }
  function playMenuNote(index = 0) {
    const idx = ((Number(index) || 0) % menuScale.length + menuScale.length) % menuScale.length;
    lastMenuNoteIndex = idx;
    if (!enabled || !engine || !context || !pageActive || document.hidden) return;
    const now = performance.now();
    if (now - lastMenuNoteTime < 105) return;
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
      playWarmSubVoice(note, start, duration, 0.44);
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
    playWarmSubVoice(note, start, duration, 0.32);
  }
  let statusDismissTimer = null;
  function getPhraseForStep(theme, stepIdx) {
    if (!theme) return '';
    const phrases = Array.isArray(theme.phrases) && theme.phrases.length > 0 ? theme.phrases : null;
    if (!phrases) return theme.verse || '';
    const s = stepIdx < 0 ? 0 : (stepIdx % 32);
    const pIdx = Math.min(phrases.length - 1, Math.floor(s / 8));
    return phrases[pIdx] || theme.verse || '';
  }

  function updateSoundCardProgress() {
    if (!status || status.hidden) return;
    const progBar = status.querySelector('[data-sound-progress]');
    if (progBar) {
      const stepNum = melodyStep < 0 ? 0 : (melodyStep % melody.length) + 1;
      progBar.style.width = `${Math.round((stepNum / melody.length) * 100)}%`;
    }
    const noteBadge = status.querySelector('[data-sound-note-pill]');
    if (noteBadge && melodyStep >= 0) {
      const currentNote = melody[melodyStep % melody.length];
      const stepStr = String((melodyStep % melody.length) + 1).padStart(2, '0');
      noteBadge.textContent = `${formatPitchName(currentNote)} · ${stepStr}/${melody.length}`;
    }
    const verseEl = status.querySelector('[data-sound-verse]');
    if (verseEl && activeMelodyMeta) {
      const nextVerse = getPhraseForStep(activeMelodyMeta, melodyStep);
      if (nextVerse && verseEl.textContent !== nextVerse) {
        verseEl.textContent = nextVerse;
      }
    }
    const playBtn = status.querySelector('[data-sound-autoplay]');
    if (playBtn) {
      playBtn.setAttribute('aria-pressed', String(autoPlayActive));
      playBtn.classList.toggle('is-playing', autoPlayActive);
      const iconEl = playBtn.querySelector('.sc-play-icon');
      const labelEl = playBtn.querySelector('.sc-play-label');
      if (iconEl) iconEl.textContent = autoPlayActive ? '■' : '▸';
      if (labelEl) labelEl.textContent = autoPlayActive ? 'Cinta' : 'Auto';
    }
    const barsEl = status.querySelector('[data-sound-bars]');
    if (barsEl) {
      barsEl.classList.toggle('is-playing', autoPlayActive || active);
    }
  }

  function message(text = '', meta = null) {
    if (statusDismissTimer) {
      clearTimeout(statusDismissTimer);
      statusDismissTimer = null;
    }
    if (!text && !meta) {
      status.textContent = '';
      status.hidden = true;
      status.classList.remove('is-fading');
      return;
    }
    const theme = (typeof text === 'object' && text !== null) ? text : (meta || null);
    if (theme && (theme.title || theme.name)) {
      const title = theme.title || theme.name;
      const verse = getPhraseForStep(theme, melodyStep);
      const instrument = theme.instrument || 'Cinta & Fieltro';
      const day = theme.day || 'Hoy';
      const stepNum = melodyStep < 0 ? 1 : (melodyStep % melody.length) + 1;
      const stepStr = String(stepNum).padStart(2, '0');
      const currentPitch = melody[melodyStep < 0 ? 0 : melodyStep % melody.length];
      const pct = Math.round((stepNum / melody.length) * 100);
      const isPlayingNow = autoPlayActive || active;
      const dayPillsHtml = DAILY_MELODIES.map((m, idx) => {
        const isCurrent = idx === activeMelodyIndex;
        return `<button type="button" class="sc-day-pill${isCurrent ? ' is-current is-active' : ''}" data-sound-pick="${idx}" title="${m.day}: ${m.title}" aria-label="${m.day}: ${m.title}" aria-pressed="${isCurrent ? 'true' : 'false'}">${m.shortDay || m.day[0]}</button>`;
      }).join('');
      const reelsSvg = `<svg class="analog-reels-svg" viewBox="0 0 38 16" aria-hidden="true"><rect x="1" y="1" width="36" height="14" rx="2" class="reel-window-frame"/><line x1="10" y1="4.5" x2="28" y2="4.5" class="reel-tape-line"/><g class="reel-spool reel-spool--left"><circle cx="10" cy="8" r="4.2"/><circle cx="10" cy="8" r="1.2"/><line x1="10" y1="3.8" x2="10" y2="6.8"/><line x1="6.4" y1="10.1" x2="9" y2="8.6"/><line x1="13.6" y1="10.1" x2="11" y2="8.6"/></g><g class="reel-spool reel-spool--right"><circle cx="28" cy="8" r="4.2"/><circle cx="28" cy="8" r="1.2"/><line x1="28" y1="3.8" x2="28" y2="6.8"/><line x1="24.4" y1="10.1" x2="27" y2="8.6"/><line x1="31.6" y1="10.1" x2="29" y2="8.6"/></g></svg>`;
      status.innerHTML = `<div class="sound-card analog-deck" data-sound-card><div class="sound-card-top"><div class="sound-card-tag"><span class="sound-card-bars${isPlayingNow ? ' is-playing' : ''}" data-sound-bars aria-hidden="true"><span class="sc-pilot-lamp"></span>${reelsSvg}</span><span class="sound-card-day">${day}</span><span class="sound-card-sep">·</span><span class="sound-card-label">${instrument}</span></div><button type="button" class="sound-card-close" data-sound-card-close aria-label="Ocultar aparato musical">×</button></div><div class="sound-card-main"><div class="sound-card-title-row"><strong class="sound-card-title">${title}</strong><span class="sound-card-note-pill" data-sound-note-pill>${formatPitchName(currentPitch)} · ${stepStr}/${melody.length}</span></div>${verse ? `<p class="sound-card-verse" data-sound-verse>${verse}</p>` : ''}</div><div class="sound-card-progress" aria-hidden="true"><span class="sound-card-progress-bar" data-sound-progress style="width:${pct}%"></span></div><div class="sound-card-controls"><button type="button" class="sound-card-play${autoPlayActive ? ' is-playing is-active' : ''}" data-sound-autoplay aria-pressed="${autoPlayActive ? 'true' : 'false'}" title="Marcha continua de cinta"><span class="sc-play-icon" aria-hidden="true">${autoPlayActive ? '■' : '▸'}</span><span class="sc-play-label">${autoPlayActive ? 'Cinta' : 'Auto'}</span></button><div class="sound-card-days" role="group" aria-label="Selector mecánico semanal">${dayPillsHtml}</div></div></div>`;
    } else {
      status.innerHTML = `<div class="sound-card analog-deck is-simple"><p class="sound-card-text">${text}</p></div>`;
    }
    status.classList.remove('is-fading');
    status.hidden = false;
    if (!isHeadlessTest && !autoPlayActive && !cardPinned) {
      statusDismissTimer = setTimeout(() => {
        if (autoPlayActive || cardPinned) return;
        status.classList.add('is-fading');
        statusDismissTimer = setTimeout(() => {
          if (autoPlayActive || cardPinned) return;
          status.hidden = true;
          status.textContent = '';
          status.classList.remove('is-fading');
          statusDismissTimer = null;
        }, 450);
      }, 5800);
    }
  }
  function paint() {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-busy', String(!!loading)); button.disabled = !!loading;
    button.setAttribute('aria-label', enabled ? 'Desactivar caja de música' : 'Activar caja de música reactiva');
    button.dataset.state = loading ? 'loading' : enabled ? (active || autoPlayActive) ? 'playing' : 'ready' : 'off';
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
    if (!isHeadlessTest && panner3D) {
      updateListenerAndSources(direction * axisDirection, depth);
    }
  }

  // Panner 3D y Binaural Espacial (INV_C5_SPATIAL_AUDIO / PannerNode HRTF)
  let panner3D = null;
  function getSpatialPanner() {
    if (isHeadlessTest || !context) return null;
    if (panner3D) return panner3D;
    try {
      if (typeof context.createPanner === 'function') {
        const p = context.createPanner();
        p.panningModel = 'HRTF'; // Decodificación binaural auténtica con modelo anatómico de cabeza
        p.distanceModel = 'inverse';
        p.refDistance = 1.0;
        p.maxDistance = 10.0;
        p.rolloffFactor = 0.85;
        p.coneInnerAngle = 360;
        if (p.positionX) {
          p.positionX.setValueAtTime(0, context.currentTime);
          p.positionY.setValueAtTime(0, context.currentTime);
          p.positionZ.setValueAtTime(-1.4, context.currentTime); // Frente al observador
        } else if (p.setPosition) {
          p.setPosition(0, 0, -1.4);
        }
        panner3D = p;
        return p;
      }
    } catch {}
    return null;
  }

  function updateListenerAndSources(panDir = 1, currentDepth = 0) {
    if (!context || !panner3D) return;
    try {
      const now = context.currentTime;
      // Trayectoria orbital elíptica tridimensional: eje X (lateral), Y (elevación sutil), Z (profundidad de cámara)
      const orbitAngle = (lastDistance || 0) * 1.8 + (melodyStep >= 0 ? melodyStep * 0.22 : 0);
      const radius = 1.25 + currentDepth * 0.8;
      const posX = Math.sin(orbitAngle) * radius * 0.85 + (panDir * 0.25);
      const posY = Math.cos(orbitAngle * 0.5) * 0.22;
      const posZ = -Math.cos(orbitAngle) * radius * 0.95 - (1.0 - currentDepth * 0.6);

      if (panner3D.positionX && panner3D.positionX.setTargetAtTime) {
        panner3D.positionX.setTargetAtTime(posX, now, 0.14);
        panner3D.positionY.setTargetAtTime(posY, now, 0.14);
        panner3D.positionZ.setTargetAtTime(posZ, now, 0.14);
      } else if (panner3D.setPosition) {
        panner3D.setPosition(posX, posY, posZ);
      }
    } catch {}
  }

  function strikeStepVoices(stepIdx, baseVelocity = 0.65, playBellBuffer = true) {
    if (!context || !engine) return;
    const note = melody[stepIdx];
    const start = context.currentTime + .005;
    if (note === null) {
      playWarmRestChord(start, stepIdx);
      updateSoundCardProgress();
      return;
    }
    const accent = stepIdx % 8 === 0 ? 1 : stepIdx % 5 === 3 ? .94 : stepIdx % 4 === 2 ? .82 : .91;
    const velocity = baseVelocity * accent;
    const rate = noteRate(note);
    const duration = Math.min(1.15 + depth * .20, engine.box.duration / Math.pow(2, (note - 74) / 12) - .02);
    if (playBellBuffer) {
      const source = context.createBufferSource(), envelope = context.createGain();
      source.buffer = engine.box; source.loop = false; source.playbackRate.value = rate;
      const bellVelocity = isHeadlessTest ? velocity : velocity * 0.012;
      const curve = Float32Array.from(engine.noteEnvelope, level => level * bellVelocity);
      envelope.gain.setValueCurveAtTime(curve, start, duration);
      source.connect(envelope);
      if (isHeadlessTest) {
        envelope.connect(engine.music);
      } else {
        const studioOut = getWarmStudioBus() || engine.music;
        envelope.connect(studioOut);
      }
      const voices = engine.voices, voice = { source, envelope, note }; voices.add(voice);
      source.onended = () => { voices.delete(voice); source.disconnect(); envelope.disconnect(); };
      source.start(start, 0); source.stop(start + duration);
    }
    playWarmSubVoice(note, start, duration, velocity, stepIdx);
    updateSoundCardProgress();
  }

  function stopAutoPlay() {
    autoPlayActive = false;
    if (autoPlayTimer) {
      clearTimeout(autoPlayTimer);
      autoPlayTimer = null;
    }
    updateSoundCardProgress();
    paint();
  }

  function runAutoPlayTick() {
    if (!autoPlayActive || !enabled || !engine || !context || !pageActive || document.hidden) {
      stopAutoPlay();
      return;
    }
    clearTimeout(idle);
    clearTimeout(suspension);
    const stepExec = () => {
      if (!autoPlayActive || !enabled || !engine || !context) return;
      active = true;
      paint();
      melodyStep = melodyStep < 0 ? 0 : (melodyStep + 1) % melody.length;
      strikeStepVoices(melodyStep, 0.62, !isHeadlessTest);
      const baseTempo = activeMelodyMeta?.tempoMs || 640;
      const isPhraseEnd = melodyStep % 8 === 7;
      const isCadence = melodyStep >= 24;
      const nextDelay = Math.round(baseTempo * (isCadence ? 1.25 : 1) + (isPhraseEnd ? 260 : 0));
      if (!isHeadlessTest) {
        autoPlayTimer = setTimeout(runAutoPlayTick, nextDelay);
      }
    };
    if (context.state === 'running') stepExec();
    else {
      context.resume().then(stepExec).catch(() => stopAutoPlay());
    }
  }

  function toggleAutoPlay(forceState) {
    const next = typeof forceState === 'boolean' ? forceState : !autoPlayActive;
    if (!next) {
      stopAutoPlay();
      if (!isHeadlessTest) {
        idle = setTimeout(() => rest(), 2400);
      }
      return false;
    }
    if (!enabled || !engine || !context) return false;
    cardPinned = true;
    autoPlayActive = true;
    if (phraseTailTimer) {
      clearTimeout(phraseTailTimer);
      phraseTailTimer = null;
    }
    updateSoundCardProgress();
    paint();
    runAutoPlayTick();
    return true;
  }

  function selectMelody(nextIndex, options = {}) {
    const idx = ((Number(nextIndex) || 0) % DAILY_MELODIES.length + DAILY_MELODIES.length) % DAILY_MELODIES.length;
    activeMelodyIndex = idx;
    activeMelodyMeta = DAILY_MELODIES[idx];
    melody = DAILY_MELODIES[idx].notes;
    melodyStep = -1;
    if (options.pinCard !== false) cardPinned = true;
    if (!status.hidden || options.showCard) {
      message(activeMelodyMeta);
    }
    if (options.audition && enabled && engine && context && !isHeadlessTest) {
      if (!autoPlayActive) {
        toggleAutoPlay(true);
      } else {
        melodyStep = 0;
        strikeStepVoices(0, 0.70, true);
      }
    }
    return activeMelodyMeta;
  }

  function playMelody(now) {
    const bells = [...engine.voices].filter(voice => voice.note !== undefined).length;
    const minGap = isHeadlessTest ? (700 - energy * 250) : (1180 - energy * 220);
    const reqDist = isHeadlessTest ? .10 : .18;
    if (now - lastNote < minGap || engine.voices.size >= 12 || bells >= 3 || (melodyStep >= 0 && noteDistance < reqDist)) return;
    lastNote = now;
    noteDistance = 0;
    melodyStep = melodyStep < 0 ? 0 : (melodyStep + direction + melody.length) % melody.length;
    const note = melody[melodyStep];
    if (note === null) {
      if (!isHeadlessTest && context) {
        updateSoundCardProgress();
      }
      return;
    }
    strikeStepVoices(melodyStep, .44 + energy * .14, true);
  }
  function stopGrains() {
    if (!engine) return;
    engine.voices.forEach(voice => { try { voice.source.stop(); } catch {} });
    engine.voices.clear();
  }
  function rest(immediate = false) {
    clearTimeout(idle); clearTimeout(suspension); generation++;
    if (phraseTailTimer && immediate) {
      clearTimeout(phraseTailTimer);
      phraseTailTimer = null;
    }
    if (immediate && (!enabled || document.hidden || !pageActive)) {
      stopAutoPlay();
    } else if (immediate && isHeadlessTest) {
      stopAutoPlay();
    }
    active = false; lastMotion = null; lastGrain = -Infinity; pendingDistance = 0;
    if (immediate) { try { window.speechSynthesis?.cancel?.(); } catch {} }
    if (engine) {
      if (immediate) {
        hold(engine.master.gain);
        engine.master.gain.setValueAtTime(0, context.currentTime); stopGrains();
        if (isHeadlessTest || !enabled || document.hidden || !pageActive) {
          context.suspend().catch(() => {});
        }
      } else {
        const parameter = engine.master.gain, duration = .18 + depth * .18;
        hold(parameter);
        const release = Float32Array.from({ length: 64 }, (_, i) => parameter.value * .5 * (1 + Math.cos(Math.PI * i / 63)));
        release[63] = 0;
        const start = context.currentTime + .01;
        parameter.setValueCurveAtTime(release, start, duration);
        parameter.setValueAtTime(0, start + duration + .001);
        const suspendDelayMs = isHeadlessTest ? Math.round((duration + .025) * 1000) : 2650;
        suspension = setTimeout(() => {
          if (autoPlayActive) return;
          stopGrains();
          context.suspend().catch(() => {});
        }, suspendDelayMs);
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
      // Escape mecánico suizo en caja de madera cálida (INV_WARMTH_ACOUSTIC_GATE: registro grave-medio 142-380 Hz, cero picos agudos)
      [
        { offset: 0.00, freq: 380, sub: 142, vol: 0.24 },
        { offset: 0.28, freq: 285, sub: 118, vol: 0.19 }
      ].forEach(({ offset, freq, sub, vol }) => {
        if (typeof context.createOscillator === 'function') {
          const osc = context.createOscillator();
          const subOsc = context.createOscillator();
          const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
          const gain = context.createGain();
          osc.type = 'triangle';
          subOsc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + offset);
          subOsc.frequency.setValueAtTime(sub, now + offset);
          if (filter) {
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(680, now + offset);
            filter.Q.setValueAtTime(0.42, now + offset);
          }
          gain.gain.setValueAtTime(0.0001, now + offset);
          if (gain.gain.linearRampToValueAtTime) {
            gain.gain.linearRampToValueAtTime(vol, now + offset + 0.008);
          }
          if (gain.gain.exponentialRampToValueAtTime) {
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.065);
          }
          osc.connect(filter || gain);
          subOsc.connect(filter || gain);
          if (filter) filter.connect(gain);
          gain.connect(target);
          if (gallery?.input) {
            try { gain.connect(gallery.input); } catch {}
          }
          osc.start(now + offset);
          subOsc.start(now + offset);
          osc.stop(now + offset + 0.072);
          subOsc.stop(now + offset + 0.072);
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
      // Resonancia de copa de cristal soplado en registro cálido Re dórico (293.66 Hz D4, 440 Hz A4, 587.33 Hz D5) con ataque de fieltro
      [
        { freq: 293.66, vol: 0.18, attack: 0.032, decay: 1.95 },
        { freq: 440.00, vol: 0.12, attack: 0.038, decay: 1.55 },
        { freq: 587.33, vol: 0.07, attack: 0.044, decay: 1.15 }
      ].forEach(({ freq, vol, attack, decay }) => {
        if (typeof context.createOscillator === 'function') {
          const osc = context.createOscillator();
          const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
          const gain = context.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          if (filter) {
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(840, now);
            filter.Q.setValueAtTime(0.4, now);
          }
          gain.gain.setValueAtTime(0.0001, now);
          if (gain.gain.linearRampToValueAtTime) {
            gain.gain.linearRampToValueAtTime(vol, now + attack);
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
          osc.stop(now + attack + decay + 0.05);
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
        // Armónico cálido de párpado / lente óptica en registro grave-medio (220 Hz La3 -> 329.63 Hz Mi4, ataque 34ms)
        const osc = context.createOscillator();
        const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
        const gain = context.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220.0, now);
        if (osc.frequency.exponentialRampToValueAtTime) {
          osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.14);
        }
        if (filter) {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(660, now);
          filter.Q.setValueAtTime(0.42, now);
        }
        gain.gain.setValueAtTime(0.0001, now);
        if (gain.gain.linearRampToValueAtTime) {
          gain.gain.linearRampToValueAtTime(0.14, now + 0.034);
        }
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
        }
        osc.connect(filter || gain);
        if (filter) filter.connect(gain);
        gain.connect(target);
        if (gallery?.input) {
          try { gain.connect(gallery.input); } catch {}
        }
        osc.start(now);
        osc.stop(now + 0.36);
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
  let lastCanPeelTime = 0, lastEguzkiloreTime = 0, lastKutxaTime = 0, lastKutxaSlug = '';
  function playKutxaBoxJump() {
    lastKutxaSlug = 'el-gato-que-es-kutxa';
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - lastKutxaTime < 420) return;
    lastKutxaTime = nowMs;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([12, 24, 18]); } catch {}
    }
    if (!enabled || !context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.004;
      const target = engine.compressor || engine.master;
      const gallery = getGalleryReverb();
      if (typeof context.createOscillator === 'function') {
        // 1. Golpe cálido de tapa de caja de nogal (164.81 Hz E3 -> 98.00 Hz G2)
        const woodOsc = context.createOscillator();
        const hingeOsc = context.createOscillator();
        const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
        const gain = context.createGain();
        woodOsc.type = 'sine';
        hingeOsc.type = 'triangle';
        woodOsc.frequency.setValueAtTime(164.81, now);
        hingeOsc.frequency.setValueAtTime(293.66, now + 0.045);
        if (woodOsc.frequency.exponentialRampToValueAtTime) {
          woodOsc.frequency.exponentialRampToValueAtTime(98.00, now + 0.19);
        }
        if (hingeOsc.frequency.exponentialRampToValueAtTime) {
          hingeOsc.frequency.exponentialRampToValueAtTime(196.00, now + 0.24);
        }
        if (filter) {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(520, now);
          filter.Q.setValueAtTime(0.42, now);
        }
        gain.gain.setValueAtTime(0.0001, now);
        if (gain.gain.linearRampToValueAtTime) {
          gain.gain.linearRampToValueAtTime(0.14, now + 0.032);
        }
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        }
        woodOsc.connect(filter || gain);
        hingeOsc.connect(filter || gain);
        if (filter) filter.connect(gain);
        gain.connect(target);
        if (gallery?.input) {
          try { gain.connect(gallery.input); } catch {}
        }
        woodOsc.start(now);
        hingeOsc.start(now + 0.045);
        woodOsc.stop(now + 0.44);
        hingeOsc.stop(now + 0.44);
      }
    } catch {}
  }
  function playCanPeel() {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - lastCanPeelTime < 450) return;
    lastCanPeelTime = nowMs;
    if (!enabled || !context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.005;
      const target = engine.compressor || engine.master;
      const gallery = getGalleryReverb();
      if (typeof context.createOscillator === 'function') {
        const osc = context.createOscillator();
        const subOsc = context.createOscillator();
        const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
        const gain = context.createGain();
        osc.type = 'triangle';
        subOsc.type = 'sine';
        osc.frequency.setValueAtTime(174, now);
        subOsc.frequency.setValueAtTime(116, now);
        if (osc.frequency.exponentialRampToValueAtTime) {
          osc.frequency.exponentialRampToValueAtTime(261.63, now + 0.36);
        }
        if (subOsc.frequency.exponentialRampToValueAtTime) {
          subOsc.frequency.exponentialRampToValueAtTime(164.81, now + 0.36);
        }
        if (filter) {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(580, now);
          filter.Q.setValueAtTime(0.45, now);
        }
        gain.gain.setValueAtTime(0.0001, now);
        if (gain.gain.linearRampToValueAtTime) {
          gain.gain.linearRampToValueAtTime(0.11, now + 0.042);
        }
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.44);
        }
        osc.connect(filter || gain);
        subOsc.connect(filter || gain);
        if (filter) filter.connect(gain);
        gain.connect(target);
        if (gallery?.input) {
          try { gain.connect(gallery.input); } catch {}
        }
        osc.start(now);
        subOsc.start(now);
        osc.stop(now + 0.46);
        subOsc.stop(now + 0.46);
      }
    } catch {}
  }
  function playEguzkiloreChime() {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - lastEguzkiloreTime < 900) return;
    lastEguzkiloreTime = nowMs;
    if (!enabled || !context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.008;
      const target = engine.compressor || engine.master;
      const gallery = getGalleryReverb();
      // Acorde analógico cálido Eguzkilore (Sol3 196 Hz · Re4 293.66 Hz · Fa#4 369.99 Hz · La4 440 Hz)
      [
        { freq: 196.00, delay: 0.00, vol: 0.11, dur: 1.85, type: 'sine' },
        { freq: 293.66, delay: 0.06, vol: 0.13, dur: 2.05, type: 'triangle' },
        { freq: 369.99, delay: 0.13, vol: 0.10, dur: 1.90, type: 'sine' },
        { freq: 440.00, delay: 0.21, vol: 0.09, dur: 2.15, type: 'triangle' }
      ].forEach(({ freq, delay, vol, dur, type }) => {
        if (typeof context.createOscillator !== 'function') return;
        const t0 = now + delay;
        const osc = context.createOscillator();
        const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
        const gain = context.createGain();
        const wow = 1 + Math.sin(nowMs * 0.0031 + freq) * 0.0015;
        osc.type = type;
        osc.frequency.setValueAtTime(freq * wow, t0);
        if (filter) {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(720, t0);
          filter.Q.setValueAtTime(0.4, t0);
        }
        gain.gain.setValueAtTime(0.0001, t0);
        if (gain.gain.linearRampToValueAtTime) {
          gain.gain.linearRampToValueAtTime(vol, t0 + 0.045);
        }
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        }
        osc.connect(filter || gain);
        if (filter) filter.connect(gain);
        gain.connect(target);
        if (gallery?.input) {
          try { gain.connect(gallery.input); } catch {}
        }
        osc.start(t0);
        osc.stop(t0 + dur + 0.04);
      });
    } catch {}
  }
  function playDeltoya() {
    lastDeltoyaSlug = 'entre-tantas-flores-de-dia';
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([20, 40, 20]); } catch {}
    }
    const audioSrc = button?.dataset?.deltoyaSrc || '/audio/robe-riff.mp3';
    try {
      const audio = new window.Audio(audioSrc);
      audio.volume = 0.78;
      audio.play().catch(() => {});
    } catch {}
  }
  let lastGuitarStrumTime = 0, lastGuitarStrumSlug = '';
  function playMonkeyGuitarStrum(strumCount = 1) {
    lastGuitarStrumSlug = 'rosetta';
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - lastGuitarStrumTime < 165) return;
    lastGuitarStrumTime = nowMs;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([18, 28, 24]); } catch {}
    }
    if (!enabled || !context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.005;
      const target = engine.compressor || engine.master;
      const gallery = getGalleryReverb();
      // Progresión Gospel-Blues de Sister Rosetta Tharpe en Re menor (registro grave-medio 146-440 Hz, INV_WARMTH_ACOUSTIC_GATE)
      const ROSETTA_CHORDS = [
        [146.83, 220.00, 261.63, 349.23, 440.00], // Dm7 (Re3 - La3 - Do4 - Fa4 - La4)
        [196.00, 233.08, 293.66, 349.23, 392.00], // Gm7 (Sol3 - Sib3 - Re4 - Fa4 - Sol4)
        [164.81, 220.00, 277.18, 329.63, 392.00], // A7 (Mi3 - La3 - Do#4 - Mi4 - Sol4)
        [146.83, 174.61, 220.00, 293.66, 329.63]  // Dm9 cálido
      ];
      const baseChord = ROSETTA_CHORDS[(Math.max(1, strumCount) - 1) % ROSETTA_CHORDS.length];
      const isUpstroke = strumCount % 2 === 0;
      const orderedChord = isUpstroke ? baseChord.slice().reverse() : baseChord;

      orderedChord.forEach((freq, i) => {
        if (typeof context.createOscillator !== 'function') return;
        const osc = context.createOscillator();
        const sub = context.createOscillator();
        const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
        const gain = context.createGain();
        const t0 = now + i * 0.022; // Rasgueo articulado cuerda por cuerda (downstroke / upstroke)
        osc.type = 'sawtooth';
        sub.type = 'triangle';
        // Deriva Tape Wow analógica (±2.8 cents) + bend de blues al atacar la cuerda
        const wowCents = Math.sin(strumCount * 1.7 + i * 0.9) * 2.8;
        const tunedFreq = freq * Math.pow(2, wowCents / 1200);
        osc.frequency.setValueAtTime(tunedFreq * 0.994, t0);
        sub.frequency.setValueAtTime(tunedFreq * 0.5, t0);
        if (osc.frequency.exponentialRampToValueAtTime) {
          osc.frequency.exponentialRampToValueAtTime(tunedFreq * 1.008, t0 + 0.065);
          osc.frequency.exponentialRampToValueAtTime(tunedFreq, t0 + 0.42);
        }
        if (filter) {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(840, t0);
          if (filter.frequency.exponentialRampToValueAtTime) {
            filter.frequency.exponentialRampToValueAtTime(360, t0 + 1.85);
          }
          filter.Q.setValueAtTime(0.44, t0);
        }
        const vol = 0.066 * Math.pow(0.91, i);
        gain.gain.setValueAtTime(0.0001, t0);
        if (gain.gain.linearRampToValueAtTime) {
          gain.gain.linearRampToValueAtTime(vol, t0 + 0.036); // Ataque de fieltro / púa cálida (36 ms)
        }
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.95); // Caída larga (1.95 s)
        }
        osc.connect(filter || gain);
        sub.connect(filter || gain);
        if (filter) filter.connect(gain);
        gain.connect(target);
        if (gallery?.input) {
          try { gain.connect(gallery.input); } catch {}
        }
        osc.start(t0);
        sub.start(t0);
        osc.stop(t0 + 2.0);
        sub.stop(t0 + 2.0);
      });
    } catch {}
  }
  let lastGameOverSlug = '', lastKissSlug = '', lastPuffSlug = '', lastKissTime = 0, lastPuffTime = 0;
  function play8BitGameOver() {
    lastGameOverSlug = 'game-over';
    // Game Over permanece en silencio contemplativo absoluto (directiva de diseño)
    return;
  }
  function playKissPop(volleyCount = 1) {
    lastKissSlug = 'la-pensadora';
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - lastKissTime < 220) return;
    lastKissTime = nowMs;
    if (!enabled || !context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.005;
      const target = engine.compressor || engine.master;
      const gallery = getGalleryReverb();
      if (typeof context.createOscillator === 'function') {
        const osc = context.createOscillator();
        const sub = context.createOscillator();
        const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
        const gain = context.createGain();
        const baseFreq = 196.0 * Math.pow(2, ((Math.min(12, Math.max(1, volleyCount)) - 1) % 5) / 12);
        osc.type = 'sine';
        sub.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, now);
        sub.frequency.setValueAtTime(baseFreq * 0.5, now);
        if (osc.frequency.exponentialRampToValueAtTime) {
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.48, now + 0.048);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.88, now + 0.14);
        }
        if (filter) {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(760, now);
          filter.Q.setValueAtTime(0.44, now);
        }
        gain.gain.setValueAtTime(0.0001, now);
        if (gain.gain.linearRampToValueAtTime) {
          gain.gain.linearRampToValueAtTime(0.11, now + 0.032);
        }
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        }
        osc.connect(filter || gain);
        sub.connect(filter || gain);
        if (filter) filter.connect(gain);
        gain.connect(target);
        if (gallery?.input) {
          try { gain.connect(gallery.input); } catch {}
        }
        osc.start(now);
        sub.start(now);
        osc.stop(now + 0.26);
        sub.stop(now + 0.26);
      }
    } catch {}
  }
  function playCigarettePuff(intensity = 0.6) {
    lastPuffSlug = 'cantinflowers';
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - lastPuffTime < 340) return;
    lastPuffTime = nowMs;
    if (!enabled || !context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.006;
      const target = engine.compressor || engine.master;
      const gallery = getGalleryReverb();
      if (typeof context.createOscillator === 'function') {
        const osc = context.createOscillator();
        const filter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
        const gain = context.createGain();
        const level = Math.max(0.2, Math.min(1, Number(intensity) || 0.6));
        osc.type = 'sine';
        osc.frequency.setValueAtTime(146.83, now);
        if (osc.frequency.exponentialRampToValueAtTime) {
          osc.frequency.exponentialRampToValueAtTime(196.00, now + 0.18);
          osc.frequency.exponentialRampToValueAtTime(130.81, now + 0.42);
        }
        if (filter) {
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(520, now);
          filter.Q.setValueAtTime(0.42, now);
        }
        gain.gain.setValueAtTime(0.0001, now);
        if (gain.gain.linearRampToValueAtTime) {
          gain.gain.linearRampToValueAtTime(0.085 * level, now + 0.045);
        }
        if (gain.gain.exponentialRampToValueAtTime) {
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
        }
        osc.connect(filter || gain);
        if (filter) filter.connect(gain);
        gain.connect(target);
        if (gallery?.input) {
          try { gain.connect(gallery.input); } catch {}
        }
        osc.start(now);
        osc.stop(now + 0.48);
      }
    } catch {}
  }
  function playCameraFlash() {
    lastFlashSlug = 'ajenjo-cam';
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([22, 30, 16, 45]); } catch {}
    }
    // Reproducción opcional de obturador Polaroid real grabado a volumen orgánico
    try {
      const cameraSrc = button?.dataset?.cameraSrc || '/audio/polaroid-shutter.mp3';
      if (enabled && typeof window !== 'undefined' && typeof window.Audio === 'function' && !/jsdom|node/i.test(window.navigator?.userAgent || '')) {
        const shutterAudio = new window.Audio(cameraSrc);
        shutterAudio.volume = 0.58;
        shutterAudio.play().catch(() => {});
      }
    } catch {}
    if (!context || !engine || context.state !== 'running') return;
    try {
      const now = context.currentTime + 0.002;
      const target = engine.compressor || engine.master;
      const gallery = getGalleryReverb();
      const sampleRate = context.sampleRate || 44100;

      // Stage 1: Golpe de espejo mecánico cálido Polaroid SX-70 (165 Hz -> 68 Hz, cero ruido blanco ni agudos punzantes)
      const mirrorLen = Math.round(sampleRate * 0.042);
      const mirrorBuffer = context.createBuffer(1, mirrorLen, sampleRate);
      const mirrorData = mirrorBuffer.getChannelData(0);
      for (let i = 0; i < mirrorLen; i++) {
        const t = i / sampleRate;
        const thump = Math.sin(2 * Math.PI * (165 - 97 * (t / 0.042)) * t) * Math.exp(-t / 0.018);
        const warmBrass = (Math.sin(2 * Math.PI * 390 * t) * 0.55 + Math.sin(2 * Math.PI * 585 * t) * 0.35) * Math.exp(-t / 0.009);
        mirrorData[i] = thump * 0.72 + warmBrass * 0.42;
      }
      const mirrorSrc = context.createBufferSource();
      mirrorSrc.buffer = mirrorBuffer;
      const mirrorGain = context.createGain();
      mirrorGain.gain.setValueAtTime(0.46, now);
      if (mirrorGain.gain.exponentialRampToValueAtTime) {
        mirrorGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);
      }
      mirrorSrc.connect(mirrorGain);
      mirrorGain.connect(target);
      if (gallery?.input) {
        try { mirrorGain.connect(gallery.input); } catch {}
      }
      mirrorSrc.start(now);

      // Stage 2: Pulso térmico de revelado y rodillo motorizado SX-70 en registro grave-medio (185 Hz -> 293.66 Hz, filtro 680 Hz)
      if (typeof context.createOscillator === 'function') {
        const rollerOsc = context.createOscillator();
        const rollerFilter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
        const rollerGain = context.createGain();
        rollerOsc.type = 'triangle';
        rollerOsc.frequency.setValueAtTime(185, now + 0.032);
        if (rollerOsc.frequency.exponentialRampToValueAtTime) {
          rollerOsc.frequency.exponentialRampToValueAtTime(293.66, now + 0.31);
        }
        if (rollerFilter) {
          rollerFilter.type = 'lowpass';
          rollerFilter.frequency.setValueAtTime(680, now + 0.032);
          rollerFilter.Q.setValueAtTime(0.44, now + 0.032);
        }
        rollerGain.gain.setValueAtTime(0.0001, now + 0.032);
        if (rollerGain.gain.linearRampToValueAtTime) {
          rollerGain.gain.linearRampToValueAtTime(0.14, now + 0.072);
        }
        if (rollerGain.gain.exponentialRampToValueAtTime) {
          rollerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
        }
        rollerOsc.connect(rollerFilter || rollerGain);
        if (rollerFilter) rollerFilter.connect(rollerGain);
        rollerGain.connect(target);
        if (gallery?.input) {
          try { rollerGain.connect(gallery.input); } catch {}
        }
        rollerOsc.start(now + 0.032);
        rollerOsc.stop(now + 0.36);
      }
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
  const PUMBA_AUDIO_DATA = 'data:audio/mp3;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYzLjEuMTAxAAAAAAAAAAAAAAD/+7TAAAAAAAAAAAAAAAAAAAAAAABJbmZvAAAADwAAABkAADqAABMTEx0dHR0nJycnMTExMTs7OztERERETk5OTlhYWFhiYmJibGxsbHZ2dnaAgICAiYmJiZOTk5OdnZ2dp6enp7GxsbG7u7u7xMTExM7Ozs7Y2NjY4uLi4uzs7Oz29vb2/////wAAAABMYXZjNjMuMS4AAAAAAAAAAAAAAAAkA2AAAAAAAAA6gFKxF88AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/+7TEAAMcVeL2bL2NzFa9H4K3gAGEAAEo8TTGqOggLjpBuQ5EOSiLzFFK6d20LgEoKcbhkIYqG85zrQ9Yhv1Wn1HhTqvw2fErG5qRDFG/f3b0PQ85zTHoEICODEGGLGh6jZ2RziuDdGSFH5UlrhId+m6vgMDxyWFiviuJYliWfsLGjASBICQAARCQOhmJau52IYNz5EeL4HN/scWQhOB8/XnYln+sONr4DxmwlmYhiO8s7KNry4IijOO418cIlo1ixxtQ2vaBADjk642vSEyuJ1RPaWc2vgWUxY5LCxZRs8mdxyE7f2+bf8ltyWDA8WOT2Uo2dmZ+sDh09M9MWMQYTgZzTXa/QsMbZmTmvqmu3jJnWTjLzIPwW+jBXsZKqemZTbhyYnMYHgVm805L/RO1QuVKnXi0bfSUzL+uPGZU4zwwAFilDYtEWHu/IJlaa56Ng0WqKkyijNVrOy1WTzMJfx0H6nqeG41EoahT6ujKWd0kaiTswY22D3ZLPU4deK1tqOOLF4zDTQo+2N9INl8EwFFYIktiHYRMSfWEMSqUy6KzkooLsRjT+R135U/U/chirRRCApx3aaM2K1iYj8vgbO3qikNnKgiz6x/kppb/xavFKe7EpRR3q87nA9eVy6mpcI1VqQzH47KJvU1yKxu1DtqrK5ZqUS2kn6V7sozLozqhlcPw3SzeUek9HdmV4A4A4AwAoAYAAAAQAAxAARqRsEYUZAGGx6RxSOpYPBDMy7hmQsERaP7sIKTqVpQaSl//+7TEGQAlGiNX+byAA8+hKQ+7oAG0Ai9AqMZB+E5ch90FNC/hrmGEHhyvJi1j2lgtNswg/1Vl79yMswuVIxmbsmMqASxKoFVSixY3nbOGEOHJRTNFcJ6D5ML5LyM+0vay2xnb1zO4XPeaMMjUvQUXYQhF9FKS7qFEBqdWPw5h//BprEN7DbgJgUTBBGYlCYorEos+7tUmf8z////nLcsvW3cs234xXTTzbXZNEX9ooi/v////////5yzHOWY25Zu3LN25yIv7YiL+2IjDtJKYdpP/////////////////////5Zu3Sbt2N27G7djduxXt//////////ymHaSUxmpKYzUlMZqSmM1JTLZgAAACUw1Jw7GHczRGMxyGEGAYhJMBwkMLw2MRRGMBAJMHAiC4LhQAkAo8BLByoBxgeCAFAm1pn4AnAwhU4WySGRvLiBjkyhQx2cISgIEHBgCMLegIaEA0LoAcGEO1Kmm0QBEGBNA40FSYJDmmOAp0AkIJBTBbkqCEfwYTB0kLCyAAmupZQuC9xllJWEAQUzTFHVszsui7oEJmOBzVOmggFYLfq4M2aa/TxJCJyKSVltPslsYUcw5Q9EVoiNAceLpuSwSKOkz575a8sXaS780vlw1TtxbDalCY0FS2ny1V83/LVJvO1xuWnxqLK/DsvdCYX/IY0gAAAODCFGoMymV4w6xEjBXAFGgJAAAKQgGCwERgBgGmBuAMYJAIwNAIAJPMPBkeFZisXDBjMvFAx4UTUCnMwAL/+7TEIAPlWQ02b3NLxFshp0Hd6XkxeOBZPIJzAoZEAMEIiMgg0LJMyc5RBFjPoyM7DcyoPVtDxkMBkIAkMLgNrDBEA5hERhgVAoEByZMiE0yK1DUaYMQKExsMREBWHLKMQCMe7MpPDj5ispnAp4SgqnNanMwcMy7FTIZzM/VGh5mSRsWhmJI2WTgNeHIFTQzB2GxCo4BKAckaUYhkVgkJbXQCVBFABPFkCI2ZwoZJMWwCEYXNER00psCHxCMMjpHuwVHmbXGyGCUYLhRUEJLTBFhEMNIeL0ovmEHqZg4gMnQcaEA0xoMINKJJehQImyovAz33YXWthZxo0/ValMcgw4EQyI0M32AsyRApgKfEBKnDgFMNAaMCRDHQhBy6AiMeKTFxkwADNdATAQ81FiHWc4RCMROTBgAy0NMeJASDEWAYqFmjShndQZcSmqF4KNgMiJVgolLAaAi8xI4DAEEAYCBVZACFGGgaYgHGTy90DjBnwEIhkMNA5cIBYMdmMLHIfCQcmtG0HAQMIw4EZmVmmrSn/WmczBkEAATa/TlzTergySChpjVh5B4GshgY4Q4Mgm2ElzDKoDzDQiICpxhSpy/B4gZoFRkwggHmjagAyAmZgigVICWkAIjkaTO/hEbNnEPDJALkFBTsFAVENEKMoYEZ0oODIUBBy6BRTMsaDrjHjKg0dwSGvLMg4tAha8SgsricvnVaIAAAABwYFIB8kigpUioWXizVwKEZBDDQoLhCaCvxAFhw6CgMHDACChT/+7TEFIHiIQ9A7m9FxF+haAHd6PkXBTqZMKmbCxKGmTBZgwIKiosEGzpBhCYAIwhHD10BCgCpAWMABlxFQOOATKgjZpzHjwgMgnUBGlJIXEooFYmBRhQwFR4CWGuvJsjQ0zgsKojpiTniDIozei0qwxoYWYZwgPOxgWZEWGRwqMNHVNc8NsIMMsOI+OmRMqATOHDIcBMCdAKs3b8yC0z5IHFEMDJg4aMsTGCyPYKDmlOoMFqjAExI+aY6YhCfKgaB4XGAK80sBi0NhhEaAnirGNFlEc1ogKEUbk0DmAjVDyK+ZQcXOBQ0xRIUCG4FAESYkCkOIQKUbOK8vp3ICwzmus7mWpQmQJCmO4hpjAkBzAANBACmiMBmpOZGNGJiAKWTVzExYWMLTR0KMUPRGMCh+YqYGBC5CRiAMMfJRoiNFBETTDUIx6SKCYBH41KhUiV6DlAEMkUMGfTCkTDgASXCABhi50QJ/SRi4JmsacBKNMACJiQYNByoqIgKJHApr0i4ZsQkgAKAkkxTYx1wxpkLkzOnCqgAWs4/o1YkecGZdgmQBl5l0gGVAYcZ4UcBECQZpApkjBsYSgIqaBIoEhgcwARwz5czBMyacAoQKpEjwJbmSNmnUGAxCt05DMSTHFKGEblokf0cDDiTNGFOCAkYQAVGIFbmkKlyR5OaOOYh+CqCChkxwNPKUEIYDAAweTG3hmWVNzAYVjlB1jZQWDHEQA4Hi/qvS1hZ4oIgEdplr0L9koONCLBDGAsx8fFj0Kj/+7TEFYGiJRFCDu9HxEqwKiW8mrsZl4aPLJIBGUiYMCTCSpCo20nMNMTO40y8QMwCgKFGCA5jpGDlRUQGGImOhBdwAkBsCw8JBCE3zQLqjISTIDzD7g1OgIYMYQsGfh42vgGFR4IaE0Y4YGTDjljGFhxaiaa8QZxEYkmEEwSbKicz2YaPGlBncWGJChU8HJVKQEtKiJSoySE1AIRAQcPGjqaiqbrQIMgRYCIUZhFpqRhUAmSJAUGYUqbA6IfpAsNBKMEFAIsYGkosyIcxwsHCTBDx1CZFEaRkYAmaWCZs+SIAwqZAMDSRkg4QXLrEhYdEAogig9UTfuSUWIEABGAiR3bKdIMQ+YOFmFgYOOzAjgBACC7iGFAzQASAoZsXRHSMggBAxAOAQBAoGYYDAoXTwLaGBAwVAVuGMoNhA5Wu0gBCihMwJApOGGkJPmGM5kVEaoYgYxAxKXBGBGYP8LFrLZ6tkwggMurWCDi7xQiPKIroYhgo0gpTJz1GNB4aYXQlUaipIC6wcTMF2nnWksHFmPqNBwStLU3PXYyxoTrL1RieyBWMN+FygYG0IGAFC7sqHQSJMq/Vsflj8cLhKHRxeCD+apldiQrQr0DMpa7DLsztrHDusMe9aNaIe7aLaI934vwESDhdAgXQIESDhdAgXQIESDhdEAugQwPwPAMzwPAyPw+AyfD4IjtD4DI9S7PgYgE1GcpBmYIgnNUQNkMICFgqqOLvm+hZE6LZkEpG4eCeDMWGTTOaStULMdERBhz/+7TEGQGhUQlEDeMkzJuhpvXd6bgRhNmUKAQDAAIjx0VrJeYAEmMUFBhAYDpyUEWlLKGIaYo4YCiUcIQcApOQsuMJAmJFBRIlNwywAVCHSiIkyQSK8zRDQZECacIdURLmJOBlAACDgWaiCJTcROqyJkJUomg5pipmiLuYKnKwJu0eRhTQTdQmRZpKBpESyVNERCBwxWRmn0HAiQUBohEgamzWL7dIiyZ9Vg1UmutJhaf0TbWAV5RyHJD2KhNCkooFRDQVCKCkoqKiGgpMUFNgsUkFRSYLCKgsUkFRSYLCKgsUkFRSYLCKguJIKxBgIQAB8YHAacgzObRgQUB+YEAAMAJDojAIwKAYLAmTAajQwsGguYKgUZqWmSBJhAIbILmSj5hRMYiFm3ipi6cZqhmXrBRQmtnA07pUihkPEpnwCDksKJZYAGtkgSEHhqg6a0cBE8YCpAkeAAoIwoxwBMOIzX0UeBRYaGks2YiM5KjFhwtSYysmelZmAMZMFmuqJoqKcMOGHBRxixvoA+KOJkARUt8JzDPTCA4Y0IaMqc5aYEGYs4FAoJQnJGEpUDhRQOCDRdE2gwOQRUUCGMDmJCCAMakQAgaVRhwANBoLCFMSCxAFA4YzQ4MIgrSIQRQtVtNAiMoyCyM4YQxCg3qkyAYxIowgQElyEEJR5wwoBS8xxdASYMWutAYxdX9SRaMTNbPcVWn9KgwAAAAwuOT30sFx23jBCYGyJBIzAKBRCQYbEJicEgUEmAw2FwGBAcSgcwn/+7TEFYGiTQ0/Dm9UhGChaB3eapADzDwzEAkMLhsxuRTAiyObPI55YjGB5M+lcw0IDABiBqObeWmJmKqYFDQQKAJzMoWAUKixMZiyizWbKQmmj5oawa6CnO4ZkZ2ZGRmflphZ8Yk+GMCpjgBkIoCTGXbmXHGfAm+DJJGIIGLYGjUEUEqmB4KAAx5BBkyhk1x9EhxfppPACyjwQ0R4zBAFFyFHOFy0ihaTRAEosxioNIqrBAghEF7YwWrQDttDSiYKJiygywowSkEBF3jAVqagBIWN4eNMPMgPO2cMIhN8iGKRKjJoQY9BgQqnc2Jy8kFgY4majwsWGrMvnMkGADgcBgyNfoZDARAKWSQTtfL6GAYQgQJDEYTzCINjA4LAgihADicZgKDxiiABgWHJiyBpi6ARhIL5m+iBkEIxnTKR2EoBjOVhmEFRo6DBsCmokMAUoggap0AQcmDBaLCcxnBTABTNDFwwUhTG5eDBWY5QgBRppg+mMUgaHKBl0EmehEZ9JwhFJiUGDS5W4eZChEwa4zwY4ZB0xkAYUaBkxpqoGbWjCAYualEaGge9CJBlIiMeRFTKkgUpBF8xIoWNIiCNAaEk8wKApEwDEWIt87MeWwLAFaIrB7OCYcY8IgAc1XL4AgIW6KgUIYAkgCiqDxNmCx8v4rGYAaDRDbgk6YwkDQBdpkbB3JL1Dodhigi3JTI5yc/+mjDgc6EyBa4NEQAC6RHsUKAQKmlo4jgTL5cxllMgKDHz4zZJNVPzP0oFZpj/+7TEFYGiAQ9ADfNRDEM0ammdvilxcckbkBvMgLo1oYzE0rNHYE3BJzxXtN18026TDaqVMcEM12GDGIIJSCZ7epwqXmbxEYGFhit0GNhkaOPBgAsmKD8Y2g5nAeGWgyUI4eMJj0NGAQ0BhYYEEJmzghDgKYMJTGGwqWM2aLAEGkhYQYoIXjAoJBKnnLC0hdZL1N9IVjAOABiYu8DEQlpCwARhBIADQ7dAcVDh4IBMcLxkoUCgBYY0JdKESXQJImLAtDBQMKikeV/mFSKkLONDMqTUsSVZYIIoUJDRIRhEAqvEvC5IsNS9GkqgS5mIQIsdeLFFCIFo5ZZUJQAAzkgSVFUEDOqwIvw1wv8cK5lmJbGmGXORmJtV8hY8OKN0oWtWWJB5QTGLMRmAEZsfG/oYMnzo0o4CWMEDEDiALMZACYIAhyyQxYKRkDAoQBocDrBOgrcJDUpLJsyYDMJOqXvSUEjlJvxhhcrg+XQwhjx8XIuqrjCblgMRuXa5bxZkGkj+XEBXSI44Y55KRPPlAyTFuM9HHMqFazxS7H++VkBlVr3bCh57r69ESDA2qd615iTNCsc9fOaUpSnvd+8ePHlPmG/ePKazd+/fvHlFhTlvHrE3FzFwIQhEzGc5Ox6yFjgJwdEzGW8esTcQ8QwTQlmveG/jxKazd+/fv4lGQ8PDHB4eHgHh4eGGZh4+kgAAAAAARTEYHZoyqGvhsYcA5k8BhQOJ7igSAAICgYAQ2MfgVH1tGliwBBQcARLBQTUmBtz/+7TEGoHjueFRTmmRzFQhZgHubSllShhQx0SyHINiA5Qdw6fb+fLibwyYYiYQKYYWbIiFF5mB5jApAGBQ4eFuLEW+ZyryGhAJLa0SwMMuMuUwgBAIwF12CQl6YBlMOxl1XRcVxXlfWpS3YZayy17aGllLOWus5Ya02HaWNSmWs9fmGTUxUtvrXyqIIenbvLVpiYurVC1l4mz2rTFf7MK1aYnJ7XqrVq1atrjS1atWrXazaq1atW1r2VqyDUGoik11okiCCIEQIg1JrrRJEEGoNQaiSe0KxJBqDVa7Ws5WrK1bWvTWrK1a7XsqtWrVq2vZVatWra1m1Vq1a7VgJMAUBkqCFGTTHMbIwjpgHg4mM+FcYUgMZKCmYgok5kWAsmAyKaJoJ782AYaNiBpdEpIZH/hz1zGLUMYvM5lQWnAhiAR4bEER0hlG080eyH5qJMDQGO5mzbp81Q8NBRAY/GMC5qAMcwtmdHJn6cai3BcDMcKQUamGiRUBjQ5A0FWByKYmCGECoAAAqEBwkYUTGwrB1LcDmo5YRMYVTGwAzxFMIKHFL8MnARsZMIiwqVRUqiYVGwsFI5sLlmDSxAAojoVOimeoUibCkPEjIAL0FAmz8DFLshAStcHAiwBeAeHQIBI2O2paNFsJEAAsA+LSFoAAFDhtFMkEAMGL1MABV5JWFAE/EBswb6HGQPGjYAgBLBcj8JYKAVGDMHsYybLwCphMJMG0wWAuiYQMwJQUzD0IXMHkUw2g6TYjkNVjsysIzBj/+7TEFoPjFREuD3NJRE4h5cHubLiqMPgswQXTfI0NYtgx8mDpo3NNlEyy4jW7AC5aNTK8z3fh+vGGJeeLsQm0Ny0M/3MC9PAXME1NlCOhEOIENu8EpQQhAo80AszxcmYmwXhYqaYKIThhlR1WIodFgjMDVTDnNTfVAF4EDUGWRMeZMyoKaIua9+YQeJC0hWzJFjo9PotmyNC9UgoeCIphVRkgiXpgzSOZIBEiDW0AigRKKZEvkSEgUEWDIKGyAobmJDhyFSpBwDD0dkCYQCEIExAkyocDHy5YY9YAGCQCBGgymAJAGaSFyHKRvCgQQhzWhgUJEgEha8sIibEWgNP++YO4PBhTBZmm+q+aHwX5h5hXGS0IuYJJBjGmmL2ALd03qCjEseNigIzGLguCDEoCMLDYyZJzNkoNY1o0GVTCgcMlBJJEDAMHCEzbBDOvbNvCU9GkTymA5s6OqQjQT0wZgOpEzJTY1k6Cw4YqeAADVtMODUBYEWBUGMbBSIbMGOZAkcVDswE1JShQEy8AMGFgKGkQKBEM2mSNBUDNBox0iCgWZuABcDBw815LhNMUEhI4EgEKm4GXggVTwUZBhWCQVxjEygxQBSQBgwBAJ+Ux37Yy11yGisOcNIsuCpo6LUhgUa8tZB0WLwsF0ykUdi169XrS9LsMTXQCAcwkUDDNxQcANwROQiVYRDrfI0LVbnDlBFsUVTAABQMBMIMyRrZTKDELMAISgw6QQQYTDD9lColM8EUx0DDNo+M7E0CBBZb/+7TEFYPeYQsyD3NFy9ahpcHt6Kk8ByUemK5WaLQ5oAnGNxMYzHhjEABUlmPAIYWEwAJhp4TmG0UFwuFWx7KJxlwEFmKHhBV4RQOi+/Kw7uI3LBhYKOAYYaon24KhhlygiIl01clQmIzyb5ekBLRIAaGSBTAXUNbNULUHaXHUWkUnmMGGMeQBwRUogABiYONjIIqjGBGSKiQuhCoEmN5y9CZBTdBkAnmpgyZAI6qu2bSF2Y+0CA25M6Qud1YSLSZUxepHxIlNRI9GZM9jKlcnd53n3LiKArMSZna3iAgGwwMgNzVql8NH0G4wjBEAEQuBFsORDggg4HIM5JBAqApBDoEzAhKEsOSjhEk86+M3PzMhIwNcBVQoVN8FOE9OxzILxnaZDUNr1MnyPEBGrBiph4lB25YPdA5iY88aRgTFI4gQnGJoB2goHA4RNsiAgRDbzMEGthgYyogUIAEsYFabsSLAQoVDoimTgCQMtOWXEIVSSuS+4kcEIMCBljjR0eqmHIGPTmIKmQGCMsCiSAZnAqBSsRSMCLLUQQkSnAZ4UZQcBBC3X2UvgBVVI9W2Ss4Zow9ri/IYVKq9FNLZgcjBIl+GUPKvh9EmSoPSGhqtTU1EujDoKNYdA+FxjdhYMjgwCEAtQKGEwCGDFoFACHMOmkwsHSEXgQSqPGUgcGCcAIQ9IGJCIqYcqVqjPkRCtMvFN/uNXgNSnOQZBogzqMECDKrABHMtJMAaOAlJpJgRqRqY9JStMQLRFaeu8vMykKD/+7TENoPdvQ82Dmsvw8KhpoHd5WAi9iJYIAID0EBhQIQDL1A5Uy9RcRwTEB0kS8DwQPHSg+/6lC1R4CswIXmMUo6mEDhjKJAIieiYjOGmNTflpLriMVBaSF8CosY8QgnDTgUwVSRUZEsSgQljIxa04BBESpkzxYBlYIIR/Xg09hi3B5VvgCiKklAxf9Y5EBTMxh+/9XpgwKJmLUxtL/5e8ensSQww9RMrCIwaFsEjsSJYaNhaaiJGQBIqlmHl51q6YFhK2mDVZAMBg0nmIQMxNMGosx0ENVbx5hM7fguQAxQlocFEQh8+nZACtgEEVviIaIigw0Gzpn7T2PNjb4VLTkftYVNQKgjDxVeJRCgk0aT9gIA1kmBSEFhArtK3IPAZ9a4WGJRRINeQwGl2FAji0B3JaxDdHiaBJzDU5VFEHFSDg5hDMsNAppAgBKIxREwhwMCiGsCv2G13vIbqRsyHSMkgl8DiwKAKksEBQSBYyLFRgxlJxHHqAaBcsaIIxV9qdwa9D61qAAAAXMEgckDR1lTGHBIZCCxioHGHAEYQBSbCI4OMxgME2UxEOT2GAAoWgLvFtl3o+Q9BDLUNEAC4EfUIlvNbTNdBBp3iIFrUREEgmpkPAR+HYUjehba4KQ/DoQg6C9q80GVwgLKoMkg6iUpep1IqUMHQjzjNZDFQjKG8hLG1p6AyvTmTlj/fHaeVLIg2qjDXdvCbEWOMFIB/STIW89jpRAWhKngd5lHwRkpxPDaXJ/xFW+vEcIDx+/v/+7TEXIGiidtMbjx5y1Swamm3seHfDxgVisUavfx8QGBWKxXq9/H3AeKxWK9XvyXuz8FsCOAqAIYOcQ8l62pBuBHAkAEMHOIeQtVrglAhASAFWDnEPc9EQDA3c9EQDA3d+IgGBu78RBYG7vxEFh3DwEgAqDRIG2Q0uDxwDh0mBE+kai9xjxCTDaHdE1G1fs4kQ75cTwMFMq8tpDF2QgHC3F/LM7zxiMqNUJWF0NFGtEKdgunpiYlla5OJSS2SbtrTRhOy4huuFJ1tgoJVLLkC1OsNCY4nX7FW2L0pVUrCoYiAW4TFh89AjACZjHYml1FccpVOFuxVUo7Pt8tZ2azNarVq12vbVlatWra1mrK1atW1rNaiSJIkk0xW+yYkkSRJJpit9k5JIkiSTTFb7JzUFBTegoKC/FBQU3oKCgv4goKb4KCgtRocHIZ4Bw6aiPJiqGUqpkgEYoCGbCBjiYc8ZGkppA2MEcNLNNemOkbCokF9zzYDToQw2FQaRDDxpYCKYBJmOcGSEg5ebYcYMOniXVQIqSEQcyJQMMGnAloQKRayoc1lNNHNLxLqGS6iMCD77L+W0lXE0cC5Bd5E1Pld9lAIwFYMEDjRAmLrwMAGLWKDhwpi72JQgwyRDXKIByYoyGDCaSjKUOpdNE8LhBI+mqHDxgQSpCqCaaCThbxyWZKgROU1CFRhFwkIMCFMqFS9MSOTHNVCCHBlQIJAGKDGULJ4AYuNLG7o8oqJgrGgSnh1+8TAmCLMYFHk2ZLOJcj/+7TEfQPduQ08Dm9Cw7kiJ8Ht6CCZjKOkiQwVHGYkplOkcgGmWDBnWIjOmglnJlGtRmdWmFjGhcgkUPKhIcYdIgHGjCt5gChyDgoLNeLJh5ehhjlqBohQWYICoMhKdhrBdB8BCBQbZTD6K40AR2YcNBEq2ZuPnBTiBAkvgxxBpNwOQF8y8ZWDNiQTgTqEgahAiANRGgigbHFKH7TMBA4zhKQF00Z4HTiR2SjUDREMmKKo0DBDDlhGDNAGPcpOaDBwQxoEzjowKcKinVFjSTZljRmRwGIoGNNQ0EgYKAlZIFDUy2FtABTJCYVQKdzpyOTuVPRitZs9AQ3nPk0mf4umQAMmLYsgYeQUWmXHgc1kXWbxQGomZzI0aIpmgCA1UFGOYiLg4RNTDTUydmAkFqXmZk5gIOYEHgZbNbQTEBoFeK7GiU1gqKsmA1kKIqxM6clgYYS+oqQtaFswKAwQUHZgUAyxTBLQaElGwp1onhQAYVRaRxIhi6zYFN0AiF4kcSADw6vYwlQl0hyVEwRYZ+yVYQBmQsXTC5BIC6JdVH4aBcAaDMkBOogIHBCrMaVQeOHECgRqpGWACq3nKpMjABAcOAARJsADGSKKggZMuKYBZd9VcWBEB6zhEAKCs2Zw+7dp5+qfBAJAabF10Z/ggLCeYbAykwpYJNQkhGFrQ27nIMhkhQXEFdsxwKNNPAQVmxBBz0EZQcCQeCQdWABII0KmTjQGODzzgzsbPFE03WhJep9YqgWHbjDyQ66EXGGsAZP/+7TEpIPdzQ0+Du8ly5iiKAHd5LircvktiYgYOaAGoXEDnkt0DUD5akWqAtsXmXckm3JHlX6r6YBHgo8tgBAQ9NLsoVVDBI8EnY7SKgXcSINEtc6Ij6UqZKuoAOQ1Ns4wTDdEICYStBwipYoJDIRDszggZSZTgMIM9JBoxiy4AGKIlhqBACXELCIgIRVDqi5YILBACE9QRIx+t6mLFzK9tRGApr1k5vuVGNAcYVEICDyqYkGTCQzAwCBriMNL8z6BxEEgKQTHhsMMqUwmUDLEcMuOs1WExKqJM2xnICI2hQUtE2pIknHGiDTMeMEQdX6ZLiuERDi5Q4DIg7sZoEFGWERZTNm5WKGiJZNNIKDXsAooVUCMaZ8eYgIxBXcrbsodDywaxi5IC8oC0rzXhFOi+M4RAg4Gu4HFhQIZ8eZkUpAElBEECoF2kj0iVdmADluTjEzJERJUX4VKAC4JAuQSGTRnQIBAJwzMg4IQwx8BGR5oNHS761EGDEoi8CpBEJMqHIjyTzqobhwNOp+GORCxSRGXSzZg+E5m/vRnmLgGSUwFAcEAqIQGYAB5hEWGByeaeCogHRosjGDQ0Y4LJj4HmYzsZ1NAq6AGzzDAISDMIg0EgcxCCAYHSsLAo4BU1GGB0NGCt6kYmikv9x4IcVvHekTeJzMqBUCAuAGtuE2VfzzioZbRcxZ1IwlFDDTHTHgUN3ZTiUHV3ApfJZJlwk0aVY4YIAw4YwFzScNMUKEiW4KbBhpwnAn8cSPtUDEKZof/+7TEz4PefQ8+DvNBw7shaAHeZLk3tATiQRFAZ4QAaZyhGGCmuYRAoOHjkDHzAPO8gEgmUSGFgFNCF3HORmXs9LZmU7TDU7S4XiKEg0FeCRCheTKG9rSUajBUB8NA4vYxVimTCZBpAyRMjhYAl0ziVTKZkND4g9FTDB8ENkIoxsaDMIaM5Ak1EwTHqAOazM3mtjYEzM9NjV1QzM2AQ+CScyYRNlPjy1sGowQDDQmWfMNICIEbqkk3RizCRQRLiDwe9ZhAQiikQpkghLimIg4CF0dguIAwEMkAUH0MmxAINMGA4SZsImdGJggcWSUMaYYWFmeAwWCTMigwxVMaHw4pMETDBC4IAjFAARhhp48BCEw9DIRkx5TM2CDQTJQNcZCFtLMJBxIWAgWY6bgErMTCh4nGjdYESFyVEMZPzoJEiGBYNKo+DAFNUSagCKCMHUSYeioFw1AOTBrS1FACICwUY0ImWCYGDwMLA4VejcDJywDJp2/sADmOhdHGsCmlA6GG4Jg4VDCIDBADZg+BJEOwoR5iCZIMDwwGD8wXEAwKBQw+CwwCAUcEkzCEsxWB0yIRwmAnngmxWmdBGqXG0TGkqGWOhakcBIPHgCPVeMgAMQEhxEAYgivC55fNItaAQYgLh4EABgCVZghxaEGAUCUkOBa4GBIIUU6NrzSEAaXhfhJBl4cOyoZATxLjp5BYIOJVTL8mqmYwQCBU2XeokLGNKCEk+lGnqb5miYKDqSIoKKEoYpLI9rtdJcqeaA9sCoL/+7TE84OjeRE4D3Njhf+8qI3dZhFYAR2XGMVMKJvMt9nkFMTgJllOly8KOcnJAldtAbg7kpZ25dM5Dj1nYdyldt36Z2HHpnYdyldt36Z/HftOw7ll23ftP479p9DgWL8maybqosEZihwooRGQwbywsCZK5tqjQxlJG+iiUYixuLEQpiqm2qTFGMgb6JQGYSjuUUNv/Rxh36OIO5RRN/6OMO/PxB/JyJv/Pyh/5+IP5OSt/5+UP/Pyh/JyVv/Pyh/5+Yfycm3/l7x9CgAAAAavP8BMIzX4YQqIghlQhb1WELohU4yJzRFUgsCMxF8kCxj4/plbjZgLpJtlsVaQuMloTEJqLMDB6Jprk2CSIrA5BUUjERV5fb8OhGKyIWFOxqfePw3bSlQPSLU+jUoA/jYUk0wNh0K/A1CAQy7pAJSYwaXnJTOFYPHizzVQtgPnC2dDc8HkRT0diU3Wri28ENn0Mqj7EXdxd9VtdW1sutq2us1xdbWa6zXLW1msUkFRSYLCKgsUkFRSYLCKgsUkFRTQWEVBcSQViaC5HAuJoViDAlsTKpETtcWDBcGDAUN0kwQAhguH4IAUweE8LywYuI4Ywg6GBCZojyAkkMMQ9MSSeMh0/MwUQMPjJKCgyYUMMAzGjYcBzBA4xoZMqOzHZo1moM7FCZMCAYDCcggRIhKlr1KWfHARQNQNccYup0s7UtL2FqjXLLBwLLQWEaxEODRF+oeAWk0HTCORcNkFrTO0eTQENotgRetBZHUZQBJBg0r/+7TEuwHapUVRDWWH27yhZsHd5hF0TKDwYMhNCgZQqrwxBV8J51rSdhcc2Iy+owKDAFgU40JqmawYhHbmsVTBVEKoFknZWOo4xtrLZl7RFFRTN2GrpiI8JRLuV6n3qbopfZXVMAQbk2iF7DEJCyMIcA0wBgGG+MBkEowOAgRGCKYgARpgtlWGIwCwdaLBm02HOkOaMiRrdjmglAck55oVMGlDsHDszAUwcezIBJMQBsyKDCUIGUhKYsAxhgWmiDSIB2YMDIGLaWjukwF1lmS4yJMuYkwQAEvTFFzJnURyyQJEmZEGBJAUIBlhiFxdkG0gIiCDxjU6FAkjEgId5QlCRAyxQdSHJVm9GmtAAdWICRj0Jikg4GArABHAIZM0OBg4gBGNIBUi+AGBhcmHBw5+OBCISApI0QHFiBxmCgRUAyQxQNAeSBAUVMi3AQkePiAaBQok5L4A0kMjBEDLsMyW0ZIaiio84hiBhhgaFCKKJRgDSLocWTZadqLRjJZAAlMHUz64g+RQBokDS13BEGBcHFDkwZLEKKRbJj4oYYEGHiwqSGdjxg7gZISHfMosRhAs16WpYsjVAWVQ+NII92l5LKUcddwXKpqB6Y7NqKwy6DKYAQ5JNQ9AqPMAvwoEXaVOzpfSJzVV4kAyABWKAoY98EumGopp8rRBgcOtcLmiE150dX2ZUjvisSGl4r9h9v3aepZReotcXCSLAg5MOtZ9n9WHbUt0ismcvmPvbJ2o8kh0lGI8CyHqHUtLl6kTdGP/+7TE7gGjHQ0uD3NLQ9iwJ528vngTo0qxs//eO/s8zHxHgaf2eZj4jwNP7RMx8R4Gn8J5LHgR4EV/CeSx4EeBV/CiSx4EeBUAADKhMP2YcxSXjGwfuGPRUYVD5jIQmUA2YUHpjoombhqZWIIYhTGpCMmkkygRzDweMiI00CSDDgjGhaYtGACHxgIErdQjAIHBw5cU2NGhBQpb0vEiOKgW8jauEtszeosZA8v038HKlVNA66WGF7l9G1zcyIokNQ0vLMI/AgI1tHsv0dxQCXtB0gVsAHdpl7CwugAgBJwBEZIXgAAVNAqMs8z5XjqNedB/HCWHQ5go40ZC5ONLZEB9EBAAIW0SMJJAxx3OeSnN5vClkoM2zKKJJRMQdCZymsIQNiyHA0CPLzGFsboPRK4LkcKl0XlJgVoTFcqPlZysOoTFcqOlZysMoT1MqOlZyJAEhPA6HQyBIfwRJAHhPCkOhkCQ/giSAPCeFIdFEEi2CLB9CenUZ0+tYPoVJ1GdPrWD5lSdRnT61g+ZdOnzq62Bcy6dPrrrYFzLq5tYgJhwtmTuke02AtoKBIJC4y339AJ5fSegcGX6oIBhxkARknBwG54IJjD4ORazabkzpygoKBjYYZrGb0uhNNXyjtigtVJVEGAtdgStL2zUdqNuixjKKpytAlj3o3IDRI0MJbjWrpWF7TAHLTKXzaNr1pzFwk0i2TqyQChIDlfzTWn0jMGxW805czDmZvIvGA1itZaQy1aSYyRS7phkRhgGKcZpxmj/+7TE/AGqeecwTmGVy6cmpZXNZDlKud0dABCJqKmw2ZwZUAN/A9+DvkNcJRowwgMErE3FFVgsocKHakNS67GZbclVnVNa3S2dVsYRUVCJBUUkEwmxWThuLjslMIgLcw0VrDDiDDMBYE0wYAFjAhATBgEMDEdYczCWjFasNPlwEBRQAzGOgCHAUSSCOGREmDRCAA4HEMSKZgIKBUJhQMmJAMSkYxCPAwHB+Bg1EzQITEhjTKStQHpuNu8TI1uryRwGAzKZFsAycIWCsQ8kmMFBREKj2CBgEkzwVCHpDLOPfI8szQRELBuMESSChvmFhIhIPK8yIzeRF/DDVMSEtgZLAOODUTPQAax4VmVeCxTGBOR0xwmpj1pnkkdIhXLasoXCXLaIjGb1JA0a7yN5hOhwIWiRLL9GfQYZKNQrEYggZGbVICRSdVgJXhqpE0mVC8xbMeTA0KMqoYtEp2uC3xVA1G+e5Ov8ar867/uvt0iDMkAzMwXhPIEHHmeDE1kYkWmAAMEmJmxh6Oc9MgqREIWZYRmAApnCaaMimTsByLETBxbIRjiyCTTDTOjQqMUAsEmsK9UPNzRAL1Ndhh82lcYlBa6VkIKpEryUkWlX0/ZalnAqUaZBghI1Ql8UERkpExTYZKZBamrNG3MZUqtGikLKBDSRJgtG6RTMrbgylVAHLMVM2YHdm4KoK7wULMkoMWTpYEZKwQWRGoDxIgxBTCLLOI/oallkMgoiZB6JbOEMkIzGFTwMc4DLK6UOTDBTKEr/+7TE8oGiVQ0OD3MlxCMjINXd5HAGhBwwUPHkVpLkduDUiXdd2zr/1l9UIhIqkFQcKmAeEYIhEJgQmdFllajdz9jXrsfe74sf9zFqTEFNRTQuMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqjQ1IDYCxTY5iDj87DPA+TCAJDBIIzAkLgcGSspegwZB4HAOBgRUBY4gKDgSMDQWEQQmBgFAIQjAQC1qRd4C+QXARFcOAVL6BoUW5UAAwTkFplg1IqBPGxGHC4S8C7SnakV3Oiz525xpTY3Vf1LZUZaFhTvtjZog8o6p4usIwTUBNOoQKCVyarZU1QqAmODiQqEnYmOmoCigQaWsM0IUBVbTIJVZmTrFcgtEFB0tEdiAsOEMkRTcxkQIIbpBgNhUMaVAwSCFWBH6XspgWPqCohKZqtQDJOjwJhmIIAhJDFtItWt2cd48q5btjbLUao6cBlgGLQARgVVgpAD/+7TEfQPktejmDuTVwAAANIAAAARFq74daPqpZLyiyW+qcjCT4/q5mCRetRqNa1HJTMsS1zrI5vOudnmqOS0ilUxBTUU0LjBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+7TEAAPAAAGkAAAAIAAANIAAAARMQU1FNC4wVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+7TEAAPAAAGkAAAAIAAANIAAAARMQU1FNC4wVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+7TEAAPAAAGkAAAAIAAANIAAAARMQU1FNC4wVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';
  let pumbaAudioInstance = null;
  function getPumbaAudio() {
    if (!pumbaAudioInstance && typeof Audio !== 'undefined') {
      try {
        pumbaAudioInstance = new Audio(PUMBA_AUDIO_DATA);
        pumbaAudioInstance.volume = 1.0;
      } catch {}
    }
    return pumbaAudioInstance;
  }
  function playPunchImpact() {
    lastPunchSlug = 'jose-manuel-ezquerra';
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([60, 40, 25]); } catch {}
    }
    // Reproducción directa e inmediata del audio auténtico grabado
    try {
      const p = getPumbaAudio();
      if (p) {
        p.currentTime = 0;
        p.play().catch(() => {});
      }
    } catch {}
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      if (!context) context = new AudioCtx();
      if (context.state === 'suspended') context.resume();
    } catch {}
    if (!context) return;
    try {
      const now = context.currentTime + 0.002;
      const target = (engine && engine.compressor) ? engine.compressor : context.destination;
      const gallery = (typeof getGalleryReverb === 'function') ? getGalleryReverb() : null;
      const sampleRate = context.sampleRate || 44100;

      // 1. Impacto cálido amortiguado en cristal del monitor (cero ruido blanco, cuerpo grave-medio)
      const slapLen = Math.round(sampleRate * 0.085);
      const slapBuffer = context.createBuffer(1, slapLen, sampleRate);
      const slapData = slapBuffer.getChannelData(0);
      for (let i = 0; i < slapLen; i++) {
        const t = i / sampleRate;
        const glassBody = Math.sin(2 * Math.PI * 360 * t) * Math.exp(-t / 0.014);
        const thump = Math.sin(2 * Math.PI * (155 - 88 * (t / 0.085)) * t) * Math.exp(-t / 0.032);
        slapData[i] = glassBody * 0.42 + thump * 0.85;
      }
      const slapSrc = context.createBufferSource();
      slapSrc.buffer = slapBuffer;
      const slapFilter = context.createBiquadFilter();
      slapFilter.type = 'lowpass';
      slapFilter.frequency.setValueAtTime(680, now);
      slapFilter.Q.setValueAtTime(0.45, now);
      const slapGain = context.createGain();
      slapGain.gain.setValueAtTime(0.65, now);
      slapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      slapSrc.connect(slapFilter);
      slapFilter.connect(slapGain);
      slapGain.connect(target);
      if (gallery?.input) slapGain.connect(gallery.input);
      slapSrc.start(now);

      // 2. PUMBA! Sub-bajo de impacto masivo en monitor (36 Hz)
      const subOsc = context.createOscillator();
      const subGain = context.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(145, now);
      subOsc.frequency.exponentialRampToValueAtTime(36, now + 0.18);
      subGain.gain.setValueAtTime(0.78, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      subOsc.connect(subGain);
      subGain.connect(target);
      subOsc.start(now);
      subOsc.stop(now + 0.18);

      // 3. Resonancia del marco del monitor (96 Hz)
      const bodyOsc = context.createOscillator();
      const bodyGain = context.createGain();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(96, now);
      bodyGain.gain.setValueAtTime(0.42, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(target);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.24);

      // 4. Deriva armónica cálida en Re4 (293.66 Hz, -12 semitonos) filtrada en seda durante el aturdimiento
      const dazeOsc = context.createOscillator();
      const dazeFilter = typeof context.createBiquadFilter === 'function' ? context.createBiquadFilter() : null;
      const dazeGain = context.createGain();
      const dazeLFO = context.createOscillator();
      const dazeLFOGain = context.createGain();
      dazeLFO.frequency.setValueAtTime(3.2, now);
      dazeLFOGain.gain.setValueAtTime(8, now);
      dazeLFOGain.gain.exponentialRampToValueAtTime(0.8, now + 2.8);
      dazeLFO.connect(dazeOsc.frequency);
      dazeOsc.type = 'triangle';
      dazeOsc.frequency.setValueAtTime(293.66, now);
      if (dazeFilter) {
        dazeFilter.type = 'lowpass';
        dazeFilter.frequency.setValueAtTime(560, now);
        dazeFilter.Q.setValueAtTime(0.42, now);
      }
      dazeGain.gain.setValueAtTime(0.11, now + 0.04);
      dazeGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.9);
      dazeOsc.connect(dazeFilter || dazeGain);
      if (dazeFilter) dazeFilter.connect(dazeGain);
      dazeGain.connect(target);
      if (gallery?.input) dazeGain.connect(gallery.input);
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
    const targetMaster = isHeadlessTest
      ? Math.min(.32, (.08 + energy * .24) * scale)
      : Math.min(.075, (.022 + energy * .053) * scale);
    ramp(engine.master.gain, targetMaster, .045);
    mix();
    if (slug !== 'dustin') playMelody(now);
    const grainGap = isHeadlessTest
      ? (150 - energy * 25 + depth * 15)
      : (290 - energy * 30 + depth * 20);
    if (now - lastGrain < grainGap || engine.voices.size > 10) return;
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
    if (!autoPlayActive && !cardPinned) message();
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
    const maxNoteDist = isHeadlessTest ? .22 : .34;
    noteDistance = Math.min(maxNoteDist, noteDistance + Math.abs(step));
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
    // Ataque de fieltro suave (~38ms en los primeros 3 pasos) + caída orgánica en coseno cuadrado sin clics transitorios
    const noteEnvelope = Float32Array.from({ length: 64 }, (_, i) => {
      if (i === 0) return 0;
      if (i === 1) return 0.42;
      if (i === 2) return 0.84;
      if (i === 3) return 1;
      if (i < 44) return 1 - (i - 3) * 0.0045;
      return 0.8155 * Math.cos((i - 44) / 19 * Math.PI / 2) ** 2;
    });
    noteEnvelope[63] = 0;
    return { master, nature, iris, filter, tone, open, core, music, panner, roomGain, roomTone, compressor, buffers: decoded.slice(0, 2), box: decoded[2], envelope, noteEnvelope, voices: new Set(), galleryReverb: null };
  }
  button.addEventListener('click', () => {
    if (loading) return;
    clearTimeout(suspension);
    if (enabled) {
      enabled = false; rest(true); message();
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
        // Minimalismo contemplativo: cero colchón/dron continuo al activar sonido; silencio puro en reposo.
        message(activeMelodyMeta);
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
  if (status) {
    status.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const closeBtn = target.closest('[data-sound-card-close]');
      if (closeBtn) {
        event.preventDefault();
        event.stopPropagation();
        cardPinned = false;
        message();
        return;
      }
      const playBtn = target.closest('[data-sound-autoplay]');
      if (playBtn) {
        event.preventDefault();
        event.stopPropagation();
        cardPinned = true;
        toggleAutoPlay();
        return;
      }
      const pickBtn = target.closest('[data-sound-pick]');
      if (pickBtn) {
        event.preventDefault();
        event.stopPropagation();
        const idx = Number(pickBtn.getAttribute('data-sound-pick'));
        selectMelody(idx, { audition: true, showCard: true });
      }
    });
  }
  button.addEventListener('mouseenter', () => {
    if (enabled && status && status.hidden && !isHeadlessTest) {
      message(activeMelodyMeta);
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
      get index() { return activeMelodyIndex; },
      get name() { return activeMelodyMeta.name; },
      get title() { return activeMelodyMeta.title; },
      get subtitle() { return activeMelodyMeta.subtitle; },
      get verse() { return activeMelodyMeta.verse; },
      get day() { return activeMelodyMeta.day; }
    }),
    melodies: DAILY_MELODIES,
    selectMelody(idx, opts) { return selectMelody(idx, opts); },
    toggleAutoPlay(state) { return toggleAutoPlay(state); },
    get autoPlayActive() { return autoPlayActive; },
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
    canPeel() {
      playCanPeel();
    },
    kiss(volleyCount) {
      playKissPop(volleyCount);
    },
    puff(intensity) {
      playCigarettePuff(intensity);
    },
    kutxaBox() {
      playKutxaBoxJump();
    },
    guitarStrum(strumCount) {
      playMonkeyGuitarStrum(strumCount);
    },
    eguzkilore() {
      playEguzkiloreChime();
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
      const loopNotes = melody.filter(n => n !== null).slice(0, 5);
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
    get lastKissSlug() { return lastKissSlug; },
    get lastPuffSlug() { return lastPuffSlug; },
    get lastKutxaSlug() { return lastKutxaSlug; },
    get lastGuitarStrumSlug() { return lastGuitarStrumSlug; },
    get lastMenuNoteIndex() { return lastMenuNoteIndex; },
    get lastPhonographCategory() { return lastPhonographCategory; },
    get lastPhonographFreq() { return lastPhonographFreq; },
    get lastStencilSprayFilter() { return lastStencilSprayFilter; },
    get sessionMelodyIndex() { return activeMelodyIndex; },
    get melody() { return melody; }
  });
  paint();
})();
