import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls, Environment, Html, Preload, PerspectiveCamera } from '@react-three/drei'
import { EffectComposer, Noise, Vignette, Bloom, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { Gallery } from './components/Gallery'

function Loader() {
  return (
    <Html center>
      <div className="loader">INITIALIZING CORTEX ENGINE...</div>
    </Html>
  )
}

function Rig() {
  // A dynamic rig that slightly moves camera with mouse, but we'll let ScrollControls handle most of it
  return null;
}

export default function App() {
  return (
    <>
      <div className="ui-layer">
        <header className="header">
          <div className="logo">MOSKV-1 APEX</div>
          <nav className="nav">
            <a href="#">EXHIBITION</a>
            <a href="#">MANIFESTO</a>
            <a href="#">INDEX</a>
          </nav>
        </header>
        <footer className="footer">
          <div>INDUSTRIAL NOIR 2026</div>
          <div>C5-REAL SOVEREIGN ARCHITECTURE</div>
        </footer>
      </div>

      <Canvas dpr={[1, 2]} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={['#050505']} />
        
        <Suspense fallback={<Loader />}>
          <ScrollControls pages={4} infinite damping={0.1}>
            <Gallery />
          </ScrollControls>
          
          <Environment preset="city" />
          
          <EffectComposer disableNormalPass>
            <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.5} />
            <Noise opacity={0.035} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
            <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={new THREE.Vector2(0.002, 0.002)} />
          </EffectComposer>

          <Preload all />
        </Suspense>
      </Canvas>
    </>
  )
}
