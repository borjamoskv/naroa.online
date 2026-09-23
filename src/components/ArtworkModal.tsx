import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ARTWORKS, type Artwork } from '../artworks'
import { sound } from '../utils/audio'
import { SplatViewerModal } from './SplatViewerModal'

interface ArtworkModalProps {
  artwork: Artwork | null
  currentIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export function ArtworkModal({ artwork, currentIndex, onClose, onNavigate }: ArtworkModalProps) {
  const touchStartX = useRef<number | null>(null)
  const [showSplat, setShowSplat] = useState(false)
  const [prevArtworkId, setPrevArtworkId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 })

  if (artwork && artwork.id !== prevArtworkId) {
    setPrevArtworkId(artwork.id)
    setShowSplat(false)
    setIsZoomed(false)
  }

  useEffect(() => {
    if (artwork) {
      sound.playOpen()
    }
  }, [artwork])

  // Teclado: ESC para cerrar, flechas para navegar
  useEffect(() => {
    if (!artwork) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isZoomed) {
          setIsZoomed(false)
        } else {
          onClose()
        }
      } else if (e.key === 'ArrowRight') {
        const next = (currentIndex + 1) % ARTWORKS.length
        onNavigate(next)
      } else if (e.key === 'ArrowLeft') {
        const prev = (currentIndex - 1 + ARTWORKS.length) % ARTWORKS.length
        onNavigate(prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [artwork, currentIndex, onClose, onNavigate, isZoomed])

  if (!artwork) return null

  const handleNext = () => {
    sound.playTick()
    const next = (currentIndex + 1) % ARTWORKS.length
    onNavigate(next)
  }

  const handlePrev = () => {
    sound.playTick()
    const prev = (currentIndex - 1 + ARTWORKS.length) % ARTWORKS.length
    onNavigate(prev)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const touchEndX = e.changedTouches[0].clientX
    const diffX = touchStartX.current - touchEndX
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        handleNext()
      } else {
        handlePrev()
      }
    }
    touchStartX.current = null
  }

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setZoomOrigin({ x, y })
  }

  const toggleZoom = (e: React.MouseEvent) => {
    e.stopPropagation()
    sound.playTick()
    setIsZoomed(prev => !prev)
  }

  const handleShare = async () => {
    sound.playTick()
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${artwork.title} — Naroa Gutiérrez Gil`,
          text: artwork.description,
          url: window.location.href,
        })
      } catch {
        // Share cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2200)
      } catch {
        // Clipboard fallback
      }
    }
  }

  const queryText = `Hola Naroa! Me interesa conocer la disponibilidad y detalles de la obra original "${artwork.title}" (${artwork.year}, ${artwork.medium}). ¿Podemos hablar de los detalles?`
  const artworkWhatsAppUrl = `https://wa.me/34636060609?text=${encodeURIComponent(queryText)}`

  return (
    <AnimatePresence>
      <div
        className="modal-backdrop"
        onClick={onClose}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-artwork-title"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(2, 2, 4, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <motion.div
          className="modal-content"
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            width: 'min(94vw, 1140px)',
            maxHeight: '92vh',
            background: 'rgba(8, 8, 12, 0.95)',
            border: '1px solid rgba(212, 175, 55, 0.4)',
            borderRadius: '20px',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 40px rgba(212, 175, 55, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Botón Cerrar */}
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              position: 'absolute',
              top: '18px',
              right: '20px',
              zIndex: 30,
              background: 'rgba(5, 5, 8, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#D4AF37'
              e.currentTarget.style.color = '#D4AF37'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              e.currentTarget.style.color = '#FFFFFF'
            }}
          >
            ✕
          </button>

          <div
            className="modal-body"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '32px',
              padding: 'clamp(20px, 4vw, 40px)',
              overflowY: 'auto',
              alignItems: 'center',
            }}
          >
            {/* Contenedor Fotográfico con Lupa Textura 200% */}
            <div
              className="modal-image-wrapper"
              onMouseMove={handleImageMouseMove}
              onClick={toggleZoom}
              style={{
                position: 'relative',
                borderRadius: '14px',
                overflow: 'hidden',
                background: '#030305',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9)',
                cursor: isZoomed ? 'zoom-out' : 'zoom-in',
                aspectRatio: '4/5',
                maxHeight: '580px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={artwork.id}
                  src={artwork.url}
                  alt={artwork.title}
                  className="modal-image"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{
                    opacity: 1,
                    scale: isZoomed ? 2.2 : 1,
                    transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                  }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </AnimatePresence>

              {/* Botón flotante para activar Lupa Textura */}
              <button
                onClick={toggleZoom}
                style={{
                  position: 'absolute',
                  bottom: '14px',
                  right: '14px',
                  zIndex: 20,
                  background: 'rgba(5, 5, 8, 0.8)',
                  border: '1px solid rgba(212, 175, 55, 0.4)',
                  color: isZoomed ? '#D4AF37' : '#FFFFFF',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.68rem',
                  letterSpacing: '0.1em',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  transition: 'all 0.2s ease',
                }}
              >
                {isZoomed ? 'SALIR DE LUPA [2X]' : '🔍 ZOOM TEXTURA'}
              </button>
            </div>

            {/* Información Curatorial de la Pieza */}
            <div
              className="modal-info"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '10px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.75rem',
                    color: '#D4AF37',
                    letterSpacing: '0.15em',
                  }}
                >
                  {String(currentIndex + 1).padStart(2, '0')} / {String(ARTWORKS.length).padStart(2, '0')}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                  }}
                >
                  {artwork.year}
                </span>
              </div>

              <h2
                id="modal-artwork-title"
                style={{
                  fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  lineHeight: 1.1,
                  color: '#FFFFFF',
                  margin: '0 0 10px 0',
                }}
              >
                {artwork.title}
              </h2>

              <div
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.82rem',
                  color: '#D4AF37',
                  letterSpacing: '0.08em',
                  marginBottom: '18px',
                }}
              >
                {artwork.medium}
              </div>

              <p
                style={{
                  color: 'rgba(255, 255, 255, 0.75)',
                  fontSize: '0.95rem',
                  lineHeight: 1.7,
                  margin: '0 0 28px 0',
                  fontWeight: 300,
                }}
              >
                {artwork.description}
              </p>

              {/* Acciones */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
                {artwork.splatUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      sound.playTick()
                      setShowSplat(true)
                    }}
                    style={{
                      background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(43,59,229,0.3) 100%)',
                      border: '1px solid #D4AF37',
                      color: '#FFFFFF',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      letterSpacing: '0.1em',
                      padding: '12px 20px',
                      borderRadius: '30px',
                      cursor: 'pointer',
                      boxShadow: '0 0 20px rgba(212, 175, 55, 0.25)',
                    }}
                  >
                    ✨ EXPLORAR 3DGS 360°
                  </button>
                )}

                <a
                  href={artworkWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => sound.playTick()}
                  style={{
                    background: '#25D366',
                    color: '#000000',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    letterSpacing: '0.08em',
                    padding: '12px 22px',
                    borderRadius: '30px',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 0 20px rgba(37, 211, 102, 0.3)',
                  }}
                  title="Consultar disponibilidad en WhatsApp"
                >
                  💬 CONSULTAR DISPONIBILIDAD ↗
                </a>

                <a
                  href="#/atelier"
                  onClick={() => {
                    sound.playTick()
                    onClose()
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#FFFFFF',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.8rem',
                    letterSpacing: '0.08em',
                    padding: '12px 20px',
                    borderRadius: '30px',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  SOLICITAR EN ESTE ESTILO ↗
                </a>

                <button
                  type="button"
                  onClick={handleShare}
                  style={{
                    background: copied ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: copied ? '1px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.15)',
                    color: copied ? '#D4AF37' : 'rgba(255,255,255,0.7)',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.78rem',
                    letterSpacing: '0.08em',
                    padding: '12px 18px',
                    borderRadius: '30px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {copied ? '✓ ENLACE COPIADO' : 'COMPARTIR ⎘'}
                </button>
              </div>

              {/* Botones de Navegación ← / → */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingTop: '16px',
                }}
              >
                <button
                  onClick={handlePrev}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.78rem',
                    letterSpacing: '0.12em',
                    cursor: 'pointer',
                    padding: '6px 0',
                    transition: 'color 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#D4AF37')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)')}
                >
                  ← ANTERIOR
                </button>
                <button
                  onClick={handleNext}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.78rem',
                    letterSpacing: '0.12em',
                    cursor: 'pointer',
                    padding: '6px 0',
                    transition: 'color 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#D4AF37')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)')}
                >
                  SIGUIENTE →
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {showSplat && artwork.splatUrl && (
        <SplatViewerModal
          splatUrl={artwork.splatUrl}
          title={artwork.title}
          onClose={() => setShowSplat(false)}
        />
      )}
    </AnimatePresence>
  )
}
