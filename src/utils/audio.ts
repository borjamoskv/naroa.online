// Sound FX Engine powered by Web Audio API (Zero external assets required)
// Calibrated for warm, organic, acoustic resonance (wood, mineral, brass, analog tape)

// Cadencia final inmutable: notas icónicas de SOUND OF SILENCE en Re menor microtonal
// D5 (sound), [silencio], A4 (of), C5 (si-), F5 (-lence), E5 (resolución), [silencio], D5 (tónica final)
export const SOUND_OF_SILENCE_CADENCE: (number | null)[] = [
  74.00, null, 69.02, 71.69, 77.16, 76.04, null, 74.00
]

// Serie Armónica Microtonal Pura en Re (Entonación Justa Extendida: Pitagórica + Septimal 7/4 + Undecimal 11/8):
// 69.02: A4 (3/4 quinta justa grave, +1.95c)
// 70.84: B4 (5/6 sexta mayor justa de Huygens, -15.64c)
// 71.69: C5 (7/8 séptima armónica natural / alboka, -31.17c)
// 74.00: D5 (1/1 tónica fundamental, 587.33 Hz)
// 75.82: E5b (10/9 tono menor justo, -17.6c)
// 76.04: E5 (9/8 tono mayor justo, +3.91c)
// 76.67: F5sub (7/6 tercera sub-menor septimal, -33.1c)
// 77.16: F5 (6/5 tercera menor justa pura, +15.64c)
// 78.51: G5+ (11/8 oncena espectral acústica, +51.3c)
// 78.98: G5 (4/3 cuarta justa pura, -1.95c)
// 81.02: A5 (3/2 quinta justa pura, +1.95c)
// 82.84: B5 (5/3 sexta dórica justa, -15.64c)
// 83.69: C6 (7/4 séptima menor armónica, -31.17c)
// 86.00: D6 (2/1 octava pura)
const MODAL_PITCHES = [
  69.02, 70.84, 71.69, 74.00, 75.82, 76.04, 76.67, 77.16, 78.51, 78.98, 81.02, 82.84, 83.69, 86.00
]

// Células motívicas polirrítmicas y asincopadas (acentos 3+3+2, Zortziko 5/8 y hemiola 3:2)
const MOTIF_CELLS_A: (number | null)[][] = [
  [74.00, null, 77.16, 81.02],
  [74.00, 69.02, null, 77.16],
  [74.00, 76.04, 77.16, null],
  [74.00, null, 70.84, 74.00],
  [69.02, 74.00, null, 76.67],
  [74.00, 78.51, null, 77.16],
  [74.00, null, 81.02, 77.16],
  [71.69, 74.00, 76.04, null]
]

const MOTIF_CELLS_B: (number | null)[][] = [
  [78.98, null, 81.02, 86.00],
  [81.02, 78.51, null, 76.67],
  [77.16, null, 82.84, 81.02],
  [78.51, 77.16, 75.82, null],
  [81.02, null, 83.69, 78.98],
  [74.00, 78.98, null, 81.02],
  [82.84, null, 81.02, 77.16],
  [76.67, 78.51, null, 81.02]
]

const MOTIF_CELLS_C: (number | null)[][] = [
  [76.04, null, 71.69, 69.02],
  [70.84, 75.82, null, 78.98],
  [77.16, 75.82, 74.00, null],
  [69.02, null, 71.69, 75.82],
  [76.67, 75.82, null, 74.00],
  [77.16, null, 75.82, 70.84],
  [74.00, 71.69, 69.02, null],
  [75.82, null, 69.02, 71.69]
]

/**
 * Generador procedural infinito de melodías microtonales y polirrítmicas para la caja de música.
 * Cada refresco de página produce una secuencia virgen e irrepetible en entonación justa,
 * con síncopas de Zortziko (5/8) y hemiolas (3:2), auditada contra un buffer FIFO en localStorage.
 */
export function generateInfiniteSessionMelody(): (number | null)[] {
  const HISTORY_KEY = 'naroa_musicbox_fingerprint_history'
  let history: string[] = []
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(HISTORY_KEY)
      if (raw) history = JSON.parse(raw)
    }
  } catch {}

  const getRandomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

  // Mutación orgánica asincopada sobre cada célula
  const mutateCell = (cell: (number | null)[], allowVariation = true): (number | null)[] => {
    const copy = [...cell]
    if (!allowVariation || Math.random() > 0.55) return copy
    const mutateIdx = 1 + Math.floor(Math.random() * (copy.length - 1))
    const current = copy[mutateIdx]
    if (current === null) {
      copy[mutateIdx] = getRandomChoice(MODAL_PITCHES)
    } else if (Math.random() < 0.28) {
      // Desplazamiento sincopado del silencio si los vecinos tienen nota
      if (copy[mutateIdx - 1] !== null) {
        copy[mutateIdx] = null
      }
    } else {
      const pIdx = MODAL_PITCHES.indexOf(current)
      if (pIdx >= 0) {
        const delta = Math.random() < 0.5 ? -1 : 1
        const nextPIdx = Math.max(0, Math.min(MODAL_PITCHES.length - 1, pIdx + delta))
        copy[mutateIdx] = MODAL_PITCHES[nextPIdx]
      }
    }
    return copy
  }

  for (let attempt = 0; attempt < 25; attempt++) {
    const phraseA = [...mutateCell(getRandomChoice(MOTIF_CELLS_A)), ...mutateCell(getRandomChoice(MOTIF_CELLS_A), false)]
    const phraseB = [...mutateCell(getRandomChoice(MOTIF_CELLS_B)), ...mutateCell(getRandomChoice(MOTIF_CELLS_B))]
    const phraseC = [...mutateCell(getRandomChoice(MOTIF_CELLS_C)), ...mutateCell(getRandomChoice(MOTIF_CELLS_C))]

    // Ensamblaje: 24 pasos polirrítmicos + 8 pasos de la cadencia Sound of Silence = 32 pasos
    const candidate = [
      ...phraseA,
      ...phraseB,
      ...phraseC,
      ...SOUND_OF_SILENCE_CADENCE
    ]

    const fingerprint = candidate.map(n => (n === null ? 'S' : n.toFixed(2))).join('-')
    if (!history.includes(fingerprint) || attempt === 24) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          history.push(fingerprint)
          if (history.length > 200) history.shift()
          window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
        }
      } catch {}
      return candidate
    }
  }

  return [...MOTIF_CELLS_A[0], ...MOTIF_CELLS_A[1], ...MOTIF_CELLS_B[0], ...MOTIF_CELLS_B[1], ...MOTIF_CELLS_C[0], ...MOTIF_CELLS_C[1], ...SOUND_OF_SILENCE_CADENCE]
}

export interface WeekdayTheme {
  day: 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo'
  name: string
  subtitle: string
  notes: (number | null)[]
}

// 7 TEMAS CANÓNICOS DE LA SEMANA (ENTONACIÓN JUSTA MICROTONAL & FRASEO ASINCOPADO)
export const WEEKDAY_THEMES: WeekdayTheme[] = [
  // 0. Lunes (Astelehena)
  {
    day: 'Lunes',
    name: 'Txoria Txori',
    subtitle: 'Mikel Laboa · Bronce septimal, libertad y memoria',
    notes: [
      74.00, null, 77.16, 76.04, null, 74.00, 71.69, 74.00,
      null, 69.02, 71.69, null, 74.00, 76.67, 77.16, 75.82,
      74.00, null, 81.02, 78.51, null, 76.67, 71.69, null,
      ...SOUND_OF_SILENCE_CADENCE
    ]
  },
  // 1. Martes (Asteartea)
  {
    day: 'Martes',
    name: 'Haurtxo Polita',
    subtitle: 'Nana tradicional en Zortziko · Juguete de cuerda',
    notes: [
      69.02, null, 74.00, 76.04, 77.16, null, 75.82, 74.00,
      77.16, null, 78.98, 81.02, null, 78.51, 77.16, 75.82,
      null, 74.00, 70.84, 69.02, null, 71.69, 75.82, null,
      ...SOUND_OF_SILENCE_CADENCE
    ]
  },
  // 2. Miércoles (Asteazkena)
  {
    day: 'Miércoles',
    name: 'Harria eta Marea',
    subtitle: 'Polirritmia 3:2 Sakamoto · Piedra y marea',
    notes: [
      74.00, 69.02, null, 77.16, 74.00, null, 78.51, 75.82,
      70.84, null, 74.00, 76.04, null, 69.02, 71.69, 74.00,
      77.16, null, 81.02, 86.00, null, 82.84, 77.16, null,
      ...SOUND_OF_SILENCE_CADENCE
    ]
  },
  // 3. Jueves (Osteguna)
  {
    day: 'Jueves',
    name: 'Landa / Alboka clásica',
    subtitle: 'Séptima de Arratia (7/4) · Tierra, cuerno y roble',
    notes: [
      74.00, 76.67, null, 81.02, 77.16, null, 74.00, 69.02,
      71.69, null, 75.82, 78.51, 75.82, null, 71.69, 69.02,
      74.00, null, 77.16, 82.84, null, 81.02, 76.67, null,
      ...SOUND_OF_SILENCE_CADENCE
    ]
  },
  // 4. Viernes (Ostirala)
  {
    day: 'Viernes',
    name: 'Mi Gran Noche',
    subtitle: 'Raphael en celesta asincopada · Qué misterio habrá',
    notes: [
      69.02, 74.00, null, 77.16, 76.04, null, 69.02, 74.00,
      77.16, 76.04, null, 74.00, 76.04, null, 78.98, 77.16,
      74.00, null, 77.16, 81.02, null, 78.51, 76.04, null,
      ...SOUND_OF_SILENCE_CADENCE
    ]
  },
  // 5. Sábado (Larunbata)
  {
    day: 'Sábado',
    name: 'Gaua / Nocturno de Bilbao',
    subtitle: 'Chiaroscuro espectral, penumbra de ría y silencio',
    notes: [
      74.00, null, 71.69, 69.02, null, 74.00, 76.67, 74.00,
      69.02, 74.00, null, 78.51, 81.02, null, 76.67, 74.00,
      81.02, null, 83.69, 81.02, null, 75.82, 70.84, null,
      ...SOUND_OF_SILENCE_CADENCE
    ]
  },
  // 6. Domingo (Igandea)
  {
    day: 'Domingo',
    name: 'Haizea / Viento en los pinos',
    subtitle: 'Cascada undecimal (11/8) · Retorno al origen',
    notes: [
      74.00, 77.16, null, 81.02, 86.00, null, 82.84, 77.16,
      78.51, null, 75.82, 74.00, 69.02, null, 71.69, 74.00,
      76.67, null, 81.02, 78.51, null, 75.82, 69.02, null,
      ...SOUND_OF_SILENCE_CADENCE
    ]
  }
]

export function getTodayWeekdayTheme(): WeekdayTheme {
  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7 // Monday = 0 .. Sunday = 6
  return WEEKDAY_THEMES[dayOfWeek] || WEEKDAY_THEMES[0]
}

// Repertorio modal histórico preservado como referencia
export const SESSION_MELODIES: (number | null)[][] = WEEKDAY_THEMES.map(t => t.notes)

class SoundEngine {
  private ctx: AudioContext | null = null
  private enabled: boolean = true

  private bgMusic: HTMLAudioElement | null = null

  // Master Warmth Acoustic Bus
  private warmBus: GainNode | null = null
  private warmShelf: BiquadFilterNode | null = null
  private warmLowpass: BiquadFilterNode | null = null
  private masterCompressor: DynamicsCompressorNode | null = null

  private lastSlideSoundTime = 0
  private lastHapticClickTime = 0
  private noiseBuffer: AudioBuffer | null = null

  private sessionMelodyIndex: number = 0
  private currentMelody: (number | null)[] = []
  private sessionStep: number = -1

  constructor() {
    this.sessionMelodyIndex = this.pickSessionMelodyIndex()
    // En cada carga / refresco de página: generación de melodía procedural virgen y jamás repetida
    this.currentMelody = generateInfiniteSessionMelody()

    // Lazy init audio context on first user interaction
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('naroa_audio_enabled')
      if (saved !== null) {
        this.enabled = saved === 'true'
      }

      // Resume AudioContext and ambient music on initial user gesture
      const handleUserInteraction = () => {
        this.initCtx()
        if (this.enabled) {
          this.playMusic()
        }
        window.removeEventListener('pointerdown', handleUserInteraction)
        window.removeEventListener('keydown', handleUserInteraction)
      }
      window.addEventListener('pointerdown', handleUserInteraction, { once: true })
      window.addEventListener('keydown', handleUserInteraction, { once: true })
    }
  }

  private pickSessionMelodyIndex(): number {
    const key = 'naroa_session_melody_idx'
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const stored = window.sessionStorage.getItem(key)
        if (stored !== null) {
          const idx = parseInt(stored, 10)
          if (!isNaN(idx) && idx >= 0 && idx < SESSION_MELODIES.length) {
            return idx
          }
        }
        let lastIdx = -1
        try {
          const lastStr = window.localStorage.getItem('naroa_last_session_melody')
          if (lastStr !== null) lastIdx = parseInt(lastStr, 10)
        } catch {}
        let nextIdx = Math.floor(Math.random() * SESSION_MELODIES.length)
        if (lastIdx >= 0 && SESSION_MELODIES.length > 1) {
          nextIdx = (lastIdx + 1 + Math.floor(Math.random() * (SESSION_MELODIES.length - 1))) % SESSION_MELODIES.length
        }
        window.sessionStorage.setItem(key, String(nextIdx))
        try { window.localStorage.setItem('naroa_last_session_melody', String(nextIdx)) } catch {}
        return nextIdx
      }
    } catch {}
    return 0
  }

  public getSessionMelodyIndex(): number {
    return this.sessionMelodyIndex
  }

  public getSessionMelody(): (number | null)[] {
    if (this.currentMelody && this.currentMelody.length > 0) {
      return this.currentMelody
    }
    return SESSION_MELODIES[this.sessionMelodyIndex] || SESSION_MELODIES[0]
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume()
      }
      this.setupWarmthBus()
    }
  }

  /**
   * Sets up an analog-modeled acoustic warmth stage:
   * 1. Low-shelf warmth boost at 280 Hz (+2.2 dB) for organic wood/mineral body.
   * 2. Gentle Butterworth low-pass rolloff at 4400 Hz to eliminate cold, piercing digital fizz.
   * 3. Soft analog glue compressor to gently round transients without harsh clipping.
   */
  private setupWarmthBus() {
    if (!this.ctx || this.warmBus) return
    try {
      this.warmBus = this.ctx.createGain()
      this.warmBus.gain.value = 1.0

      // Low-shelf warming boost around 280 Hz: adds physical body to UI interactions
      this.warmShelf = this.ctx.createBiquadFilter()
      this.warmShelf.type = 'lowshelf'
      this.warmShelf.frequency.value = 280
      this.warmShelf.gain.value = 2.2

      // Gentle high-frequency acoustic rolloff (analog tape / natural wood acoustic space)
      this.warmLowpass = this.ctx.createBiquadFilter()
      this.warmLowpass.type = 'lowpass'
      this.warmLowpass.frequency.value = 4400
      this.warmLowpass.Q.value = 0.707

      // Warm analog glue compressor / soft limiter
      this.masterCompressor = this.ctx.createDynamicsCompressor()
      this.masterCompressor.threshold.value = -6.0
      this.masterCompressor.knee.value = 8.0
      this.masterCompressor.ratio.value = 3.0
      this.masterCompressor.attack.value = 0.005
      this.masterCompressor.release.value = 0.08

      this.warmBus.connect(this.warmShelf)
      this.warmShelf.connect(this.warmLowpass)
      this.warmLowpass.connect(this.masterCompressor)
      this.masterCompressor.connect(this.ctx.destination)
    } catch {
      // Fallback: warmBus null will route straight to ctx.destination
    }
  }

  private getOut(): AudioNode {
    return this.warmBus || this.ctx!.destination
  }

  /**
   * Síntesis modal de alta relojería (celesta Schiedmayer / peine suizo Reuge en bronce envejecido):
   * - Doble lengüeta simpática binaural (±1.6 cents) con batimiento orgánico lento.
   * - Resonador mineral sub-octava (0.5x f0) con entrada aterciopelada (24 ms).
   * - Parciales Euler-Fokker en entonación justa con barrido de filtro de seda (2400 Hz -> 740 Hz).
   * - Espacialización estéreo sutil y soporte de retardo polirrítmico asincopado.
   */
  public playMusicBoxNote(
    midiNote: number = 74.00,
    volume: number = 0.5,
    delaySec: number = 0,
    pan: number = 0,
    detuneCents: number = 0
  ) {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime + 0.003 + Math.max(0, delaySec)
      const out = this.getOut()
      const rootHz = 440 * Math.pow(2, (midiNote + detuneCents / 100 - 69) / 12)

      const masterTineGain = this.ctx.createGain()
      masterTineGain.gain.setValueAtTime(volume * 0.34, now)

      // Posicionamiento espacial estéreo de galería
      if (typeof this.ctx.createStereoPanner === 'function') {
        const panner = this.ctx.createStereoPanner()
        panner.pan.setValueAtTime(Math.max(-0.65, Math.min(0.65, pan)), now)
        masterTineGain.connect(panner)
        panner.connect(out)
      } else {
        masterTineGain.connect(out)
      }

      // Filtro acústico dinámico: abre en el ataque del fieltro y decanta hacia madera cálida
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      const openCutoff = Math.min(2500, rootHz * 3.4)
      const warmCutoff = Math.max(480, Math.min(920, rootHz * 1.35))
      filter.frequency.setValueAtTime(openCutoff, now)
      filter.frequency.exponentialRampToValueAtTime(warmCutoff, now + 0.65)
      filter.Q.setValueAtTime(0.85, now)
      filter.connect(masterTineGain)

      // Parciales espectrales Euler-Fokker + doble fundamental binaural + sub-octava simpática
      const partials = [
        { ratio: 0.5, detune: 0, level: 0.16, attack: 0.026, decay: 1.45 },       // Cuerpo mineral sub-octava
        { ratio: 1.0, detune: -1.6, level: 0.52, attack: 0.008, decay: 1.25 },    // Lengüeta principal L
        { ratio: 1.0, detune: 1.6, level: 0.44, attack: 0.011, decay: 1.28 },     // Lengüeta simpática R (batimiento cálido)
        { ratio: 1.9985, detune: 0, level: 0.21, attack: 0.005, decay: 0.62 },    // 2º armónico dulce
        { ratio: 2.997, detune: 1.95, level: 0.095, attack: 0.004, decay: 0.38 }, // Duodécima justa pura (3/1)
        { ratio: 4.006, detune: 0, level: 0.042, attack: 0.003, decay: 0.21 },    // Destello de celesta
        { ratio: 5.38, detune: -14, level: 0.018, attack: 0.002, decay: 0.11 }    // Transitorio de latón
      ]

      partials.forEach(({ ratio, detune, level, attack, decay }) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()

        osc.type = 'sine'
        const targetFreq = rootHz * ratio * Math.pow(2, detune / 1200)
        // Sutilísimo pitch-bloom físico de lengüeta al ser pulsada (+2.8 cents -> 0 en 16ms)
        osc.frequency.setValueAtTime(targetFreq * 1.0016, now)
        osc.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.016)

        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.linearRampToValueAtTime(level, now + attack)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay)

        osc.connect(gain)
        gain.connect(filter)

        osc.start(now)
        osc.stop(now + decay + 0.03)
      })
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Motor Polirrítmico Asincopado y Armónico Microtonal (Ciclo de 32 pasos).
   * - Pasos 0..23: Teje una constelación en Zortziko (5/8) + hemiola (3:2) donde la nota principal
   *   despierta una segunda voz armónica en entonación justa (5ª pura 3/2, 6ª dórica 5/3 o 7ª natural 7/4)
   *   con retardo asincopado áureo, más un destello espectral en contratiempo.
   * - Pasos 24..31: Cadencia sagrada inmutable de SOUND OF SILENCE arropada por un pedal armónico profundo.
   */
  public playSessionStep(stepIndex?: number) {
    if (!this.enabled) return
    const mel = this.getSessionMelody()
    if (typeof stepIndex === 'number') {
      this.sessionStep = ((stepIndex % mel.length) + mel.length) % mel.length
    } else {
      this.sessionStep = (this.sessionStep + 1) % mel.length
    }

    const step = this.sessionStep
    const isSilenceCadence = step >= mel.length - 8
    const note = mel[step]

    // Si el paso es silencio pero cae en contratiempo polirrítmico (fuera de Sound of Silence),
    // susurra un armónico fantasma asincopado muy tenue para mantener el pulso vivo en el aire
    if (note === null) {
      if (!isSilenceCadence && step % 5 === 1) {
        const ghostIntervals = [69.02, 71.69, 74.00, 78.51, 81.02]
        const ghostNote = ghostIntervals[step % ghostIntervals.length]
        this.playMusicBoxNote(ghostNote, 0.14, 0.065, -0.22, -3.5)
      }
      return
    }

    // Acentuación polirrítmica cruzada: Zortziko 5/8 (3+2) superpuesto a ciclo ternario (3:2)
    const zortzikoSub = step % 5
    const hemiolaSub = step % 3
    const accent = zortzikoSub === 0 ? 1.0 : zortzikoSub === 3 ? 0.92 : hemiolaSub === 0 ? 0.86 : 0.76
    const panMain = Math.sin(step * 1.15) * 0.24

    // 1. VOZ PRINCIPAL (Cantus en t0)
    this.playMusicBoxNote(note, 0.40 * accent, 0, panMain, 0)

    if (isSilenceCadence) {
      // En SOUND OF SILENCE: reverencia absoluta a la melodía, solo un cálido pedal armónico grave en la tónica y dominante
      if (step === mel.length - 8 || step === mel.length - 1) {
        this.playMusicBoxNote(62.00, 0.22, 0.025, 0, 0) // D4 pedal profundo
      } else if (step === mel.length - 6) {
        this.playMusicBoxNote(69.02, 0.18, 0.035, -0.15, 1.95) // A4 quinta pura
      }
      return
    }

    // 2. VOZ ARMÓNICA MICROTONAL EN SÍNCOPA (Off-beat polirrítmico 3:2 / 5:4)
    // Retardos asincopados en proporción áurea y subdivisión quinaria (95ms, 142ms, 188ms)
    const syncopatedDelays = [0.095, 0.142, 0.188, 0.118, 0.165]
    const delayHarmony = syncopatedDelays[step % syncopatedDelays.length]

    // Selección de intervalo microtonal justo según posición modal:
    // -4.98 (5ª justa inferior 2/3), -3.16 (6ª mayor justa inferior 5/6), -2.31 (7ª armónica 7/8), +3.16 (3ª menor justa 6/5)
    let harmonyNote = 69.02
    if (note >= 78.0) {
      harmonyNote = note - 4.9805 // Quinta justa pura hacia abajo
    } else if (note >= 75.0) {
      harmonyNote = zortzikoSub === 3 ? 70.84 : 69.02 // Sexta dórica de Huygens (B4) o Dominante (A4)
    } else {
      harmonyNote = hemiolaSub === 1 ? 77.16 : 71.69 // Tercera menor justa (F5) o Séptima de alboka (C5)
    }

    this.playMusicBoxNote(harmonyNote, 0.21 * accent, delayHarmony, -panMain * 1.2, -2.0)

    // 3. TERCERA VOZ CRISTALINA (Campanilla polirrítmica 3:2 en pasos sincopados)
    if (zortzikoSub === 2 || hemiolaSub === 2) {
      const shimmerIntervals = [81.02, 82.84, 83.69, 86.00, 78.51] // A5(3/2), B5(5/3), C6(7/4), D6(2/1), G5+(11/8)
      const shimmerNote = shimmerIntervals[(step * 2) % shimmerIntervals.length]
      const delayShimmer = delayHarmony + (zortzikoSub === 2 ? 0.088 : 0.126)
      this.playMusicBoxNote(shimmerNote, 0.135 * accent, delayShimmer, panMain * 0.85, 3.5)
    }
  }

  public playMusic() {
    if (!this.enabled || typeof window === 'undefined') return
    try {
      if (!this.bgMusic) {
        this.bgMusic = new Audio('/audio/boards-of-burgos.mp3')
        this.bgMusic.loop = true
        this.bgMusic.volume = 0.32
      }
      this.bgMusic.play().catch(() => {
        // Autoplay policy fallback
      })
    } catch {
      // Ignore audio error
    }
  }

  public pauseMusic() {
    if (this.bgMusic) {
      try {
        this.bgMusic.pause()
      } catch {
        // Ignore error
      }
    }
  }

  public toggleSound(): boolean {
    this.enabled = !this.enabled
    localStorage.setItem('naroa_audio_enabled', String(this.enabled))
    if (this.enabled) {
      this.playTick()
      this.playMusic()
    } else {
      this.pauseMusic()
    }
    return this.enabled
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  private getNoiseBuffer(): AudioBuffer | null {
    if (this.noiseBuffer || !this.ctx) return this.noiseBuffer
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.15) // 150ms noise
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
      this.noiseBuffer = buffer
      return buffer
    } catch {
      return null
    }
  }

  /**
   * Escape de relojería suiza de alta complicación (Patek / Leica M):
   * Doble micro-pulso asincopado en entonación justa de Re menor (3/2 y 7/4) filtrado en seda.
   */
  public playHapticClick(pitchMultiplier: number = 1.0) {
    if (!this.enabled) return
    const nowMs = performance.now()
    if (nowMs - this.lastHapticClickTime < 35) return
    this.lastHapticClickTime = nowMs

    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      // Fundamental cálida en Re4 justo (293.66 Hz) + armónico septimal 7/4 en contratiempo de 14ms
      const root = 293.66 * pitchMultiplier
      const voices = [
        { fStart: root * 1.5, fEnd: root * 0.5, delay: 0, dur: 0.032, gain: 0.048 },
        { fStart: root * 1.75, fEnd: root * 0.75, delay: 0.014, dur: 0.026, gain: 0.026 }
      ]

      voices.forEach(({ fStart, fEnd, delay, dur, gain: gVal }) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        const filter = this.ctx.createBiquadFilter()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(fStart, now + delay)
        osc.frequency.exponentialRampToValueAtTime(fEnd, now + delay + dur)

        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(980 * pitchMultiplier, now + delay)
        filter.Q.setValueAtTime(0.9, now + delay)

        gain.gain.setValueAtTime(0.0001, now + delay)
        gain.gain.linearRampToValueAtTime(gVal, now + delay + 0.003)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur)

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(out)

        osc.start(now + delay)
        osc.stop(now + delay + dur + 0.005)
      })
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Warm velvet / fine canvas sliding texture.
   */
  public playHapticSlide(velocity: number = 1.0) {
    if (!this.enabled) return
    const nowMs = performance.now()
    if (nowMs - this.lastSlideSoundTime < 65) return // Throttling 65ms
    this.lastSlideSoundTime = nowMs

    try {
      this.initCtx()
      if (!this.ctx) return
      const now = this.ctx.currentTime
      const buf = this.getNoiseBuffer()
      if (!buf) return
      const out = this.getOut()

      const source = this.ctx.createBufferSource()
      source.buffer = buf

      // Warm lowpass filter instead of thin bandpass
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(240 + Math.min(360, Math.abs(velocity) * 120), now)
      filter.Q.setValueAtTime(1.8, now)

      // Subtle sub-glide oscillator for silk/velvet contact sensation
      const glideOsc = this.ctx.createOscillator()
      const glideGain = this.ctx.createGain()
      glideOsc.type = 'sine'
      glideOsc.frequency.setValueAtTime(95 + Math.min(60, Math.abs(velocity) * 40), now)
      glideGain.gain.setValueAtTime(0.018, now)
      glideGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065)

      const gain = this.ctx.createGain()
      const vol = Math.min(0.038, 0.008 + Math.abs(velocity) * 0.016)
      gain.gain.setValueAtTime(vol, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065)

      source.connect(filter)
      filter.connect(gain)
      gain.connect(out)

      glideOsc.connect(glideGain)
      glideGain.connect(out)

      source.start(now)
      source.stop(now + 0.065)
      glideOsc.start(now)
      glideOsc.stop(now + 0.065)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Floración espectral microtonal en Re Dórico Justo (1/1, 3/2, 6/5, 7/4, 9/4, 11/4)
   * con arpegio asincopado en proporción áurea al abrir la lupa.
   */
  public playLoupeReveal() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      const d3 = 146.832
      // Intervalos puros sobre D3 con retardos asincopados no uniformes
      const spectralVoices = [
        { freq: d3 * 1.0, delay: 0.000, dur: 1.05, level: 0.036 },     // 1/1 D3
        { freq: d3 * 1.5, delay: 0.055, dur: 0.95, level: 0.028 },     // 3/2 A3 justa
        { freq: d3 * 2.4, delay: 0.135, dur: 0.85, level: 0.022 },     // 12/5 F4 menor justa
        { freq: d3 * 3.5, delay: 0.195, dur: 0.78, level: 0.018 },     // 7/2 C5 séptima armónica
        { freq: d3 * 4.5, delay: 0.285, dur: 0.72, level: 0.014 },     // 9/2 E5 novena pura
        { freq: d3 * 5.5, delay: 0.350, dur: 0.64, level: 0.010 }      // 11/2 G5+ oncena espectral
      ]

      spectralVoices.forEach(({ freq, delay, dur, level }) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        const filter = this.ctx.createBiquadFilter()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + delay)

        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(Math.min(1600, freq * 2.1), now + delay)
        filter.Q.setValueAtTime(1.1, now + delay)

        gain.gain.setValueAtTime(0.0001, now + delay)
        gain.gain.linearRampToValueAtTime(level, now + delay + 0.032)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur)

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(out)

        osc.start(now + delay)
        osc.stop(now + delay + dur + 0.03)
      })
    } catch {
      // Ignore audio errors
    }
  }

  public playTick() {
    if (!this.enabled) return
    this.playHapticClick(1.0)
  }

  /**
   * Susurro armónico microtonal en díada justa (5/6 -> 1/1) con eco asincopado.
   */
  public playHover() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      // D4 (293.66 Hz) y su sexta dórica justa B3 (244.72 Hz, 5/6) + séptima armónica C4 (256.95 Hz, 7/8)
      const osc = this.ctx.createOscillator()
      const osc2 = this.ctx.createOscillator()
      const filter = this.ctx.createBiquadFilter()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(244.72, now)
      osc.frequency.exponentialRampToValueAtTime(293.66, now + 0.085)

      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(513.91, now + 0.028) // C5 séptima natural 7/4 en síncopa
      osc2.frequency.exponentialRampToValueAtTime(587.33, now + 0.095)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(820, now)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.022, now + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11)

      const gain2 = this.ctx.createGain()
      gain2.gain.setValueAtTime(0.0001, now + 0.028)
      gain2.gain.linearRampToValueAtTime(0.011, now + 0.038)
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.11)

      osc.connect(filter)
      osc2.connect(gain2)
      gain2.connect(filter)
      filter.connect(gain)
      gain.connect(out)

      osc.start(now)
      osc.stop(now + 0.12)
      osc2.start(now + 0.028)
      osc2.stop(now + 0.12)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Apertura modal en Re menor septimal (1/1, 7/6, 3/2, 7/4) con entrada polirrítmica 3:2.
   */
  public playOpen() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      const d3 = 146.832
      // Acorde microtonal justo: D3 (1/1), A3 (3/2), F4 septimal (7/3), C5 armónica (7/2)
      const notes = [
        { f: d3 * 1.0, delay: 0.000, weight: 0.34 },
        { f: d3 * 1.5, delay: 0.038, weight: 0.24 },
        { f: d3 * (7 / 3), delay: 0.092, weight: 0.16 },
        { f: d3 * 3.5, delay: 0.138, weight: 0.11 }
      ]
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(860, now)
      filter.frequency.exponentialRampToValueAtTime(1450, now + 0.14)
      filter.frequency.exponentialRampToValueAtTime(540, now + 0.42)

      const masterGain = this.ctx.createGain()
      masterGain.gain.setValueAtTime(0.0001, now)
      masterGain.gain.linearRampToValueAtTime(0.052, now + 0.04)
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.44)

      filter.connect(masterGain)
      masterGain.connect(out)

      notes.forEach(({ f, delay, weight }) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const oscGain = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(f * 0.992, now + delay)
        osc.frequency.exponentialRampToValueAtTime(f, now + delay + 0.065)

        oscGain.gain.setValueAtTime(weight, now + delay)
        osc.connect(oscGain)
        oscGain.connect(filter)

        osc.start(now + delay)
        osc.stop(now + delay + 0.45)
      })
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Pliegue de terciopelo en cadencia plagal/septimal descendente (7/4 -> 3/2 -> 1/1).
   */
  public playClose() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      const osc = this.ctx.createOscillator()
      const subOsc = this.ctx.createOscillator()
      const filter = this.ctx.createBiquadFilter()
      const gain = this.ctx.createGain()

      // Caída justa: 256.95 Hz (C4 7/4) -> 220.25 Hz (A3 3/2) -> 146.83 Hz (D3 1/1)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(256.95, now)
      osc.frequency.exponentialRampToValueAtTime(220.25, now + 0.065)
      osc.frequency.exponentialRampToValueAtTime(146.83, now + 0.19)

      subOsc.type = 'sine'
      subOsc.frequency.setValueAtTime(110.12, now + 0.024)
      subOsc.frequency.exponentialRampToValueAtTime(73.416, now + 0.19)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(560, now)
      filter.frequency.exponentialRampToValueAtTime(220, now + 0.2)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.044, now + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.21)

      osc.connect(filter)
      subOsc.connect(filter)
      filter.connect(gain)
      gain.connect(out)

      osc.start(now)
      subOsc.start(now + 0.024)
      osc.stop(now + 0.22)
      subOsc.stop(now + 0.22)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Warm 3D Gaussian Splat spatial activation bloom.
   */
  public playSplatActivate() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      const osc1 = this.ctx.createOscillator()
      const osc2 = this.ctx.createOscillator()
      const filter = this.ctx.createBiquadFilter()
      const gain = this.ctx.createGain()

      // Warm harmonic swell: 220 Hz (A3) -> 440 Hz (A4)
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(220, now)
      osc1.frequency.exponentialRampToValueAtTime(440, now + 0.22)

      // C#4 (277.18) -> C#5 (554.37)
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(277.18, now)
      osc2.frequency.exponentialRampToValueAtTime(554.37, now + 0.22)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(750, now)
      filter.frequency.exponentialRampToValueAtTime(1100, now + 0.15)
      filter.frequency.exponentialRampToValueAtTime(450, now + 0.3)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.052, now + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32)

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(gain)
      gain.connect(out)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.32)
      osc2.stop(now + 0.32)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Warm ceramic lighting toggle.
   */
  public playSplatLightChange() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      const osc = this.ctx.createOscillator()
      const filter = this.ctx.createBiquadFilter()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(392, now) // G4 -> D4
      osc.frequency.exponentialRampToValueAtTime(293.66, now + 0.09)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(800, now)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.04, now + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(out)

      osc.start(now)
      osc.stop(now + 0.1)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Felted oak gallery footstep.
   */
  public playStep() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      const osc = this.ctx.createOscillator()
      const filter = this.ctx.createBiquadFilter()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(110, now)
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.07)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(260, now)

      gain.gain.setValueAtTime(0.038, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(out)

      osc.start(now)
      osc.stop(now + 0.075)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Warm golden shimmer (celesta/warm bell harmonics).
   */
  public playGoldSparkle() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      // Warm modal pentatonic frequencies (D5, F#5, A5, C#6)
      const freqs = [587.33, 739.99, 880.00, 1108.73]
      freqs.forEach((freq, idx) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        const filter = this.ctx.createBiquadFilter()

        osc.type = 'sine'
        const startTime = now + idx * 0.042
        osc.frequency.setValueAtTime(freq, startTime)
        osc.frequency.exponentialRampToValueAtTime(freq * 1.12, startTime + 0.1)

        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(1600, startTime)

        gain.gain.setValueAtTime(0.0001, startTime)
        gain.gain.linearRampToValueAtTime(0.022, startTime + 0.008)
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.12)

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(out)

        osc.start(startTime)
        osc.stop(startTime + 0.13)
      })
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Warm charcoal / pencil on cotton rag paper.
   */
  public playScratch() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      const osc = this.ctx.createOscillator()
      const filter = this.ctx.createBiquadFilter()
      const gain = this.ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(140 + Math.random() * 80, now)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(420, now)

      gain.gain.setValueAtTime(0.02, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(out)

      osc.start(now)
      osc.stop(now + 0.035)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Deep singing slate / Tibetan bronze bowl.
   */
  public playMineralResonance() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      // Fundamental A2 (110 Hz) + E3 (164.81 Hz) + A3 (220 Hz)
      const osc1 = this.ctx.createOscillator()
      const osc2 = this.ctx.createOscillator()
      const osc3 = this.ctx.createOscillator()
      const filter = this.ctx.createBiquadFilter()
      const gain = this.ctx.createGain()

      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(110.0, now)

      // Slight chorus detune for warm organic beating
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(165.2, now)

      osc3.type = 'triangle'
      osc3.frequency.setValueAtTime(220.4, now)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(420, now)
      filter.frequency.exponentialRampToValueAtTime(130, now + 2.0)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.085, now + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2)

      osc1.connect(filter)
      osc2.connect(filter)
      osc3.connect(filter)
      filter.connect(gain)
      gain.connect(out)

      osc1.start(now)
      osc2.start(now)
      osc3.start(now)
      osc1.stop(now + 2.25)
      osc2.stop(now + 2.25)
      osc3.stop(now + 2.25)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Heavy warm organic body thump (deep bass + cajón wood slap).
   */
  public playPunch() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return
      const now = this.ctx.currentTime + 0.002
      const out = this.getOut()

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([35, 25, 60]) } catch {}
      }

      const sampleRate = this.ctx.sampleRate || 44100

      // Warm pre-impact air displacement (filtered lowpass)
      const whooshLen = Math.round(sampleRate * 0.065)
      const whooshBuffer = this.ctx.createBuffer(1, whooshLen, sampleRate)
      const whooshData = whooshBuffer.getChannelData(0)
      for (let i = 0; i < whooshLen; i++) {
        const t = i / whooshLen
        whooshData[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI)
      }
      const whooshSrc = this.ctx.createBufferSource()
      whooshSrc.buffer = whooshBuffer
      const whooshFilter = this.ctx.createBiquadFilter()
      whooshFilter.type = 'lowpass'
      whooshFilter.frequency.setValueAtTime(260, now)
      whooshFilter.frequency.exponentialRampToValueAtTime(680, now + 0.038)
      whooshFilter.frequency.exponentialRampToValueAtTime(140, now + 0.065)
      const whooshGain = this.ctx.createGain()
      whooshGain.gain.setValueAtTime(0.01, now)
      whooshGain.gain.linearRampToValueAtTime(0.38, now + 0.032)
      whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065)
      whooshSrc.connect(whooshFilter)
      whooshFilter.connect(whooshGain)
      whooshGain.connect(out)
      whooshSrc.start(now)

      // Warm sub-bass body thump (210 Hz down to 32 Hz)
      const subOsc = this.ctx.createOscillator()
      const subGain = this.ctx.createGain()
      subOsc.type = 'sine'
      subOsc.frequency.setValueAtTime(210, now)
      subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.2)
      subGain.gain.setValueAtTime(0.85, now)
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      subOsc.connect(subGain)
      subGain.connect(out)
      subOsc.start(now)
      subOsc.stop(now + 0.26)

      // Warm wooden cajón impact (filtered at 880 Hz instead of harsh 1850 Hz)
      const snapLen = Math.round(sampleRate * 0.05)
      const snapBuffer = this.ctx.createBuffer(1, snapLen, sampleRate)
      const snapData = snapBuffer.getChannelData(0)
      for (let i = 0; i < snapLen; i++) {
        const t = i / snapLen
        snapData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 12)
      }
      const snapSrc = this.ctx.createBufferSource()
      snapSrc.buffer = snapBuffer
      const snapFilter = this.ctx.createBiquadFilter()
      snapFilter.type = 'lowpass'
      snapFilter.frequency.value = 880
      snapFilter.Q.value = 1.6
      const snapGain = this.ctx.createGain()
      snapGain.gain.setValueAtTime(0.68, now)
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
      snapSrc.connect(snapFilter)
      snapFilter.connect(snapGain)
      snapGain.connect(out)
      snapSrc.start(now)

      // Wood resonance
      const woodOsc = this.ctx.createOscillator()
      const woodGain = this.ctx.createGain()
      woodOsc.type = 'triangle'
      woodOsc.frequency.setValueAtTime(140, now + 0.004)
      woodOsc.frequency.exponentialRampToValueAtTime(48, now + 0.2)
      woodGain.gain.setValueAtTime(0.5, now + 0.004)
      woodGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
      woodOsc.connect(woodGain)
      woodGain.connect(out)
      woodOsc.start(now + 0.004)
      woodOsc.stop(now + 0.26)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Warm brass / Rhodes chord arpeggio.
   */
  public playVictory() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      // Warm C major triad: C4 (261.63), E4 (329.63), G4 (392.00), C5 (523.25)
      const notes = [261.63, 329.63, 392.00, 523.25]
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(1100, now)

      notes.forEach((note, idx) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'triangle'
        const startTime = now + idx * 0.09
        osc.frequency.setValueAtTime(note, startTime)

        gain.gain.setValueAtTime(0.0001, startTime)
        gain.gain.linearRampToValueAtTime(0.062, startTime + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.45)

        osc.connect(filter)
        gain.connect(out)
        filter.connect(gain)

        osc.start(startTime)
        osc.stop(startTime + 0.48)
      })
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Intimate acoustic piano / pool drift motif with warm lowpass filtering.
   */
  public playSilenceFinale() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime + 0.01
      const out = this.getOut()

      // Subaquatic Warm Low-pass Filter
      const subaquaticFilter = this.ctx.createBiquadFilter()
      subaquaticFilter.type = 'lowpass'
      subaquaticFilter.frequency.setValueAtTime(1800, now)
      subaquaticFilter.frequency.exponentialRampToValueAtTime(360, now + 5.0)
      subaquaticFilter.Q.setValueAtTime(0.9, now)

      const masterGain = this.ctx.createGain()
      masterGain.gain.setValueAtTime(0.08, now)
      masterGain.gain.exponentialRampToValueAtTime(0.00001, now + 6.8)

      subaquaticFilter.connect(masterGain)
      masterGain.connect(out)

      // The Sound of Silence motif + open lingering chord
      const motif = [
        { f: 146.83, t: 0.00, d: 0.35, p: 0.045 },
        { f: 146.83, t: 0.36, d: 0.35, p: 0.040 },
        { f: 174.61, t: 0.72, d: 0.38, p: 0.045 },
        { f: 174.61, t: 1.08, d: 0.38, p: 0.040 },
        { f: 220.00, t: 1.44, d: 0.42, p: 0.052 },
        { f: 220.00, t: 1.80, d: 0.42, p: 0.046 },
        { f: 196.00, t: 2.18, d: 1.15, p: 0.058 },
        { f: 146.83, t: 3.45, d: 3.20, p: 0.065 },
        { f: 220.00, t: 3.46, d: 3.20, p: 0.050 },
        { f: 293.66, t: 3.47, d: 3.40, p: 0.048 },
        { f: 440.00, t: 3.48, d: 3.50, p: 0.038 }
      ]

      motif.forEach(({ f, t, d, p }) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(f, now + t)
        gain.gain.setValueAtTime(0.0001, now + t)
        gain.gain.linearRampToValueAtTime(p, now + t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d)
        osc.connect(gain)
        gain.connect(subaquaticFilter)
        osc.start(now + t)
        osc.stop(now + t + d + 0.05)
      })
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Warm dried seed calabash / Latin bamboo shaker.
   */
  public playSugarShaker() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([15, 30, 15, 45, 20, 80, 45, 60]) } catch {}
      }

      const now = this.ctx.currentTime + 0.005
      const sampleRate = this.ctx.sampleRate || 44100
      const out = this.getOut()

      // 4 Latin shaker strokes: warm seed texture (bandpass centered at 2400 & 2800 Hz)
      ;[0.00, 0.12, 0.24, 0.40].forEach((offset, idx) => {
        if (!this.ctx) return
        const strokeLen = Math.round(sampleRate * (idx === 3 ? 0.16 : 0.075))
        const buffer = this.ctx.createBuffer(1, strokeLen, sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < strokeLen; i++) {
          const t = i / strokeLen
          data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * Math.exp(-t * (idx === 3 ? 4 : 7))
        }
        const src = this.ctx.createBufferSource()
        src.buffer = buffer
        const filter = this.ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = idx === 3 ? 2400 : 2800
        filter.Q.value = 2.2
        const gain = this.ctx.createGain()
        gain.gain.setValueAtTime(0.01, now + offset)
        gain.gain.linearRampToValueAtTime(idx === 3 ? 0.72 : 0.45, now + offset + 0.018)
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + (idx === 3 ? 0.16 : 0.075))
        src.connect(filter)
        filter.connect(gain)
        gain.connect(out)
        src.start(now + offset)
      })

      // Warm acoustic wood palm tap
      const tapOsc = this.ctx.createOscillator()
      const tapGain = this.ctx.createGain()
      tapOsc.type = 'sine'
      tapOsc.frequency.setValueAtTime(115, now + 0.40)
      tapOsc.frequency.exponentialRampToValueAtTime(38, now + 0.52)
      tapGain.gain.setValueAtTime(0.42, now + 0.40)
      tapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.54)
      tapOsc.connect(tapGain)
      tapGain.connect(out)
      tapOsc.start(now + 0.40)
      tapOsc.stop(now + 0.55)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Warm vintage tube-amp power chord with cabinet low-pass filtering.
   */
  public playDeltoya() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance('¡DELTOYA!')
        utterance.lang = 'es-ES'
        utterance.rate = 1.05
        utterance.pitch = 0.86
        utterance.volume = 1.0
        window.speechSynthesis.speak(utterance)
      } catch {
        // Ignore speech synthesis errors
      }
    }

    try {
      this.initCtx()
      if (!this.ctx) return

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([35, 50, 25, 90, 40, 160]) } catch {}
      }

      const now = this.ctx.currentTime + 0.005
      const out = this.getOut()

      // Vintage guitar cabinet simulation: warm 820 Hz lowpass filter with gentle resonance
      const cabFilter = this.ctx.createBiquadFilter()
      cabFilter.type = 'lowpass'
      cabFilter.frequency.setValueAtTime(820, now)
      cabFilter.Q.setValueAtTime(1.4, now)

      // Warm overdrive soft-clip stage
      const waveShaper = this.ctx.createWaveShaper()
      const curve = new Float32Array(256)
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1
        curve[i] = Math.tanh(1.8 * x) // Soft warm analog tape/tube saturation
      }
      waveShaper.curve = curve

      const guitarGain = this.ctx.createGain()
      guitarGain.gain.setValueAtTime(0.001, now)
      guitarGain.gain.linearRampToValueAtTime(0.42, now + 0.02)
      guitarGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0)

      waveShaper.connect(cabFilter)
      cabFilter.connect(guitarGain)
      guitarGain.connect(out)

      // Power chord: E2, B2, E3, G#3 (warm analog crunch)
      ;[82.41, 123.47, 164.81, 207.65].forEach((freq, idx) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = idx === 0 ? 'sawtooth' : 'triangle'
        osc.frequency.setValueAtTime(freq, now)
        gain.gain.setValueAtTime(0.35 / (idx + 1), now)
        osc.connect(gain)
        gain.connect(waveShaper)
        osc.start(now)
        osc.stop(now + 2.05)
      })
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Warm handcrafted walnut puzzle snap.
   */
  public playPuzzleSnap() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([12, 10, 18]) } catch {}
    }
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime + 0.002
      const sampleRate = this.ctx.sampleRate || 44100
      const out = this.getOut()

      ;[0.00, 0.016].forEach((offset, idx) => {
        if (!this.ctx) return
        const len = Math.round(sampleRate * 0.035)
        const buf = this.ctx.createBuffer(1, len, sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < len; i++) {
          const t = i / len
          data[i] = (Math.random() * 2 - 1) * Math.exp(-t * (idx === 0 ? 12 : 9))
        }
        const src = this.ctx.createBufferSource()
        src.buffer = buf
        const filter = this.ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = idx === 0 ? 820 : 1150 // Warm wood frequency range
        filter.Q.value = 2.4
        const gain = this.ctx.createGain()
        gain.gain.setValueAtTime(0.01, now + offset)
        gain.gain.linearRampToValueAtTime(idx === 0 ? 0.38 : 0.58, now + offset + 0.003)
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.032)
        src.connect(filter)
        filter.connect(gain)
        gain.connect(out)
        src.start(now + offset)
      })

      // Warm wooden body thump
      const bodyOsc = this.ctx.createOscillator()
      const bodyGain = this.ctx.createGain()
      bodyOsc.type = 'sine'
      bodyOsc.frequency.setValueAtTime(160, now)
      bodyOsc.frequency.exponentialRampToValueAtTime(65, now + 0.04)
      bodyGain.gain.setValueAtTime(0.24, now)
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045)
      bodyOsc.connect(bodyGain)
      bodyGain.connect(out)
      bodyOsc.start(now)
      bodyOsc.stop(now + 0.05)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Antique brass & walnut clock escapement (780 Hz & 620 Hz).
   */
  public playSwissClock() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([8, 240, 6]) } catch {}
    }
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime + 0.002
      const out = this.getOut()

      ;[
        { offset: 0.00, freq: 780, vol: 0.36 },
        { offset: 0.26, freq: 620, vol: 0.30 }
      ].forEach(({ offset, freq, vol }) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const filter = this.ctx.createBiquadFilter()
        const gain = this.ctx.createGain()

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + offset)

        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(1200, now + offset)

        gain.gain.setValueAtTime(0.001, now + offset)
        gain.gain.linearRampToValueAtTime(vol, now + offset + 0.002)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.028)

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(out)

        osc.start(now + offset)
        osc.stop(now + offset + 0.03)

        // Wood body resonance
        const wood = this.ctx.createOscillator()
        const woodGain = this.ctx.createGain()
        wood.type = 'sine'
        wood.frequency.setValueAtTime(260, now + offset)
        woodGain.gain.setValueAtTime(vol * 0.45, now + offset)
        woodGain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.025)
        wood.connect(woodGain)
        woodGain.connect(out)
        wood.start(now + offset)
        wood.stop(now + offset + 0.028)
      })
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Heavy vintage Bohemian lead crystal goblet resonance.
   */
  public playWineGlassClink() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([10, 30, 15]) } catch {}
    }
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime + 0.002
      const out = this.getOut()

      ;[
        { freq: 1174.66, vol: 0.48, decay: 1.6 },
        { freq: 1479.98, vol: 0.32, decay: 1.2 },
        { freq: 1760.00, vol: 0.18, decay: 0.8 }
      ].forEach(({ freq, vol, decay }) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const filter = this.ctx.createBiquadFilter()
        const gain = this.ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)

        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(2200, now)

        gain.gain.setValueAtTime(0.001, now)
        gain.gain.linearRampToValueAtTime(vol, now + 0.003)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay)

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(out)

        osc.start(now)
        osc.stop(now + decay + 0.05)
      })
    } catch {
      // Ignore audio errors
    }
  }
}

export const sound = new SoundEngine()
