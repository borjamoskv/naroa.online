import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sound, WEEKDAY_THEMES } from '../utils/audio'

const NOTE_NAMES: Record<number, string> = {
  62: 'Re3', 65: 'Fa3', 67: 'Sol3', 69: 'La3', 70: 'Sib3', 71: 'Si3', 72: 'Do4', 73: 'Do#4',
  74: 'Re4', 75: 'Mib4', 76: 'Mi4', 77: 'Fa4', 78: 'Fa#4', 79: 'Sol4', 81: 'La4', 82: 'Sib4', 83: 'Si4', 84: 'Do5', 86: 'Re5'
}

function getPitchName(midi: number | null): string {
  if (midi === null || midi === undefined) return 'Silencio'
  const rounded = Math.round(midi)
  return NOTE_NAMES[rounded] || `Re${Math.floor(rounded / 12) - 1}`
}

function getPhraseForStep(phrases: string[], stepIdx: number, defaultVerse: string): string {
  if (!phrases || phrases.length === 0) return defaultVerse || ''
  const s = stepIdx < 0 ? 0 : stepIdx % 32
  const pIdx = Math.min(phrases.length - 1, Math.floor(s / 8))
  return phrases[pIdx] || defaultVerse || ''
}

export function SoundDeckOverlay() {
  const [enabled, setEnabled] = useState<boolean>(sound.isEnabled())
  const [themeIndex, setThemeIndex] = useState<number>(sound.getSessionMelodyIndex())
  const [step, setStep] = useState<number>(sound.getStep())
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(sound.isAutoPlaying())
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [dismissed, setDismissed] = useState<boolean>(false)

  useEffect(() => {
    const unsubscribe = sound.subscribe(() => {
      setEnabled(sound.isEnabled())
      setThemeIndex(sound.getSessionMelodyIndex())
      setStep(sound.getStep())
      setIsAutoPlaying(sound.isAutoPlaying())
    })
    return () => unsubscribe()
  }, [])

  if (!enabled || dismissed) return null

  const theme = WEEKDAY_THEMES[themeIndex] || WEEKDAY_THEMES[0]
  const notes = theme.notes
  const currentNote = step >= 0 && step < notes.length ? notes[step] : null
  const currentPitchLabel = getPitchName(currentNote)
  const stepNumber = step < 0 ? 1 : (step % notes.length) + 1
  const stepStr = String(stepNumber).padStart(2, '0')
  const progressPct = Math.round((stepNumber / notes.length) * 100)
  const currentPhrase = getPhraseForStep(theme.phrases, step, theme.verse)

  const reelsSvg = (
    <svg
      width="34"
      height="14"
      viewBox="0 0 38 16"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect x="1" y="1" width="36" height="14" rx="2" fill="none" stroke="rgba(247, 213, 148, 0.45)" strokeWidth="1" />
      <line x1="10" y1="4.5" x2="28" y2="4.5" stroke="rgba(247, 213, 148, 0.65)" strokeWidth="0.8" />
      <g className={isAutoPlaying || step >= 0 ? 'sc-reel-left-anim' : ''} style={{ transformOrigin: '10px 8px' }}>
        <circle cx="10" cy="8" r="4.2" fill="none" stroke="#f7d594" strokeWidth="0.8" />
        <circle cx="10" cy="8" r="1.2" fill="#f7d594" />
        <line x1="10" y1="3.8" x2="10" y2="6.8" stroke="#f7d594" strokeWidth="0.6" />
        <line x1="6.4" y1="10.1" x2="9" y2="8.6" stroke="#f7d594" strokeWidth="0.6" />
        <line x1="13.6" y1="10.1" x2="11" y2="8.6" stroke="#f7d594" strokeWidth="0.6" />
      </g>
      <g className={isAutoPlaying || step >= 0 ? 'sc-reel-right-anim' : ''} style={{ transformOrigin: '28px 8px' }}>
        <circle cx="28" cy="8" r="4.2" fill="none" stroke="#f7d594" strokeWidth="0.8" />
        <circle cx="28" cy="8" r="1.2" fill="#f7d594" />
        <line x1="28" y1="3.8" x2="28" y2="6.8" stroke="#f7d594" strokeWidth="0.6" />
        <line x1="24.4" y1="10.1" x2="27" y2="8.6" stroke="#f7d594" strokeWidth="0.6" />
        <line x1="31.6" y1="10.1" x2="29" y2="8.6" stroke="#f7d594" strokeWidth="0.6" />
      </g>
    </svg>
  )

  return (
    <AnimatePresence>
      <motion.aside
        aria-label="Aparato de música reactiva analógica"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          zIndex: 900,
          maxWidth: isExpanded ? '440px' : '360px',
          width: 'calc(100vw - 48px)',
          background: 'rgba(17, 18, 15, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(247, 213, 148, 0.28)',
          borderRadius: '16px',
          padding: isExpanded ? '16px 18px' : '12px 14px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.04)',
          color: '#fffdf4',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
          lineHeight: 1.4,
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* CABECERA: LÁMPARA PILOTO + REELS + ETIQUETA + MINIMIZAR / CERRAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {/* Lámpara piloto */}
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isAutoPlaying || step >= 0 ? '#00f0ff' : '#f7d594',
                boxShadow: isAutoPlaying || step >= 0 ? '0 0 8px #00f0ff' : '0 0 4px #f7d594',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            {reelsSvg}
            <span
              style={{
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#f7d594',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {theme.day} · {theme.title}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Plegar detalles' : 'Desplegar controles'}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(247, 213, 148, 0.22)',
                borderRadius: '999px',
                color: '#f7d594',
                fontSize: '10px',
                padding: '2px 8px',
                cursor: 'pointer',
              }}
            >
              {isExpanded ? 'Plegar' : 'Días'}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Ocultar aparato sónico"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 253, 244, 0.45)',
                fontSize: '16px',
                lineHeight: 1,
                cursor: 'pointer',
                padding: '0 4px',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* NOTA ACTIVA Y PASO */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
          <strong
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: 'italic',
              fontWeight: 300,
              fontSize: '16px',
              color: '#fffdf4',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {theme.subtitle}
          </strong>
          <span
            style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: '10px',
              fontWeight: 700,
              color: '#f7d594',
              background: 'rgba(247, 213, 148, 0.12)',
              border: '1px solid rgba(247, 213, 148, 0.25)',
              padding: '2px 6px',
              borderRadius: '4px',
              flexShrink: 0,
            }}
          >
            {currentPitchLabel} · {stepStr}/{notes.length}
          </span>
        </div>

        {/* VERSO POÉTICO */}
        {currentPhrase && (
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: '11px',
              color: 'rgba(255, 253, 244, 0.72)',
              fontStyle: 'italic',
              lineHeight: 1.35,
            }}
          >
            {currentPhrase}
          </p>
        )}

        {/* BARRA DE PROGRESO */}
        <div
          style={{
            height: '2px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '2px',
            overflow: 'hidden',
            marginBottom: isExpanded ? '12px' : '4px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #f7d594, #00f0ff)',
              transition: 'width 0.25s ease-out',
            }}
          />
        </div>

        {/* CONTROLES EXPANDIDOS (DÍAS DE LA SEMANA + BOTÓN CINTA) */}
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              paddingTop: '10px',
            }}
          >
            {/* SELECTOR SEMANAL L..D */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'space-between' }}>
              {WEEKDAY_THEMES.map((t, idx) => {
                const isCurrent = idx === themeIndex
                return (
                  <button
                    key={t.day}
                    type="button"
                    onClick={() => {
                      sound.playTick()
                      sound.selectTheme(idx)
                    }}
                    title={`${t.day}: ${t.title} (${t.subtitle})`}
                    aria-pressed={isCurrent}
                    style={{
                      flex: 1,
                      padding: '4px 0',
                      borderRadius: '6px',
                      background: isCurrent ? 'rgba(247, 213, 148, 0.24)' : 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid ' + (isCurrent ? '#f7d594' : 'rgba(255, 255, 255, 0.1)'),
                      color: isCurrent ? '#f7d594' : 'rgba(255, 255, 255, 0.6)',
                      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                      fontSize: '10px',
                      fontWeight: isCurrent ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    {t.shortDay}
                  </button>
                )
              })}
            </div>

            {/* BOTÓN MODO CINTA CONTINUA */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  sound.playTick()
                  sound.toggleAutoPlay()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isAutoPlaying ? 'rgba(0, 240, 255, 0.16)' : 'rgba(247, 213, 148, 0.12)',
                  border: '1px solid ' + (isAutoPlaying ? '#00f0ff' : 'rgba(247, 213, 148, 0.38)'),
                  color: isAutoPlaying ? '#00f0ff' : '#f7d594',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{isAutoPlaying ? '■' : '▸'}</span>
                <span>{isAutoPlaying ? 'Detener Cinta' : 'Cinta Continua'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playTick()
                  sound.setProceduralMelody()
                }}
                title="Generar haiku procedimental único e irrepetible"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: 'rgba(255, 253, 244, 0.65)',
                  padding: '5px 10px',
                  borderRadius: '999px',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                ✦ Procedural
              </button>
            </div>
          </motion.div>
        )}
      </motion.aside>
    </AnimatePresence>
  )
}
