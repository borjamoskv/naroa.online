import * as THREE from 'three'
import { useRef, useState, useMemo, useEffect } from 'react'
import { Image, useTexture } from '@react-three/drei'
import { useFrame as useR3FFrame, useThree } from '@react-three/fiber'
import { ARTWORKS } from '../artworks'
import { sound } from '../utils/audio'
import { ROTUNDA_RADIUS } from '../utils/spline'

if (typeof window !== 'undefined') {
  ARTWORKS.forEach((a) => {
    try {
      useTexture.preload(a.url)
    } catch {
      // Ignorar fallo de precarga individual
    }
  })
}

interface GalleryItemProps {
  position: [number, number, number]
  rotation: [number, number, number]
  url: string
  title: string
  year: string
  medium: string
  scale: [number, number, number]
  index: number
  isSelected: boolean
  isHovered: boolean
  portalTexture: THREE.Texture
  onSelect: (index: number) => void
  onInspect: (index: number) => void
}

function GalleryItem({
  position,
  scale,
  url,
  title: _title,
  year: _year,
  index,
  rotation,
  isSelected,
  portalTexture,
  onSelect,
  onInspect,
}: GalleryItemProps) {
  const [hovered, setHovered] = useState(false)
  const active = isSelected || hovered
  const portalGateRef = useRef<THREE.Mesh>(null)

  useR3FFrame(({ clock }) => {
    if (portalGateRef.current) {
      const t = clock.getElapsedTime()
      const pulse = active ? 0.88 + Math.sin(t * 2.6 + index) * 0.12 : 0.42
      const mat = portalGateRef.current.material as THREE.MeshBasicMaterial
      if (mat) {
        mat.opacity = pulse
      }
    }
  })

  return (
    <group
      position={position}
      rotation={rotation}
      userData={{ isArtwork: true, index }}
      onClick={(e) => {
        e.stopPropagation()
        sound.playTick()
        if (isSelected) {
          onInspect(index)
        } else {
          onSelect(index)
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'default'
      }}
    >
      {/* ── 0. PORTAL ARQUITECTÓNICO EXTERIOR (UMBRAL DE CÁMARA DE RESONANCIA) ── */}
      <mesh
        position={[0, 0, -0.09]}
        scale={[scale[0] + 0.54, scale[1] + 0.54, 0.03]}
      >
        <boxGeometry />
        <meshStandardMaterial
          color={active ? '#d4af37' : '#1b1915'}
          metalness={0.85}
          roughness={0.22}
        />
      </mesh>

      {/* ── 0b. MUNDO 3D SECUNDARIO EN RENDERTARGET (PORTAL SCROLLYTELLING) ── */}
      <mesh
        ref={portalGateRef}
        position={[0, 0, -0.025]}
        scale={[scale[0] + 0.22, scale[1] + 0.22, 1]}
      >
        <planeGeometry />
        <meshBasicMaterial
          map={portalTexture}
          transparent
          opacity={active ? 0.92 : 0.45}
          toneMapped={false}
        />
      </mesh>

      {/* ── 1. PANEL MONOLÍTICO DE PIZARRA TRASERO (PROPORCIONAL AL LIENZO) ── */}
      <mesh
        position={[0, 0, -0.05]}
        scale={[scale[0] + 0.34, scale[1] + 0.34, 0.05]}
        castShadow
        receiveShadow
      >
        <boxGeometry />
        <meshStandardMaterial
          color="#111216"
          metalness={0.25}
          roughness={0.78}
        />
      </mesh>

      {/* ── 2. BISEL DE BRONCE MINERAL OSCURO ── */}
      <mesh position={[0, 0, -0.012]} scale={[scale[0] + 0.08, scale[1] + 0.08, 0.02]}>
        <boxGeometry />
        <meshStandardMaterial
          color={active ? '#d4af37' : '#332e22'}
          metalness={0.72}
          roughness={0.32}
        />
      </mesh>

      {/* ── 3. LIENZO / OBRA DE ARTE (PROPORCIÓN Y COLOR AUTÉNTICO 1:1) ── */}
      <Image
        url={url}
        scale={[scale[0], scale[1]]}
        transparent
        side={THREE.DoubleSide}
        toneMapped={false}
      />

      {/* ── 4. ANCLAJE DE BRONCE ARQUITECTÓNICO ── */}
      <mesh position={[0, -scale[1] / 2 - 0.05, 0.02]}>
        <boxGeometry args={[Math.min(scale[0] * 0.5, 1.0), 0.008, 0.02]} />
        <meshStandardMaterial
          color={active ? '#C9A96E' : '#3A3832'}
          roughness={0.4}
          metalness={0.8}
        />
      </mesh>

      {/* ── 5. PROYECTOR CENITAL DE GALERÍA (ILUMINACIÓN FÍSICA DE MUSEO) ── */}
      <pointLight
        position={[0, scale[1] / 2 + 0.9, 1.5]}
        intensity={isSelected ? 4.4 : hovered ? 3.4 : 1.8}
        distance={6.8}
        decay={2}
        color="#FFF6E8"
      />
    </group>
  )
}

interface PortalBundle {
  renderTarget: THREE.WebGLRenderTarget
  update: (t: number, camera: THREE.Camera, gl: THREE.WebGLRenderer) => void
  dispose: () => void
}

function createPortalBundle(): PortalBundle {
  const renderTarget = new THREE.WebGLRenderTarget(512, 512, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    depthBuffer: true,
  })

  const portalScene = new THREE.Scene()
  portalScene.background = new THREE.Color('#04050a')
  portalScene.fog = new THREE.FogExp2('#04050a', 0.085)

  const portalCamera = new THREE.PerspectiveCamera(52, 1.0, 0.1, 45)
  portalCamera.position.set(0, 0, 6.2)

  // Iluminación interna de la cámara de resonancia
  const amb = new THREE.AmbientLight('#1c2030', 1.1)
  const keyLight = new THREE.PointLight('#d4af37', 8.5, 22)
  keyLight.position.set(2.5, 3.2, 4.0)
  const rimLight = new THREE.PointLight('#6b8cff', 5.0, 18)
  rimLight.position.set(-3.0, -2.2, 2.5)
  portalScene.add(amb, keyLight, rimLight)

  // Anillos concéntricos de túnel/portal arquitectónico
  const ringsGroup = new THREE.Group()
  const ringGeo = new THREE.TorusGeometry(2.1, 0.035, 16, 64)
  const ringMat = new THREE.MeshStandardMaterial({
    color: '#d4af37',
    metalness: 0.9,
    roughness: 0.18,
  })
  for (let k = 0; k < 6; k++) {
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.position.z = -k * 1.55
    const s = 1 - k * 0.1
    ring.scale.set(s, s, 1)
    ringsGroup.add(ring)
  }
  portalScene.add(ringsGroup)

  // Monolito octaedro mineral flotante en el santuario interior
  const crystalGeo = new THREE.OctahedronGeometry(1.05, 1)
  const crystalMat = new THREE.MeshStandardMaterial({
    color: '#edbca4',
    metalness: 0.88,
    roughness: 0.15,
    wireframe: false,
  })
  const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat)
  portalScene.add(crystalMesh)

  // Jaula geodésica áurea envolvente
  const wireGeo = new THREE.IcosahedronGeometry(1.55, 1)
  const wireMat = new THREE.MeshBasicMaterial({
    color: '#d4af37',
    wireframe: true,
    transparent: true,
    opacity: 0.32,
  })
  const wireMesh = new THREE.Mesh(wireGeo, wireMat)
  portalScene.add(wireMesh)

  return {
    renderTarget,
    update(t: number, camera: THREE.Camera, gl: THREE.WebGLRenderer) {
      crystalMesh.rotation.x = t * 0.45
      crystalMesh.rotation.y = t * 0.68
      wireMesh.rotation.x = -t * 0.28
      wireMesh.rotation.z = t * 0.36

      // Inversión de ejes en paralaje interno del portal respecto al rig principal
      const invX = -Math.sin(camera.rotation.y) * 1.35
      const invY = -Math.sin(camera.rotation.x) * 0.95
      portalCamera.position.x = invX
      portalCamera.position.y = invY
      portalCamera.position.z = 5.4 + Math.cos(t * 0.8) * 0.45
      portalCamera.lookAt(0, 0, -2.5)

      ringsGroup.rotation.z = t * 0.15

      const currentRT = gl.getRenderTarget()
      gl.setRenderTarget(renderTarget)
      gl.clear()
      gl.render(portalScene, portalCamera)
      gl.setRenderTarget(currentRT)
    },
    dispose() {
      renderTarget.dispose()
    },
  }
}

interface GalleryProps {
  selectedIndex: number | null
  onSelectArtwork: (index: number | null) => void
  onInspectArtwork: (index: number) => void
  reducedMotion?: boolean
}

export function Gallery({
  selectedIndex,
  onSelectArtwork,
  onInspectArtwork,
  reducedMotion: _reducedMotion = false,
}: GalleryProps) {
  const group = useRef<THREE.Group>(null)
  const { gl, camera } = useThree()

  const numItems = ARTWORKS.length
  const radius = ROTUNDA_RADIUS

  // ── RENDERTARGET SECUNDARIO (MUNDO 3D INTERIOR DE RESONANCIA MINERAL) ──
  const [portalBundle] = useState<PortalBundle>(createPortalBundle)

  useEffect(() => {
    return () => {
      portalBundle.dispose()
    }
  }, [portalBundle])

  // Renderizado offscreen del mundo 3D secundario acoplado con inversión de ejes a la cámara principal
  useR3FFrame(({ clock }) => {
    portalBundle.update(clock.getElapsedTime(), camera, gl)
  })

  const items = useMemo(() => {
    return ARTWORKS.map((artwork, i) => {
      const angle = (i / numItems) * Math.PI * 2
      const aspect = artwork.aspectRatio || 0.75

      // Dimensionamiento orgánico respetando el ratio nativo de la obra
      let width: number
      let height: number

      if (aspect >= 1.2) {
        height = 2.05
        width = height * aspect
      } else if (aspect >= 0.92) {
        height = 2.3
        width = height * aspect
      } else {
        height = 2.7
        width = height * aspect
      }

      return {
        position: [Math.sin(angle) * radius, 2.0, Math.cos(angle) * radius] as [number, number, number],
        rotation: [0, angle + Math.PI, 0] as [number, number, number],
        url: artwork.url,
        title: artwork.title,
        year: artwork.year,
        medium: artwork.medium,
        scale: [width, height, 1] as [number, number, number],
      }
    })
  }, [numItems, radius])

  return (
    <group ref={group} position={[0, 0, 0]}>
      {/* ── OBRAS CANÓNICAS EN SUS PROPORCIONES REALES CON RENDERTARGET PORTAL ── */}
      {items.map((item, i) => (
        <GalleryItem
          key={i}
          index={i}
          isSelected={selectedIndex === i}
          isHovered={false}
          portalTexture={portalBundle.renderTarget.texture}
          onSelect={onSelectArtwork}
          onInspect={onInspectArtwork}
          {...item}
        />
      ))}
    </group>
  )
}

