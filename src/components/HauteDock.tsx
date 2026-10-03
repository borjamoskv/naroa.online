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
  onOpenCommission: () => void
  isMicaOpen?: boolean
  onToggleMica?: () => void
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
  onOpenCommission,
  isMicaOpen,
  onToggleMica,
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
        {/* LOGO NAROA.ONLINE + SUBTÍTULO EXPERIMENTAL + CONTADOR */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a
            href="#/lab"
            onClick={(e) => {
              e.preventDefault()
              sound.playTick()
              onSelectMode('horizon')
              window.location.hash = '#/lab'
            }}
            style={{
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '0.14em',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                textShadow: '0 2px 10px rgba(0,0,0,0.8)',
              }}
            >
              <span>NAROA</span>
              <span style={{ color: '#D4AF37' }}>.ONLINE</span>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.58rem',
                color: 'rgba(212, 175, 55, 0.75)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginTop: '-2px',
              }}
            >
              DIGITAL PLAYGROUND
            </span>
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

        {/* ENLACE CRUZADO CANÓNICO AL DOMINIO INSTITUCIONAL ("EL MUSEO") */}
        <div style={{ pointerEvents: 'auto' }} className="desktop-only">
          <a
            href="https://naroagutierrezgil.com"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => sound.playTick()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(5, 5, 8, 0.75)',
              border: '1px solid rgba(212, 175, 55, 0.32)',
              padding: '6px 16px',
              borderRadius: '24px',
              color: 'rgba(255, 255, 255, 0.85)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.7rem',
              letterSpacing: '0.12em',
              textDecoration: 'none',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              transition: 'all 0.25s ease',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#D4AF37'
              e.currentTarget.style.color = '#D4AF37'
              e.currentTarget.style.background = 'rgba(212, 175, 55, 0.12)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.32)'
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)'
              e.currentTarget.style.background = 'rgba(5, 5, 8, 0.75)'
            }}
            title="Ir al dominio principal: Obra canónica, bio, exposiciones y prensa"
          >
            <span style={{ fontSize: '0.85rem' }}>🏛️</span>
            <span>Obra y trayectoria / naroagutierrezgil.com ↗</span>
          </a>
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
        {/* BOTÓN LABORATORIO */}
        <button
          data-cursor="HORIZONTE"
          onClick={() => {
            sound.playHapticClick(1.0)
            onSelectMode('horizon')
            window.location.hash = '#/lab'
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
          LABORATORIO
        </button>

        {/* BOTÓN PABELLÓN 3D EXPERIMENTS */}
        <button
          data-cursor="3D EXP"
          onClick={() => {
            sound.playHapticClick(1.1)
            onSelectMode('3d')
            window.location.hash = '#/experiments'
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
          3D EXPERIMENTS
        </button>

        {/* BOTÓN ARCHIVO CANÓNICO */}
        <button
          data-cursor="CATÁLOGO"
          onClick={() => {
            sound.playHapticClick(1.0)
            onOpenIndex()
            window.location.hash = '#/archive'
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
          ARCHIVO ({totalArtworks})
        </button>

        {/* BOTÓN PROCESO / TALLER */}
        <button
          data-cursor="ATELIER"
          onClick={() => {
            sound.playHapticClick(1.0)
            onOpenArtist()
            window.location.hash = '#/process'
          }}
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            color: 'rgba(255, 255, 255, 0.75)',
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
            e.currentTarget.style.background = 'rgba(212, 175, 55, 0.14)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          PROCESO / TALLER
        </button>

        {/* BOTÓN ENCARGOS BESPOKE */}
        <button
          data-cursor="BESPOKE"
          onClick={() => {
            sound.playHapticClick(1.2)
            onOpenCommission()
          }}
          style={{
            background: 'rgba(212, 175, 55, 0.16)',
            border: '1px solid rgba(212, 175, 55, 0.45)',
            color: '#D4AF37',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.14em',
            padding: '7px 15px',
            borderRadius: '30px',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            boxShadow: '0 0 15px rgba(212, 175, 55, 0.15)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#D4AF37'
            e.currentTarget.style.color = '#000000'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(212, 175, 55, 0.16)'
            e.currentTarget.style.color = '#D4AF37'
          }}
        >
          ⚡ ENCARGOS
        </button>

        {/* BOTÓN ASISTENTE MICA SYSTEM */}
        {onToggleMica && (
          <button
            data-cursor="MICA AI"
            onClick={() => {
              sound.playHapticClick(1.15)
              onToggleMica()
            }}
            title="Abrir Asistente MICA SYSTEM v∞"
            style={{
              background: isMicaOpen ? '#D4AF37' : 'rgba(255, 255, 255, 0.06)',
              border: isMicaOpen ? '1px solid #FFFFFF' : '1px solid rgba(212, 175, 55, 0.35)',
              color: isMicaOpen ? '#000000' : '#D4AF37',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              padding: '7px 14px',
              borderRadius: '30px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              if (!isMicaOpen) {
                e.currentTarget.style.background = 'rgba(212, 175, 55, 0.18)'
                e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.6)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isMicaOpen) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.35)'
              }
            }}
          >
            <span>💎</span>
            <span>MICA</span>
          </button>
        )}

        {/* SEPARADOR SUTIL */}
        <div style={{ width: '1px', height: '14px', background: 'rgba(212, 175, 55, 0.25)', margin: '0 2px' }} />

        {/* ENLACE INSTITUCIONAL DIRECTO */}
        <a
          href="https://naroagutierrezgil.com"
          target="_blank"
          rel="noopener noreferrer"
          data-cursor="MUSEO ↗"
          onClick={() => sound.playHapticClick(1.0)}
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            color: 'rgba(255, 255, 255, 0.75)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.72rem',
            letterSpacing: '0.14em',
            padding: '7px 14px',
            borderRadius: '30px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#D4AF37'
            e.currentTarget.style.background = 'rgba(212, 175, 55, 0.14)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <span>🏛️</span>
          <span>EL MUSEO ↗</span>
        </a>
      </nav>
    </>
  )
}
