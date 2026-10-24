// Sound FX Engine powered by Web Audio API (Zero external assets required)
// Calibrated for warm, organic, acoustic resonance (wood, mineral, brass, analog tape)

// Cadencia final inmutable: notas icónicas de SOUND OF SILENCE en Re menor microtonal
// D5 (sound), [silencio], A4 (of), C5 (si-), F5 (-lence), E5 (resolución), [silencio], D5 (tónica final)
export const SOUND_OF_SILENCE_CADENCE: (number | null)[] = [
  74.00, null, 69.02, 71.74, 77.24, 75.86, null, 74.00
]

// Repertorio modal en Re menor para cada nueva sesión de usuario.
// Todas arrancan en 74.00 (D5) y culminan siempre en la cadencia de SOUND OF SILENCE.
export const SESSION_MELODIES: (number | null)[][] = [
  // 0. Landa / Alboka clásica de Arratia
  [
    74.00, 77.24, 81.02, 77.24, 75.86, 74.00, 69.02, null,
    71.74, 75.86, 78.98, 75.86, 74.00, 71.74, 69.02, null,
    74.00, 77.24, 81.02, 83.74, 81.02, 77.24, 75.86, null,
    ...SOUND_OF_SILENCE_CADENCE
  ],
  // 1. Olatua / Marejada cantábrica (arpegios amplios en ascenso)
  [
    74.00, 69.02, 74.00, 77.24, 81.02, 78.98, 77.24, null,
    77.24, 81.02, 83.74, 81.02, 78.98, 77.24, 74.00, null,
    74.00, 78.98, 81.02, 86.00, 83.74, 81.02, 77.24, null,
    ...SOUND_OF_SILENCE_CADENCE
  ],
  // 2. Mika / Mineral íntimo (campanas y destellos de celesta)
  [
    74.00, 81.02, 77.24, 74.00, 75.86, 77.24, 74.00, null,
    69.02, 74.00, 77.24, 81.02, 78.98, 75.86, 74.00, null,
    77.24, 78.98, 81.02, 78.98, 77.24, 75.86, 71.74, null,
    ...SOUND_OF_SILENCE_CADENCE
  ],
  // 3. Eskuak / Gesto de taller (ritmo pausado y contemplativo)
  [
    74.00, 75.86, 77.24, 74.00, 81.02, null, 78.98, 77.24,
    75.86, 74.00, 71.74, 69.02, 74.00, 77.24, 75.86, null,
    81.02, 77.24, 74.00, 78.98, 81.02, 83.74, 81.02, null,
    ...SOUND_OF_SILENCE_CADENCE
  ],
  // 4. Argia / Luz de ría (apertura diurna brillante)
  [
    74.00, 77.24, 74.00, 81.02, 77.24, 83.74, 81.02, null,
    78.98, 81.02, 77.24, 75.86, 74.00, 69.02, 71.74, null,
    74.00, 77.24, 81.02, 78.98, 75.86, 77.24, 74.00, null,
    ...SOUND_OF_SILENCE_CADENCE
  ],
  // 5. Gaua / Nocturno de Bilbao (graves densos y silencio envolvente)
  [
    74.00, 71.74, 69.02, null, 74.00, 77.24, 75.86, 74.00,
    69.02, 74.00, 77.24, 78.98, 81.02, 77.24, 74.00, null,
    81.02, 83.74, 81.02, 77.24, 75.86, 71.74, 69.02, null,
    ...SOUND_OF_SILENCE_CADENCE
  ],
  // 6. Haizea / Viento en los pinos (arpegios etéreos en cascada)
  [
    74.00, 77.24, 81.02, 86.00, 81.02, 77.24, 74.00, null,
    78.98, 75.86, 74.00, 69.02, 71.74, 75.86, 74.00, null,
    77.24, 81.02, 78.98, 77.24, 75.86, 74.00, 69.02, null,
    ...SOUND_OF_SILENCE_CADENCE
  ]
]

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
  private sessionStep: number = -1

  constructor() {
    this.sessionMelodyIndex = this.pickSessionMelodyIndex()

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
   * Synthesize a warm modal acoustic music-box tine note (in D minor microtonal temperament).
   */
  public playMusicBoxNote(midiNote: number = 74.00, volume: number = 0.5) {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime + 0.002
      const out = this.getOut()
      const rootHz = 440 * Math.pow(2, (midiNote - 69) / 12)

      const masterTineGain = this.ctx.createGain()
      masterTineGain.gain.setValueAtTime(volume * 0.38, now)
      masterTineGain.connect(out)

      // Warm acoustic lowpass filter to ensure silky chime tone
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(Math.min(2200, rootHz * 3.0), now)
      filter.Q.value = 1.0
      filter.connect(masterTineGain)

      // Modal synthesis partials
      const partials = [
        { ratio: 1.0, level: 0.72, decay: 0.95 },
        { ratio: 2.012, level: 0.22, decay: 0.48 },
        { ratio: 3.994, level: 0.08, decay: 0.25 },
        { ratio: 5.46, level: 0.04, decay: 0.15 }
      ]

      partials.forEach(({ ratio, level, decay }) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(rootHz * ratio, now)

        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.linearRampToValueAtTime(level, now + 0.003)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay)

        osc.connect(gain)
        gain.connect(filter)

        osc.start(now)
        osc.stop(now + decay + 0.02)
      })
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Plays or advances the user session melody note (32-step cycle).
   * Steps 24..31 always sound the iconic Sound of Silence cadence.
   */
  public playSessionStep(stepIndex?: number) {
    if (!this.enabled) return
    const mel = this.getSessionMelody()
    if (typeof stepIndex === 'number') {
      this.sessionStep = ((stepIndex % mel.length) + mel.length) % mel.length
    } else {
      this.sessionStep = (this.sessionStep + 1) % mel.length
    }
    const note = mel[this.sessionStep]
    if (note !== null) {
      this.playMusicBoxNote(note, 0.42)
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
   * Warm wooden/mineral tactile tap (like precision Leica shutter or carved wood switch).
   */
  public playHapticClick(pitchMultiplier: number = 1.0) {
    if (!this.enabled) return
    const nowMs = performance.now()
    if (nowMs - this.lastHapticClickTime < 35) return // Throttling 35ms
    this.lastHapticClickTime = nowMs

    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      // Primary warm body oscillator (sine for round warm mass)
      const osc = this.ctx.createOscillator()
      const oscGain = this.ctx.createGain()

      // Subtle tactile snap oscillator (filtered soft triangle for organic texture)
      const snapOsc = this.ctx.createOscillator()
      const snapGain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      const baseFreq = 380 * pitchMultiplier
      osc.type = 'sine'
      osc.frequency.setValueAtTime(baseFreq, now)
      osc.frequency.exponentialRampToValueAtTime(115 * pitchMultiplier, now + 0.024)

      oscGain.gain.setValueAtTime(0.065, now)
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026)

      snapOsc.type = 'triangle'
      snapOsc.frequency.setValueAtTime(baseFreq * 1.5, now)
      snapOsc.frequency.exponentialRampToValueAtTime(160 * pitchMultiplier, now + 0.018)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(1200 * pitchMultiplier, now)
      filter.Q.setValueAtTime(1.2, now)

      snapGain.gain.setValueAtTime(0.035, now)
      snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018)

      osc.connect(oscGain)
      oscGain.connect(out)

      snapOsc.connect(filter)
      filter.connect(snapGain)
      snapGain.connect(out)

      osc.start(now)
      osc.stop(now + 0.028)
      snapOsc.start(now)
      snapOsc.stop(now + 0.02)
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
   * Warm celesta/Rhodes mineral bloom with low D anchor and velvety sustain.
   */
  public playLoupeReveal() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      // D3, A3, F#4, A4, C#5 (warm open Dmaj9 chord)
      const chord = [146.83, 220.00, 369.99, 440.00, 554.37]
      chord.forEach((freq, idx) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        const filter = this.ctx.createBiquadFilter()

        osc.type = idx === 0 ? 'sine' : 'triangle'
        osc.frequency.setValueAtTime(freq, now)

        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(Math.min(1400, freq * 2.2), now)
        filter.Q.setValueAtTime(1.5, now)

        const delay = idx * 0.04
        gain.gain.setValueAtTime(0.0001, now + delay)
        gain.gain.linearRampToValueAtTime(idx === 0 ? 0.038 : 0.024, now + delay + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.65)

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(out)

        osc.start(now + delay)
        osc.stop(now + delay + 0.7)
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
   * Warm acoustic ghost note / marimba aura.
   */
  public playHover() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      // Warm sine fundamental (A3 -> C#4 warm major third)
      const osc = this.ctx.createOscillator()
      const osc2 = this.ctx.createOscillator()
      const filter = this.ctx.createBiquadFilter()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(220, now)
      osc.frequency.exponentialRampToValueAtTime(277.18, now + 0.065)

      // Subtle octave overtone
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(440, now)
      osc2.frequency.exponentialRampToValueAtTime(554.37, now + 0.065)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(750, now)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.026, now + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075)

      const gain2 = this.ctx.createGain()
      gain2.gain.setValueAtTime(0.008, now)
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.065)

      osc.connect(filter)
      osc2.connect(gain2)
      gain2.connect(filter)
      filter.connect(gain)
      gain.connect(out)

      osc.start(now)
      osc.stop(now + 0.08)
      osc2.start(now)
      osc2.stop(now + 0.08)
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Warm ambient acoustic opening swell (D major modal resonance).
   */
  public playOpen() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const out = this.getOut()

      // D3 (146.83), A3 (220.00), F#4 (369.99) - warm luminous triad
      const notes = [146.83, 220.00, 369.99]
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(900, now)
      filter.frequency.exponentialRampToValueAtTime(1400, now + 0.12)
      filter.frequency.exponentialRampToValueAtTime(600, now + 0.28)

      const masterGain = this.ctx.createGain()
      masterGain.gain.setValueAtTime(0.0001, now)
      masterGain.gain.linearRampToValueAtTime(0.055, now + 0.035)
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)

      filter.connect(masterGain)
      masterGain.connect(out)

      notes.forEach((freq, idx) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const oscGain = this.ctx.createGain()
        osc.type = idx === 0 ? 'sine' : 'triangle'
        osc.frequency.setValueAtTime(freq * 0.96, now)
        osc.frequency.exponentialRampToValueAtTime(freq, now + 0.08)

        oscGain.gain.setValueAtTime(0.3 / (idx + 1), now)
        osc.connect(oscGain)
        oscGain.connect(filter)

        osc.start(now + idx * 0.015)
        osc.stop(now + 0.3)
      })
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Soft velvet settle (descending fifth into warm sub cushion).
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

      // Warm downward fifth: 220 Hz (A3) -> 146.83 Hz (D3)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(220, now)
      osc.frequency.exponentialRampToValueAtTime(146.83, now + 0.14)

      subOsc.type = 'sine'
      subOsc.frequency.setValueAtTime(110, now)
      subOsc.frequency.exponentialRampToValueAtTime(73.4, now + 0.14)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(520, now)
      filter.frequency.exponentialRampToValueAtTime(240, now + 0.15)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.048, now + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)

      osc.connect(filter)
      subOsc.connect(filter)
      filter.connect(gain)
      gain.connect(out)

      osc.start(now)
      subOsc.start(now)
      osc.stop(now + 0.16)
      subOsc.stop(now + 0.16)
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
