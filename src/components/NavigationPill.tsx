import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sound } from '../utils/audio'

interface NavigationPillProps {
  currentView: 'home' | '3d' | 'destacada' | 'encargos' | 'juegos' | 'about' | 'blog'
  audioActive: boolean
  toggleAudio: () => void
}

const NAV_ITEMS = [
  { view: 'home', label: 'INICIO', href: '#/' },
  { view: 'destacada', label: 'OBRA', href: '#/destacada' },
  { view: '3d', label: '3D 🕹️', href: '#/3d' },
  { view: 'juegos', label: 'JUEGOS 🎮', href: '#/juegos' },
  { view: 'about', label: 'SOBRE MÍ', href: '#/sobre-mi' },
  { view: 'blog', label: 'BLOG', href: '#/blog' },
  { view: 'encargos', label: 'CONTACTO', href: '#/encargos' },
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
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      style={{
        position: 'relative',
        width: '100%',
        zIndex: 100,
        background: 'rgba(2, 2, 4, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.15)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 28px',
          maxWidth: '1400px',
          margin: '0 auto',
        }}
      >
        {/* LOGO ARTISTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <a
            href="#/"
            onClick={() => { sound.playTick(); window.location.hash = '#/'; }}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#FFFFFF',
              textDecoration: 'none',
              letterSpacing: '0.12em',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>NAROA</span>
            <span style={{ color: '#D4AF37' }}>.</span>
          </a>

          {/* ENLACES DESKTOP (Ocultos en móvil por CSS) */}
          <ul
            className="nav-desktop-links"
            style={{
              display: 'flex',
              gap: '22px',
              listStyle: 'none',
              margin: 0,
              padding: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              letterSpacing: '0.08em',
              alignItems: 'center'
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
                      color: isActive ? '#D4AF37' : 'rgba(255,255,255,0.65)',
                      textDecoration: 'none',
                      fontWeight: isActive ? 700 : 500,
                      position: 'relative',
                      padding: '6px 2px',
                      transition: 'color 0.2s ease',
                      borderBottom: isActive ? '2px solid #D4AF37' : '2px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.color = '#FFFFFF'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>

        {/* ACCIONES DERECHA: AUDIO + HAMBURGUESA MÓVIL */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={toggleAudio}
            title={audioActive ? 'Silenciar audio procedural' : 'Activar audio procedural'}
            style={{
              background: audioActive ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.06)',
              border: '1px solid ' + (audioActive ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.15)'),
              color: audioActive ? '#D4AF37' : 'rgba(255,255,255,0.5)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              padding: '6px 14px',
              borderRadius: '20px',
              cursor: 'pointer',
              letterSpacing: '0.08em',
              transition: 'all 0.25s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{audioActive ? '🔊' : '🔇'}</span>
            <span className="audio-btn-text">{audioActive ? 'AUDIO ON' : 'AUDIO OFF'}</span>
          </button>

          {/* BOTÓN HAMBURGUESA (visible en pantallas móviles <= 860px) */}
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
              cursor: 'pointer'
            }}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* DRAWER RESPONSIVE MÓVIL (Animado con Framer Motion) */}
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
              background: 'rgba(5, 5, 8, 0.96)',
              borderTop: '1px solid rgba(212, 175, 55, 0.2)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.9)',
              padding: '20px 28px'
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
                fontFamily: 'var(--font-mono)',
                fontSize: '1rem'
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
                        borderLeft: isActive ? '3px solid #D4AF37' : '3px solid transparent'
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
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                gap: '12px'
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
                  fontSize: '0.85rem',
                  padding: '10px',
                  borderRadius: '8px',
                  textDecoration: 'none'
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
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  padding: '10px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  border: '1px solid rgba(255,255,255,0.2)'
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
