import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls, Environment, Html, Preload } from '@react-three/drei'
import { EffectComposer, Noise, Vignette, Bloom, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { Gallery } from './components/Gallery'

function Loader() {
  return (
    <Html center>
      <div className="loader-container">
        <div className="loader">CORTEX ENGINE INITIALIZING</div>
        <div className="loader-bar" />
      </div>
    </Html>
  )
}

export default function App() {
  return (
    <>
      {/* Scroll Progress Bar */}
      <div className="scroll-indicator" id="scroll-bar" />

      <div className="ui-layer">
        <header className="header">
          <a href="https://naroagutierrezgil.com" className="logo">
            <span className="logo-dot"></span>
            A O R A N / NAROA
          </a>
          <nav className="nav">
            <a href="#/exhibition" className="active">EXPOSICIÓN 3D</a>
            <a href="https://naroagutierrezgil.com/autodidacta" target="_blank" rel="noopener noreferrer">MANIFIESTO</a>
            <a href="https://naroagutierrezgil.com/contacto" target="_blank" rel="noopener noreferrer">CONTACTO</a>
          </nav>
        </header>

        <div className="ui-middle">
          <div className="headline">
            <h1>SALA DE JUEGOS & 3D</h1>
            <p>Fricción interactiva sobre el lienzo tridimensional de Naroa. Desliza para rotar la galería.</p>
          </div>

          {/* Telemetry panel matching the C5-REAL styling */}
          <div className="telemetry-panel">
            <div className="telemetry-row">
              <span>SYSTEM LEVEL</span>
              <span className="telemetry-value">C5-REAL</span>
            </div>
            <div className="telemetry-row">
              <span>EXERGY YIELD</span>
              <span className="telemetry-value">1000/1000</span>
            </div>
            <div className="telemetry-row">
              <span>LEDGER IDENTITY</span>
              <span className="telemetry-value">BORJA MOSKV</span>
            </div>
            <div className="telemetry-row">
              <span>BYZANTINE QUORUM</span>
              <span className="telemetry-value">ACTIVE (N&gt;=3)</span>
            </div>
          </div>
        </div>

        <footer className="footer">
          <div><a href="https://naroagutierrezgil.com" target="_blank" rel="noopener noreferrer">PORTAL OFICIAL: naroagutierrezgil.com</a></div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--accent-color)" }}>
            KOBETAMENDI // 43.2630° N, 2.9350° W
          </div>
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
