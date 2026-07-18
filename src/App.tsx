import { Suspense, lazy, useState } from 'react'
import { motion } from 'framer-motion'
import { ARTWORKS, PORTAL } from './artworks'

// La escena WebGL (three.js + postprocesado) carga en un chunk aparte:
// la UI y el loader pintan al instante, la sala 3D llega después.
const Scene = lazy(() => import('./components/Scene'))

function Loader() {
  return (
    <div className="loader">
      <div className="spinner"></div>
      <div className="loader-text">SINCRONIZANDO LIENZO 3D...</div>
    </div>
  )
}

export default function App() {
  const [current, setCurrent] = useState(0)
  const artwork = ARTWORKS[current]

  return (
    <>
      <div className="ui-layer">
        <motion.header
          className="header"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1], delay: 0.2 }}
        >
          <a href={PORTAL} className="logo">
            <span className="logo-dot"></span>
            A O R A N / NAROA
          </a>
          <nav className="nav">
            <a href="#/" className="active">EXPOSICIÓN 3D</a>
            <a href={`${PORTAL}/sobre-mi/`} target="_blank" rel="noopener noreferrer">MANIFIESTO</a>
            <a href={`${PORTAL}/encargos/`} target="_blank" rel="noopener noreferrer">CONTACTO</a>
          </nav>
        </motion.header>

        <div className="ui-middle">
          <div className="headline">
            <h1>SALA DE JUEGOS & 3D</h1>
            <p>Fricción interactiva sobre el lienzo de Naroa. Desliza para navegar; haz clic en una obra para verla en el portal.</p>
          </div>
        </div>

        <div className="artwork-caption">
          <a href={artwork.href} target="_blank" rel="noopener noreferrer" key={artwork.title}>
            <span className="artwork-index">
              {String(current + 1).padStart(2, '0')} / {String(ARTWORKS.length).padStart(2, '0')}
            </span>
            <span className="artwork-title">{artwork.title}</span>
            <span className="artwork-cta">VER OBRA ↗</span>
          </a>
        </div>

        <footer className="footer">
          <div><a href={PORTAL} target="_blank" rel="noopener noreferrer">PORTAL OFICIAL: naroagutierrezgil.com</a></div>
          <div className="coordinates">KOBETAMENDI // 43.2630° N, 2.9350° W</div>
        </footer>
      </div>

      <div className="scroll-hint" aria-hidden="true"><span /></div>

      <Suspense fallback={<Loader />}>
        <Scene onCurrentChange={setCurrent} />
      </Suspense>
    </>
  )
}
