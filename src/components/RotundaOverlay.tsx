import { useEffect, useCallback } from 'react'
import { ARTWORKS } from '../artworks'
import { sound } from '../utils/audio'

interface RotundaOverlayProps {
  onExit: () => void
  selectedIndex: number | null
  onSelectArtwork: (index: number | null) => void
  onInspectArtwork: (index: number) => void
  onOpenCommission: (title: string) => void
}

/**
 * Capa curatorial y contemplativa para la Rotonda 3D.
 * Principio: La obra es el centro absoluto; la interfaz se desvanece en silencio.
 */
export function RotundaOverlay({
  onExit,
  selectedIndex,
  onSelectArtwork,
  onInspectArtwork,
  onOpenCommission,
}: RotundaOverlayProps) {
  const selectedArtwork = selectedIndex !== null ? ARTWORKS[selectedIndex] : null

  const handlePrev = useCallback(() => {
    if (selectedIndex === null) return
    const prev = (selectedIndex - 1 + ARTWORKS.length) % ARTWORKS.length
    sound.playTick()
    onSelectArtwork(prev)
  }, [selectedIndex, onSelectArtwork])

  const handleNext = useCallback(() => {
    if (selectedIndex === null) return
    const next = (selectedIndex + 1) % ARTWORKS.length
    sound.playTick()
    onSelectArtwork(next)
  }, [selectedIndex, onSelectArtwork])

  // Navegación fluida por teclado (← / → para recorrer la rotonda, ESC para salir, Espacio/L/Z para lupa)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (selectedIndex === null) {
          onSelectArtwork(0)
        } else {
          handleNext()
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (selectedIndex === null) {
          onSelectArtwork(ARTWORKS.length - 1)
        } else {
          handlePrev()
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (selectedIndex !== null) {
          sound.playTick()
          onSelectArtwork(null)
        } else {
          onExit()
        }
      } else if (
        (e.key === ' ' || e.key === 'Enter' || e.key === 'l' || e.key === 'L' || e.key === 'z' || e.key === 'Z') &&
        selectedIndex !== null
      ) {
        e.preventDefault()
        sound.playOpen()
        onInspectArtwork(selectedIndex)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, handleNext, handlePrev, onSelectArtwork, onExit, onInspectArtwork])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px clamp(20px, 4vw, 48px)',
      }}
    >
      {/* Espacio superior para respetar el HauteDock cenital */}
      <div style={{ height: '72px', pointerEvents: 'none' }} />

      {/* ── CARTELA CURATORIAL DISCRETA AL ENFOCAR UNA OBRA ── */}
      {selectedArtwork && selectedIndex !== null ? (
        <div
          style={{
            pointerEvents: 'auto',
            alignSelf: 'center',
            marginBottom: '84px',
            background: 'rgba(8, 9, 13, 0.92)',
            border: '1px solid rgba(212, 175, 55, 0.22)',
            borderRadius: '18px',
            padding: '18px 28px',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(212, 175, 55, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxWidth: 'min(90vw, 580px)',
            textAlign: 'center',
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          {/* Micro-índice curatorial */}
          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.62rem',
              letterSpacing: '0.24em',
              color: 'rgba(212, 175, 55, 0.75)',
              textTransform: 'uppercase',
            }}
          >
            ROTONDA · OBRA {String(selectedIndex + 1).padStart(2, '0')} / {String(ARTWORKS.length).padStart(2, '0')}
          </div>

          {/* Kicker poético si existe */}
          {selectedArtwork.kicker && (
            <div
              style={{
                fontFamily: 'var(--font-editorial, "Cormorant Garamond", Georgia, serif)',
                fontStyle: 'italic',
                fontSize: '1.02rem',
                color: 'rgba(212, 175, 55, 0.95)',
                letterSpacing: '0.04em',
                lineHeight: 1.2,
              }}
            >
              «{selectedArtwork.kicker}»
            </div>
          )}

          {/* Título de la obra */}
          <div
            style={{
              fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
              fontSize: '1.3rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: '#FFFFFF',
            }}
          >
            {selectedArtwork.title}
          </div>

          {/* Ficha técnica esencial */}
          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.68rem',
              letterSpacing: '0.08em',
              color: 'rgba(212, 175, 55, 0.85)',
            }}
          >
            {selectedArtwork.year} · {selectedArtwork.medium}
          </div>

          {/* Cita de autor de Naroa si existe */}
          {selectedArtwork.quote && (
            <div
              style={{
                fontFamily: 'var(--font-editorial, "Cormorant Garamond", Georgia, serif)',
                fontStyle: 'italic',
                fontSize: '0.9rem',
                color: 'rgba(255, 255, 255, 0.7)',
                maxWidth: '460px',
                margin: '2px auto 6px',
                lineHeight: 1.4,
              }}
            >
              "{selectedArtwork.quote}"
            </div>
          )}

          {/* Botones de acción artística esenciales */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              marginTop: '4px',
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                handlePrev()
              }}
              title="Obra anterior (←)"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '1.1rem',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              ‹
            </button>

            <button
              onClick={() => {
                sound.playOpen()
                onInspectArtwork(selectedIndex)
              }}
              title="Inspeccionar textura con macro 2.5x (L / Z)"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                color: '#FFFFFF',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.68rem',
                letterSpacing: '0.12em',
                padding: '6px 16px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#D4AF37'
                e.currentTarget.style.color = '#D4AF37'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)'
                e.currentTarget.style.color = '#FFFFFF'
              }}
            >
              LUPA 2.5X
            </button>

            <button
              onClick={() => {
                sound.playTick()
                onOpenCommission(selectedArtwork.title)
              }}
              title="Solicitar encargo bespoke a medida"
              style={{
                background: 'rgba(212, 175, 55, 0.12)',
                border: '1px solid rgba(212, 175, 55, 0.45)',
                color: '#D4AF37',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.68rem',
                letterSpacing: '0.12em',
                padding: '6px 14px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#D4AF37'
                e.currentTarget.style.color = '#000000'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(212, 175, 55, 0.12)'
                e.currentTarget.style.color = '#D4AF37'
              }}
            >
              ENCARGO
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                handleNext()
              }}
              title="Siguiente obra (→)"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '1.1rem',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              ›
            </button>

            <button
              onClick={() => {
                sound.playTick()
                onSelectArtwork(null)
              }}
              title="Volver a la perspectiva general de la sala (ESC)"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                marginLeft: '6px',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        /* Sutil indicación contemplativa en reposo */
        <div
          style={{
            alignSelf: 'center',
            marginBottom: '84px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.65rem',
            letterSpacing: '0.18em',
            color: 'rgba(255, 255, 255, 0.35)',
            textTransform: 'uppercase',
          }}
        >
          DESLIZA PARA RECORRER · PULSA UNA OBRA PARA ACERCARTE (LUPA: L · ESC: SALIR)
        </div>
      )}
    </div>
  )
}

export const RotundaHUD = RotundaOverlay
export const VideogameHUD = RotundaOverlay
