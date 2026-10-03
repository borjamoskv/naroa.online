import { Suspense, useState, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Preload, PerformanceMonitor, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { easing } from 'maath'

import { Gallery, ROTUNDA_RADIUS } from './Gallery'
import { EnvironmentLevel } from './EnvironmentLevel'
import { ARTWORKS } from '../artworks'

const isMobile =
  typeof window !== 'undefined' &&
  (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))

interface CameraGlideControllerProps {
  selectedIndex: number | null
}

function CameraGlideController({ selectedIndex }: CameraGlideControllerProps) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)
  const isTransitioningRef = useRef(false)
  const prevIndexRef = useRef<number | null>(null)

  const targetCamPos = useRef(new THREE.Vector3(0, 2.0, 7.0))
  const targetLookAt = useRef(new THREE.Vector3(0, 1.8, 0))
  const lastInteractionRef = useRef<number>(0)

  // Detección de inactividad para el modo contemplativo
  useEffect(() => {
    lastInteractionRef.current = Date.now()
    const handleActivity = () => {
      lastInteractionRef.current = Date.now()
      if (controlsRef.current && controlsRef.current.autoRotate) {
        controlsRef.current.autoRotate = false
      }
    }

    window.addEventListener('pointermove', handleActivity, { passive: true })
    window.addEventListener('pointerdown', handleActivity, { passive: true })
    window.addEventListener('keydown', handleActivity, { passive: true })
    window.addEventListener('wheel', handleActivity, { passive: true })
    window.addEventListener('touchstart', handleActivity, { passive: true })

    return () => {
      window.removeEventListener('pointermove', handleActivity)
      window.removeEventListener('pointerdown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('wheel', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
    }
  }, [])

  useEffect(() => {
    if (selectedIndex !== null && ARTWORKS[selectedIndex]) {
      const numItems = ARTWORKS.length
      const angle = (selectedIndex / numItems) * Math.PI * 2
      const artX = Math.sin(angle) * ROTUNDA_RADIUS
      const artZ = Math.cos(angle) * ROTUNDA_RADIUS
      const artY = 2.0

      // Distancia de contemplación natural (3.8 metros frente a la obra)
      const viewDist = 3.8
      const camX = Math.sin(angle) * (ROTUNDA_RADIUS - viewDist)
      const camZ = Math.cos(angle) * (ROTUNDA_RADIUS - viewDist)

      targetCamPos.current.set(camX, artY, camZ)
      targetLookAt.current.set(artX, artY, artZ)
      isTransitioningRef.current = true
    } else {
      // Regreso a la perspectiva general de la sala
      targetLookAt.current.set(0, 1.8, 0)
      if (prevIndexRef.current !== null && ARTWORKS[prevIndexRef.current]) {
        // Retroceso hemisférico armónico: retrocede en el mismo cuadrante angular
        // conservando la orientación del observador y evitando atravesar el banco central
        const numItems = ARTWORKS.length
        const angle = (prevIndexRef.current / numItems) * Math.PI * 2
        const pullbackRadius = 7.2
        targetCamPos.current.set(
          Math.sin(angle) * pullbackRadius,
          2.1,
          Math.cos(angle) * pullbackRadius
        )
        isTransitioningRef.current = true
      }
    }
    prevIndexRef.current = selectedIndex
  }, [selectedIndex])

  useFrame((_, delta) => {
    if (isTransitioningRef.current && controlsRef.current) {
      if (controlsRef.current.autoRotate) {
        controlsRef.current.autoRotate = false
      }
      easing.damp3(camera.position, targetCamPos.current, 0.28, delta)
      easing.damp3(controlsRef.current.target, targetLookAt.current, 0.28, delta)
      controlsRef.current.update()

      if (
        camera.position.distanceTo(targetCamPos.current) < 0.05 &&
        controlsRef.current.target.distanceTo(targetLookAt.current) < 0.05
      ) {
        isTransitioningRef.current = false
      }
    } else if (controlsRef.current && selectedIndex === null) {
      // Si el visitante permanece inactivo > 10 segundos, activar rotación lenta contemplativa
      const idleTime = lastInteractionRef.current > 0 ? Date.now() - lastInteractionRef.current : 0
      if (idleTime > 10000) {
        controlsRef.current.autoRotate = true
        controlsRef.current.autoRotateSpeed = 0.35 // Velocidad majestuosa y orgánica
      } else {
        controlsRef.current.autoRotate = false
      }
      controlsRef.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.65}
      minDistance={2.2}
      maxDistance={17.5}
      minPolarAngle={Math.PI / 4}
      maxPolarAngle={Math.PI / 2 - 0.02}
      target={[0, 1.8, 0]}
    />
  )
}

function RotundaLighting({ selectedIndex }: { selectedIndex: number | null }) {
  const ambientRef = useRef<THREE.AmbientLight>(null)

  useFrame((_, delta) => {
    if (ambientRef.current) {
      const targetIntensity = selectedIndex !== null ? 0.22 : 0.42
      easing.damp(ambientRef.current, 'intensity', targetIntensity, 0.35, delta)
    }
  })

  return (
    <>
      <directionalLight position={[12, 18, 12]} intensity={1.1} color="#FFF8EE" />
      <ambientLight ref={ambientRef} intensity={0.4} color="#151720" />
      <pointLight position={[0, 8, 0]} intensity={selectedIndex !== null ? 1.2 : 1.6} color="#FFE6C2" distance={24} />
    </>
  )
}

interface SceneProps {
  onInspectArtwork: (index: number) => void
  selectedIndex: number | null
  onSelectArtwork: (index: number | null) => void
  active?: boolean
}

export default function Scene({
  onInspectArtwork,
  selectedIndex,
  onSelectArtwork,
  active = true,
}: SceneProps) {
  const [dpr, setDpr] = useState(isMobile ? 1 : 1.5)
  const frameloop = active ? 'always' : 'demand'

  return (
    <Canvas
      dpr={dpr}
      frameloop={frameloop}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        powerPreference: 'high-performance',
      }}
      camera={{ position: [0, 2.0, 7.0], fov: 60 }}
      onPointerMissed={(e) => {
        if (e.type === 'click') {
          onSelectArtwork(null)
        }
      }}
    >
      <PerformanceMonitor onIncline={() => setDpr(isMobile ? 1.5 : 2)} onDecline={() => setDpr(1)}>
        <color attach="background" args={['#06060a']} />
        <fog attach="fog" args={['#06060a', 14, 38]} />

        <Suspense fallback={null}>
          {/* Controlador de cámara suave y orgánico */}
          <CameraGlideController selectedIndex={selectedIndex} />

          {/* Espacio arquitectónico mineral */}
          <EnvironmentLevel onResetView={() => onSelectArtwork(null)} />

          {/* Obras colgadas en la rotonda */}
          <Gallery
            selectedIndex={selectedIndex}
            onSelectArtwork={onSelectArtwork}
            onInspectArtwork={onInspectArtwork}
          />

          {/* Iluminación de sala cálida y óptica teatral */}
          <RotundaLighting selectedIndex={selectedIndex} />

          <Preload all />
        </Suspense>
      </PerformanceMonitor>
    </Canvas>
  )
}
