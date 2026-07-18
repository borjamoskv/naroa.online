import { Suspense, lazy } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls, Environment, Html, Preload } from '@react-three/drei'
import { EffectComposer, Noise, Vignette, Bloom, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { motion } from 'framer-motion'

const Gallery = lazy(() => import('./components/Gallery').then(module => ({ default: module.Gallery })))

// Portal oficial (restaurado 2026-07-18 tras redespliegue a Cloudflare Pages)
const PORTAL = 'https://naroagutierrezgil.com'

function Loader() {
  return (
    <Html center>
      <div className="loader">
        <div className="spinner"></div>
        <div className="loader-text">SINCRONIZANDO LIENZO 3D...</div>
      </div>
    </Html>
  )
}

export default function App() {
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
            <p>Fricción interactiva sobre el lienzo de Naroa. Desliza para navegar por la galería.</p>
          </div>
        </div>

        <footer className="footer">
          <div><a href={PORTAL} target="_blank" rel="noopener noreferrer">PORTAL OFICIAL: naroagutierrezgil.com</a></div>
          <div className="coordinates">KOBETAMENDI // 43.2630° N, 2.9350° W</div>
        </footer>
      </div>

      <Canvas dpr={[1, 2]} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={['#0a0a0a']} />
        
        <Suspense fallback={<Loader />}>
          <ScrollControls pages={4} infinite damping={0.1}>
            <Gallery />
          </ScrollControls>
          
          <Environment preset="city" />
          
          <EffectComposer>
            <Bloom luminanceThreshold={0.15} mipmapBlur intensity={1.2} />
            <Noise opacity={0.03} />
            <Vignette eskil={false} offset={0.15} darkness={1.15} />
            <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={new THREE.Vector2(0.0015, 0.0015)} />
          </EffectComposer>

          <Preload all />
        </Suspense>
      </Canvas>
    </>
  )
}
