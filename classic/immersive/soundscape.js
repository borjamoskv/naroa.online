/* Naroa — banda sonora original para piano de fieltro: doce piezas, una por mes («Apirila» es la de abril).
 * Suena la del mes en curso. Motor autónomo escrito desde cero: síntesis pura Web Audio, sin muestras ni red.
 * Mano izquierda saltarina en corcheas, melodía pentatónica en Do mayor,
 * trombones en el puente, phaser lento, delays cruzados a tempo, un eco en tresillo y otro lejano.
 * Sonido cálido y húmedo: piano de casa algo desafinado, sala larga, eco de cinta y microfallos de mano.
 * El pulso respira con el scroll del visitante: 96 pulsos por minuto en reposo, entre 84 y 116 en marcha.
 * La melodía (mano derecha) descansa en reposo y despierta cuando el visitante se mueve.
 * Espacio al estilo Portal: los ecos y el paisaje del mes (viento, lluvia, mar, brasas) rodean al oyente
 * en 3D (HRTF) y giran con el scroll.
 * API: window.NAROA_SCORE.{start, stop, toggle, setVolume, setIntensity, setSilent, setPace, wake, setTurn, setMonth, on}
 */
(() => {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || window.NAROA_SCORE) return;

  const BPM = 96;
  const EIGHTH = 60 / BPM / 2;
  const LOOKAHEAD = 0.4;
  const TICK_MS = 60;
  // Margen del pulso alrededor del tempo base: de 84 a 116 pulsos por minuto.
  const PACE_MIN = 84 / BPM, PACE_MAX = 116 / BPM;
  // Segundos sin noticias del scroll tras los que el pulso vuelve solo al tempo base.
  const PACE_HOLD = 0.6;
  // La melodía aguanta un poco más: una pausa corta entre dos gestos no la corta.
  const WAKE_HOLD = 2.5;
  // Umbral de intensidad a partir del cual suena la mano derecha, e intensidad de reposo.
  const MELODY_GATE = 0.35, REST = 0.31;
  // Nivel general del paisaje: presente pero siempre por debajo del piano (unos 12–16 dB).
  const NATURE = 1.4;
  // Nivel del piano antes de la cinta; cada pieza lo corrige con su `level` para que los doce meses suenen igual de fuerte.
  const BUS = 0.72;
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
  // ── Las doce piezas ──────────────────────────────────────────────────────
  // Una por mes, con el nombre del mes en euskera. «Apirila» (abril) es la partitura escrita nota a nota
  // de arriba; las otras once se escriben por grados sobre la escala del mes. Cada compás es
  // [grado del acorde, 'entrada grado duración, …']: el grado 0 es la tónica, el 7 su octava.
  const SCALES = {
    mayor: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10], dorica: [0, 2, 3, 5, 7, 9, 10],
    mixolidia: [0, 2, 4, 5, 7, 9, 10], lidia: [0, 2, 4, 6, 7, 9, 11]
  };
  // Figuras de mano izquierda: ocho corcheas en grados sobre el bajo del acorde (null = silencio).
  const FIGURES = {
    saltarina: [0, 4, 9, 4, 7, 4, 9, 4], quieta: [0, null, 4, null, 9, null, 7, null],
    tresillo: [0, 4, 9, 0, 4, 9, 0, 4], rafaga: [0, 4, 7, 9, 7, 9, 11, 9],
    ola: [0, 4, 7, 9, 11, 9, 7, 4], danza: [0, 7, 9, 7, 0, 7, 9, 7],
    barca: [0, 7, 4, 9, 7, 4, 9, 7], brinco: [0, 9, 4, 9, 0, 9, 4, 9],
    lluvia: [0, 7, 4, 7, 9, 7, 4, 7], niebla: [0, null, 7, 4, 9, null, 7, 4],
    campana: [0, 9, 7, 9, 4, 9, 7, 9]
  };
  // Segunda voz de «Apirila» (escrita en Fa mayor): la nota de la escala que queda una tercera por debajo.
  const F_MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const thirdBelow = midi => {
    let found = 0;
    for (let note = midi - 1; note > midi - 6; note--) if (F_MAJOR.includes(((note - 5) % 12 + 12) % 12) && ++found === 2) return note;
    return null;
  };
  const voice = bars => bars.map(bar => ({ ...bar, second: bar.rh.map(([, midi, length]) => (length >= 2 ? thirdBelow(midi) : null)) }));
  const arrange = (intro, a, b, outro, back = a) => [
    ...tag(intro, 'Entrada'),
    ...tag(a, 'A'),
    ...tag(a, 'A · eco', { thin: true }),
    ...tag(b, 'B'),
    ...tag(back, 'A · regreso', { bloom: true }),
    ...tag(outro, 'Cierre')
  ];
  function compose({ title, tonic, sing, scale, figure, accent, swing, nature, level, A: verse, B: bridge }) {
    const steps = SCALES[scale], shape = FIGURES[figure];
    const wrap = step => ((step % 7) + 7) % 7;
    // `raised` es el grado que el compás sube medio tono (la sensible de una cadencia en menor).
    const pitch = (ref, step, raised = null) => ref + 12 * Math.floor(step / 7) + steps[wrap(step)] + (wrap(step) === raised ? 1 : 0);
    // El bajo de cada acorde vive entre La1 y Sol#2.
    const low = degree => (pitch(tonic, degree) > 44 ? degree - 7 : degree);
    // Armonía de frase: el compás que cierra en dominante lleva séptima y, en menor, sensible (una cadencia
    // de verdad); el que lo prepara desde el II o el IV también lleva séptima.
    const colour = (degree, i) => ({
      seventh: (i === 7 && degree === 4) || (i === 6 && (degree === 1 || degree === 3)),
      raised: i === 7 && degree === 4 && scale === 'menor' ? wrap(degree + 2) : null
    });
    const left = (degree, { seventh = false, raised = null } = {}, next = null) => {
      const offsets = shape.slice();
      if (seventh) {
        const octave = offsets.indexOf(7), fifth = offsets.lastIndexOf(4);
        if (octave >= 0) offsets[octave] = 6; else if (fifth > 0) offsets[fifth] = 6;
      }
      const notes = offsets.map(offset => (offset == null ? null : pitch(tonic, low(degree) + offset, raised)));
      // El bajo camina: la última corchea se acerca por grado conjunto al bajo del compás siguiente.
      if (next != null && next !== degree) notes[7] = pitch(tonic, low(next) + (low(next) > low(degree) ? -1 : 1), raised);
      return notes;
    };
    const read = text => text.split(',').map(note => note.trim().split(/\s+/).map(Number));
    const right = (notes, raised) => notes.map(([at, step, length]) => [at, pitch(sing, step, raised), length]);
    // En la vuelta la melodía se adorna: una nota de paso rellena cada salto de tercera entre notas seguidas.
    const adorn = notes => notes.flatMap(([at, step, length], i) => {
      const next = notes[i + 1];
      if (next && length >= 2 && next[0] === at + length && Math.abs(next[1] - step) === 2) {
        return [[at, step, length - 1], [next[0] - 1, (step + next[1]) / 2, 1]];
      }
      return [[at, step, length]];
    });
    // Tres trombones: las notas del acorde más cercanas a su tesitura, sin cruzarse.
    const horns = (degree, raised) => {
      const chairs = [48, 53, 57], tones = [0, 2, 4].map(third => pitch(tonic, degree + third, raised) % 12);
      let best = null, bestCost = Infinity;
      [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].forEach(order => {
        const notes = order.map((tone, voice) => {
          const near = chairs[voice] - ((chairs[voice] - tones[tone]) % 12 + 12) % 12;
          return chairs[voice] - near > 6 ? near + 12 : near;
        });
        const cost = notes.reduce((sum, note, voice) => sum + Math.abs(note - chairs[voice]), 0);
        if (notes[0] < notes[1] && notes[1] < notes[2] && cost < bestCost) { best = notes; bestCost = cost; }
      });
      return best || chairs;
    };
    const section = (specs, decorate, brassy, voiced) => specs.map(([degree, melody], i) => {
      const tint = colour(degree, i), notes = decorate ? adorn(read(melody)) : read(melody);
      // Al final de la frase la figura se queda quieta: el bajo no camina hacia la sección siguiente.
      const next = i < 7 ? specs[i + 1][0] : null;
      return {
        lh: left(degree, tint, next), rh: right(notes, tint.raised),
        // Segunda voz: una tercera por debajo de cada nota larga, dentro de la escala y de la armonía del compás.
        ...(voiced ? { second: notes.map(([, step, length]) => (length >= 2 ? pitch(sing, step - 2, tint.raised) : null)) } : {}),
        ...(brassy ? { brass: horns(degree, tint.raised) } : {}), ...(i === 7 ? { breathe: true } : {})
      };
    });
    const home = pitch(sing, 7) <= 79 ? 7 : 0;
    return {
      title, transpose: 0, swing, accent, nature, level,
      bars: arrange(
        verse.slice(0, 2).map(([degree]) => ({ lh: left(degree), rh: [], soft: true })),
        section(verse, false, false, false),
        section(bridge, false, true, true),
        [
          { lh: left(0), rh: [[0, pitch(sing, home), 8]], soft: true, breathe: true },
          { lh: [0, 4, 7, 9, 11, 14, null, null].map(offset => (offset == null ? null : pitch(tonic, offset))), rh: [], soft: true, final: true },
          { lh: [null, null, null, null, null, null, null, null], rh: [] }
        ],
        section(verse, true, false, true)
      )
    };
  }
  // `level` iguala el volumen de los doce meses (medido renderizando cada pieza sin tiempo real el 2026-11-11).
  // Paisaje de cada mes: capas de ruido pardo filtrado (viento, lluvia, mar, brasas) y, según la estación,
  // pájaros o grillos sintetizados. Los números son niveles; 0 o ausente = sin esa capa.
  const PIECES = [
    compose({
      // Enero: escarcha. La menor, mano izquierda quieta y notas largas.
      title: 'Urtarrila', level: 1.27, tonic: 33, sing: 69, scale: 'menor', figure: 'quieta', swing: 0.03,
      accent: [1, 0, 0.7, 0, 0.8, 0, 0.66, 0.5], nature: { wind: 0.125, cold: true, whistle: 0.05 },
      A: [
        [0, '0 4 3, 4 2 2, 6 1 2'], [5, '0 0 4, 5 2 3'], [2, '0 2 2, 2 4 2, 4 6 4'], [6, '0 8 3, 3 6 1, 4 3 4'],
        [0, '0 4 3, 4 2 2, 6 4 2'], [5, '0 5 2, 2 7 4, 6 5 2'], [3, '0 3 3, 3 5 1, 4 7 2, 6 5 2'], [4, '0 4 4, 5 1 1, 6 -1 2']
      ],
      B: [
        [5, '1 7 1, 2 9 2, 4 7 2, 6 5 2'], [6, '0 8 3, 3 6 1, 4 8 4'], [0, '0 9 4, 4 7 2, 6 4 2'], [2, '0 6 4, 4 4 4'],
        [5, '1 7 1, 2 9 2, 4 7 2, 6 9 2'], [6, '0 8 3, 3 6 1, 4 3 4'], [3, '0 5 2, 2 7 2, 4 5 2, 6 3 2'], [4, '0 4 6, 6 1 2']
      ]
    }),
    compose({
      // Febrero: carnaval bajo la lluvia. Re dórico, bajo en tresillo (3+3+2).
      title: 'Otsaila', level: 0.98, tonic: 38, sing: 62, scale: 'dorica', figure: 'tresillo', swing: 0.04,
      accent: [1, 0.5, 0.62, 0.95, 0.5, 0.62, 0.9, 0.55], nature: { rain: 0.135, wind: 0.05 },
      A: [
        [0, '0 7 3, 3 9 3, 6 11 2'], [3, '0 10 3, 3 8 1, 4 7 2, 6 5 2'], [0, '0 4 3, 3 7 3, 6 9 2'], [3, '0 10 2, 2 9 1, 3 7 3, 6 5 2'],
        [6, '0 6 3, 3 8 3, 6 10 2'], [3, '0 12 3, 3 10 1, 4 9 1, 5 8 1, 6 7 2'], [0, '0 9 3, 3 7 1, 4 4 2, 6 7 2'], [4, '0 8 4, 5 6 1, 6 4 2']
      ],
      B: [
        [3, '1 7 1, 2 8 1, 3 10 3, 6 12 2'], [0, '0 11 3, 3 9 1, 4 7 4'], [3, '1 5 1, 2 7 1, 3 10 3, 6 8 2'], [0, '0 9 4, 4 7 2, 6 4 2'],
        [6, '0 6 2, 2 8 2, 4 10 2, 6 13 2'], [3, '0 12 3, 3 10 1, 4 7 4'], [1, '0 8 2, 2 10 2, 4 12 2, 6 10 2'], [4, '0 11 6, 6 8 2']
      ]
    }),
    compose({
      // Marzo: viento del sur. Sol mixolidio, ráfagas de corcheas que suben.
      title: 'Martxoa', level: 0.98, tonic: 43, sing: 67, scale: 'mixolidia', figure: 'rafaga', swing: 0.06,
      nature: { wind: 0.11, whistle: 0.035, birds: 3 },
      A: [
        [0, '0 0 1, 1 1 1, 2 2 1, 3 4 1, 4 7 4'], [6, '0 6 2, 2 8 1, 3 10 1, 4 8 2, 6 6 2'], [3, '0 3 1, 1 4 1, 2 5 1, 3 7 1, 4 10 2, 6 7 2'], [0, '0 9 3, 3 7 1, 4 4 4'],
        [0, '0 0 1, 1 1 1, 2 2 1, 3 4 1, 4 7 2, 6 9 2'], [6, '0 10 2, 2 8 1, 3 6 1, 4 8 4'], [3, '0 7 2, 2 5 2, 4 3 2, 6 5 2'], [4, '0 4 4, 5 1 1, 6 4 2']
      ],
      B: [
        [3, '1 5 1, 2 7 1, 3 10 3, 6 9 2'], [0, '0 9 2, 2 7 2, 5 4 1, 6 7 2'], [6, '0 8 3, 3 6 1, 4 3 2, 6 6 2'], [3, '0 5 4, 4 7 2, 6 5 2'],
        [3, '1 5 1, 2 7 1, 3 10 3, 6 9 2'], [0, '0 9 3, 3 7 1, 4 4 4'], [6, '0 6 1, 1 8 1, 2 10 2, 4 8 2, 6 6 2'], [4, '0 8 6, 6 4 2']
      ]
    }),
    // Abril: la pieza original, en Do mayor (escrita en Fa y transportada).
    { title: 'Apirila', level: 1.02, transpose: -5, swing: 0.08, nature: { rain: 0.1, birds: 5 }, bars: arrange(INTRO, A, voice(B), OUTRO, voice(A)) },
    compose({
      // Mayo: todo florece. Fa lidio, olas de arpegio y saltos de sexta.
      title: 'Maiatza', level: 0.97, tonic: 41, sing: 65, scale: 'lidia', figure: 'ola', swing: 0.08,
      nature: { wind: 0.05, birds: 9 },
      A: [
        [0, '0 2 2, 2 7 3, 5 4 1, 6 9 2'], [1, '0 8 3, 3 5 1, 4 10 2, 6 8 2'], [0, '0 9 2, 2 4 2, 4 7 3, 7 4 1'], [5, '0 5 3, 3 7 1, 4 9 4'],
        [0, '0 2 2, 2 7 3, 5 9 1, 6 11 2'], [1, '0 10 2, 2 8 2, 4 5 2, 6 8 2'], [2, '0 9 3, 3 6 1, 4 4 2, 6 6 2'], [4, '0 4 4, 5 6 1, 6 8 2']
      ],
      B: [
        [5, '1 5 1, 2 7 1, 3 9 3, 6 7 2'], [1, '0 8 2, 2 10 2, 4 8 2, 6 5 2'], [0, '0 7 3, 3 9 1, 4 11 4'], [4, '0 11 2, 2 8 2, 4 6 4'],
        [5, '1 5 1, 2 7 1, 3 9 2, 5 7 1, 6 9 2'], [1, '0 10 3, 3 8 1, 4 5 4'], [2, '0 6 2, 2 9 2, 4 6 2, 6 4 2'], [4, '0 8 6, 6 4 2']
      ]
    }),
    compose({
      // Junio: hogueras de San Juan. Re mayor, danza de notas repetidas.
      title: 'Ekaina', level: 0.95, tonic: 38, sing: 62, scale: 'mayor', figure: 'danza', swing: 0.1,
      nature: { embers: 0.05, birds: 4 },
      A: [
        [0, '0 7 1, 1 7 1, 2 9 2, 4 11 2, 6 9 2'], [4, '0 8 1, 1 8 1, 2 11 2, 4 8 2, 6 6 2'], [5, '0 7 1, 1 7 1, 2 9 2, 4 12 2, 6 9 2'], [3, '0 10 3, 3 9 1, 4 7 4'],
        [0, '0 7 1, 1 7 1, 2 9 2, 4 11 2, 6 9 2'], [4, '0 8 1, 1 8 1, 2 11 2, 4 12 1, 5 11 1, 6 8 2'], [3, '0 10 2, 2 12 2, 4 10 2, 6 7 2'], [4, '0 8 4, 5 6 1, 6 4 2']
      ],
      B: [
        [3, '1 7 1, 2 10 2, 4 12 2, 6 10 2'], [0, '0 11 3, 3 9 1, 4 7 4'], [3, '1 7 1, 2 10 2, 4 12 2, 6 10 2'], [4, '0 11 2, 2 8 2, 4 6 2, 6 8 2'],
        [5, '0 9 3, 3 7 1, 4 5 2, 6 7 2'], [3, '0 10 3, 3 12 1, 4 10 4'], [1, '0 8 2, 2 10 2, 4 12 2, 6 10 2'], [4, '0 11 6, 6 8 2']
      ]
    }),
    compose({
      // Julio: siesta junto al mar. Mi mayor, barcarola perezosa que entra a contratiempo.
      title: 'Uztaila', level: 0.95, tonic: 40, sing: 64, scale: 'mayor', figure: 'barca', swing: 0.15,
      nature: { sea: 0.063, crickets: 0.004 },
      A: [
        [0, '1 4 2, 3 7 3, 6 9 2'], [3, '1 7 2, 3 5 3, 6 7 2'], [0, '1 9 2, 3 11 3, 6 9 2'], [3, '0 7 4, 5 5 1, 6 7 2'],
        [5, '1 5 2, 3 7 3, 6 9 2'], [3, '0 10 3, 3 9 1, 4 7 4'], [0, '1 4 2, 3 7 2, 5 9 1, 6 11 2'], [4, '0 8 5, 6 4 2']
      ],
      B: [
        [3, '1 7 1, 2 10 3, 5 9 1, 6 7 2'], [0, '0 9 4, 5 7 1, 6 4 2'], [3, '1 7 1, 2 10 3, 5 9 1, 6 10 2'], [0, '0 11 4, 4 9 4'],
        [1, '0 8 3, 3 10 1, 4 8 2, 6 5 2'], [3, '0 7 3, 3 5 1, 4 7 4'], [0, '1 4 2, 3 7 2, 5 9 1, 6 11 2'], [4, '0 11 6, 6 8 2']
      ]
    }),
    compose({
      // Agosto: Aste Nagusia. Si bemol mayor, fanfarria que brinca.
      title: 'Abuztua', level: 0.96, tonic: 34, sing: 70, scale: 'mayor', figure: 'brinco', swing: 0.12,
      nature: { sea: 0.05, wind: 0.04 },
      A: [
        [0, '0 0 1, 1 0 1, 2 2 1, 3 4 1, 4 7 2, 6 4 2'], [0, '0 2 2, 2 4 1, 3 2 1, 4 0 4'], [3, '0 3 1, 1 3 1, 2 5 1, 3 7 1, 4 7 2, 6 5 2'], [0, '0 4 3, 3 2 1, 4 0 4'],
        [4, '0 4 1, 1 4 1, 2 6 1, 3 8 1, 4 6 2, 6 4 2'], [3, '0 5 2, 2 7 2, 4 5 2, 6 3 2'], [0, '0 0 1, 1 2 1, 2 4 1, 3 7 1, 4 4 2, 6 2 2'], [4, '0 1 4, 5 -1 1, 6 -3 2']
      ],
      B: [
        [3, '1 5 1, 2 7 2, 4 5 2, 6 3 2'], [0, '0 4 2, 2 7 2, 4 4 4'], [4, '0 8 2, 2 6 2, 4 4 2, 6 6 2'], [0, '0 7 4, 4 4 2, 6 2 2'],
        [3, '1 5 1, 2 7 2, 4 8 1, 5 7 1, 6 5 2'], [0, '0 4 3, 3 2 1, 4 0 4'], [1, '0 1 2, 2 3 2, 4 5 2, 6 3 2'], [4, '0 4 6, 6 1 2']
      ]
    }),
    compose({
      // Septiembre: la vuelta. Fa mayor que empieza en su relativo menor, terceras que caen.
      title: 'Iraila', level: 1.01, tonic: 41, sing: 65, scale: 'mayor', figure: 'saltarina', swing: 0.08,
      nature: { wind: 0.07, sea: 0.025, leaves: 0.2 },
      A: [
        [5, '0 9 3, 3 7 1, 4 5 2, 6 7 2'], [3, '0 10 3, 3 8 1, 4 7 2, 6 5 2'], [0, '0 9 2, 2 7 2, 4 4 3, 7 7 1'], [4, '0 8 3, 3 6 1, 4 4 4'],
        [5, '0 9 3, 3 7 1, 4 5 2, 6 9 2'], [3, '0 10 2, 2 7 2, 4 5 2, 6 7 2'], [1, '0 8 3, 3 5 1, 4 3 2, 6 5 2'], [4, '0 4 4, 5 6 1, 6 8 2']
      ],
      B: [
        [3, '1 5 1, 2 7 1, 3 10 3, 6 7 2'], [0, '0 9 4, 4 7 2, 6 4 2'], [3, '1 5 1, 2 7 1, 3 10 2, 5 9 1, 6 7 2'], [4, '0 8 3, 3 6 1, 4 8 4'],
        [5, '0 9 2, 2 7 2, 4 5 2, 6 2 2'], [2, '0 4 3, 3 6 1, 4 9 4'], [3, '0 10 2, 2 7 2, 4 5 2, 6 3 2'], [4, '0 8 6, 6 4 2']
      ]
    }),
    compose({
      // Octubre: caen las hojas. Si menor, líneas que bajan por grados.
      title: 'Urria', level: 0.94, tonic: 35, sing: 71, scale: 'menor', figure: 'lluvia', swing: 0.06,
      nature: { rain: 0.11, wind: 0.08, leaves: 0.16 },
      A: [
        [0, '0 7 2, 2 6 1, 3 5 1, 4 4 4'], [6, '0 6 2, 2 5 1, 3 4 1, 4 3 4'], [5, '0 5 2, 2 4 1, 3 3 1, 4 2 4'], [4, '0 4 3, 3 1 1, 4 -1 4'],
        [0, '0 7 2, 2 6 1, 3 4 1, 4 2 2, 6 4 2'], [2, '0 6 3, 3 4 1, 4 2 2, 6 4 2'], [5, '0 5 2, 2 7 2, 4 5 2, 6 2 2'], [4, '0 1 4, 5 -1 1, 6 -3 2']
      ],
      B: [
        [5, '1 2 1, 2 5 2, 4 7 2, 6 5 2'], [6, '0 6 3, 3 3 1, 4 1 4'], [0, '0 2 2, 2 4 2, 4 7 4'], [0, '0 4 4, 4 2 2, 6 0 2'],
        [5, '1 2 1, 2 5 2, 4 7 1, 5 5 1, 6 2 2'], [6, '0 3 2, 2 6 2, 4 3 4'], [3, '0 5 2, 2 3 2, 4 0 2, 6 3 2'], [4, '0 4 6, 6 1 2']
      ]
    }),
    compose({
      // Noviembre: niebla y sirimiri. Sol menor, vaivén lento y notas vecinas.
      title: 'Azaroa', level: 1.21, tonic: 43, sing: 67, scale: 'menor', figure: 'niebla', swing: 0.05,
      accent: [1, 0, 0.72, 0.5, 0.85, 0, 0.7, 0.5], nature: { drizzle: 0.115, wind: 0.045 },
      A: [
        [0, '0 4 3, 3 5 1, 4 4 2, 6 2 2'], [3, '0 3 3, 3 4 1, 4 5 4'], [0, '0 4 3, 3 5 1, 4 4 2, 6 7 2'], [4, '0 6 3, 3 5 1, 4 4 4'],
        [5, '0 7 3, 3 5 1, 4 2 2, 6 5 2'], [2, '0 6 3, 3 4 1, 4 2 4'], [3, '0 5 2, 2 7 2, 4 5 2, 6 3 2'], [4, '0 4 4, 5 1 1, 6 4 2']
      ],
      B: [
        [5, '1 5 1, 2 7 2, 4 9 2, 6 7 2'], [6, '0 8 3, 3 6 1, 4 10 4'], [0, '0 9 3, 3 7 1, 4 4 4'], [0, '0 4 2, 2 2 2, 4 0 4'],
        [5, '1 5 1, 2 7 2, 4 9 2, 6 7 2'], [6, '0 8 2, 2 10 2, 4 8 2, 6 6 2'], [3, '0 7 3, 3 5 1, 4 3 2, 6 5 2'], [4, '0 4 6, 6 1 2']
      ]
    }),
    compose({
      // Diciembre: nana junto al fuego. Mi bemol mayor, campanas en terceras.
      title: 'Abendua', level: 1.0, tonic: 39, sing: 63, scale: 'mayor', figure: 'campana', swing: 0.04,
      nature: { embers: 0.05, wind: 0.04, cold: true, whistle: 0.02 },
      A: [
        [0, '0 11 2, 2 9 2, 4 11 2, 6 9 2'], [3, '0 12 2, 2 10 2, 4 7 4'], [0, '0 11 2, 2 9 2, 4 7 2, 6 9 2'], [4, '0 8 3, 3 6 1, 4 4 4'],
        [5, '0 9 2, 2 7 2, 4 5 2, 6 7 2'], [3, '0 10 3, 3 12 1, 4 10 4'], [1, '0 8 2, 2 10 2, 4 8 2, 6 5 2'], [4, '0 4 4, 5 6 1, 6 8 2']
      ],
      B: [
        [3, '1 7 1, 2 10 2, 4 12 2, 6 10 2'], [0, '0 11 4, 4 9 2, 6 7 2'], [3, '1 7 1, 2 10 2, 4 12 1, 5 10 1, 6 7 2'], [0, '0 9 4, 4 4 4'],
        [5, '0 5 2, 2 7 2, 4 9 2, 6 7 2'], [2, '0 6 3, 3 9 1, 4 11 4'], [3, '0 10 2, 2 7 2, 4 5 2, 6 3 2'], [4, '0 8 6, 6 4 2']
      ]
    })
  ];
  // La segunda voz no roza el acorde: si su tercera queda a medio tono de una nota de la izquierda, baja a la
  // nota del acorde más cercana (hasta una cuarta por debajo de la melodía) o calla.
  PIECES.forEach(entry => entry.bars.forEach(bar => {
    if (!bar.second) return;
    const chord = new Set(bar.lh.slice(0, 7).filter(note => note != null).map(note => note % 12));
    const rubs = note => { const pc = note % 12; return !chord.has(pc) && [...chord].some(tone => (pc - tone + 12) % 12 === 1 || (tone - pc + 12) % 12 === 1); };
    bar.second = bar.second.map((under, i) => {
      if (under == null || !rubs(under)) return under;
      const top = bar.rh[i][1];
      for (let note = top - 3; note >= top - 5; note--) if (chord.has(note % 12)) return note;
      return null;
    });
  }));
  const TITLES = Object.freeze(PIECES.map(entry => entry.title));
  const INTRO_BARS = INTRO.length;

  // ── Estado ───────────────────────────────────────────────────────────────
  let ctx = null, bus = null, master = null, analyser = null, wow = null, wave = null, noise = null;
  let timer = null, playing = false, silent = false, resumeOnVisible = false;
  let barIndex = 0, eighth = 0, nextTime = 0, passes = 0, rubatoPhase = 0;
  // Suena la pieza del mes en curso, según el reloj del visitante.
  let piece = PIECES[new Date().getMonth()] || PIECES[3];
  // En reposo suena sin mano derecha (intensidad < 0.35): arpegio, delays y trombones.
  // `intensity` es la que suena; `rest`, a la que vuelve; `presence`, a la que la lleva el scroll.
  let volume = 0.8, intensity = REST, rest = REST, presence = REST, wakeStamp = -Infinity;
  // Espacio: fuentes que rodean al oyente y giran con el scroll; paisaje del mes.
  let orbit = [], orbitAt = 0, turn = 0, turnGoal = 0, seats = [];
  // Envío a la sala (para la resonancia por simpatía) y si la mano derecha está cantando ahora mismo.
  let roomSend = null, singing = false;
  let natureOut = null, natureSides = [], natureParts = [], natureSwell = -1, nextBird = 0;
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
    const bar = piece.bars[barIndex] || piece.bars[0];
    return { playing, silent, volume, intensity, tempo: Math.round(BPM * pace * 10) / 10, title: piece.title, month: PIECES.indexOf(piece), section: bar.section, bar: barIndex + 1, bars: piece.bars.length, pass: passes + 1 };
  }

  // ── Cadena de audio ──────────────────────────────────────────────────────
  function build() {
    ctx = new AC({ latencyHint: 'playback' });
    // Timbre de fieltro: fundamental dominante y armónicos que se apagan pronto.
    const partials = [0, 1, 0.48, 0.2, 0.1, 0.05, 0.025, 0.012, 0.006];
    wave = ctx.createPeriodicWave(new Float32Array(partials.length), Float32Array.from(partials));

    bus = ctx.createGain();
    bus.gain.value = BUS * (piece.level || 1);
    // El piano queda delante y sin colorear, visto desde la banqueta: los graves a la izquierda y los
    // agudos a la derecha, en cinco posiciones según el registro de cada nota.
    seats = [-0.4, -0.2, 0, 0.2, 0.4].map(pan => {
      if (typeof ctx.createStereoPanner !== 'function') return bus;
      const chair = ctx.createStereoPanner(); chair.pan.value = pan;
      chair.connect(bus); return chair;
    });
    // Fuente que rodea al oyente, al estilo Portal: HRTF en 3D si el navegador lo ofrece, estéreo simple si no.
    // `drift` es su giro propio (rad/s) y `pull` cuánto la arrastra el scroll.
    orbit = [];
    const surround = (source, target, degrees, height, drift, pull) => {
      const angle = degrees * Math.PI / 180;
      if (typeof ctx.createPanner !== 'function') {
        if (typeof ctx.createStereoPanner !== 'function') { source.connect(target); return; }
        const flat = ctx.createStereoPanner(); flat.pan.value = clamp(Math.sin(angle), -1, 1);
        source.connect(flat); flat.connect(target); return;
      }
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.rolloffFactor = 0;
      source.connect(panner); panner.connect(target);
      const body = { panner, angle, height, drift, pull };
      orbit.push(body); steer(body, ctx.currentTime, 0);
    };

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
    body.type = 'lowshelf'; body.frequency.value = 220; body.gain.value = 2.5;
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

    // Caja del piano: dos resonancias de madera que dan cuerpo sin abrir los agudos.
    const board = [[185, 1.3, 1.2], [430, 1.8, 1.6]].map(([frequency, q, gain]) => {
      const plank = ctx.createBiquadFilter();
      plank.type = 'peaking'; plank.frequency.value = frequency; plank.Q.value = q; plank.gain.value = gain;
      return plank;
    });
    bus.connect(tape); tape.connect(silk); silk.connect(body); body.connect(board[0]); board[0].connect(board[1]); board[1].connect(rumble);
    rumble.connect(glue);
    // A la sala no llegan los graves: el bajo se queda seco y la reverberación no emborrona.
    const roomTone = ctx.createBiquadFilter();
    roomTone.type = 'highpass'; roomTone.frequency.value = 150; roomTone.Q.value = 0.5;
    roomSend = send;
    rumble.connect(send); send.connect(roomTone); roomTone.connect(room); room.connect(wet); wet.connect(glue);
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
    // Los ecos cruzados tampoco repiten los graves.
    const loopLow = ctx.createBiquadFilter();
    loopLow.type = 'highpass'; loopLow.frequency.value = 180; loopLow.Q.value = 0.5;
    rumble.connect(pingSend); pingSend.connect(loopTone); loopTone.connect(loopLow); loopLow.connect(ping);
    ping.connect(pingBack); pingBack.connect(pong);
    pong.connect(pongBack); pongBack.connect(loopTone);
    // Cada repetición ocupa un punto alrededor del oyente y deriva despacio.
    surround(ping, glue, -55, 0.1, 0.035, 0.6); surround(pong, glue, 55, 0.1, -0.03, 0.6);
    ping.connect(send); pong.connect(send);
    // Las repeticiones cabecean de tono, cada lado a su ritmo.
    [[ping, 0.17, 0.004], [pong, 0.13, 0.005]].forEach(([line, hz, amount]) => {
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = hz; depth.gain.value = amount;
      lfo.connect(depth); depth.connect(line.delayTime); lfo.start();
    });
    // Dos ecos más, cada uno con su bucle: uno en tresillo de negra, cercano y algo más claro, que rellena
    // los huecos entre corcheas; y uno lejano, a blanca con puntillo, muy oscuro, que devuelve la frase al fondo de la sala.
    // El tresillo queda detrás a la derecha; el lejano, detrás a la izquierda y algo más alto.
    [[EIGHTH * 4 / 3, 0.15, 0.3, 1700, 125, 0.21, 0.003, 0.25], [EIGHTH * 6, 0.2, 0.42, 900, -145, 0.09, 0.005, 0.6]]
      .forEach(([seconds, level, feedback, cutoff, degrees, hz, amount, toRoom]) => {
        const line = ctx.createDelay(2), lineSend = ctx.createGain(), lineBack = ctx.createGain();
        const lineTone = ctx.createBiquadFilter(), lineRoom = ctx.createGain();
        line.delayTime.value = seconds;
        lineSend.gain.value = level; lineBack.gain.value = feedback; lineRoom.gain.value = toRoom;
        echoSends.push([lineSend, level]);
        lineTone.type = 'lowpass'; lineTone.frequency.value = cutoff; lineTone.Q.value = 0.4;
        rumble.connect(lineSend); lineSend.connect(lineTone); lineTone.connect(line);
        line.connect(lineBack); lineBack.connect(lineTone);
        surround(line, glue, degrees, degrees > 0 ? 0.15 : 0.3, degrees > 0 ? 0.04 : -0.045, 0.6);
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

    // Paisaje del mes, al estilo Portal: dos focos opuestos que rodean al oyente y giran despacio.
    natureOut = ctx.createGain(); natureOut.gain.value = 0; natureSwell = -1;
    const natureRoom = ctx.createGain(); natureRoom.gain.value = 0.3;
    natureOut.connect(master); natureOut.connect(natureRoom); natureRoom.connect(send);
    natureSides = [[-105, 0.25], [80, -0.1]].map(([degrees, height]) => {
      const side = ctx.createGain();
      surround(side, natureOut, degrees, height, 0.017, 0.35);
      return side;
    });
    plant();

    // Tras el compresor, un poco de ganancia y un techo que solo actúa en los picos.
    const lift = ctx.createGain(); lift.gain.value = 1.3;
    const ceiling = ctx.createDynamicsCompressor();
    ceiling.threshold.value = -4; ceiling.knee.value = 2; ceiling.ratio.value = 16;
    ceiling.attack.value = 0.003; ceiling.release.value = 0.12;
    glue.connect(lift); lift.connect(ceiling); ceiling.connect(master);
    master.connect(analyser); analyser.connect(ctx.destination);

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

  // ── Espacio ──────────────────────────────────────────────────────────────
  function steer(body, when, glide) {
    const x = Math.sin(body.angle), z = -Math.cos(body.angle), panner = body.panner;
    if (panner.positionX) {
      [[panner.positionX, x], [panner.positionY, body.height], [panner.positionZ, z]].forEach(([param, value]) => {
        if (glide) param.setTargetAtTime(value, when, glide); else param.setValueAtTime(value, when);
      });
    } else if (typeof panner.setPosition === 'function') panner.setPosition(x, body.height, z);
  }
  // Las fuentes derivan solas muy despacio; el scroll las hace girar hacia donde va el visitante.
  function turnSpace() {
    const now = ctx.currentTime, dt = clamp(now - orbitAt, 0, 0.25);
    orbitAt = now;
    if (silent || now - paceStamp > PACE_HOLD) turnGoal = 0;
    turn += (turnGoal - turn) * Math.min(1, dt / 0.45);
    orbit.forEach(body => { body.angle += (body.drift + turn * body.pull) * dt; steer(body, now, 0.12); });
    // El paisaje se abre un poco con el movimiento y calla del todo en el silencio contemplativo.
    const swell = silent ? 0 : NATURE * (1 + 0.45 * Math.abs(turn));
    if (natureOut && Math.abs(swell - natureSwell) > 0.01) {
      natureSwell = swell;
      natureOut.gain.setTargetAtTime(swell, now, silent ? 0.25 : 0.6);
    }
  }

  // ── Paisaje ──────────────────────────────────────────────────────────────
  // Todo sale del mismo ruido pardo filtrado (nunca ruido blanco) y de senos: nada se descarga.
  function uproot() {
    natureParts.forEach(part => { try { if (part.stop) part.stop(); part.disconnect(); } catch {} });
    natureParts = [];
  }
  function plant() {
    if (!ctx || !noise) return;
    uproot();
    const recipe = piece.nature || {}, now = ctx.currentTime;
    const keep = (...nodes) => { natureParts.push(...nodes); return nodes[0]; };
    const filter = (type, frequency, q) => {
      const node = ctx.createBiquadFilter();
      node.type = type; node.frequency.value = frequency; node.Q.value = q;
      return keep(node);
    };
    const lfo = (hz, amount, param) => {
      const osc = ctx.createOscillator(), depth = ctx.createGain();
      osc.frequency.value = hz; depth.gain.value = amount;
      osc.connect(depth); depth.connect(param); osc.start(now);
      keep(osc, depth);
    };
    // Cada capa suena dos veces, decorrelacionada, una en cada foco.
    const layer = shape => natureSides.forEach((side, i) => {
      const src = ctx.createBufferSource(), level = ctx.createGain();
      src.buffer = noise; src.loop = true;
      shape(src, level, i).connect(level); level.connect(side);
      src.start(now, (i * 0.83 + natureParts.length * 0.071) % 1.9);
      keep(src, level);
    });
    // Viento: una banda que sube y baja con las rachas. En los meses fríos silba más agudo.
    if (recipe.wind) layer((src, level, i) => {
      const centre = (recipe.cold ? 760 : 520) * (i ? 1.12 : 1);
      const band = filter('bandpass', centre, recipe.cold ? 1.6 : 1.1);
      level.gain.value = recipe.wind * 0.62;
      lfo(0.071 + i * 0.023, recipe.wind * 0.38, level.gain);
      lfo(0.043 + i * 0.017, centre * 0.3, band.frequency);
      src.connect(band); return band;
    });
    // Silbo del viento: una banda estrecha que sube y baja de tono y aparece solo en las rachas.
    if (recipe.whistle) layer((src, level, i) => {
      const reed = filter('bandpass', i ? 1280 : 980, 11);
      level.gain.value = recipe.whistle * 0.4;
      lfo(0.071 + i * 0.023, recipe.whistle * 0.6, level.gain);
      lfo(0.19 + i * 0.07, i ? 260 : 210, reed.frequency);
      src.connect(reed); return reed;
    });
    // Lluvia: la parte alta del ruido pardo. El sirimiri es más fino y más tenue.
    const rain = recipe.rain || recipe.drizzle;
    if (rain) layer((src, level, i) => {
      const high = filter('highpass', (recipe.drizzle ? 2200 : 1400) * (i ? 1.08 : 1), -3);
      const top = filter('lowpass', recipe.drizzle ? 6000 : 5200, -3);
      level.gain.value = rain * 0.88;
      lfo(0.11 + i * 0.037, rain * 0.12, level.gain);
      src.connect(high); high.connect(top); return top;
    });
    // Mar: olas lentas que abren el filtro al romper, cada lado a su compás.
    if (recipe.sea) layer((src, level, i) => {
      const body = filter('lowpass', 520, -3), period = i ? 12.3 : 9.5;
      level.gain.value = recipe.sea * 0.55;
      lfo(1 / period, recipe.sea * 0.45, level.gain);
      lfo(1 / period, 330, body.frequency);
      src.connect(body); return body;
    });
    // Espuma: el siseo agudo de la ola al romper, un poco después de la cresta.
    if (recipe.sea) natureSides.forEach((side, i) => {
      const src = ctx.createBufferSource(), level = ctx.createGain(), period = i ? 12.3 : 9.5;
      const high = filter('highpass', 1700, -3), top = filter('lowpass', 4800, -3);
      const swell = ctx.createOscillator(), depth = ctx.createGain();
      src.buffer = noise; src.loop = true;
      level.gain.value = recipe.sea * 1.1;
      swell.frequency.value = 1 / period; depth.gain.value = recipe.sea * 1.1;
      swell.connect(depth); depth.connect(level.gain);
      src.connect(high); high.connect(top); top.connect(level); level.connect(side);
      src.start(now, 0.4 + i * 0.57); swell.start(now + period * 0.2);
      keep(src, level, swell, depth);
    });
    // Brasas: un rumor grave; los chasquidos se reparten aparte.
    if (recipe.embers) layer((src, level) => {
      const glow = filter('lowpass', 140, -3);
      level.gain.value = recipe.embers;
      src.connect(glow); return glow;
    });
    // Grillos: un seno agudo troceado en pulsos y en frases.
    if (recipe.crickets) natureSides.forEach((side, i) => {
      const song = ctx.createOscillator(), chop = ctx.createOscillator(), chopDepth = ctx.createGain();
      const pulse = ctx.createGain(), phrase = ctx.createGain(), level = ctx.createGain();
      song.frequency.value = i ? 4650 : 4200;
      chop.type = 'square'; chop.frequency.value = i ? 31 : 27;
      pulse.gain.value = 0.5; chopDepth.gain.value = 0.5; phrase.gain.value = 0.5; level.gain.value = recipe.crickets;
      chop.connect(chopDepth); chopDepth.connect(pulse.gain);
      lfo(i ? 0.61 : 0.83, 0.5, phrase.gain);
      song.connect(pulse); pulse.connect(phrase); phrase.connect(level); level.connect(side);
      song.start(now); chop.start(now);
      keep(song, chop, chopDepth, pulse, phrase, level);
    });
    nextBird = now + rand(2, 6);
  }
  // Un grano: una ráfaga muy corta de ruido pardo en una banda, en uno de los dos focos.
  function grain(when, length, frequency, q, level) {
    const src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), amp = ctx.createGain();
    src.buffer = noise;
    band.type = 'bandpass'; band.frequency.value = frequency; band.Q.value = q;
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(level, when + Math.min(0.004, length * 0.3));
    amp.gain.exponentialRampToValueAtTime(0.0001, when + length);
    src.connect(band); band.connect(amp); amp.connect(natureSides[Math.random() < 0.5 ? 0 : 1]);
    src.start(when, rand(0, 1.8)); src.stop(when + length + 0.02);
    src.onended = () => { try { amp.disconnect(); } catch {} };
  }
  // Lo que no es continuo: chasquidos de brasa, gotas, hojas y frases de pájaro, repartidos entre los dos focos.
  function sprinkle() {
    const recipe = piece.nature;
    if (!recipe || !natureSides.length) return;
    const now = ctx.currentTime;
    if (recipe.embers && Math.random() < 0.16) {
      grain(now + rand(0.02, 0.08), rand(0.012, 0.05), rand(1500, 3400), 2, recipe.embers * rand(1.5, 6));
    }
    // De tarde en tarde un leño se asienta: un golpe grave y sordo.
    if (recipe.embers && Math.random() < 0.012) {
      const log = ctx.createOscillator(), amp = ctx.createGain(), when = now + 0.03;
      log.frequency.setValueAtTime(rand(85, 120), when);
      log.frequency.exponentialRampToValueAtTime(48, when + 0.09);
      amp.gain.setValueAtTime(0, when);
      amp.gain.linearRampToValueAtTime(recipe.embers * 0.5, when + 0.006);
      amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
      log.connect(amp); amp.connect(natureSides[Math.random() < 0.5 ? 0 : 1]);
      log.start(when); log.stop(when + 0.16);
      log.onended = () => { try { amp.disconnect(); } catch {} };
    }
    // Gotas: sobre el fondo de lluvia, golpecitos sueltos con su propio tono, más espaciados en el sirimiri.
    const rain = recipe.rain || recipe.drizzle;
    if (rain) for (let drop = 0; drop < 3; drop++) {
      if (Math.random() > (recipe.drizzle ? 0.16 : 0.3)) continue;
      grain(now + rand(0.01, 0.07), rand(0.006, 0.02), rand(1900, 5200), rand(6, 11), rain * rand(3, 11));
    }
    // Hojas: ráfagas secas y cortas, como una rama que se sacude.
    if (recipe.leaves && Math.random() < 0.035) {
      let when = now + 0.03;
      for (let i = 0, count = 3 + Math.floor(rand(0, 6)); i < count; i++) {
        const length = rand(0.03, 0.09);
        grain(when, length, rand(2400, 4300), 1.4, recipe.leaves * rand(0.5, 1.6));
        when += length * rand(0.5, 1.1);
      }
    }
    if (recipe.birds && now >= nextBird) {
      // De dos a cinco silbos que barren hacia arriba o hacia abajo.
      const side = natureSides[Math.random() < 0.5 ? 0 : 1], base = rand(2500, 3900), rising = Math.random() < 0.6;
      let when = now + 0.05;
      for (let i = 0, count = 2 + Math.floor(rand(0, 4)); i < count; i++) {
        const osc = ctx.createOscillator(), amp = ctx.createGain(), length = rand(0.06, 0.13);
        const from = base * rand(0.94, 1.06), to = from * (rising ? rand(1.12, 1.3) : rand(0.78, 0.9));
        osc.frequency.setValueAtTime(from, when);
        osc.frequency.exponentialRampToValueAtTime(to, when + length);
        amp.gain.setValueAtTime(0, when);
        amp.gain.linearRampToValueAtTime(rand(0.006, 0.012), when + length * 0.3);
        amp.gain.exponentialRampToValueAtTime(0.0001, when + length);
        osc.connect(amp); amp.connect(side);
        osc.start(when); osc.stop(when + length + 0.02);
        osc.onended = () => { try { amp.disconnect(); } catch {} };
        when += length + rand(0.04, 0.11);
      }
      nextBird = now + rand(30, 90) / recipe.birds;
    }
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
    const sounding = midi + piece.transpose;
    const freq = 440 * Math.pow(2, (sounding - 69) / 12);
    const vel = clamp(velocity, 0.05, 1);
    // Cada nota suena desde su sitio en el teclado: Do2 a la izquierda, Do6 a la derecha.
    const seat = seats[clamp(Math.round((sounding - 36) / 12), 0, 4)] || bus;
    const out = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.Q.value = 0.4;
    // El macillo: tocar fuerte abre mucho más el timbre y ataca antes; tocar suave lo deja redondo.
    const bright = Math.min(3200, freq * (2.1 + 5.6 * vel) + 380);
    const dark = Math.min(1500, freq * 1.5 + 120);
    const attack = 0.024 - 0.012 * vel;
    tone.frequency.setValueAtTime(bright, when);
    tone.frequency.setTargetAtTime(dark, when + 0.02, 0.24);

    const peak = vel * 0.22;
    const tail = sustain * clamp(2.6 - Math.log2(freq / 55) * 0.42, 0.7, 2.8);
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(peak, when + attack);
    out.gain.setTargetAtTime(peak * 0.46, when + attack, 0.13);
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
    tone.connect(out); out.connect(seat);

    // Un armónico de ataque algo más alto de lo que tocaría: la cuerda real es rígida y sus parciales
    // se estiran. Dura medio segundo y da el brillo metálico del principio de la nota.
    if (vel > 0.25 && freq < 1100) {
      const ring = ctx.createOscillator(), ringGain = ctx.createGain();
      ring.frequency.value = freq * 3 * (1 + 0.0011 * Math.pow(freq / 261.6, 0.7));
      ringGain.gain.setValueAtTime(0, when);
      ringGain.gain.linearRampToValueAtTime(peak * 0.14 * vel, when + 0.005);
      ringGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.5);
      ring.connect(ringGain); ringGain.connect(seat);
      ring.start(when); ring.stop(when + 0.52);
      ring.onended = () => { try { ringGain.disconnect(); } catch {} };
    }

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

  // Resonancia por simpatía: con el pedal pisado, las cuerdas libres del acorde vibran solas. Dos senos
  // muy tenues que crecen despacio y van solo a la sala: un halo, no una nota.
  function halo(bar, when, seconds, level) {
    const notes = bar.lh.filter(note => note != null);
    if (notes.length < 2 || !roomSend) return;
    [notes[0] + 12, Math.max(...notes)].forEach((midi, i) => {
      const osc = ctx.createOscillator(), amp = ctx.createGain();
      osc.frequency.value = 440 * Math.pow(2, (midi + piece.transpose - 69) / 12);
      osc.detune.value = rand(-4, 4);
      amp.gain.setValueAtTime(0, when);
      amp.gain.linearRampToValueAtTime(level * (i ? 0.7 : 1), when + seconds * 0.45);
      amp.gain.linearRampToValueAtTime(0, when + seconds + 0.7);
      osc.connect(amp); amp.connect(roomSend);
      osc.start(when); osc.stop(when + seconds + 0.75);
      osc.onended = () => { try { amp.disconnect(); } catch {} };
    });
  }

  // ── Trombones ────────────────────────────────────────────────────────────
  // Diente de sierra filtrado que se abre con el soplo, vibrato tardío y vara que desliza.
  let lastBrass = null;
  function brass(notes, when, seconds, level) {
    const previous = lastBrass;
    lastBrass = notes;
    notes.forEach((midi, i) => {
      const start = when + rand(0, 0.045) + i * 0.012;
      const freq = 440 * Math.pow(2, (midi + piece.transpose - 69) / 12);
      const from = previous ? 440 * Math.pow(2, (previous[i] + piece.transpose - 69) / 12) : freq * 0.944;
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
    const bar = piece.bars[barIndex];
    // Balanceo ligero: las corcheas a contratiempo llegan un pelo tarde.
    if (eighth % 2 === 1 && !bar.final) when += EIGHTH / pace * piece.swing * clamp(1 - 1.6 * (pace - 1), 0.65, 1.2);
    if (eighth === 0 && bar.thin) {
      // Cada pasada del eco calla notas distintas.
      thinMask = new Set(bar.rh.map((_, i) => i).filter(i => i > 0 && Math.random() < 0.3));
    }
    // Con el pulso cambia la mano: al apretar toca con más decisión y más seco; al serenarse, más suave y ligado.
    const hush = (bar.soft ? 0.72 : 1) * clamp(1 + 0.8 * (pace - 1), 0.88, 1.17);
    const pedal = 1 / pace;
    // En las vueltas impares el eco invierte el dibujo de la izquierda; el bajo y la nota que camina siguen en su sitio.
    const left = bar.lh[bar.thin && passes % 2 === 1 && eighth > 0 && eighth < 7 ? 7 - eighth : eighth];
    // Fraseo: la izquierda crece hacia el centro de la frase de ocho compases y se apaga al respirar.
    const phrase = (0.92 + 0.1 * Math.sin((bar.pos + eighth / 8) / 8 * Math.PI)) * (bar.breathe && eighth >= 4 ? 1 - 0.05 * (eighth - 3) : 1);
    // La melodía no entra en cualquier corchea: espera a un tiempo fuerte o a la primera nota del compás.
    // Y al retirarse termina el compás que estaba diciendo.
    const awake = intensity >= MELODY_GATE;
    if (awake && !singing && (eighth === 0 || eighth === 4 || (bar.rh[0] && bar.rh[0][0] === eighth))) singing = true;
    else if (!awake && singing && eighth === 0) singing = false;
    // Cambio de pedal al empezar el compás: un golpe sordo de madera y fieltro.
    if (eighth === 0 && left != null && Math.random() < 0.65) brush(when - 0.03, rand(0.03, 0.06), 190, 0.16);
    if (eighth === 0) {
      if (bar.brass) brass(bar.brass, when, EIGHTH * 8 / pace, 0.55 + 0.45 * (bar.pos / 7));
      else lastBrass = null;
      if (!bar.final) halo(bar, when, EIGHTH * 8 / pace, 0.011 * hush);
    }
    const dropped = eighth % 2 === 1 && !bar.final && Math.random() < 0.03;
    if (left != null && !dropped) {
      const roll = bar.final ? eighth * rand(0.03, 0.045) : 0;
      // Cuando la derecha canta, la izquierda cede un poco para dejarla oír.
      const [at, vel] = human(when + roll, 0.4 * (piece.accent || LH_ACCENT)[eighth] * hush * phrase * (singing ? 0.86 : 1) * rand(0.86, 1.1));
      strike(left, at, vel, bar.final ? 1.5 : 0.5 * pedal);
    }
    if (singing) {
      bar.rh.forEach(([at, midi, length], i) => {
        if (at !== eighth) return;
        if (bar.thin && thinMask.has(i)) return;
        // La melodía entra un instante después del bajo, como una mano que se abre.
        const lag = 0.012 + rand(0, 0.03);
        const arc = 0.68 + 0.14 * Math.sin(bar.pos / 8 * Math.PI) + (at === 0 ? 0.05 : 0);
        const [hit, vel] = human(when + lag, arc * hush * rand(0.9, 1.07) * (0.6 + 0.4 * intensity) * clamp((intensity - 0.33) / 0.3, 0.3, 1));
        // De vez en cuando un dedo roza la tecla vecina antes de caer en la buena.
        if (Math.random() < 0.035) strike(midi + (Math.random() < 0.5 ? -2 : 2), hit - rand(0.03, 0.05), vel * 0.2, 0.35);
        strike(midi, hit, vel, clamp(0.8 + length * 0.12, 0.9, 1.7) * Math.sqrt(pedal));
        // Con el scroll rápido la mano se abre: la segunda voz suena un instante después y más suave.
        const under = bar.second && bar.second[i];
        if (under != null && intensity >= 0.75) strike(under, hit + rand(0.008, 0.02), vel * 0.5, clamp(0.8 + length * 0.12, 0.9, 1.7) * Math.sqrt(pedal));
        if (bar.bloom && length >= 4 && Math.random() < 0.55) {
          strike(midi - 12, hit + EIGHTH / pace * 0.5, vel * 0.45, 1.3);
        }
      });
    }
  }

  // El pulso se acerca a su meta corchea a corchea, como un intérprete que aprieta o afloja el paso:
  // nunca salta, y solo decide la distancia a la nota siguiente, sin tocar las ya programadas.
  function breathePace() {
    // La mano derecha despierta deprisa con el gesto y se retira despacio, apagándose.
    if (silent || ctx.currentTime - wakeStamp > WAKE_HOLD) presence = rest;
    intensity = Math.abs(presence - intensity) < 0.03 ? presence : intensity + clamp(presence - intensity, -0.03, 0.12);
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
    const bar = piece.bars[barIndex];
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
    if (barIndex >= piece.bars.length) { barIndex = INTRO_BARS; passes += 1; }
    emit();
  }

  function tick() {
    if (!playing || !ctx) return;
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      if (!silent) scheduleEighth(nextTime);
      advance();
    }
    turnSpace();
    if (!silent) sprinkle();
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
    intensity = presence = rest; singing = false;
    turn = turnGoal = 0; orbitAt = ctx.currentTime;
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
    get title() { return piece.title; },
    // Mes de la pieza que suena (0 = enero … 11 = diciembre) y los doce títulos.
    get month() { return PIECES.indexOf(piece); },
    titles: TITLES,
    // Partitura de un mes en solo lectura (copia), con las notas ya transportadas a como suenan.
    sheet(index) {
      const chosen = PIECES[((Math.round(Number(index)) % 12) + 12) % 12];
      const t = chosen.transpose;
      return chosen.bars.map(bar => ({ section: bar.section, lh: bar.lh.map(n => (n == null ? null : n + t)), rh: bar.rh.map(([at, midi, length]) => [at, midi + t, length]), brass: bar.brass ? bar.brass.map(n => n + t) : null, second: bar.second ? bar.second.map(n => (n == null ? null : n + t)) : null }));
    },
    bpm: BPM,
    start,
    stop() { resumeOnVisible = false; stop(); },
    toggle() { if (playing) { resumeOnVisible = false; stop(); return Promise.resolve(false); } return start(); },
    rewind,
    // Salta al primer compás de una sección ('A', 'B', 'Cierre'…).
    seek(section) {
      const index = piece.bars.findIndex(bar => bar.section === section);
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
    setIntensity(value) { intensity = rest = presence = clamp(Number(value) || 0, 0, 1); emit(); },
    // El visitante se mueve: la mano derecha despierta hasta `level` y, sin noticias, vuelve sola al reposo.
    wake(level) {
      if (!playing || !ctx || silent) return;
      presence = clamp(Number(level) || 0, rest, 1);
      wakeStamp = ctx.currentTime;
    },
    // Giro del espacio con el scroll: de -1 (hacia atrás) a 1 (hacia delante).
    setTurn(value) {
      if (!playing || !ctx) return;
      turnGoal = silent ? 0 : clamp(Number(value) || 0, -1, 1);
      paceStamp = ctx.currentTime;
    },
    // Cambia de pieza (0 = enero … 11 = diciembre) y la empieza desde la entrada.
    setMonth(index) {
      const next = PIECES[((Math.round(Number(index)) % 12) + 12) % 12];
      if (!next || next === piece) return piece.title;
      piece = next; rewind(); lastBrass = null; singing = false;
      if (ctx) {
        plant();
        bus.gain.setTargetAtTime(BUS * (piece.level || 1), ctx.currentTime, 0.2);
        if (playing) nextTime = ctx.currentTime + 0.12;
      }
      emit();
      return piece.title;
    },
    // Silencio contemplativo (p. ej. «Game Over»): el pulso sigue, las notas callan.
    setSilent(value) { silent = !!value; if (silent) singing = false; emit(); },
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

/* Naroa — conexión con la web: el botón SONIDO enciende y apaga la pieza del mes. Sin tarjeta. */
(() => {
  'use strict';
  const score = window.NAROA_SCORE || null;
  const button = document.querySelector('[data-sound]');
  if (!button) return;
  const status = document.querySelector('[data-sound-status]');
  const RESUME_KEY = 'naroa-score-on';
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const TITLES = ['Urtarrila', 'Otsaila', 'Martxoa', 'Apirila', 'Maiatza', 'Ekaina', 'Uztaila', 'Abuztua', 'Iraila', 'Urria', 'Azaroa', 'Abendua'];
  // Sin motor (navegador sin Web Audio) el título sigue siendo el del mes.
  const month = () => (score ? score.month : new Date().getMonth());
  const title = () => (score ? score.title : TITLES[month()]);
  const monthName = () => MONTHS[month()];
  let busy = false, quiet = false;
  let energy = 0, calm = 0, heading = 1, feltAt = 0, seenAt = 0, seenDistance = 0;
  // Para escuchar otra pieza sin esperar al mes: `?mes=1` … `?mes=12`. No hay selector en la web.
  try {
    const pick = Number(new URLSearchParams(location.search).get('mes'));
    if (score && pick >= 1 && pick <= 12) score.setMonth(pick - 1);
  } catch {}
  button.title = `Banda sonora: «${title()}»`;

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
    button.setAttribute('aria-label', on ? 'Sonido: parar la banda sonora' : 'Sonido: escuchar la banda sonora');
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
  // Velocidad real del scroll: la distancia recorrida entre dos avisos, medida con el reloj. Así no depende
  // de los fotogramas por segundo del dispositivo; `velocity` solo vale si falta la distancia o el reloj no corre.
  function speedOf(state) {
    if (typeof state.distance !== 'number') return state.velocity;
    const now = performance.now(), gap = now - seenAt, travelled = state.distance - seenDistance;
    seenAt = now; seenDistance = state.distance;
    if (!(gap > 0)) return state.velocity;
    // El primer aviso tras una pausa solo fija el punto de partida.
    return gap > 250 ? 0 : travelled / (gap / 1000);
  }
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
    // El espacio gira hacia donde va el scroll, y la melodía despierta en cuanto hay movimiento.
    if (speed > 0.02) heading = Math.sign(velocity);
    score.setTurn(heading * ease(energy / 3));
    if (energy > 0.06) score.wake(0.6 + 0.4 * ease(energy / 2.5));
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
      if (state && typeof state.velocity === 'number' && state.mode !== 'still') feel(quiet ? 0 : speedOf(state));
    },
    gameOver() {},
    getActiveMelodyInfo() { return { day: monthName(), name: title() }; },
    // Audio para la Story en vídeo; sin motor disponible devuelve una toma muda.
    async createStoryLoopStream(seconds = 6) {
      const take = score
        ? await score.capture(seconds)
        : { stream: null, notesScheduled: Math.max(1, Math.floor(seconds / 0.3125)), stop() {} };
      return { stream: take.stream, melodyName: title(), melodyDay: monthName(), notesScheduled: take.notesScheduled, stop: take.stop };
    }
  });
})();
