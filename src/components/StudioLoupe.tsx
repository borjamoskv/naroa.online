import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ARTWORKS } from '../artworks'
import { sound } from '../utils/audio'

interface StudioLoupeProps {
  artworkIndex: number | null
  onClose: () => void
  onNavigate: (index: number) => void
}

const ZOOM_LEVELS = [1.0, 2.5, 4.0] as const

export function StudioLoupe({ artworkIndex, onClose, onNavigate }: StudioLoupeProps) {
  const [zoomLevelIndex, setZoomLevelIndex] = useState(1) // 2.5x default
  const [lensOrigin, setLensOrigin] = useState({ x: 50, y: 50 })
  const imageContainerRef = useRef<HTMLDivElement>(null)

  const isOpen = artworkIndex !== null
  const currentArtwork = isOpen ? ARTWORKS[artworkIndex] : null
  const currentZoom = ZOOM_LEVELS[zoomLevelIndex]

  const handleNext = useCallback(() => {
    if (artworkIndex === null) return
    sound.playTick()
    onNavigate((artworkIndex + 1) % ARTWORKS.length)
  }, [artworkIndex, onNavigate])

  const handlePrev = useCallback(() => {
    if (artworkIndex === null) return
    sound.playTick()
    onNavigate((artworkIndex - 1 + ARTWORKS.length) % ARTWORKS.length)
  }, [artworkIndex, onNavigate])

  // ESC y flechas de teclado
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sound.playClose()
        onClose()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === '+' || e.key === '=') {
        setZoomLevelIndex((prev) => Math.min(prev + 1, ZOOM_LEVELS.length - 1))
      } else if (e.key === '-') {
        setZoomLevelIndex((prev) => Math.max(prev - 1, 0))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, handleNext, handlePrev])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = imageContainerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    setLensOrigin({ x: Math.round(x), y: Math.round(y) })
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation()
    if (e.deltaY < -20) {
      setZoomLevelIndex((prev) => Math.min(prev + 1, ZOOM_LEVELS.length - 1))
    } else if (e.deltaY > 20) {
      setZoomLevelIndex((prev) => Math.max(prev - 1, 0))
    }
  }

  return (
    <AnimatePresence>
      {isOpen && currentArtwork && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(2, 2, 4, 0.96)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px clamp(16px, 4vw, 48px)',
            boxSizing: 'border-box',
            userSelect: 'none',
          }}
          onClick={onClose}
        >
          {/* BARRA SUPERIOR DE CONTROL */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              maxWidth: '1600px',
              margin: '0 auto',
              zIndex: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.8rem',
                  color: '#D4AF37',
                  letterSpacing: '0.2em',
                  fontWeight: 700,
                }}
              >
                {String(artworkIndex + 1).padStart(2, '0')} / {String(ARTWORKS.length).padStart(2, '0')}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>

              {/* SELECTORES DE ZOOM MACRO */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {ZOOM_LEVELS.map((lvl, idx) => {
                  const isActive = idx === zoomLevelIndex
                  const labels = ['1.0× GLOBAL', '2.5× MACRO', '4.0× FÓSIL']
                  return (
                    <button
                      key={lvl}
                      onClick={() => {
                        sound.playTick()
                        setZoomLevelIndex(idx)
                      }}
                      style={{
                        background: isActive ? 'rgba(212, 175, 55, 0.18)' : 'transparent',
                        border: '1px solid ' + (isActive ? '#D4AF37' : 'rgba(255, 255, 255, 0.15)'),
                        color: isActive ? '#D4AF37' : 'rgba(255, 255, 255, 0.55)',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '0.68rem',
                        padding: '3px 10px',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        letterSpacing: '0.1em',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {labels[idx]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* BOTÓN CERRAR ESC */}
            <button
              onClick={() => {
                sound.playClose()
                onClose()
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                color: '#D4AF37',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.76rem',
                letterSpacing: '0.15em',
                padding: '8px 18px',
                borderRadius: '30px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#D4AF37'
                e.currentTarget.style.background = '#D4AF37'
                e.currentTarget.style.color = '#000000'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.3)'
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#D4AF37'
              }}
            >
              <span>CERRAR</span>
              <span style={{ opacity: 0.6 }}>ESC</span>
            </button>
          </div>

          {/* ÁREA CENTRAL DE LA OBRA (ZOOM ALTA DEFINICIÓN) */}
          <div
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              margin: '12px 0',
            }}
          >
            {/* NAVEGACIÓN PREV / NEXT LATERAL */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handlePrev()
              }}
              aria-label="Obra anterior"
              style={{
                position: 'absolute',
                left: '0px',
                zIndex: 25,
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                padding: '24px',
                fontSize: '2.4rem',
                fontFamily: 'var(--font-serif, serif)',
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#D4AF37')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)')}
            >
              ‹
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                handleNext()
              }}
              aria-label="Obra siguiente"
              style={{
                position: 'absolute',
                right: '0px',
                zIndex: 25,
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                padding: '24px',
                fontSize: '2.4rem',
                fontFamily: 'var(--font-serif, serif)',
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#D4AF37')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)')}
            >
              ›
            </button>

            {/* CONTENEDOR DE LA IMAGEN CON LUPA DE PROFUNDIDAD */}
            <div
              ref={imageContainerRef}
              onMouseMove={handleMouseMove}
              onWheel={handleWheel}
              onClick={(e) => {
                e.stopPropagation()
                sound.playTick()
                setZoomLevelIndex((prev) => (prev + 1) % ZOOM_LEVELS.length)
              }}
              style={{
                position: 'relative',
                maxHeight: 'min(78vh, 800px)',
                maxWidth: 'min(90vw, 960px)',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: currentZoom > 1 ? 'crosshair' : 'zoom-in',
                overflow: 'hidden',
              }}
            >
              <motion.img
                key={currentArtwork.id}
                src={currentArtwork.url}
                alt={currentArtwork.title}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                  opacity: 1,
                  scale: currentZoom,
                  transformOrigin: `${lensOrigin.x}% ${lensOrigin.y}%`,
                }}
                transition={{
                  scale: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.4 },
                }}
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.95))',
                }}
              />

              {/* FOCO ESPECULAR DINÁMICO */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `radial-gradient(circle 280px at ${lensOrigin.x}% ${lensOrigin.y}%, rgba(212, 175, 55, 0.28) 0%, rgba(255, 255, 255, 0.08) 25%, transparent 70%)`,
                  mixBlendMode: 'overlay',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>

          {/* PLACA INFERIOR MINIMALISTA */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              maxWidth: '800px',
              margin: '0 auto',
              zIndex: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
                color: '#FFFFFF',
                letterSpacing: '0.12em',
                margin: 0,
                textTransform: 'uppercase',
              }}
            >
              {currentArtwork.title}
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-editorial, "Cormorant Garamond", Georgia, serif)',
                fontStyle: 'italic',
                fontSize: '1.1rem',
                color: '#D4AF37',
                letterSpacing: '0.05em',
                margin: '4px 0 0',
              }}
            >
              {currentArtwork.year} · {currentArtwork.medium}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
