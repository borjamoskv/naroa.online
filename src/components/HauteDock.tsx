import { motion } from 'framer-motion'
import { sound } from '../utils/audio'

export type ActiveMode = 'horizon' | '3d'

interface HauteDockProps {
  activeMode: ActiveMode
  currentIndex: number
  totalArtworks: number
  onSelectMode: (mode: ActiveMode) => void
  onOpenIndex: () => void
  onOpenArtist: () => void
  audioActive: boolean
  toggleAudio: () => void
}

export function HauteDock({
  activeMode,
  currentIndex,
  totalArtworks,
  onSelectMode,
  onOpenIndex,
  onOpenArtist,
  audioActive,
  toggleAudio,
}: HauteDockProps) {
  return (
    <>
      {/* CABECERA TOP MINIMALISTA FLOTANTE (ESTÉTICA MUSEO CARTIER / BIENAL) */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 150,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '22px clamp(16px, 3.5vw, 48px)',
          pointerEvents: 'none',
        }}
      >
        {/* LOGO NAROA. + CONTADOR INTEGRADO */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'baseline', gap: '14px' }}>
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault()
              sound.playTick()
              onSelectMode('horizon')
            }}
            style={{
              fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
              fontSize: '1.2rem',
              fontWeight: 700,
              color: '#FFFFFF',
              textDecoration: 'none',
              letterSpacing: '0.16em',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              textShadow: '0 2px 10px rgba(0,0,0,0.8)',
            }}
          >
            <span>NAROA</span>
            <span style={{ color: '#D4AF37' }}>.</span>
          </a>

          {/* Micro-contador Curatorial */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.78rem',
                color: '#D4AF37',
                letterSpacing: '0.15em',
                fontWeight: 700,
              }}
            >
              {String(currentIndex + 1).padStart(2, '0')}
            </span>
            <span style={{ color: 'rgba(212, 175, 55, 0.35)', fontSize: '0.7rem' }}>/</span>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.7rem',
                color: 'rgba(255, 255, 255, 0.45)',
                letterSpacing: '0.12em',
              }}
            >
              {String(totalArtworks).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* PALÍNDROMO AUTÉNTICO CENTRAL (WATERMARK FLOTANTE) */}
        <div
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.68rem',
            letterSpacing: '0.3em',
            color: 'rgba(212, 175, 55, 0.6)',
            textTransform: 'uppercase',
            pointerEvents: 'none',
          }}
          className="desktop-only"
        >
          AORAN / NAROA · A NAROA LA ORAN A
        </div>

        {/* BANDA SONORA "BOARDS OF BURGOS" (BORJA MOSKV) */}
        <div style={{ pointerEvents: 'auto' }}>
          <button
            onClick={() => {
              sound.playTick()
              toggleAudio()
            }}
            title={audioActive ? 'Banda Sonora Activa: Boards of Burgos (Borja Moskv)' : 'Activar Audio Ambiental'}
            style={{
              background: audioActive ? 'rgba(212, 175, 55, 0.12)' : 'rgba(5, 5, 8, 0.65)',
              border: '1px solid ' + (audioActive ? 'rgba(212, 175, 55, 0.45)' : 'rgba(255, 255, 255, 0.12)'),
              color: audioActive ? '#D4AF37' : 'rgba(255, 255, 255, 0.45)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.7rem',
              padding: '6px 14px',
              borderRadius: '24px',
              cursor: 'pointer',
              letterSpacing: '0.12em',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              transition: 'all 0.25s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '11px' }}>
              {[0.5, 1, 0.4].map((val, idx) => (
                <motion.span
                  key={idx}
                  animate={audioActive ? { height: ['3px', `${val * 11}px`, '3px'] } : { height: '3px' }}
                  transition={{ repeat: Infinity, duration: 0.65 + idx * 0.2, ease: 'easeInOut' }}
                  style={{
                    width: '2px',
                    background: audioActive ? '#D4AF37' : 'rgba(255, 255, 255, 0.4)',
                    borderRadius: '1px',
                    display: 'inline-block',
                  }}
                />
              ))}
            </div>
            <span className="desktop-only" style={{ fontSize: '0.66rem' }}>
              {audioActive ? 'BOARDS OF BURGOS' : 'SONIDO'}
            </span>
          </button>
        </div>
      </header>

      {/* DOCK FLOTANTE INFERIOR DE ALTA COSTURA (ZERO SCROLLBAR) */}
      <nav
        className="hide-scrollbar"
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 150,
          background: 'rgba(5, 5, 8, 0.88)',
          border: '1px solid rgba(212, 175, 55, 0.28)',
          borderRadius: '40px',
          padding: '5px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          boxShadow: '0 15px 40px rgba(0, 0, 0, 0.92), 0 0 30px rgba(212, 175, 55, 0.08)',
          maxWidth: '94vw',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        {/* BOTÓN EXPOSICIÓN HORIZONTE */}
        <button
          onClick={() => {
            sound.playTick()
            onSelectMode('horizon')
          }}
          style={{
            background: activeMode === 'horizon' ? 'rgba(212, 175, 55, 0.16)' : 'transparent',
            border: activeMode === 'horizon' ? '1px solid rgba(212, 175, 55, 0.5)' : '1px solid transparent',
            color: activeMode === 'horizon' ? '#D4AF37' : 'rgba(255, 255, 255, 0.65)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.72rem',
            fontWeight: activeMode === 'horizon' ? 700 : 500,
            letterSpacing: '0.14em',
            padding: '7px 14px',
            borderRadius: '30px',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
          }}
        >
          HORIZONTE
        </button>

        {/* BOTÓN ÍNDICE VISUAL */}
        <button
          onClick={() => {
            sound.playTick()
            onOpenIndex()
          }}
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            color: 'rgba(255, 255, 255, 0.65)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.72rem',
            letterSpacing: '0.14em',
            padding: '7px 14px',
            borderRadius: '30px',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#D4AF37'
            e.currentTarget.style.background = 'rgba(212, 175, 55, 0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          ÍNDICE ({totalArtworks})
        </button>

        {/* BOTÓN PABELLÓN 3D */}
        <button
          onClick={() => {
            sound.playTick()
            onSelectMode('3d')
          }}
          style={{
            background: activeMode === '3d' ? 'rgba(212, 175, 55, 0.16)' : 'transparent',
            border: activeMode === '3d' ? '1px solid rgba(212, 175, 55, 0.5)' : '1px solid transparent',
            color: activeMode === '3d' ? '#D4AF37' : 'rgba(255, 255, 255, 0.65)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.72rem',
            fontWeight: activeMode === '3d' ? 700 : 500,
            letterSpacing: '0.14em',
            padding: '7px 14px',
            borderRadius: '30px',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
          }}
        >
          PABELLÓN 3D
        </button>

        {/* SEPARADOR SUTIL */}
        <div style={{ width: '1px', height: '14px', background: 'rgba(212, 175, 55, 0.25)', margin: '0 2px' }} />

        {/* BOTÓN ARTISTA & ATELIER */}
        <button
          onClick={() => {
            sound.playTick()
            onOpenArtist()
          }}
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            color: '#D4AF37',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.72rem',
            letterSpacing: '0.14em',
            padding: '7px 14px',
            borderRadius: '30px',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(212, 175, 55, 0.14)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          ARTISTA & ATELIER ↗
        </button>
      </nav>
    </>
  )
}
