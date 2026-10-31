// Sound FX Engine powered by Web Audio API (Zero external assets required)
// Calibrated for warm, nostalgic analog tape & felt-piano resonance (Aphex Twin / Boards of Canada aesthetic)

// Cadencia final inmutable: notas icónicas de SOUND OF SILENCE en Re menor microtonal cálido
// D5 (sound), [silencio], A4 (of), C5 (si-), F5 (-lence), E5 (resolución), [silencio], D5 (tónica final)
export const SOUND_OF_SILENCE_CADENCE: (number | null)[] = [
  74.00, null, 69.02, 72.02, 77.16, 75.86, null, 74.00
]

// Escala Dórica / Eólica Cálida en Re (Entonación Justa Consonante · Estética Aphex Twin "Rhubarb" / Boards of Canada "Olson"):
// (El sintetizador las transpone -12 semitonos al registro grave/medio de cinta analógica y piano con fieltro: 146 Hz – 440 Hz)
// 69.02: A4 (Quinta justa pura 3/2 grave)
// 71.74: B4 (Sexta dórica dulce)
// 72.02: C5 (Séptima menor cálida)
// 74.00: D5 (Tónica fundamental Re)
// 75.86: E5 (Novena / Segunda mayor dulce)
// 77.16: F5 (Tercera menor justa pura 6/5)
// 78.98: G5 (Cuarta justa pura 4/3)
// 81.02: A5 (Quinta justa pura 3/2)
// 83.74: B5 (Sexta dórica superior)
// 86.00: D6 (Octava pura 2/1)
const MODAL_PITCHES = [
  69.02, 71.74, 72.02, 74.00, 75.86, 77.16, 78.98, 81.02, 83.74, 86.00
]

// Células motívicas minimalistas (haikus monofónicos tipo Erik Satie / Nils Frahm "Felt" / Ryuichi Sakamoto "async")
const MOTIF_CELLS_A: (number | null)[][] = [
  [74.00, null, null, 77.16],
  [74.00, null, 69.02, null],
  [74.00, null, null, 81.02],
  [null, 74.00, null, 71.74],
  [69.02, null, 74.00, null],
  [74.00, null, 78.98, null],
  [null, 81.02, null, 77.16],
  [72.02, null, 75.86, null]
]

const MOTIF_CELLS_B: (number | null)[][] = [
  [78.98, null, null, 81.02],
  [81.02, null, 77.16, null],
  [77.16, null, null, 83.74],
  [null, 77.16, null, 75.86],
  [81.02, null, null, 74.00],
  [74.00, null, 81.02, null],
  [null, 81.02, null, 77.16],
  [77.16, null, 78.98, null]
]

const MOTIF_CELLS_C: (number | null)[][] = [
  [75.86, null, null, 69.02],
  [null, 75.86, null, 78.98],
  [77.16, null, 74.00, null],
  [69.02, null, null, 75.86],
  [null, 75.86, null, 74.00],
  [77.16, null, null, 71.74],
  [74.00, null, 69.02, null],
  [null, 72.02, null, 69.02]
]

/**
 * Generador procedural minimalista de melodías para piano de fieltro monofónico.
 * Preserva silencios amplios (nunca rellena pausas null con notas extra) y culmina en SOUND OF SILENCE.
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

  // Mutación orgánica minimalista: preserva siempre los silencios null y solo desplaza grados vecinos
  const mutateCell = (cell: (number | null)[], allowVariation = true): (number | null)[] => {
    const copy = [...cell]
    if (!allowVariation || Math.random() > 0.45) return copy
    const mutateIdx = 1 + Math.floor(Math.random() * (copy.length - 1))
    const current = copy[mutateIdx]
    if (current === null) {
      return copy
    }
    if (Math.random() < 0.25) {
      copy[mutateIdx] = null
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

// 7 TEMAS CANÓNICOS DE LA SEMANA (HAIKUS MINIMALISTAS EN PIANO DE FIELTRO CÁLIDO · ERIK SATIE / NILS FRAHM)
export const WEEKDAY_THEMES: WeekdayTheme[] = [
  // 0. Lunes (Astelehena)
  {
    day: 'Lunes',
    name: 'Txoria Txori',
    subtitle: 'Mikel Laboa · Piano de fieltro minimalista',
    notes: [
      74.00, null, 75.86, null, 77.16, null, 74.00, null,
      null, 69.02, null, 74.00, null, 77.16, null, null,
      81.02, null, 78.98, null, 75.86, null, 72.02, null,
      ...SOUND_OF_SILENCE_CADENCE
    ]
  },
  // 1. Martes (Asteartea)
  {
    day: 'Martes',
    name: 'Haurtxo Polita',
    subtitle: 'Nana vasca íntima · Fieltro y silencio',
    notes: [
      69.02, null, 74.00, null, 77.16, null, null, 74.00,
      null, 78.98, null, 81.02, null, null, 77.16, null,
      null, 74.00, null, 69.02, null, 72.02, null, null,
      ...SOUND_OF_SILENCE_CADENCE
    ]
  },
  // 2. Miércoles (Asteazkena)
  {
    day: 'Miércoles',
    name: 'Harria eta Marea',
    subtitle: 'Piedra y marea · Espacio contemplativo',
    notes: [
      74.00, null, null, 81.02, null, 75.86, null, null,
      77.16, null, 83.74, null, null, 78.98, null, 74.00,
      null, 75.86, null, null, 72.02, null, 69.02, null,
      ...SOUND_OF_SILENCE_CADENCE
    ]
  },
  // 3. Jueves (Osteguna)
  {
    day: 'Jueves',
    name: 'Landa / Alboka pastoral',
    subtitle: 'Valle de Arratia · Notas solitarias de fieltro',
    notes: [
      74.00, null, 77.16, null, 81.02, null, 74.00, null,
      null, 71.74, null, 75.86, null, null, 69.02, null,
      74.00, null, 77.16, null, null, 75.86, null, null,
      ...SOUND_OF_SILENCE_CADENCE
    ]
  },
  // 4. Viernes (Ostirala)
  {
    day: 'Viernes',
    name: 'Mi Gran Noche',
    subtitle: 'Fieltro nocturno desnudo · Qué misterio habrá',
    notes: [
      74.00, null, 75.86, null, 77.16, null, null, 81.02,
      null, 78.98, null, 75.86, null, null, 69.02, null,
      81.02, null, null, 78.98, null, 77.16, null, null,
      ...SOUND_OF_SILENCE_CADENCE
    ]
  },
  // 5. Sábado (Larunbata)
  {
    day: 'Sábado',
    name: 'Gaua / Nocturno de Bilbao',
    subtitle: 'Nocturno minimalista en penumbra de ría',
    notes: [
      74.00, null, null, 81.02, null, 77.16, null, null,
      69.02, null, 74.00, null, null, 78.98, null, null,
      74.00, null, 81.02, null, null, 75.86, null, null,
      ...SOUND_OF_SILENCE_CADENCE
    ]
  },
  // 6. Domingo (Igandea)
  {
    day: 'Domingo',
    name: 'Haizea / Viento en los pinos',
    subtitle: 'Aire y silencio · Retorno al origen',
    notes: [
      74.00, null, 77.16, null, 81.02, null, null, 78.98,
      null, 75.86, null, 74.00, null, 69.02, null, null,
      75.86, null, 81.02, null, null, 75.86, null, null,
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

  private lastHapticClickTime = 0
  private lastSessionStepTime = 0

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

      // Resume AudioContext on initial user gesture (zero background MP3 loop — pure minimalist silence at rest)
      const handleUserInteraction = () => {
        this.initCtx()
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
   * Bus maestro de calidez analógica (Estética Boards of Canada / Aphex Twin SAW II):
   * 1. Realce low-shelf en 220 Hz (+3.0 dB) para cuerpo cálido de cinta y madera.
   * 2. Filtro paso-bajo sedoso en 1450 Hz (Q = 0.5) que elimina cualquier aspereza o brillo digital.
   * 3. Compresor de pegamento analógico suave.
   */
  private setupWarmthBus() {
    if (!this.ctx || this.warmBus) return
    try {
      this.warmBus = this.ctx.createGain()
      this.warmBus.gain.value = 0.92

      this.warmShelf = this.ctx.createBiquadFilter()
      this.warmShelf.type = 'lowshelf'
      this.warmShelf.frequency.value = 200
      this.warmShelf.gain.value = 3.2

      this.warmLowpass = this.ctx.createBiquadFilter()
      this.warmLowpass.type = 'lowpass'
      this.warmLowpass.frequency.value = 820
      this.warmLowpass.Q.value = 0.38

      this.masterCompressor = this.ctx.createDynamicsCompressor()
      this.masterCompressor.threshold.value = -10.0
      this.masterCompressor.knee.value = 14.0
      this.masterCompressor.ratio.value = 2.8
      this.masterCompressor.attack.value = 0.015
      this.masterCompressor.release.value = 0.16

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
   * Voz Monofónica Minimalista de Piano de Fieltro (Estética Erik Satie / Nils Frahm "Felt" / Ryuichi Sakamoto "async"):
   * - Transposición de -12 semitonos al registro grave-medio aterciopelado (146 Hz – 440 Hz).
   * - Una única fundamental senoidal pura con ataque de fieltro suave (45 ms) y caída larga de seda (2.15 s).
   * - Filtro paso-bajo sedoso (460 Hz -> 230 Hz, Q = 0.34) y deriva sutil Tape Wow (±2.0 cents).
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

      const now = this.ctx.currentTime + 0.005 + Math.max(0, delaySec)
      const out = this.getOut()

      const warmMidi = midiNote - 12
      const rootHz = 440 * Math.pow(2, (warmMidi + detuneCents / 100 - 69) / 12)

      const masterVoiceGain = this.ctx.createGain()
      masterVoiceGain.gain.setValueAtTime(volume * 0.14, now)

      if (typeof this.ctx.createStereoPanner === 'function') {
        const panner = this.ctx.createStereoPanner()
        panner.pan.setValueAtTime(Math.max(-0.28, Math.min(0.28, pan)), now)
        masterVoiceGain.connect(panner)
        panner.connect(out)
      } else {
        masterVoiceGain.connect(out)
      }

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      const openCutoff = Math.min(480, Math.max(240, rootHz * 1.4))
      const warmCutoff = Math.max(195, Math.min(310, rootHz * 0.82))
      filter.frequency.setValueAtTime(openCutoff, now)
      filter.frequency.exponentialRampToValueAtTime(warmCutoff, now + 1.75)
      filter.Q.setValueAtTime(0.34, now)
      filter.connect(masterVoiceGain)

      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const attack = 0.045
      const decay = 2.15
      const driftedFreq = rootHz * Math.pow(2, -1.8 / 1200)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(rootHz * 0.9991, now)
      osc.frequency.exponentialRampToValueAtTime(driftedFreq, now + 0.65)
      osc.frequency.exponentialRampToValueAtTime(rootHz, now + decay)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.72, now + attack)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay)

      osc.connect(gain)
      gain.connect(filter)

      osc.start(now)
      osc.stop(now + decay + 0.05)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Motor Minimalista de Piano de Fieltro (Ciclo de 32 pasos).
   * - Respiración amplia (980 ms mínimo entre notas) para que cada desplazamiento emita a lo sumo una nota solitaria.
   * - Cero acordes sincopados apilados; los pasos null permanecen en silencio contemplativo absoluto.
   * - Pasos 24..31: Cadencia inmutable de SOUND OF SILENCE en Re menor.
   */
  public playSessionStep(stepIndex?: number) {
    if (!this.enabled) return
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (nowMs - this.lastSessionStepTime < 980) return
    this.lastSessionStepTime = nowMs

    const mel = this.getSessionMelody()
    if (typeof stepIndex === 'number') {
      this.sessionStep = ((stepIndex % mel.length) + mel.length) % mel.length
    } else {
      this.sessionStep = (this.sessionStep + 1) % mel.length
    }

    const step = this.sessionStep
    const isSilenceCadence = step >= mel.length - 8
    const note = mel[step]

    if (note === null) {
      return
    }

    const accent = step % 8 === 0 ? 1.0 : step % 4 === 0 ? 0.90 : 0.80
    const panMain = Math.sin(step * 0.7) * 0.12

    // Nota solitaria de fieltro
    this.playMusicBoxNote(note, 0.34 * accent, 0, panMain, 0)

    // Susurro sub-octava exclusivo en el arranque y reposo final de SOUND OF SILENCE
    if (isSilenceCadence && (step === mel.length - 8 || step === mel.length - 1)) {
      this.playMusicBoxNote(62.00, 0.14, 0.045, 0, 0)
    }
  }

  public playMusic() {
    // Minimalismo estricto: ningún bucle MP3 continuo de fondo invade el silencio del estudio.
    this.pauseMusic()
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
    } else {
      this.pauseMusic()
    }
    return this.enabled
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Pulso minimalista grave de fieltro (cero clics agudos).
   */
  public playHapticClick(pitchMultiplier: number = 1.0) {
    if (!this.enabled) return
    const nowMs = performance.now()
    if (nowMs - this.lastHapticClickTime < 140) return
    this.lastHapticClickTime = nowMs

    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      const root = 146.83 * Math.max(0.75, Math.min(1.25, pitchMultiplier))
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(root * 1.08, now)
      osc.frequency.exponentialRampToValueAtTime(root, now + 0.045)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(360, now)
      filter.Q.setValueAtTime(0.4, now)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.012, now + 0.014)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(out)

      osc.start(now)
      osc.stop(now + 0.08)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Deslizamiento silencioso / sub-respiración analógica cálida (CERO ruido blanco).
   */
  public playHapticSlide(_velocity: number = 1.0) {
    // Silenciado el generador de ruido blanco para preservar la pureza tonal minimalista
    return
  }

  /**
   * Quinta abierta minimalista de fieltro (D3 + A3) al abrir la lupa.
   */
  public playLoupeReveal() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      const d3 = 146.832
      const warmDyad = [
        { freq: d3 * 1.0, delay: 0.000, dur: 1.85, level: 0.015 }, // D3 (146.8 Hz)
        { freq: d3 * 1.5, delay: 0.085, dur: 1.75, level: 0.011 }  // A3 (220.2 Hz)
      ]

      warmDyad.forEach(({ freq, delay, dur, level }) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        const filter = this.ctx.createBiquadFilter()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq * 0.9985, now + delay)
        osc.frequency.exponentialRampToValueAtTime(freq, now + delay + 0.40)

        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(460, now + delay)
        filter.Q.setValueAtTime(0.4, now + delay)

        gain.gain.setValueAtTime(0.0001, now + delay)
        gain.gain.linearRampToValueAtTime(level, now + delay + 0.048)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur)

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(out)

        osc.start(now + delay)
        osc.stop(now + delay + dur + 0.04)
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
   * Susurro minimalista casi imperceptible en registro grave-medio (D3 -> A3).
   */
  public playHover() {
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
      osc.frequency.setValueAtTime(146.83, now)
      osc.frequency.exponentialRampToValueAtTime(220.00, now + 0.14)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(380, now)
      filter.Q.setValueAtTime(0.4, now)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.007, now + 0.032)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(out)

      osc.start(now)
      osc.stop(now + 0.18)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Apertura minimalista en quinta abierta (D3 + A3) de piano de fieltro.
   */
  public playOpen() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      const d3 = 146.832
      const notes = [
        { f: d3 * 1.0, delay: 0.000, weight: 0.24 },
        { f: d3 * 1.5, delay: 0.065, weight: 0.16 }
      ]
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(420, now)
      filter.frequency.exponentialRampToValueAtTime(280, now + 0.65)
      filter.Q.setValueAtTime(0.4, now)

      const masterGain = this.ctx.createGain()
      masterGain.gain.setValueAtTime(0.0001, now)
      masterGain.gain.linearRampToValueAtTime(0.018, now + 0.045)
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.68)

      filter.connect(masterGain)
      masterGain.connect(out)

      notes.forEach(({ f, delay, weight }) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const oscGain = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(f * 0.998, now + delay)
        osc.frequency.exponentialRampToValueAtTime(f, now + delay + 0.14)

        oscGain.gain.setValueAtTime(weight, now + delay)
        osc.connect(oscGain)
        oscGain.connect(filter)

        osc.start(now + delay)
        osc.stop(now + delay + 0.7)
      })
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Cierre minimalista monofónico descendente hacia la tónica grave D3 (146.83 Hz).
   */
  public playClose() {
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
      osc.frequency.setValueAtTime(220.00, now)
      osc.frequency.exponentialRampToValueAtTime(146.83, now + 0.26)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(380, now)
      filter.frequency.exponentialRampToValueAtTime(190, now + 0.27)
      filter.Q.setValueAtTime(0.4, now)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.016, now + 0.032)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(out)

      osc.start(now)
      osc.stop(now + 0.30)
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
   * Authentic Extremoduro dry electric guitar chord hit ('Deltoya').
   */
  public playDeltoya() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([20, 40, 20]) } catch {}
    }

    if (typeof window !== 'undefined' && typeof window.Audio === 'function') {
      try {
        const audio = new window.Audio('/audio/deltoya.mp3')
        audio.volume = 0.85
        audio.play().catch(() => {})
      } catch {
        // Ignore audio playback errors
      }
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
