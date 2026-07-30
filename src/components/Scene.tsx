import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls, Preload, PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, Noise, Vignette, Bloom, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { Gallery } from './Gallery'

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isMobile =
  typeof window !== 'undefined' &&
  (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))

interface SceneProps {
  onCurrentChange: (index: number) => void
  onInspectArtwork: (index: number) => void
  targetIndex?: number | null
  active?: boolean
}

export default function Scene({ onCurrentChange, onInspectArtwork, targetIndex, active = true }: SceneProps) {
  const [dpr, setDpr] = useState(isMobile ? 1 : 1.5)

  // Use frameloop='demand' when inactive to save GPU resources, 'always' when active.
  const frameloop = active ? 'always' : 'demand'

  return (
    <Canvas 
      dpr={dpr} 
      frameloop={frameloop}
      gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: 'high-performance' }}
    >
      <PerformanceMonitor onIncline={() => setDpr(isMobile ? 1.5 : 2)} onDecline={() => setDpr(1)}>
      <color attach="background" args={['#07070a']} />

      <Suspense fallback={null}>
        <ScrollControls pages={4} infinite damping={0.1}>
          <Gallery
            onCurrentChange={onCurrentChange}
            onInspectArtwork={onInspectArtwork}
            targetIndex={targetIndex}
            reducedMotion={prefersReducedMotion}
          />
        </ScrollControls>

        <ambientLight intensity={1.8} />
        <directionalLight position={[10, 10, 10]} intensity={2.5} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={1.2} />
        <spotLight position={[0, 15, 10]} angle={0.3} penumbra={1} intensity={2} />

        {!prefersReducedMotion && !isMobile && (
          <EffectComposer>
            <Bloom luminanceThreshold={0.3} mipmapBlur intensity={0.85} />
            <Noise opacity={0.015} />
            <Vignette eskil={false} offset={0.15} darkness={0.95} />
            <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={new THREE.Vector2(0.0008, 0.0008)} />
          </EffectComposer>
        )}

        <Preload all />
      </Suspense>
      </PerformanceMonitor>
    </Canvas>
  )
}
