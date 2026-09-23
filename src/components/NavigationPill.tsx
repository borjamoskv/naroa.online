import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sound } from '../utils/audio'

interface NavigationPillProps {
  currentView: 'home' | 'coleccion' | '3d' | 'artista' | 'atelier'
  audioActive: boolean
  toggleAudio: () => void
}

const NAV_ITEMS = [
  { view: 'home', label: 'EXPOSICIÓN', href: '#/' },
  { view: 'coleccion', label: 'CATÁLOGO', href: '#/coleccion' },
  { view: '3d', label: 'ESPACIO 3D', href: '#/3d' },
  { view: 'artista', label: 'ARTISTA', href: '#/artista' },
  { view: 'atelier', label: 'ATELIER', href: '#/atelier' },
] as const

export function NavigationPill({ currentView, audioActive, toggleAudio }: NavigationPillProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Cerrar menú al redimensionar a pantalla grande
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 860) {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleNavClick = () => {
    sound.playTick()
    setMobileMenuOpen(false)
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        zIndex: 100,
        background: 'rgba(3, 3, 5, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.75)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 32px',
          maxWidth: '1400px',
          margin: '0 auto',
        }}
      >
        {/* LOGO ARTISTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
          <a
            href="#/"
            onClick={() => {
              sound.playTick()
              window.location.hash = '#/'
            }}
            style={{
              fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#FFFFFF',
              textDecoration: 'none',
              letterSpacing: '0.14em',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>NAROA</span>
            <span style={{ color: '#D4AF37' }}>.</span>
          </a>

          {/* ENLACES DESKTOP */}
          <ul
            className="nav-desktop-links"
            style={{
              display: 'flex',
              gap: '26px',
              listStyle: 'none',
              margin: 0,
              padding: 0,
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.78rem',
              letterSpacing: '0.12em',
              alignItems: 'center',
            }}
          >
            {NAV_ITEMS.map((item) => {
              const isActive = currentView === item.view
              return (
                <li key={item.view}>
                  <a
                    href={item.href}
                    onClick={handleNavClick}
                    style={{
                      color: isActive ? '#D4AF37' : 'rgba(255,255,255,0.6)',
                      textDecoration: 'none',
                      fontWeight: isActive ? 700 : 500,
                      position: 'relative',
                      padding: '6px 2px',
                      transition: 'color 0.25s ease',
                      borderBottom: isActive ? '2px solid #D4AF37' : '2px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.color = '#FFFFFF'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>

        {/* ACCIONES DERECHA: AUDIO TELEMETRY + CONCIERGE ATELIER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* BOTÓN SINESTÉSICO AUDIO "BOARDS OF BURGOS" */}
          <button
            onClick={toggleAudio}
            title={audioActive ? 'Banda Sonora Activa: Boards of Burgos (Borja Moskv)' : 'Activar Audio Ambiental'}
            style={{
              background: audioActive ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)',
              border: '1px solid ' + (audioActive ? 'rgba(212,175,55,0.45)' : 'rgba(255,255,255,0.12)'),
              color: audioActive ? '#D4AF37' : 'rgba(255,255,255,0.45)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.7rem',
              padding: '6px 14px',
              borderRadius: '20px',
              cursor: 'pointer',
              letterSpacing: '0.12em',
              transition: 'all 0.25s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {/* Animación de barras de espectro doradas */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '11px' }}>
              {[0.5, 1, 0.35].map((val, idx) => (
                <motion.span
                  key={idx}
                  animate={audioActive ? { height: ['3px', `${val * 11}px`, '3px'] } : { height: '3px' }}
                  transition={{ repeat: Infinity, duration: 0.7 + idx * 0.2, ease: 'easeInOut' }}
                  style={{
                    width: '2px',
                    background: audioActive ? '#D4AF37' : 'rgba(255,255,255,0.4)',
                    borderRadius: '1px',
                    display: 'inline-block',
                  }}
                />
              ))}
            </div>
            <span className="audio-btn-text">{audioActive ? 'SONIDO ACTIVO' : 'SONIDO SILENCIADO'}</span>
          </button>

          {/* BOTÓN HAMBURGUESA RESPONSIVE */}
          <button
            className="nav-mobile-toggle"
            onClick={() => {
              sound.playTick()
              setMobileMenuOpen((prev) => !prev)
            }}
            aria-label="Abrir menú de navegación"
            style={{
              display: 'none',
              background: 'transparent',
              border: '1px solid rgba(212,175,55,0.4)',
              color: '#D4AF37',
              fontSize: '1.2rem',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* DRAWER RESPONSIVE MÓVIL */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="nav-mobile-drawer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{
              overflow: 'hidden',
              background: 'rgba(3, 3, 5, 0.98)',
              borderTop: '1px solid rgba(212, 175, 55, 0.2)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.9)',
              padding: '24px 28px',
            }}
          >
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.95rem',
                letterSpacing: '0.12em',
              }}
            >
              {NAV_ITEMS.map((item) => {
                const isActive = currentView === item.view
                return (
                  <li key={item.view}>
                    <a
                      href={item.href}
                      onClick={handleNavClick}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: isActive ? '#D4AF37' : '#FFFFFF',
                        textDecoration: 'none',
                        fontWeight: isActive ? 700 : 500,
                        padding: '10px 14px',
                        background: isActive ? 'rgba(212,175,55,0.1)' : 'transparent',
                        borderRadius: '8px',
                        borderLeft: isActive ? '3px solid #D4AF37' : '3px solid transparent',
                      }}
                    >
                      <span>{item.label}</span>
                      {isActive && <span style={{ fontSize: '0.8rem', color: '#D4AF37' }}>●</span>}
                    </a>
                  </li>
                )
              })}
            </ul>

            <div
              style={{
                marginTop: '22px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
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
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  padding: '11px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  letterSpacing: '0.08em',
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
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: '0.82rem',
                  padding: '11px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  border: '1px solid rgba(255,255,255,0.15)',
                  letterSpacing: '0.08em',
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
