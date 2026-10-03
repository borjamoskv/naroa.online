import * as THREE from 'three'
import { useRef, useState, useMemo } from 'react'
import { Image, Sparkles, useTexture, Text } from '@react-three/drei'
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
  title,
  year,
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
      {/* ── 1. PANEL TRASERO MONOLÍTICO DE PIZARRA (SOPORTE FÍSICO) ── */}
      <mesh position={[0, 0, -0.05]} scale={[scale[0] + 0.32, scale[1] + 0.32, 0.06]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial
          color="#121318"
          metalness={0.2}
          roughness={0.8}
        />
      </mesh>

      {/* ── 2. JUNTA PERIMETRAL EN BRONCE SUAVE ── */}
      <mesh position={[0, 0, -0.015]} scale={[scale[0] + 0.08, scale[1] + 0.08, 0.02]}>
        <boxGeometry />
        <meshStandardMaterial
          color={active ? '#bfa157' : '#332e22'}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* ── 3. LIENZO / OBRA DE ARTE (TEXTURA REAL Y COLOR ÍNTEGRO) ── */}
      <Image
        url={url}
        scale={[scale[0], scale[1]]}
        transparent
        side={THREE.DoubleSide}
        toneMapped={false}
      />

      {/* ── 4. CARTELA DE GALERÍA (MUSEUM LABEL CARD) ── */}
      <group position={[0, -scale[1] / 2 - 0.32, 0.04]}>
        {/* Soporte discreto de papel mineral */}
        <mesh>
          <planeGeometry args={[Math.min(scale[0] * 0.72, 1.8), 0.24]} />
          <meshStandardMaterial
            color="#0b0c10"
            roughness={0.9}
            metalness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Título en tipografía serena */}
        <Text
          position={[0, 0.04, 0.01]}
          fontSize={0.075}
          color={active ? '#EAD6A6' : '#C8C6C0'}
          anchorX="center"
          anchorY="middle"
          maxWidth={scale[0] * 0.68}
          letterSpacing={0.05}
        >
          {title.toUpperCase()}
        </Text>

        {/* Año y técnica */}
        <Text
          position={[0, -0.05, 0.01]}
          fontSize={0.055}
          color="rgba(180, 160, 120, 0.75)"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.08}
        >
          {`${year} · PIZARRA, MICA Y PIGMENTOS`}
        </Text>
      </group>

      {/* ── 5. PROYECTOR DE GALERÍA CENITAL (ILUMINACIÓN DE ACENTO DIRIGIDA) ── */}
      <spotLight
        position={[0, scale[1] * 0.7 + 0.8, 1.8]}
        target-position={[0, 0, 0]}
        intensity={active ? 3.4 : 1.8}
        angle={0.7}
        penumbra={0.8}
        distance={6.0}
        color="#FFF5E4"
        decay={2}
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
  reducedMotion = false,
}: GalleryProps) {
  const group = useRef<THREE.Group>(null)

  const numItems = ARTWORKS.length
  const radius = ROTUNDA_RADIUS

  const items = useMemo(() => {
    return ARTWORKS.map((artwork, i) => {
      const angle = (i / numItems) * Math.PI * 2
      return {
        position: [Math.sin(angle) * radius, 2.0, Math.cos(angle) * radius] as [number, number, number],
        rotation: [0, angle + Math.PI, 0] as [number, number, number],
        url: artwork.url,
        title: artwork.title,
        year: artwork.year,
        medium: artwork.medium,
        scale: [2.2, 2.9, 1] as [number, number, number],
      }
    })
  }, [numItems, radius])

  return (
    <group ref={group} position={[0, 0, 0]}>
      {/* ── MOTAS DE MICA EN EL AIRE (TRANQUILAS Y ORGÁNICAS) ── */}
      {!reducedMotion && (
        <Sparkles
          count={70}
          scale={[35, 8, 35]}
          size={1.6}
          speed={0.15}
          opacity={0.25}
          color="#D8C395"
        />
      )}

      {/* ── LAS 27 OBRAS CANÓNICAS COLGADAS EN ARMONÍA ── */}
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
