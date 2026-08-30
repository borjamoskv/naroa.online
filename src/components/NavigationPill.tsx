import { motion } from 'framer-motion'
import { sound } from '../utils/audio'

interface NavigationPillProps {
  currentView: 'home' | '3d' | 'destacada' | 'encargos' | 'juegos' | 'about' | 'blog'
  audioActive: boolean
  toggleAudio: () => void
}

export function NavigationPill({ currentView, audioActive, toggleAudio }: NavigationPillProps) {
  return (
    <motion.nav
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 40px',
        background: 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
        <a 
          href="#/" 
          onClick={() => { sound.playTick(); window.location.hash = '#/'; }}
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '1rem',
            fontWeight: 400,
            color: '#fff',
            textDecoration: 'none',
            letterSpacing: '0.1em'
          }}
        >
          NAROA.
        </a>
        <ul style={{
          display: 'flex',
          gap: '20px',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          letterSpacing: '0.05em',
          flexWrap: 'wrap'
        }}>
          <li><a href="#/" style={{ color: currentView === 'home' ? '#D4AF37' : 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: currentView === 'home' ? 700 : 400 }} onClick={() => sound.playTick()}>INICIO</a></li>
          <li><a href="#/destacada" style={{ color: currentView === 'destacada' ? '#D4AF37' : 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: currentView === 'destacada' ? 700 : 400 }} onClick={() => sound.playTick()}>OBRA</a></li>
          <li><a href="#/3d" style={{ color: currentView === '3d' ? '#D4AF37' : 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: currentView === '3d' ? 700 : 400 }} onClick={() => sound.playTick()}>3D 🕹️</a></li>
          <li><a href="#/juegos" style={{ color: currentView === 'juegos' ? '#D4AF37' : 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: currentView === 'juegos' ? 700 : 400 }} onClick={() => sound.playTick()}>JUEGOS 🎮</a></li>
          <li><a href="#/sobre-mi" style={{ color: currentView === 'about' ? '#D4AF37' : 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: currentView === 'about' ? 700 : 400 }} onClick={() => sound.playTick()}>SOBRE MÍ</a></li>
          <li><a href="#/blog" style={{ color: currentView === 'blog' ? '#D4AF37' : 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: currentView === 'blog' ? 700 : 400 }} onClick={() => sound.playTick()}>BLOG</a></li>
          <li><a href="#/encargos" style={{ color: currentView === 'encargos' ? '#D4AF37' : 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: currentView === 'encargos' ? 700 : 400 }} onClick={() => sound.playTick()}>CONTACTO</a></li>
        </ul>
      </div>
      
      <button
        onClick={toggleAudio}
        title={audioActive ? 'Silenciar' : 'Activar sonido'}
        style={{
          background: audioActive ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
          border: '1px solid ' + (audioActive ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.1)'),
          color: audioActive ? '#D4AF37' : 'rgba(255,255,255,0.4)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          padding: '6px 14px',
          borderRadius: '20px',
          cursor: 'pointer',
          letterSpacing: '0.1em',
          transition: 'all 0.3s ease'
        }}
      >
        🔊 {audioActive ? 'AUDIO ON' : 'AUDIO OFF'}
      </button>
    </motion.nav>
  )
}
