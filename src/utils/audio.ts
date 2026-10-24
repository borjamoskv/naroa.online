// Sound FX Engine powered by Web Audio API (Zero external assets required)

class SoundEngine {
  private ctx: AudioContext | null = null
  private enabled: boolean = true

  private bgMusic: HTMLAudioElement | null = null

  constructor() {
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

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  public playMusic() {
    if (!this.enabled || typeof window === 'undefined') return
    try {
      if (!this.bgMusic) {
        this.bgMusic = new Audio('/audio/boards-of-burgos.mp3')
        this.bgMusic.loop = true
        this.bgMusic.volume = 0.35
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

  private lastSlideSoundTime = 0
  private lastHapticClickTime = 0
  private noiseBuffer: AudioBuffer | null = null

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

  public playHapticClick(pitchMultiplier: number = 1.0) {
    if (!this.enabled) return
    const nowMs = performance.now()
    if (nowMs - this.lastHapticClickTime < 35) return // Throttling 35ms
    this.lastHapticClickTime = nowMs

    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(860 * pitchMultiplier, now)
      osc.frequency.exponentialRampToValueAtTime(220 * pitchMultiplier, now + 0.016)

      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(950 * pitchMultiplier, now)
      filter.Q.setValueAtTime(3.0, now)

      gain.gain.setValueAtTime(0.045, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.02)
    } catch {
      // Ignore audio errors
    }
  }

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

      const source = this.ctx.createBufferSource()
      source.buffer = buf

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(280 + Math.min(380, Math.abs(velocity) * 140), now)
      filter.Q.setValueAtTime(3.2, now)

      const gain = this.ctx.createGain()
      const vol = Math.min(0.035, 0.006 + Math.abs(velocity) * 0.018)
      gain.gain.setValueAtTime(vol, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065)

      source.connect(filter)
      filter.connect(gain)
      gain.connect(this.ctx.destination)

      source.start(now)
      source.stop(now + 0.065)
    } catch {
      // Ignore audio errors
    }
  }

  public playLoupeReveal() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const chord = [293.66, 369.99, 440.00, 587.33, 739.99] // D maj 9 mineral shimmer
      chord.forEach((freq, idx) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        const filter = this.ctx.createBiquadFilter()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)

        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(freq * 1.15, now)
        filter.Q.setValueAtTime(4.5, now)

        const delay = idx * 0.035
        gain.gain.setValueAtTime(0.0001, now + delay)
        gain.gain.exponentialRampToValueAtTime(0.022, now + delay + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.5)

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(this.ctx.destination)

        osc.start(now + delay)
        osc.stop(now + delay + 0.55)
      })
    } catch {
      // Ignore audio errors
    }
  }

  public playTick() {
    if (!this.enabled) return
    this.playHapticClick(1.0)
  }

  public playHover() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(280, now)
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.055)

      gain.gain.setValueAtTime(0.02, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.055)
    } catch {
      // Ignore audio errors
    }
  }

  public playOpen() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const osc1 = this.ctx.createOscillator()
      const osc2 = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(320, now)
      osc1.frequency.exponentialRampToValueAtTime(720, now + 0.14)

      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(480, now)
      osc2.frequency.exponentialRampToValueAtTime(960, now + 0.14)

      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(this.ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.15)
      osc2.stop(now + 0.15)
    } catch {
      // Ignore audio errors
    }
  }

  public playClose() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(680, now)
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.12)

      gain.gain.setValueAtTime(0.04, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.12)
    } catch {
      // Ignore audio errors
    }
  }

  public playSplatActivate() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const osc1 = this.ctx.createOscillator()
      const osc2 = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(440, now)
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.25)

      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(554.37, now) // C#5 harmonic
      osc2.frequency.exponentialRampToValueAtTime(1108.73, now + 0.25)

      gain.gain.setValueAtTime(0.06, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(this.ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.3)
      osc2.stop(now + 0.3)
    } catch {
      // Ignore audio errors
    }
  }

  public playSplatLightChange() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(660, now)
      osc.frequency.exponentialRampToValueAtTime(330, now + 0.08)

      gain.gain.setValueAtTime(0.04, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.08)
    } catch {
      // Ignore audio errors
    }
  }

  public playStep() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(140, now)
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.06)

      gain.gain.setValueAtTime(0.025, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + 0.06)
    } catch {
      // Ignore audio errors
    }
  }

  public playGoldSparkle() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const freqs = [1200, 1600, 2400, 3200]
      freqs.forEach((freq, idx) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'sine'
        const startTime = now + idx * 0.04
        osc.frequency.setValueAtTime(freq, startTime)
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, startTime + 0.08)
        gain.gain.setValueAtTime(0.02, startTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.08)
        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(startTime)
        osc.stop(startTime + 0.08)
      })
    } catch {
      // Ignore audio errors
    }
  }

  public playScratch() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(150 + Math.random() * 200, now)
      gain.gain.setValueAtTime(0.015, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start(now)
      osc.stop(now + 0.03)
    } catch {
      // Ignore audio errors
    }
  }

  public playMineralResonance() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime

      // Fundamental y armónico mineral cálido (110 Hz A2 + 220 Hz A3)
      const osc1 = this.ctx.createOscillator()
      const osc2 = this.ctx.createOscillator()
      const filter = this.ctx.createBiquadFilter()
      const gain = this.ctx.createGain()

      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(110, now)

      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(220, now)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(380, now)
      filter.frequency.exponentialRampToValueAtTime(120, now + 1.6)

      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8)

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(gain)
      gain.connect(this.ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 1.8)
      osc2.stop(now + 1.8)
    } catch {
      // Ignore audio errors
    }
  }

  public playPunch() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return
      const now = this.ctx.currentTime + 0.002

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([35, 25, 60]) } catch {}
      }

      const sampleRate = this.ctx.sampleRate || 44100

      // Pre-impact whoosh
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
      whooshFilter.frequency.setValueAtTime(320, now)
      whooshFilter.frequency.exponentialRampToValueAtTime(1100, now + 0.038)
      whooshFilter.frequency.exponentialRampToValueAtTime(180, now + 0.065)
      const whooshGain = this.ctx.createGain()
      whooshGain.gain.setValueAtTime(0.01, now)
      whooshGain.gain.linearRampToValueAtTime(0.42, now + 0.032)
      whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065)
      whooshSrc.connect(whooshFilter)
      whooshFilter.connect(whooshGain)
      whooshGain.connect(this.ctx.destination)
      whooshSrc.start(now)

      // Sub-bass body thump
      const subOsc = this.ctx.createOscillator()
      const subGain = this.ctx.createGain()
      subOsc.type = 'sine'
      subOsc.frequency.setValueAtTime(240, now)
      subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.18)
      subGain.gain.setValueAtTime(0.85, now)
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
      subOsc.connect(subGain)
      subGain.connect(this.ctx.destination)
      subOsc.start(now)
      subOsc.stop(now + 0.26)

      // Knuckle snap transient
      const snapLen = Math.round(sampleRate * 0.05)
      const snapBuffer = this.ctx.createBuffer(1, snapLen, sampleRate)
      const snapData = snapBuffer.getChannelData(0)
      for (let i = 0; i < snapLen; i++) {
        const t = i / snapLen
        snapData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 11)
      }
      const snapSrc = this.ctx.createBufferSource()
      snapSrc.buffer = snapBuffer
      const snapFilter = this.ctx.createBiquadFilter()
      snapFilter.type = 'bandpass'
      snapFilter.frequency.value = 1850
      snapFilter.Q.value = 2.8
      const snapGain = this.ctx.createGain()
      snapGain.gain.setValueAtTime(0.75, now)
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
      snapSrc.connect(snapFilter)
      snapFilter.connect(snapGain)
      snapGain.connect(this.ctx.destination)
      snapSrc.start(now)

      // Wood tabla slap
      const woodOsc = this.ctx.createOscillator()
      const woodGain = this.ctx.createGain()
      woodOsc.type = 'triangle'
      woodOsc.frequency.setValueAtTime(160, now + 0.004)
      woodOsc.frequency.exponentialRampToValueAtTime(54, now + 0.2)
      woodGain.gain.setValueAtTime(0.55, now + 0.004)
      woodGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26)
      woodOsc.connect(woodGain)
      woodGain.connect(this.ctx.destination)
      woodOsc.start(now + 0.004)
      woodOsc.stop(now + 0.28)
    } catch {
      // Ignore audio errors
    }
  }

  public playVictory() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
      notes.forEach((note, idx) => {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const gain = this.ctx.createGain()
        osc.type = 'triangle'
        const startTime = now + idx * 0.1
        osc.frequency.setValueAtTime(note, startTime)
        gain.gain.setValueAtTime(0.06, startTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4)
        osc.connect(gain)
        gain.connect(this.ctx.destination)
        osc.start(startTime)
        osc.stop(startTime + 0.4)
      })
    } catch {
      // Ignore audio errors
    }
  }

  public playSilenceFinale() {
    if (!this.enabled) return
    try {
      this.initCtx()
      if (!this.ctx) return

      const now = this.ctx.currentTime + 0.01

      // C2: Subaquatic Low-pass Filter (Ben Braddock Pool Drift)
      const subaquaticFilter = this.ctx.createBiquadFilter()
      subaquaticFilter.type = 'lowpass'
      subaquaticFilter.frequency.setValueAtTime(3200, now)
      subaquaticFilter.frequency.exponentialRampToValueAtTime(480, now + 4.8)
      subaquaticFilter.Q.setValueAtTime(1.0, now)
      subaquaticFilter.Q.linearRampToValueAtTime(2.8, now + 4.8)

      // C1: Acoustic Fade down to -60 dB
      const masterGain = this.ctx.createGain()
      masterGain.gain.setValueAtTime(0.08, now)
      masterGain.gain.exponentialRampToValueAtTime(0.00001, now + 6.8)

      subaquaticFilter.connect(masterGain)
      masterGain.connect(this.ctx.destination)

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
        { f: 587.33, t: 3.48, d: 3.50, p: 0.038 }
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

      // 4 Latin shaker strokes: "chik-chik-chiki-CHA!"
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
        filter.frequency.value = idx === 3 ? 4800 : 5600
        filter.Q.value = 3.2
        const gain = this.ctx.createGain()
        gain.gain.setValueAtTime(0.01, now + offset)
        gain.gain.linearRampToValueAtTime(idx === 3 ? 0.75 : 0.48, now + offset + 0.018)
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + (idx === 3 ? 0.16 : 0.075))
        src.connect(filter)
        filter.connect(gain)
        gain.connect(this.ctx.destination)
        src.start(now + offset)
      })

      // Accent palm tap on final stroke
      const tapOsc = this.ctx.createOscillator()
      const tapGain = this.ctx.createGain()
      tapOsc.type = 'triangle'
      tapOsc.frequency.setValueAtTime(140, now + 0.40)
      tapOsc.frequency.exponentialRampToValueAtTime(45, now + 0.52)
      tapGain.gain.setValueAtTime(0.45, now + 0.40)
      tapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.54)
      tapOsc.connect(tapGain)
      tapGain.connect(this.ctx.destination)
      tapOsc.start(now + 0.40)
      tapOsc.stop(now + 0.55)
    } catch {
      // Ignore audio errors
    }
  }
}

export const sound = new SoundEngine()

