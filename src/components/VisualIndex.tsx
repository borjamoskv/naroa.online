import { motion } from 'framer-motion'
import { ARTWORKS } from '../artworks'
import { sound } from '../utils/audio'

interface VisualIndexProps {
  isOpen: boolean
  onClose: () => void
  onSelectArtwork: (index: number) => void
}

export function VisualIndex({ isOpen, onClose, onSelectArtwork }: VisualIndexProps) {
  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(2, 2, 4, 0.97)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* BARRA SUPERIOR FIJA */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(2, 2, 4, 0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(212, 175, 55, 0.15)',
          padding: '20px clamp(20px, 4vw, 56px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1680px',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
              fontSize: '1.1rem',
              letterSpacing: '0.14em',
              color: '#FFFFFF',
              fontWeight: 600,
            }}
          >
            ÍNDICE VISUAL
          </span>
          <span style={{ color: 'rgba(212, 175, 55, 0.4)' }}>·</span>
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.75rem',
              color: '#D4AF37',
              letterSpacing: '0.2em',
            }}
          >
            27 OBRAS CANÓNICAS
          </span>
        </div>

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
            padding: '8px 20px',
            borderRadius: '30px',
            cursor: 'pointer',
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
          CERRAR ÍNDICE ✕
        </button>
      </div>

      {/* GRID EDITORIAL ASIMÉTRICO DE ALTA COSTURA */}
      <div
        style={{
          maxWidth: '1680px',
          margin: '0 auto',
          padding: '40px clamp(20px, 4vw, 56px) 120px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(240px, 22vw, 360px), 1fr))',
          gap: 'clamp(24px, 3vw, 48px)',
        }}
      >
        {ARTWORKS.map((artwork, idx) => (
          <motion.div
            key={artwork.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: Math.min(idx * 0.025, 0.4), ease: [0.16, 1, 0.3, 1] }}
            onClick={() => {
              sound.playOpen()
              onSelectArtwork(idx)
              onClose()
            }}
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              transition: 'transform 0.35s ease',
            }}
            whileHover={{ y: -6 }}
          >
            {/* Contenedor de la Imagen */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '3/4',
                background: '#040407',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                boxShadow: '0 15px 35px rgba(0, 0, 0, 0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                boxSizing: 'border-box',
              }}
            >
              <img
                src={artwork.url}
                alt={artwork.title}
                loading="lazy"
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.9))',
                  transition: 'transform 0.4s ease, filter 0.4s ease',
                }}
              />

              {/* Número de Colección Monospace */}
              <span
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.68rem',
                  letterSpacing: '0.15em',
                  color: 'rgba(212, 175, 55, 0.75)',
                }}
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
            </div>

            {/* Metadatos Curatorial */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <h3
                style={{
                  fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: '#FFFFFF',
                  margin: 0,
                  lineHeight: 1.2,
                  textTransform: 'uppercase',
                }}
              >
                {artwork.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-editorial, "Cormorant Garamond", Georgia, serif)',
                  fontStyle: 'italic',
                  fontSize: '0.92rem',
                  color: '#D4AF37',
                  margin: 0,
                  letterSpacing: '0.04em',
                }}
              >
                {artwork.medium}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
