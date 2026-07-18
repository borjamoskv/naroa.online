import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls, Environment, Preload } from '@react-three/drei'
import { EffectComposer, Noise, Vignette, Bloom, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { Gallery } from './Gallery'

// Respeta la preferencia de accesibilidad del sistema: sin postprocesado
// pesado ni animaciones ambientales si el usuario pidió menos movimiento.
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface SceneProps {
  onCurrentChange: (index: number) => void
}

export default function Scene({ onCurrentChange }: SceneProps) {
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
      <color attach="background" args={['#0a0a0a']} />

      <Suspense fallback={null}>
        <ScrollControls pages={4} infinite damping={0.1}>
          <Gallery onCurrentChange={onCurrentChange} reducedMotion={prefersReducedMotion} />
        </ScrollControls>

        <Environment preset="city" />

        {!prefersReducedMotion && (
          <EffectComposer>
            <Bloom luminanceThreshold={0.15} mipmapBlur intensity={1.2} />
            <Noise opacity={0.03} />
            <Vignette eskil={false} offset={0.15} darkness={1.15} />
            <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={new THREE.Vector2(0.0015, 0.0015)} />
          </EffectComposer>
        )}

        <Preload all />
      </Suspense>
    </Canvas>
  )
}
