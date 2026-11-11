/* Naroa — «Apirila»: banda sonora original para piano de fieltro.
 * Motor autónomo escrito desde cero: síntesis pura Web Audio, sin muestras ni red.
 * Mano izquierda saltarina en corcheas, melodía pentatónica en Do mayor,
 * trombones en el puente, phaser lento, delays cruzados a tempo, un eco en tresillo y otro lejano.
 * Sonido cálido y húmedo: piano de casa algo desafinado, sala larga, eco de cinta y microfallos de mano.
 * El pulso respira con el scroll del visitante: 96 pulsos por minuto en reposo, entre 84 y 116 en marcha.
 * API: window.NAROA_SCORE.{start, stop, toggle, setVolume, setIntensity, setSilent, setPace, on}
 */
(() => {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || window.NAROA_SCORE) return;

  const TITLE = 'Apirila';
  const BPM = 96;
  const TRANSPOSE = -5;
  const SWING = 0.08;
  const EIGHTH = 60 / BPM / 2;
  const LOOKAHEAD = 0.4;
  const TICK_MS = 60;
  // Margen del pulso alrededor del tempo base: de 84 a 116 pulsos por minuto.
  const PACE_MIN = 84 / BPM, PACE_MAX = 116 / BPM;
  // Segundos sin noticias del scroll tras los que el pulso vuelve solo al tempo base.
  const PACE_HOLD = 0.6;
  const VOLUME_KEY = 'naroa-score-volume';

  // ── Partitura ────────────────────────────────────────────────────────────
  // Mano izquierda: ocho corcheas por compás (MIDI, Do4 = 60), escritas en Fa y
  // transportadas a Do mayor al sonar. Armonía luminosa: I, IV y V mandan.
  const LH = {
    F: [41, 48, 57, 48, 53, 48, 57, 48],
    Bb: [46, 53, 62, 53, 58, 53, 62, 53],
    FA: [45, 53, 60, 53, 57, 53, 60, 53],
    C: [48, 55, 64, 55, 60, 55, 64, 55],
    CE: [40, 48, 55, 48, 52, 48, 55, 48],
    Dm: [38, 45, 53, 45, 50, 45, 53, 45],
    Gm7: [43, 50, 58, 50, 53, 50, 58, 50],
    C7sus: [36, 43, 46, 53, 55, 53, 46, 43]
  };
  // Mano derecha: [corchea de entrada 0–7, nota MIDI, duración en corcheas].
  // Melodía pentatónica con saltos y entradas a contratiempo.
  const A = [
    { lh: LH.F, rh: [[0, 72, 1], [1, 74, 1], [2, 77, 2], [5, 81, 3]] },
    { lh: LH.Bb, rh: [[0, 79, 2], [3, 77, 1], [4, 74, 2], [6, 77, 2]] },
    { lh: LH.FA, rh: [[0, 81, 3], [3, 84, 1], [4, 81, 2], [6, 77, 2]] },
    { lh: LH.C, rh: [[0, 79, 3], [3, 76, 1], [4, 79, 4]] },
    { lh: LH.F, rh: [[0, 72, 1], [1, 74, 1], [2, 77, 2], [5, 81, 1], [6, 84, 2]] },
    { lh: LH.Bb, rh: [[0, 86, 2], [2, 84, 1], [3, 81, 2], [5, 77, 1], [6, 74, 2]] },
    { lh: LH.C, rh: [[0, 76, 2], [2, 79, 2], [4, 84, 3], [7, 79, 1]] },
    { lh: LH.F, rh: [[0, 77, 4], [5, 72, 1], [6, 69, 2]], breathe: true }
  ];
  // Puente: tres trombones sostienen el acorde de cada compás y deslizan la vara al siguiente.
  const B = [
    { brass: [53, 58, 62], lh: LH.Bb, rh: [[1, 74, 1], [2, 77, 1], [3, 82, 3], [6, 81, 2]] },
    { brass: [52, 55, 60], lh: LH.C, rh: [[0, 79, 2], [2, 76, 2], [5, 79, 1], [6, 84, 2]] },
    { brass: [53, 57, 62], lh: LH.Dm, rh: [[0, 81, 3], [3, 77, 1], [4, 74, 2], [6, 77, 2]] },
    { brass: [53, 57, 60], lh: LH.FA, rh: [[0, 84, 4], [4, 81, 2], [6, 77, 2]] },
    { brass: [53, 58, 62], lh: LH.Bb, rh: [[1, 74, 1], [2, 77, 1], [3, 82, 3], [6, 86, 2]] },
    { brass: [52, 55, 60], lh: LH.CE, rh: [[0, 84, 3], [3, 79, 1], [4, 76, 4]] },
    { brass: [53, 58, 62], lh: LH.Gm7, rh: [[0, 74, 2], [2, 77, 2], [4, 82, 2], [6, 81, 2]] },
    { brass: [53, 55, 58], lh: LH.C7sus, rh: [[0, 79, 6], [6, 76, 2]], breathe: true }
  ];
  const INTRO = [
    { lh: LH.F, rh: [], soft: true },
    { lh: LH.Bb, rh: [], soft: true }
  ];
  const OUTRO = [
    { lh: LH.F, rh: [[0, 77, 8]], soft: true, breathe: true },
    { lh: [41, 48, 53, 57, 60, 65, null, null], rh: [], soft: true, final: true },
    { lh: [null, null, null, null, null, null, null, null], rh: [] }
  ];
  const tag = (bars, section, extra = {}) => bars.map((bar, pos) => ({ ...bar, ...extra, section, pos }));
  const FIRST_PASS = [
    ...tag(INTRO, 'Entrada'),
    ...tag(A, 'A'),
    ...tag(A, 'A · eco', { thin: true }),
    ...tag(B, 'B'),
    ...tag(A, 'A · regreso', { bloom: true }),
    ...tag(OUTRO, 'Cierre')
  ];
  const INTRO_BARS = INTRO.length;

  // ── Estado ───────────────────────────────────────────────────────────────
  let ctx = null, bus = null, master = null, analyser = null, wow = null, wave = null, noise = null;
  let timer = null, playing = false, silent = false, resumeOnVisible = false;
  let barIndex = 0, eighth = 0, nextTime = 0, passes = 0, rubatoPhase = 0;
  // Por defecto suena sin mano derecha (intensidad < 0.35): arpegio, delays y trombones.
  let volume = 0.8, intensity = 0.31;
  // Pulso: multiplicador del tempo base. `pace` es el que suena; `paceGoal`, al que se acerca nota a nota.
  let pace = 1, paceGoal = 1, paceStamp = 0;
  // Envíos de los ecos a tempo [nodo, nivel base]: se recogen al apretar el paso y se abren al serenarse.
  let echoSends = [], echoWet = 1;
  const listeners = new Set();
  try {
    const saved = parseFloat(localStorage.getItem(VOLUME_KEY));
    if (saved >= 0 && saved <= 1) volume = saved;
  } catch {}

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const emit = () => listeners.forEach(fn => { try { fn(snapshot()); } catch {} });
  function snapshot() {
    const bar = FIRST_PASS[barIndex] || FIRST_PASS[0];
    return { playing, silent, volume, intensity, tempo: Math.round(BPM * pace * 10) / 10, title: TITLE, section: bar.section, bar: barIndex + 1, bars: FIRST_PASS.length, pass: passes + 1 };
  }

  // ── Cadena de audio ──────────────────────────────────────────────────────
  function build() {
    ctx = new AC({ latencyHint: 'playback' });
    // Timbre de fieltro: fundamental dominante y armónicos que se apagan pronto.
    const partials = [0, 1, 0.48, 0.2, 0.1, 0.05, 0.025, 0.012, 0.006];
    wave = ctx.createPeriodicWave(new Float32Array(partials.length), Float32Array.from(partials));

    bus = ctx.createGain();
    bus.gain.value = 0.72;

    // Saturación suave de cinta.
    const tape = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(1.5 * x) / Math.tanh(1.5);
    }
    tape.curve = curve;
    tape.oversample = '2x';

    const silk = ctx.createBiquadFilter();
    silk.type = 'lowpass'; silk.frequency.value = 2000; silk.Q.value = 0.5;
    const body = ctx.createBiquadFilter();
    body.type = 'lowshelf'; body.frequency.value = 220; body.gain.value = 3.5;
    const rumble = ctx.createBiquadFilter();
    rumble.type = 'highpass'; rumble.frequency.value = 42; rumble.Q.value = 0.5;

    // Sala pequeña y oscura generada en el momento (sin descargar nada).
    const room = ctx.createConvolver();
    const seconds = 3.6, rate = ctx.sampleRate, length = Math.floor(seconds * rate);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      const predelay = Math.floor(0.018 * rate);
      let smooth = 0;
      for (let i = predelay; i < length; i++) {
        const t = (i - predelay) / rate;
        smooth += ((Math.random() * 2 - 1) - smooth) * 0.13;
        data[i] = smooth * Math.exp(-t / 0.82) * (1 - Math.exp(-t / 0.012));
      }
    }
    room.buffer = impulse;
    const send = ctx.createGain(); send.gain.value = 0.7;
    const wet = ctx.createGain(); wet.gain.value = 0.85;

    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20; glue.knee.value = 18; glue.ratio.value = 2.5;
    glue.attack.value = 0.02; glue.release.value = 0.3;

    master = ctx.createGain();
    master.gain.value = 0;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;

    // Phaser lento: cuatro pasa-todo barridos que abren muescas móviles en el timbre.
    const swirl = ctx.createOscillator(), phased = ctx.createGain();
    swirl.frequency.value = 0.11; phased.gain.value = 0.85;
    let stage = bus;
    [380, 720, 1150, 1700].forEach(center => {
      const pass = ctx.createBiquadFilter(), depth = ctx.createGain();
      pass.type = 'allpass'; pass.frequency.value = center; pass.Q.value = 0.7;
      depth.gain.value = center * 0.55;
      swirl.connect(depth); depth.connect(pass.frequency);
      stage.connect(pass); stage = pass;
    });
    stage.connect(phased); phased.connect(tape); swirl.start();

    bus.connect(tape); tape.connect(silk); silk.connect(body); body.connect(rumble);
    rumble.connect(glue);
    rumble.connect(send); send.connect(room); room.connect(wet); wet.connect(glue);
    // Eco de cinta: una repetición blanda que se va oscureciendo y cabecea.
    const echo = ctx.createDelay(1), echoTone = ctx.createBiquadFilter();
    const echoSend = ctx.createGain(), echoBack = ctx.createGain();
    echo.delayTime.value = 0.33;
    echoTone.type = 'lowpass'; echoTone.frequency.value = 1300; echoTone.Q.value = 0.4;
    echoSend.gain.value = 0.2; echoBack.gain.value = 0.36;
    rumble.connect(echoSend); echoSend.connect(echo); echo.connect(echoTone);
    echoTone.connect(echoBack); echoBack.connect(echo);
    echoTone.connect(glue); echoTone.connect(send);
    const sway = ctx.createOscillator(), swayDepth = ctx.createGain();
    sway.frequency.value = 0.23; swayDepth.gain.value = 0.0022;
    sway.connect(swayDepth); swayDepth.connect(echo.delayTime); sway.start();

    // Delays cruzados: corchea con puntillo a la izquierda, negra a la derecha, realimentándose entre sí.
    const pingSend = ctx.createGain(), ping = ctx.createDelay(2), pong = ctx.createDelay(2);
    const pingBack = ctx.createGain(), pongBack = ctx.createGain(), loopTone = ctx.createBiquadFilter();
    pingSend.gain.value = 0.34;
    echoSends = [[pingSend, 0.34]];
    ping.delayTime.value = EIGHTH * 3; pong.delayTime.value = EIGHTH * 2;
    pingBack.gain.value = 0.52; pongBack.gain.value = 0.48;
    loopTone.type = 'lowpass'; loopTone.frequency.value = 1500; loopTone.Q.value = 0.4;
    rumble.connect(pingSend); pingSend.connect(loopTone); loopTone.connect(ping);
    ping.connect(pingBack); pingBack.connect(pong);
    pong.connect(pongBack); pongBack.connect(loopTone);
    const place = (node, pan) => {
      if (typeof ctx.createStereoPanner !== 'function') { node.connect(glue); return; }
      const panner = ctx.createStereoPanner(); panner.pan.value = pan;
      node.connect(panner); panner.connect(glue);
    };
    place(ping, -0.8); place(pong, 0.8);
    ping.connect(send); pong.connect(send);
    // Las repeticiones cabecean de tono, cada lado a su ritmo.
    [[ping, 0.17, 0.004], [pong, 0.13, 0.005]].forEach(([line, hz, amount]) => {
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = hz; depth.gain.value = amount;
      lfo.connect(depth); depth.connect(line.delayTime); lfo.start();
    });
    // Dos ecos más, cada uno con su bucle: uno en tresillo de negra, cercano y algo más claro, que rellena
    // los huecos entre corcheas; y uno lejano, a blanca con puntillo, muy oscuro, que devuelve la frase al fondo de la sala.
    [[EIGHTH * 4 / 3, 0.15, 0.3, 1700, 0.35, 0.21, 0.003, 0.25], [EIGHTH * 6, 0.2, 0.42, 900, -0.3, 0.09, 0.005, 0.6]]
      .forEach(([seconds, level, feedback, cutoff, pan, hz, amount, toRoom]) => {
        const line = ctx.createDelay(2), lineSend = ctx.createGain(), lineBack = ctx.createGain();
        const lineTone = ctx.createBiquadFilter(), lineRoom = ctx.createGain();
        line.delayTime.value = seconds;
        lineSend.gain.value = level; lineBack.gain.value = feedback; lineRoom.gain.value = toRoom;
        echoSends.push([lineSend, level]);
        lineTone.type = 'lowpass'; lineTone.frequency.value = cutoff; lineTone.Q.value = 0.4;
        rumble.connect(lineSend); lineSend.connect(lineTone); lineTone.connect(line);
        line.connect(lineBack); lineBack.connect(lineTone);
        place(line, pan);
        line.connect(lineRoom); lineRoom.connect(send);
        const lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.frequency.value = hz; depth.gain.value = amount;
        lfo.connect(depth); depth.connect(line.delayTime); lfo.start();
      });

    // Ruido pardo para fieltro, pedal y aire de sala (nunca ruido blanco).
    noise = ctx.createBuffer(1, rate * 2, rate);
    const grain = noise.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < grain.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.04) / 1.02;
      grain[i] = brown * 3;
    }
    const air = ctx.createBufferSource(), airTone = ctx.createBiquadFilter(), airGain = ctx.createGain();
    air.buffer = noise; air.loop = true;
    airTone.type = 'lowpass'; airTone.frequency.value = 480;
    airGain.gain.value = 0.012;
    air.connect(airTone); airTone.connect(airGain); airGain.connect(glue); air.start();

    glue.connect(master); master.connect(analyser); analyser.connect(ctx.destination);

    // Deriva de cinta: wow lento y un hilo de flutter, en cents.
    wow = ctx.createGain(); wow.gain.value = 1;
    const slow = ctx.createOscillator(), slowDepth = ctx.createGain();
    slow.frequency.value = 0.41; slowDepth.gain.value = 6;
    const fast = ctx.createOscillator(), fastDepth = ctx.createGain();
    fast.frequency.value = 5.7; fastDepth.gain.value = 0.9;
    slow.connect(slowDepth); slowDepth.connect(wow);
    fast.connect(fastDepth); fastDepth.connect(wow);
    const tide = ctx.createOscillator(), tideDepth = ctx.createGain();
    tide.frequency.value = 0.063; tideDepth.gain.value = 7;
    tide.connect(tideDepth); tideDepth.connect(wow);
    slow.start(); fast.start(); tide.start();
  }

  // ── Voz de piano ─────────────────────────────────────────────────────────
  // Un piano de casa: cada tecla tiene su pequeña desafinación fija y su batido.
  const keyHash = (midi, salt) => { const x = Math.sin(midi * 12.9898 + salt) * 43758.5453; return x - Math.floor(x); };
  const keyTuning = midi => (keyHash(midi, 1.7) - 0.5) * 9;
  const keySpread = midi => 0.7 + keyHash(midi, 8.3) * 1.5;

  function brush(when, level, cutoff, seconds) {
    const src = ctx.createBufferSource(), tone = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = noise;
    tone.type = 'lowpass'; tone.frequency.value = cutoff; tone.Q.value = 0.3;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + seconds);
    src.connect(tone); tone.connect(gain); gain.connect(bus);
    src.start(when, rand(0, 1.5)); src.stop(when + seconds + 0.02);
    src.onended = () => { try { gain.disconnect(); } catch {} };
  }

  function strike(midi, when, velocity, sustain = 1) {
    const freq = 440 * Math.pow(2, (midi + TRANSPOSE - 69) / 12);
    const vel = clamp(velocity, 0.05, 1);
    const out = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.Q.value = 0.4;
    const bright = Math.min(3000, freq * (2.6 + 4.5 * vel) + 450);
    const dark = Math.min(1500, freq * 1.5 + 120);
    tone.frequency.setValueAtTime(bright, when);
    tone.frequency.setTargetAtTime(dark, when + 0.02, 0.24);

    const peak = vel * 0.22;
    const tail = sustain * clamp(2.6 - Math.log2(freq / 55) * 0.42, 0.7, 2.8);
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(peak, when + 0.019);
    out.gain.setTargetAtTime(peak * 0.46, when + 0.019, 0.13);
    out.gain.setTargetAtTime(0, when + 0.3, tail);
    const end = when + 0.3 + tail * 5;

    const strings = freq > 700 ? [0] : [-1.7, 1.9];
    const oscs = strings.map(cents => {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(wave);
      osc.frequency.value = freq;
      osc.detune.value = cents * keySpread(midi) + keyTuning(midi) + rand(-0.6, 0.6);
      wow.connect(osc.detune);
      const level = ctx.createGain();
      level.gain.value = 1 / strings.length;
      osc.connect(level); level.connect(tone);
      osc.start(when); osc.stop(end);
      return osc;
    });
    tone.connect(out); out.connect(bus);

    // Golpe de macillo: impulso grave senoidal, sin ruido.
    const thump = ctx.createOscillator(), thumpGain = ctx.createGain();
    thump.frequency.setValueAtTime(150, when);
    thump.frequency.exponentialRampToValueAtTime(70, when + 0.05);
    thumpGain.gain.setValueAtTime(0, when);
    thumpGain.gain.linearRampToValueAtTime(vel * 0.035, when + 0.004);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    thump.connect(thumpGain); thumpGain.connect(bus);
    thump.start(when); thump.stop(when + 0.08);
    brush(when, vel * 0.05, 500 + 1100 * vel, 0.05);
    thump.onended = () => { try { thump.disconnect(); thumpGain.disconnect(); } catch {} };

    oscs[0].onended = () => {
      try { wow.disconnect(oscs[0].detune); } catch {}
      if (oscs[1]) { try { wow.disconnect(oscs[1].detune); } catch {} }
      try { out.disconnect(); } catch {}
    };
  }

  // ── Trombones ────────────────────────────────────────────────────────────
  // Diente de sierra filtrado que se abre con el soplo, vibrato tardío y vara que desliza.
  let lastBrass = null;
  function brass(notes, when, seconds, level) {
    const previous = lastBrass;
    lastBrass = notes;
    notes.forEach((midi, i) => {
      const start = when + rand(0, 0.045) + i * 0.012;
      const freq = 440 * Math.pow(2, (midi + TRANSPOSE - 69) / 12);
      const from = previous ? 440 * Math.pow(2, (previous[i] + TRANSPOSE - 69) / 12) : freq * 0.944;
      const osc = ctx.createOscillator(), bore = ctx.createBiquadFilter(), bell = ctx.createBiquadFilter(), amp = ctx.createGain();
      osc.type = 'sawtooth';
      osc.detune.value = rand(-7, 7);
      osc.frequency.setValueAtTime(from, start);
      osc.frequency.exponentialRampToValueAtTime(freq, start + rand(0.16, 0.3));
      wow.connect(osc.detune);
      const lip = ctx.createOscillator(), lipDepth = ctx.createGain();
      lip.frequency.value = rand(4.6, 5.4);
      lipDepth.gain.setValueAtTime(0, start);
      lipDepth.gain.linearRampToValueAtTime(11, start + seconds * 0.7);
      lip.connect(lipDepth); lipDepth.connect(osc.detune);
      const peak = level * (i === 1 ? 0.05 : 0.04);
      const swell = start + seconds * 0.55, off = start + seconds + 0.12;
      bore.type = 'lowpass'; bore.Q.value = 1.1;
      bore.frequency.setValueAtTime(240, start);
      bore.frequency.linearRampToValueAtTime(520 + 520 * level, start + 0.14);
      bore.frequency.linearRampToValueAtTime(700 + 800 * level, swell);
      bore.frequency.linearRampToValueAtTime(300, off + 0.25);
      bell.type = 'peaking'; bell.frequency.value = 500; bell.Q.value = 1.2; bell.gain.value = 5;
      amp.gain.setValueAtTime(0, start);
      amp.gain.linearRampToValueAtTime(peak * 0.7, start + 0.11);
      amp.gain.linearRampToValueAtTime(peak, swell);
      amp.gain.linearRampToValueAtTime(peak * 0.75, off);
      amp.gain.linearRampToValueAtTime(0, off + 0.3);
      osc.connect(bore); bore.connect(bell); bell.connect(amp);
      if (typeof ctx.createStereoPanner === 'function') {
        const seat = ctx.createStereoPanner(); seat.pan.value = (i - 1) * 0.45;
        amp.connect(seat); seat.connect(bus);
      } else amp.connect(bus);
      osc.start(start); lip.start(start);
      osc.stop(off + 0.35); lip.stop(off + 0.35);
      osc.onended = () => { try { wow.disconnect(osc.detune); amp.disconnect(); lipDepth.disconnect(); } catch {} };
    });
  }

  // ── Intérprete ───────────────────────────────────────────────────────────
  // Microfallos de mano humana: dudas, notas fantasma, arranques y teclas rozadas.
  function human(when, vel) {
    const r = Math.random();
    if (r < 0.05) return [when + rand(0.035, 0.075), vel * 0.9];
    if (r < 0.11) return [when, vel * rand(0.35, 0.55)];
    if (r < 0.15) return [when - rand(0.01, 0.024), vel * 1.18];
    return [when + rand(-0.008, 0.014), vel];
  }
  let drift = 0;

  const LH_ACCENT = [1, 0.55, 0.82, 0.55, 0.9, 0.55, 0.78, 0.6];
  let thinMask = new Set();

  function scheduleEighth(when) {
    const bar = FIRST_PASS[barIndex];
    // Balanceo ligero: las corcheas a contratiempo llegan un pelo tarde.
    if (eighth % 2 === 1 && !bar.final) when += EIGHTH / pace * SWING * clamp(1 - 1.6 * (pace - 1), 0.65, 1.2);
    if (eighth === 0 && bar.thin) {
      // Cada pasada del eco calla notas distintas.
      thinMask = new Set(bar.rh.map((_, i) => i).filter(i => i > 0 && Math.random() < 0.3));
    }
    // Con el pulso cambia la mano: al apretar toca con más decisión y más seco; al serenarse, más suave y ligado.
    const hush = (bar.soft ? 0.72 : 1) * clamp(1 + 0.8 * (pace - 1), 0.88, 1.17);
    const pedal = 1 / pace;
    const left = bar.lh[eighth];
    // Cambio de pedal al empezar el compás: un golpe sordo de madera y fieltro.
    if (eighth === 0 && left != null && Math.random() < 0.65) brush(when - 0.03, rand(0.03, 0.06), 190, 0.16);
    if (eighth === 0) {
      if (bar.brass) brass(bar.brass, when, EIGHTH * 8 / pace, 0.55 + 0.45 * (bar.pos / 7));
      else lastBrass = null;
    }
    const dropped = eighth % 2 === 1 && !bar.final && Math.random() < 0.03;
    if (left != null && !dropped) {
      const roll = bar.final ? eighth * rand(0.03, 0.045) : 0;
      const [at, vel] = human(when + roll, 0.4 * LH_ACCENT[eighth] * hush * rand(0.86, 1.1));
      strike(left, at, vel, bar.final ? 1.5 : 0.5 * pedal);
    }
    if (intensity >= 0.35) {
      bar.rh.forEach(([at, midi, length], i) => {
        if (at !== eighth) return;
        if (bar.thin && thinMask.has(i)) return;
        // La melodía entra un instante después del bajo, como una mano que se abre.
        const lag = 0.012 + rand(0, 0.03);
        const arc = 0.68 + 0.14 * Math.sin(bar.pos / 8 * Math.PI) + (at === 0 ? 0.05 : 0);
        const [hit, vel] = human(when + lag, arc * hush * rand(0.9, 1.07) * (0.6 + 0.4 * intensity));
        // De vez en cuando un dedo roza la tecla vecina antes de caer en la buena.
        if (Math.random() < 0.035) strike(midi + (Math.random() < 0.5 ? -2 : 2), hit - rand(0.03, 0.05), vel * 0.2, 0.35);
        strike(midi, hit, vel, clamp(0.8 + length * 0.12, 0.9, 1.7) * Math.sqrt(pedal));
        if (bar.bloom && length >= 4 && Math.random() < 0.55) {
          strike(midi - 12, hit + EIGHTH / pace * 0.5, vel * 0.45, 1.3);
        }
      });
    }
  }

  // El pulso se acerca a su meta corchea a corchea, como un intérprete que aprieta o afloja el paso:
  // nunca salta, y solo decide la distancia a la nota siguiente, sin tocar las ya programadas.
  function breathePace() {
    if (silent || ctx.currentTime - paceStamp > PACE_HOLD) paceGoal = 1;
    const gap = paceGoal - pace;
    if (Math.abs(gap) < 0.003) { pace = paceGoal; breatheEchoes(); return; }
    // Aprieta con más decisión de la que afloja; como mucho un 3 % de una corchea a la siguiente.
    pace += clamp(gap * (paceGoal === 1 ? 0.2 : 0.24), -0.03, 0.03);
    breatheEchoes();
  }

  // Los ecos están medidos a 96: al correr se recogen para no emborronar; al serenarse se abren.
  function breatheEchoes() {
    const wet = clamp(1 - 1.7 * (pace - 1), 0.66, 1.2);
    if (Math.abs(wet - echoWet) < 0.004) return;
    echoWet = wet;
    echoSends.forEach(([node, base]) => node.gain.setTargetAtTime(base * wet, nextTime, 0.35));
  }

  function advance() {
    const bar = FIRST_PASS[barIndex];
    rubatoPhase += 0.21;
    drift = clamp(drift + rand(-0.005, 0.005), -0.035, 0.035);
    let stretch = 1 + drift + 0.015 * Math.sin(rubatoPhase) + rand(-0.012, 0.012);
    if (bar.breathe && eighth >= 5) stretch *= 1 + (eighth - 4) * 0.07;
    breathePace();
    nextTime += EIGHTH * stretch / pace;
    eighth += 1;
    if (eighth < 8) return;
    eighth = 0;
    barIndex += 1;
    // A veces la mano respira antes de atacar el compás siguiente.
    if (Math.random() < 0.14) nextTime += rand(0.02, 0.06);
    if (barIndex >= FIRST_PASS.length) { barIndex = INTRO_BARS; passes += 1; }
    emit();
  }

  function tick() {
    if (!playing || !ctx) return;
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      if (!silent) scheduleEighth(nextTime);
      advance();
    }
  }

  function fade(target, seconds) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(target, now + seconds);
  }

  // ── Control ──────────────────────────────────────────────────────────────
  async function start() {
    if (playing) return true;
    try {
      if (!ctx) build();
      if (ctx.state !== 'running') await ctx.resume();
    } catch { return false; }
    playing = true;
    pace = paceGoal = 1;
    nextTime = ctx.currentTime + 0.12;
    breatheEchoes();
    fade(volume, 1.4);
    clearInterval(timer);
    timer = setInterval(tick, TICK_MS);
    tick();
    emit();
    return true;
  }

  function stop(seconds = 0.9) {
    if (!playing || !ctx) return;
    playing = false;
    clearInterval(timer); timer = null;
    fade(0, seconds);
    const context = ctx;
    setTimeout(() => { if (!playing && context.state === 'running') context.suspend().catch(() => {}); }, seconds * 1000 + 3500);
    emit();
  }

  function rewind() { barIndex = 0; eighth = 0; passes = 0; rubatoPhase = 0; drift = 0; }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      resumeOnVisible = playing;
      if (playing) stop(0.4);
    } else if (resumeOnVisible) {
      resumeOnVisible = false;
      start();
    }
  });
  addEventListener('pagehide', () => { resumeOnVisible = false; stop(0.1); });

  window.NAROA_SCORE = Object.freeze({
    title: TITLE,
    bpm: BPM,
    start,
    stop() { resumeOnVisible = false; stop(); },
    toggle() { if (playing) { resumeOnVisible = false; stop(); return Promise.resolve(false); } return start(); },
    rewind,
    // Salta al primer compás de una sección ('A', 'B', 'Cierre'…).
    seek(section) {
      const index = FIRST_PASS.findIndex(bar => bar.section === section);
      if (index < 0) return false;
      barIndex = index; eighth = 0; lastBrass = null;
      if (ctx && playing) nextTime = ctx.currentTime + 0.12;
      emit();
      return true;
    },
    setVolume(value) {
      volume = clamp(Number(value) || 0, 0, 1);
      try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch {}
      if (playing && ctx) fade(volume, 0.15);
      emit();
    },
    // 0 = solo mano izquierda; 1 = pieza completa.
    setIntensity(value) { intensity = clamp(Number(value) || 0, 0, 1); emit(); },
    // Silencio contemplativo (p. ej. «Game Over»): el pulso sigue, las notas callan.
    setSilent(value) { silent = !!value; emit(); },
    // Meta del pulso (1 = 96 pulsos por minuto). Hay que renovarla mientras dure el gesto:
    // sin noticias, el pulso vuelve solo al tempo base. Con el sonido apagado no hace nada.
    setPace(value) {
      if (!playing || !ctx) return;
      paceGoal = silent ? 1 : clamp(Number(value) || 1, PACE_MIN, PACE_MAX);
      paceStamp = ctx.currentTime;
    },
    // Toma de audio para la Story en vídeo: suena desde la sección A y se devuelve como MediaStream.
    async capture(seconds = 6) {
      const take = { stream: null, notesScheduled: Math.max(1, Math.floor(seconds / EIGHTH)), stop() {} };
      const wasPlaying = playing;
      if (!wasPlaying) {
        rewind(); barIndex = INTRO_BARS;
        if (!(await start())) return take;
      }
      let tap = null;
      if (typeof ctx.createMediaStreamDestination === 'function') {
        tap = ctx.createMediaStreamDestination();
        master.connect(tap);
        take.stream = tap.stream;
      }
      take.stop = () => {
        if (tap) { try { master.disconnect(tap); } catch {} }
        if (!wasPlaying) stop(0.3);
      };
      return take;
    },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get state() { return snapshot(); },
    get playing() { return playing; },
    get analyser() { return analyser; }
  });
})();

/* Naroa — conexión con la web: el botón SONIDO enciende y apaga «Apirila». Sin tarjeta. */
(() => {
  'use strict';
  const score = window.NAROA_SCORE || null;
  const button = document.querySelector('[data-sound]');
  if (!button) return;
  const status = document.querySelector('[data-sound-status]');
  const RESUME_KEY = 'naroa-score-on';
  const TITLE = 'Apirila';
  let busy = false, quiet = false;
  let energy = 0, calm = 0, feltAt = 0;

  const remember = on => {
    try { if (on) sessionStorage.setItem(RESUME_KEY, '1'); else sessionStorage.removeItem(RESUME_KEY); } catch {}
  };
  // El aviso solo aparece si el navegador bloquea el audio.
  function say(text) {
    if (!status) return;
    status.textContent = text;
    status.hidden = !text;
  }
  function paint() {
    const on = !!score && score.playing;
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-busy', String(busy));
    button.disabled = busy;
    button.setAttribute('aria-label', on ? 'Parar la banda sonora' : 'Escuchar la banda sonora');
    button.dataset.state = busy ? 'loading' : on ? 'playing' : 'off';
  }
  async function turnOn() {
    if (!score) { say('Este navegador no puede reproducir la banda sonora.'); return; }
    if (busy || score.playing) return;
    busy = true; paint();
    const ok = await score.start();
    busy = false;
    say(ok ? '' : 'El navegador no ha permitido iniciar el sonido. Vuelve a intentarlo.');
    remember(ok);
    paint();
  }
  button.addEventListener('click', () => {
    if (score && score.playing) { score.stop(); remember(false); say(''); paint(); }
    else turnOn();
  });
  if (score) score.on(paint);
  say('');
  paint();

  // Si la música sonaba en la página anterior, vuelve con el primer gesto en esta.
  let wasOn = false;
  try { wasOn = !!score && sessionStorage.getItem(RESUME_KEY) === '1'; } catch {}
  if (wasOn) {
    const resume = event => {
      removeEventListener('pointerdown', resume, true);
      removeEventListener('keydown', resume, true);
      if (event.target instanceof Element && event.target.closest('[data-sound]')) return;
      turnOn();
    };
    addEventListener('pointerdown', resume, true);
    addEventListener('keydown', resume, true);
  }

  // El pulso sigue al scroll. `velocity` llega en alturas de pantalla por segundo.
  // Parado: tempo base. Paseo lento y sostenido: la pieza se serena. Scroll rápido: aprieta el paso.
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const ease = v => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
  const strollOf = speed => ease((speed - 0.04) / 0.2) * (1 - ease((speed - 0.45) / 0.75));
  const rushOf = speed => ease((speed - 0.9) / 2.3);
  function feel(velocity) {
    if (!score || !score.playing) { energy = calm = 0; return; }
    const speed = Math.abs(velocity);
    // Un salto de golpe (enlace, tecla, índice: más de 40 pantallas por segundo) no es un gesto: no cuenta.
    if (!(speed <= 40)) return;
    const now = performance.now(), gap = now - feltAt;
    feltAt = now;
    if (gap > 400) energy = 0;
    if (gap > 1500) calm = 0;
    const dt = clamp(gap, 8, 50);
    // Media móvil de un cuarto de segundo: las muescas sueltas de una rueda de ratón se leen como
    // la velocidad media del gesto, no como una ráfaga de picos.
    energy += (Math.min(speed, 6) - energy) * (1 - Math.exp(-dt / 260));
    // La calma hay que ganársela: solo un paseo lento sostenido cerca de un segundo serena la pieza.
    // Así la cola de un gesto rápido o una muesca suelta de la rueda no la frenan.
    const stroll = strollOf(energy);
    calm += (stroll - calm) * (1 - Math.exp(-dt / (stroll > calm ? 800 : 220)));
    score.setPace(1 - (12 / 96) * calm + (20 / 96) * rushOf(energy));
  }

  window.NAROA_SOUND = Object.freeze({
    score,
    // La cámara informa de la obra en pantalla y de la velocidad del scroll.
    // «Game Over» exige silencio contemplativo; sin movimiento (`still`) el pulso no se inmuta.
    frame(state) {
      // Un aviso que solo trae velocidad (páginas sin obra en pantalla) no cambia el silencio.
      const next = state && typeof state.slug !== 'string' ? quiet : !!state && state.slug === 'game-over';
      if (next !== quiet) {
        quiet = next;
        if (score) score.setSilent(quiet);
      }
      if (state && typeof state.velocity === 'number' && state.mode !== 'still') feel(quiet ? 0 : state.velocity);
    },
    gameOver() {},
    getActiveMelodyInfo() { return { day: 'Banda sonora', name: TITLE }; },
    // Audio para la Story en vídeo; sin motor disponible devuelve una toma muda.
    async createStoryLoopStream(seconds = 6) {
      const take = score
        ? await score.capture(seconds)
        : { stream: null, notesScheduled: Math.max(1, Math.floor(seconds / 0.3125)), stop() {} };
      return { stream: take.stream, melodyName: TITLE, melodyDay: 'Banda sonora', notesScheduled: take.notesScheduled, stop: take.stop };
    }
  });
})();
