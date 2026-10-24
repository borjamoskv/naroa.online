import { Suspense, useState, useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Preload, PerformanceMonitor, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import * as easing from 'maath/easing'

import { Gallery } from './Gallery'
import { EnvironmentLevel } from './EnvironmentLevel'
import { ARTWORKS } from '../artworks'
import { ROTUNDA_RADIUS, buildGallerySplineCurve } from '../utils/spline'

const isMobile =
  typeof window !== 'undefined' &&
  (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))

interface CameraGlideControllerProps {
  selectedIndex: number | null
  onSelectArtwork?: (index: number | null) => void
}

function CameraGlideController({ selectedIndex, onSelectArtwork }: CameraGlideControllerProps) {
  const controlsRef = useRef<any>(null)
  const isTransitioningRef = useRef(false)
  const prevIndexRef = useRef<number | null>(null)

  const targetCamPos = useRef(new THREE.Vector3(0, 2.0, 7.0))
  const targetLookAt = useRef(new THREE.Vector3(0, 1.8, 0))
  const lastInteractionRef = useRef<number>(0)

  // ── RIG DE CÁMARA EN SPLINE CATMULL-ROM 3D CON INVERSIÓN DE EJES ──
  const splineCurve = useMemo(() => buildGallerySplineCurve(ROTUNDA_RADIUS), [])
  const splineStateRef = useRef({
    active: false,
    uCurrent: 0,
    uTarget: 0,
    rollCurrent: 0,
    rollTarget: 0,
  })
  const scratchPoint = useMemo(() => new THREE.Vector3(), [])
  const scratchTangent = useMemo(() => new THREE.Vector3(), [])

  // Detección de actividad y empuje pasivo en la curva Catmull-Rom 3D (INV_C5_SCROLL_SUBSTEP_DYNAMICS)
  useEffect(() => {
    lastInteractionRef.current = Date.now()
    const handleActivity = () => {
      lastInteractionRef.current = Date.now()
      if (controlsRef.current && controlsRef.current.autoRotate) {
        controlsRef.current.autoRotate = false
      }
    }

    const handleWheel = (e: WheelEvent) => {
      lastInteractionRef.current = Date.now()
      // Inversión de ejes: el gesto vertical/horizontal empuja el rig en profundidad 3D sobre la spline
      const dominantDelta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : -e.deltaX
      const stepU = dominantDelta * 0.00028
      splineStateRef.current.active = true
      splineStateRef.current.uTarget = (splineStateRef.current.uTarget + stepU + 10.0) % 1.0
      splineStateRef.current.rollTarget = Math.max(-0.18, Math.min(0.18, -dominantDelta * 0.0012))
    }

    window.addEventListener('pointermove', handleActivity, { passive: true })
    window.addEventListener('pointerdown', handleActivity, { passive: true })
    window.addEventListener('keydown', handleActivity, { passive: true })
    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('touchstart', handleActivity, { passive: true })

    return () => {
      window.removeEventListener('pointermove', handleActivity)
      window.removeEventListener('pointerdown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('wheel', handleWheel)
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

      // Sincronizar coordenada u de la spline con la obra seleccionada
      const targetU = (selectedIndex / numItems) % 1.0
      splineStateRef.current.uTarget = targetU
      splineStateRef.current.uCurrent = targetU
      splineStateRef.current.active = false

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

  useFrame((state, delta) => {
    const cam = state.camera
    const sp = splineStateRef.current

    // Sub-step inertial follow a lo largo de la curva Catmull-Rom 3D (alpha = 0.16)
    if (sp.active) {
      let diff = sp.uTarget - sp.uCurrent
      if (diff > 0.5) diff -= 1.0
      if (diff < -0.5) diff += 1.0

      if (Math.abs(diff) < 0.00012) {
        sp.uCurrent = sp.uTarget
        sp.rollTarget = 0
        sp.active = false
        // Acoplar suavemente la obra más cercana al detenerse en su cámara de resonancia
        if (onSelectArtwork) {
          const nearestIdx = Math.round(sp.uCurrent * ARTWORKS.length) % ARTWORKS.length
          if (selectedIndex !== nearestIdx) {
            onSelectArtwork(nearestIdx)
          }
        }
      } else {
        sp.uCurrent = (sp.uCurrent + diff * 0.16 + 1.0) % 1.0
      }

      splineCurve.getPointAt(sp.uCurrent, scratchPoint)
      splineCurve.getTangentAt(sp.uCurrent, scratchTangent)

      const nearestAngle = sp.uCurrent * Math.PI * 2
      const lookX = Math.sin(nearestAngle) * ROTUNDA_RADIUS + scratchTangent.x * 2.4
      const lookZ = Math.cos(nearestAngle) * ROTUNDA_RADIUS + scratchTangent.z * 2.4
      const lookY = 2.0 - scratchTangent.y * 0.85 // Inversión de eje de cabeceo en el umbral del portal

      targetCamPos.current.copy(scratchPoint)
      targetLookAt.current.set(lookX, lookY, lookZ)
      isTransitioningRef.current = true
    }

    sp.rollCurrent += (sp.rollTarget - sp.rollCurrent) * 0.14
    sp.rollTarget *= 0.9

    if (isTransitioningRef.current && controlsRef.current) {
      if (controlsRef.current.autoRotate) {
        controlsRef.current.autoRotate = false
      }
      easing.damp3(cam.position, targetCamPos.current, 0.24, delta)
      easing.damp3(controlsRef.current.target, targetLookAt.current, 0.24, delta)
      controlsRef.current.update()
      cam.rotation.z = sp.rollCurrent

      if (
        !sp.active &&
        cam.position.distanceTo(targetCamPos.current) < 0.05 &&
        controlsRef.current.target.distanceTo(targetLookAt.current) < 0.05
      ) {
        isTransitioningRef.current = false
        cam.rotation.z = 0
      }
    } else if (controlsRef.current && selectedIndex === null) {
      const idleTime = lastInteractionRef.current > 0 ? Date.now() - lastInteractionRef.current : 0
      if (idleTime > 10000) {
        controlsRef.current.autoRotate = true
        controlsRef.current.autoRotateSpeed = 0.35
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
      enableZoom={false}
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
          {/* Controlador de cámara en Spline Catmull-Rom 3D con inversión de ejes */}
          <CameraGlideController selectedIndex={selectedIndex} onSelectArtwork={onSelectArtwork} />

          {/* Espacio arquitectónico mineral */}
          <EnvironmentLevel onResetView={() => onSelectArtwork(null)} />

          {/* Obras colgadas en la rotonda con portales RenderTarget */}
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
