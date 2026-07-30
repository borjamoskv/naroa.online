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
      className="nav-pill"
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1, ease: [0.25, 1, 0.5, 1], delay: 0.3 }}
    >
      <div className="nav-pill__inner">
        <a href="#/" className="nav-pill__logo" onClick={() => { sound.playTick(); window.location.hash = '#/'; }}>
          N
        </a>
        <ul className="nav-pill__links">
          <li>
            <a href="#/" className={`nav-pill__link ${currentView === 'home' ? 'active' : ''}`} onClick={() => sound.playTick()}>
              Home
            </a>
          </li>
          <li>
            <a href="#/destacada" className={`nav-pill__link ${currentView === 'destacada' ? 'active' : ''}`} onClick={() => sound.playTick()}>
              Obra
            </a>
          </li>
          <li>
            <a href="#/3d" className={`nav-pill__link ${currentView === '3d' ? 'active' : ''}`} onClick={() => sound.playTick()}>
              Sala 3D
            </a>
          </li>
          <li>
            <a href="#/sobre-mi" className={`nav-pill__link ${currentView === 'about' ? 'active' : ''}`} onClick={() => sound.playTick()}>
              Sobre mí
            </a>
          </li>
          <li>
            <a href="#/blog" className={`nav-pill__link ${currentView === 'blog' ? 'active' : ''}`} onClick={() => sound.playTick()}>
              Blog
            </a>
          </li>
          <li>
            <a href="#/encargos" className={`nav-pill__link nav-pill__link--cta ${currentView === 'encargos' ? 'active' : ''}`} onClick={() => sound.playTick()}>
              Contacto
            </a>
          </li>
        </ul>
        <button
          className={`nav-pill__audio ${audioActive ? 'active' : ''}`}
          onClick={toggleAudio}
          title={audioActive ? 'Desactivar audio FX' : 'Activar audio FX'}
        >
          <span className="audio-equalizer">
            <span className="eq-bar bar-1"></span>
            <span className="eq-bar bar-2"></span>
            <span className="eq-bar bar-3"></span>
          </span>
        </button>
      </div>
    </motion.nav>
  )
}
