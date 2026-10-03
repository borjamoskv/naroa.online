import * as THREE from 'three'
import { useRef, useState, useMemo } from 'react'
import { Image, useTexture } from '@react-three/drei'
import { ARTWORKS } from '../artworks'
import { sound } from '../utils/audio'

if (typeof window !== 'undefined') {
  ARTWORKS.forEach((a) => {
    try {
      useTexture.preload(a.url)
    } catch {
      // Ignorar fallo de precarga individual
    }
  })
}

export const ROTUNDA_RADIUS = 20.0

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
  onSelect,
  onInspect,
}: GalleryItemProps) {
  const [hovered, setHovered] = useState(false)
  const active = isSelected || hovered

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
      {/* ── 1. PANEL MONOLÍTICO DE PIZARRA TRASERO (PROPORCIONAL AL LIENZO) ── */}
      <mesh
        position={[0, 0, -0.05]}
        scale={[scale[0] + 0.28, scale[1] + 0.28, 0.06]}
        castShadow
        receiveShadow
      >
        <boxGeometry />
        <meshStandardMaterial
          color="#111216"
          metalness={0.2}
          roughness={0.8}
        />
      </mesh>

      {/* ── 2. BISEL DE BRONCE MINERAL OSCURO ── */}
      <mesh position={[0, 0, -0.015]} scale={[scale[0] + 0.08, scale[1] + 0.08, 0.02]}>
        <boxGeometry />
        <meshStandardMaterial
          color={active ? '#bfa157' : '#332e22'}
          metalness={0.6}
          roughness={0.4}
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

  const numItems = ARTWORKS.length
  const radius = ROTUNDA_RADIUS

  const items = useMemo(() => {
    return ARTWORKS.map((artwork, i) => {
      const angle = (i / numItems) * Math.PI * 2
      const aspect = artwork.aspectRatio || 0.75

      // Dimensionamiento orgánico respetando el ratio nativo de la obra
      let width: number
      let height: number

      if (aspect >= 1.2) {
        // Formato horizontal (ej. Cantinflas, Amy Rocks, Divinos Amy)
        height = 2.05
        width = height * aspect
      } else if (aspect >= 0.92) {
        // Formato cuadrado (ej. Celia Cruz, Pink & Sparkles)
        height = 2.3
        width = height * aspect
      } else {
        // Formato vertical clásico (ej. Marilyn, James, Johnny)
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
      {/* ── OBRAS CANÓNICAS EN SUS PROPORCIONES REALES ── */}
      {items.map((item, i) => (
        <GalleryItem
          key={i}
          index={i}
          isSelected={selectedIndex === i}
          isHovered={false}
          onSelect={onSelectArtwork}
          onInspect={onInspectArtwork}
          {...item}
        />
      ))}
    </group>
  )
}
