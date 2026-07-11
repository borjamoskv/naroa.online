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
      <div className="loader">INITIALIZING CORTEX ENGINE...</div>
    </Html>
  )
}

export default function App() {
  return (
    <>
      <div className="ui-layer">
        <header className="header">
          <div className="logo">A O R A N / NAROA</div>
          <nav className="nav">
            <a href="#/exhibition" className="active">COLECCIÓN</a>
            <a href="#/manifesto">MANIFIESTO</a>
            <a href="mailto:naroa@naroa.eu">CONTACTO</a>
          </nav>
        </header>
        <div className="ui-middle">
          <div className="headline">
            <h1>HIPERREALISMO POP</h1>
            <p>Retratos sobre pizarra natural y mica mineral</p>
          </div>
        </div>
        <footer className="footer">
          <div>MOSKV-1 APEX ENGINE // C5-REAL</div>
          <div>KOBETAMENDI // 43.2630° N, 2.9350° W</div>
        </footer>
      </div>

      <Canvas dpr={[1, 2]} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={['#050505']} />
        
        <Suspense fallback={<Loader />}>
          <ScrollControls pages={4} infinite damping={0.1}>
            <Gallery />
          </ScrollControls>
          
          <Environment preset="city" />
          
          <EffectComposer>
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
