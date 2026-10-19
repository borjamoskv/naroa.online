import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sound } from '../utils/audio'

export type ActiveMode = 'horizon' | '3d'

export interface NavigationPillProps {
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

export function NavigationPill({
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
}: NavigationPillProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Cerrar menú al redimensionar a pantalla grande (> 1024px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Bloquear scroll de fondo cuando el menú móvil está abierto
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = ''
      }
    }
  }, [mobileMenuOpen])

  const handleAction = (action: () => void, hash?: string) => {
    sound.playHapticClick(1.05)
    action()
    if (hash) {
      window.location.hash = hash
    }
    setMobileMenuOpen(false)
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        zIndex: 1000,
        background: 'rgba(5, 5, 8, 0.88)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.22)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.85), 0 1px 0 rgba(212, 175, 55, 0.1)',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px clamp(16px, 3.2vw, 44px)',
          maxWidth: '1680px',
          margin: '0 auto',
        }}
      >
        {/* LOGO NAROA.ONLINE + MICRO-CONTADOR CURATORIAL */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <a
            href="#/"
            data-cursor="HOME"
            onClick={(e) => {
              e.preventDefault()
              handleAction(() => onSelectMode('horizon'), '#/')
            }}
            style={{
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              cursor: 'pointer',
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
                lineHeight: 1,
              }}
            >
              <span>NAROA</span>
              <span style={{ color: '#D4AF37' }}>.ONLINE</span>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.55rem',
                color: 'rgba(212, 175, 55, 0.75)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginTop: '3px',
              }}
            >
              DIGITAL PLAYGROUND
            </span>
          </a>

          {/* Micro-contador Curatorial de Obra Activa */}
          <div
            className="desktop-only"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '4px',
              paddingLeft: '14px',
              borderLeft: '1px solid rgba(212, 175, 55, 0.25)',
              userSelect: 'none',
            }}
          >
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
            <span style={{ color: 'rgba(212, 175, 55, 0.4)', fontSize: '0.7rem' }}>/</span>
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

        {/* ENLACES PRINCIPALES DESKTOP (HAUTE COUTURE) */}
        <nav
          className="nav-desktop-links"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {/* MODO EXPOSICIÓN (HORIZONTE) */}
          <button
            data-cursor="HORIZONTE"
            onClick={() => handleAction(() => onSelectMode('horizon'), '#/')}
            style={{
              background: activeMode === 'horizon' ? 'rgba(212, 175, 55, 0.16)' : 'transparent',
              border: activeMode === 'horizon' ? '1px solid rgba(212, 175, 55, 0.5)' : '1px solid transparent',
              color: activeMode === 'horizon' ? '#D4AF37' : 'rgba(255, 255, 255, 0.72)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.72rem',
              fontWeight: activeMode === 'horizon' ? 700 : 500,
              letterSpacing: '0.14em',
              padding: '6px 14px',
              borderRadius: '24px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              if (activeMode !== 'horizon') {
                e.currentTarget.style.color = '#FFFFFF'
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
              }
            }}
            onMouseLeave={(e) => {
              if (activeMode !== 'horizon') {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.72)'
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            EXPOSICIÓN
          </button>

          {/* MODO 3D EXPERIMENTS */}
          <button
            data-cursor="3D EXP"
            onClick={() => handleAction(() => onSelectMode('3d'), '#/experiments')}
            style={{
              background: activeMode === '3d' ? 'rgba(212, 175, 55, 0.16)' : 'transparent',
              border: activeMode === '3d' ? '1px solid rgba(212, 175, 55, 0.5)' : '1px solid transparent',
              color: activeMode === '3d' ? '#D4AF37' : 'rgba(255, 255, 255, 0.72)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.72rem',
              fontWeight: activeMode === '3d' ? 700 : 500,
              letterSpacing: '0.14em',
              padding: '6px 14px',
              borderRadius: '24px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              if (activeMode !== '3d') {
                e.currentTarget.style.color = '#FFFFFF'
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
              }
            }}
            onMouseLeave={(e) => {
              if (activeMode !== '3d') {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.72)'
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            3D EXPERIMENTS
          </button>

          {/* ARCHIVO / CATÁLOGO COMPLETO */}
          <button
            data-cursor="CATÁLOGO"
            onClick={() => handleAction(onOpenIndex, '#/archive')}
            style={{
              background: 'transparent',
              border: '1px solid transparent',
              color: 'rgba(255, 255, 255, 0.72)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.72rem',
              fontWeight: 500,
              letterSpacing: '0.14em',
              padding: '6px 14px',
              borderRadius: '24px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#D4AF37'
              e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.72)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            ARCHIVO ({totalArtworks})
          </button>

          {/* PROCESO / ATELIER */}
          <button
            data-cursor="ATELIER"
            onClick={() => handleAction(onOpenArtist, '#/process')}
            style={{
              background: 'transparent',
              border: '1px solid transparent',
              color: 'rgba(255, 255, 255, 0.72)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.72rem',
              fontWeight: 500,
              letterSpacing: '0.14em',
              padding: '6px 14px',
              borderRadius: '24px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#D4AF37'
              e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.72)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            PROCESO / TALLER
          </button>

          {/* ENCARGOS BESPOKE */}
          <button
            data-cursor="BESPOKE"
            onClick={() => handleAction(onOpenCommission, '#/encargos')}
            style={{
              background: 'rgba(212, 175, 55, 0.14)',
              border: '1px solid rgba(212, 175, 55, 0.45)',
              color: '#D4AF37',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              padding: '6px 14px',
              borderRadius: '24px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              boxShadow: '0 0 14px rgba(212, 175, 55, 0.15)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#D4AF37'
              e.currentTarget.style.color = '#000000'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(212, 175, 55, 0.14)'
              e.currentTarget.style.color = '#D4AF37'
            }}
          >
            ⚡ ENCARGOS
          </button>

          {/* MICA SYSTEM ASISTENTE */}
          {onToggleMica && (
            <button
              data-cursor="MICA AI"
              onClick={() => handleAction(onToggleMica, isMicaOpen ? '#/' : '#/mica')}
              style={{
                background: isMicaOpen ? '#D4AF37' : 'rgba(255, 255, 255, 0.05)',
                border: isMicaOpen ? '1px solid #FFFFFF' : '1px solid rgba(212, 175, 55, 0.35)',
                color: isMicaOpen ? '#000000' : '#D4AF37',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.14em',
                padding: '6px 12px',
                borderRadius: '24px',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>💎</span>
              <span>MICA</span>
            </button>
          )}

          {/* SEPARADOR VERTICAL */}
          <div style={{ width: '1px', height: '14px', background: 'rgba(212, 175, 55, 0.25)', margin: '0 4px' }} />

          {/* ENLACE CRUZADO INSTITUCIONAL */}
          <a
            href="https://naroagutierrezgil.com"
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="MUSEO ↗"
            onClick={() => sound.playTick()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              padding: '6px 14px',
              borderRadius: '24px',
              color: 'rgba(255, 255, 255, 0.85)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.7rem',
              letterSpacing: '0.12em',
              textDecoration: 'none',
              transition: 'all 0.25s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#D4AF37'
              e.currentTarget.style.color = '#D4AF37'
              e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.25)'
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)'
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
            }}
          >
            <span>🏛️</span>
            <span>EL MUSEO ↗</span>
          </a>
        </nav>

        {/* ACCIONES DERECHA: AUDIO BANDA SONORA + BOTÓN MÓVIL */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* BOTÓN BANDA SONORA "BOARDS OF BURGOS" */}
          <button
            onClick={() => {
              sound.playTick()
              toggleAudio()
            }}
            title={audioActive ? 'Banda Sonora Activa: Boards of Burgos (Borja Moskv)' : 'Activar Audio Ambiental'}
            style={{
              background: audioActive ? 'rgba(212, 175, 55, 0.12)' : 'rgba(5, 5, 8, 0.65)',
              border: '1px solid ' + (audioActive ? 'rgba(212, 175, 55, 0.45)' : 'rgba(255, 255, 255, 0.15)'),
              color: audioActive ? '#D4AF37' : 'rgba(255, 255, 255, 0.55)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.7rem',
              padding: '6px 14px',
              borderRadius: '24px',
              cursor: 'pointer',
              letterSpacing: '0.12em',
              transition: 'all 0.25s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
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
            <span className="audio-btn-text" style={{ fontSize: '0.66rem' }}>
              {audioActive ? 'BOARDS OF BURGOS' : 'SONIDO'}
            </span>
          </button>

          {/* BOTÓN HAMBURGUESA RESPONSIVE PARA MÓVIL/TABLET */}
          <button
            className="nav-mobile-toggle"
            onClick={() => {
              sound.playTick()
              setMobileMenuOpen((prev) => !prev)
            }}
            aria-label="Abrir menú de navegación"
            style={{
              background: mobileMenuOpen ? 'rgba(212, 175, 55, 0.2)' : 'rgba(5, 5, 8, 0.8)',
              border: '1px solid ' + (mobileMenuOpen ? '#D4AF37' : 'rgba(212, 175, 55, 0.4)'),
              color: '#D4AF37',
              fontSize: '1.15rem',
              padding: '6px 13px',
              borderRadius: '20px',
              cursor: 'pointer',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* DRAWER RESPONSIVE MÓVIL FULL-SCREEN DE ALTA GAMA */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="nav-mobile-drawer"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              top: '100%',
              left: 0,
              right: 0,
              height: 'calc(100vh - 65px)',
              overflowY: 'auto',
              background: 'rgba(5, 5, 8, 0.98)',
              backdropFilter: 'blur(36px)',
              WebkitBackdropFilter: 'blur(36px)',
              borderTop: '1px solid rgba(212, 175, 55, 0.22)',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.95)',
              padding: '24px clamp(18px, 6vw, 36px) 48px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* EXPOSICIÓN */}
              <button
                onClick={() => handleAction(() => onSelectMode('horizon'), '#/')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: activeMode === 'horizon' ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: activeMode === 'horizon' ? '1px solid rgba(212, 175, 55, 0.5)' : '1px solid rgba(255, 255, 255, 0.07)',
                  color: activeMode === 'horizon' ? '#D4AF37' : '#FFFFFF',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.9rem',
                  letterSpacing: '0.14em',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>🏛️ EXPOSICIÓN (HORIZONTE)</span>
                {activeMode === 'horizon' && <span style={{ color: '#D4AF37' }}>●</span>}
              </button>

              {/* 3D EXPERIMENTS */}
              <button
                onClick={() => handleAction(() => onSelectMode('3d'), '#/experiments')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: activeMode === '3d' ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: activeMode === '3d' ? '1px solid rgba(212, 175, 55, 0.5)' : '1px solid rgba(255, 255, 255, 0.07)',
                  color: activeMode === '3d' ? '#D4AF37' : '#FFFFFF',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.9rem',
                  letterSpacing: '0.14em',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>🌀 3D EXPERIMENTS</span>
                {activeMode === '3d' && <span style={{ color: '#D4AF37' }}>●</span>}
              </button>

              {/* ARCHIVO */}
              <button
                onClick={() => handleAction(onOpenIndex, '#/archive')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.9rem',
                  letterSpacing: '0.14em',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>📂 ARCHIVO COMPLETO ({totalArtworks})</span>
                <span style={{ color: 'rgba(212, 175, 55, 0.6)' }}>→</span>
              </button>

              {/* PROCESO / TALLER */}
              <button
                onClick={() => handleAction(onOpenArtist, '#/process')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.9rem',
                  letterSpacing: '0.14em',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>🎨 PROCESO / TALLER</span>
                <span style={{ color: 'rgba(212, 175, 55, 0.6)' }}>→</span>
              </button>

              {/* ENCARGOS */}
              <button
                onClick={() => handleAction(onOpenCommission, '#/encargos')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: 'rgba(212, 175, 55, 0.16)',
                  border: '1px solid rgba(212, 175, 55, 0.5)',
                  color: '#D4AF37',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '0 0 20px rgba(212, 175, 55, 0.12)',
                }}
              >
                <span>⚡ ENCARGOS BESPOKE</span>
                <span>→</span>
              </button>

              {/* MICA */}
              {onToggleMica && (
                <button
                  onClick={() => handleAction(onToggleMica, '#/mica')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: '12px',
                    background: isMicaOpen ? 'rgba(212, 175, 55, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(212, 175, 55, 0.4)',
                    color: '#D4AF37',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>💎 ASISTENTE MICA SYSTEM</span>
                  <span>●</span>
                </button>
              )}

              {/* DOMINIO INSTITUCIONAL */}
              <a
                href="https://naroagutierrezgil.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sound.playTick()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.85rem',
                  letterSpacing: '0.12em',
                  textDecoration: 'none',
                }}
              >
                <span>🏛️ EL MUSEO (naroagutierrezgil.com)</span>
                <span>↗</span>
              </a>
            </div>

            {/* BOTONES DE CONTACTO DIRECTO */}
            <div
              style={{
                marginTop: '32px',
                paddingTop: '20px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                gap: '12px',
              }}
            >
              <a
                href="https://wa.me/34636060609?text=Hola%20Naroa%2C%20me%20gustar%C3%ADa%20informaci%C3%B3n%20sobre%20tus%20obras"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sound.playTick()}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: '#25D366',
                  color: '#000000',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  padding: '14px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  letterSpacing: '0.1em',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                WHATSAPP ↗
              </a>
              <a
                href="mailto:naroa@naroa.eu"
                onClick={() => sound.playTick()}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  padding: '14px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  letterSpacing: '0.1em',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                EMAIL ✉
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
