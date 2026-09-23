import { motion } from 'framer-motion'
import { sound } from '../utils/audio'

interface ArtistManifestoProps {
  isOpen: boolean
  onClose: () => void
}

export function ArtistManifesto({ isOpen, onClose }: ArtistManifestoProps) {
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
        zIndex: 600,
        background: 'rgba(2, 2, 4, 0.96)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        userSelect: 'none',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: '920px',
          width: '100%',
          background: 'rgba(6, 6, 10, 0.92)',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          borderRadius: '24px',
          padding: 'clamp(28px, 5vw, 56px)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 40px rgba(212, 175, 55, 0.1)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '40px',
          alignItems: 'center',
        }}
      >
        {/* BOTÓN CERRAR */}
        <button
          onClick={() => {
            sound.playClose()
            onClose()
          }}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '1.4rem',
            cursor: 'pointer',
            padding: '8px',
            lineHeight: 1,
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#D4AF37')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)')}
        >
          ✕
        </button>

        {/* RETRATO DE NAROA */}
        <div style={{ position: 'relative' }}>
          <img
            src="/assets/naroa-portrait-DW8XfHYG.webp"
            alt="Naroa Gutiérrez Gil — Artista Visual"
            style={{
              width: '100%',
              borderRadius: '16px',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              boxShadow: '0 20px 45px rgba(0,0,0,0.9)',
              display: 'block',
              objectFit: 'cover',
            }}
            onError={(e) => {
              e.currentTarget.src = '/assets/naroa-portrait-DW8XfHYG.jpg'
            }}
          />
        </div>

        {/* IDENTIDAD, PALÍNDROMO & ACCESO SOBERANO */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.72rem',
              color: '#D4AF37',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            ARTISTA VISUAL · BILBAO
          </span>

          <h2
            style={{
              fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
              fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: '#FFFFFF',
              margin: '0 0 6px 0',
              lineHeight: 1.05,
            }}
          >
            AORAN / <span style={{ color: '#D4AF37' }}>NAROA</span>
          </h2>

          <p
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              color: 'rgba(212, 175, 55, 0.9)',
              fontSize: '0.85rem',
              letterSpacing: '0.28em',
              margin: '0 0 28px 0',
              textTransform: 'uppercase',
            }}
          >
            A NAROA LA ORAN A
          </p>

          <p
            style={{
              fontFamily: 'var(--font-editorial, "Cormorant Garamond", Georgia, serif)',
              fontStyle: 'italic',
              fontSize: '1.25rem',
              color: 'rgba(255, 255, 255, 0.75)',
              lineHeight: 1.5,
              margin: '0 0 32px 0',
            }}
          >
            Pizarra natural, mica mineral, pan de oro y óleo en relieve sobre fractura fósil.
          </p>

          {/* ACCESOS DIRECTOS SIN RUIDO COMERCIAL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <a
              href="https://www.instagram.com/naroa_art/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => sound.playTick()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'rgba(212, 175, 55, 0.15)',
                border: '1px solid #D4AF37',
                color: '#D4AF37',
                padding: '12px 24px',
                borderRadius: '30px',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textDecoration: 'none',
                transition: 'all 0.25s ease',
                boxShadow: '0 0 20px rgba(212, 175, 55, 0.2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#D4AF37'
                e.currentTarget.style.color = '#000000'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(212, 175, 55, 0.15)'
                e.currentTarget.style.color = '#D4AF37'
              }}
            >
              INSTAGRAM (@naroa_art) ↗
            </a>

            <div style={{ display: 'flex', gap: '12px' }}>
              <a
                href="https://wa.me/34636060609?text=Hola%20Naroa%2C%20deseo%20consultar%20sobre%20tus%20obras%20y%20encargos"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sound.playTick()}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'rgba(255, 255, 255, 0.85)',
                  padding: '10px 16px',
                  borderRadius: '30px',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.1em',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#D4AF37'
                  e.currentTarget.style.color = '#D4AF37'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)'
                }}
              >
                WHATSAPP ATELIER ↗
              </a>

              <a
                href="mailto:naroa@naroa.eu"
                onClick={() => sound.playTick()}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'rgba(255, 255, 255, 0.85)',
                  padding: '10px 16px',
                  borderRadius: '30px',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.1em',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#FFFFFF'
                  e.currentTarget.style.color = '#FFFFFF'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)'
                }}
              >
                EMAIL ATELIER ✉
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
