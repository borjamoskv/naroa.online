import * as THREE from 'three'
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Image, useScroll, Html } from '@react-three/drei'
import { easing } from 'maath'

interface GalleryItemProps {
  position: [number, number, number]
  rotation: [number, number, number]
  url: string
  title: string
  id: string
  scale: [number, number, number]
  index: number
}

// A single item in the gallery with Industrial Noir cybernetic readouts
function GalleryItem({ position, scale, url, title, id, index, rotation }: GalleryItemProps) {
  const ref = useRef<any>(null)
  const [hovered, hover] = useState(false)
  
  useFrame((state, delta) => {
    if (ref.current) {
      // Add a subtle floating effect
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + index) * 0.08
      
      // Smooth hover effects on material properties
      easing.damp3(ref.current.scale, hovered ? [scale[0] * 1.05, scale[1] * 1.05, 1] : scale, 0.2, delta)
      easing.damp(ref.current.material, 'grayscale', hovered ? 0 : 0.85, 0.2, delta)
      easing.dampC(ref.current.material.color, hovered ? '#ffffff' : '#888888', 0.2, delta)
    }
  })

  return (
    <group position={position} rotation={rotation}>
      <Image
        ref={ref}
        url={url}
        transparent
        side={THREE.DoubleSide}
        onPointerOver={() => hover(true)}
        onPointerOut={() => hover(false)}
        toneMapped={false}
      />
      {hovered && (
        <Html distanceFactor={10} position={[0, -2.5, 0]} center>
          <div style={{
            fontFamily: "'Share Tech Mono', monospace",
            color: '#FFFFFF',
            background: 'rgba(10, 10, 10, 0.9)',
            border: '1px solid #2B3BE5',
            padding: '6px 12px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            fontSize: '12px',
            boxShadow: '0 0 15px rgba(43, 59, 229, 0.6)',
            pointerEvents: 'none',
            letterSpacing: '0.1em'
          }}>
            <span style={{ color: '#2B3BE5', marginRight: '8px', fontWeight: 'bold' }}>[{id}]</span>
            {title}
          </div>
        </Html>
      )}
    </group>
  )
}

const itemsData = [
  { url: '/assets/marilyn-rocks--qPeLHxE.webp', title: 'MARILYN ROCKS', id: 'ART-01' },
  { url: '/assets/hq-amy-BRTriASV.webp', title: 'AMY WINEHOUSE', id: 'ART-02' },
  { url: '/assets/hq-james-CjsTrO7r.webp', title: 'JAMES DEAN', id: 'ART-03' },
  { url: '/assets/hq-johnny-5ueL8eU0.webp', title: 'JOHNNY DEPP', id: 'ART-04' },
  { url: '/assets/celia-cruz-cantinflowers-DO-SRKMB.webp', title: 'CELIA & CANTINFLOWERS', id: 'ART-05' },
  { url: '/assets/baroque-farrokh-mjg4ClA9.webp', title: 'BAROQUE FARROKH', id: 'ART-06' },
  { url: '/assets/divinos-marilyn-By8KYPMI.webp', title: 'DIVINOS MARILYN', id: 'ART-07' },
  { url: '/assets/divinos-johnny-gl9M1ZKj.webp', title: 'DIVINOS JOHNNY', id: 'ART-08' }
]

export function Gallery() {
  const group = useRef<THREE.Group>(null)
  const scroll = useScroll()

  // Generate items placed in a cylinder/circle around the center
  const numItems = itemsData.length
  const radius = 5.2

  const items = Array.from({ length: numItems }, (_, i) => {
    const angle = (i / numItems) * Math.PI * 2
    const x = Math.sin(angle) * radius
    const z = Math.cos(angle) * radius
    // Point towards the center
    const rotation = [0, angle, 0]
    return {
      position: [x, 0, z] as [number, number, number],
      rotation: rotation as [number, number, number],
      url: itemsData[i].url,
      title: itemsData[i].title,
      id: itemsData[i].id,
      scale: [3, 4, 1] as [number, number, number]
    }
  })

  useFrame((_, delta) => {
    if (group.current) {
      // Rotate the entire gallery based on the scroll offset
      const targetRotation = scroll.offset * Math.PI * 2
      easing.damp(group.current.rotation, 'y', targetRotation, 0.25, delta)
    }

    // Direct-DOM injection at 60fps for maximum exergy performance
    const progressBar = document.getElementById('scroll-bar')
    if (progressBar) {
      progressBar.style.width = `${scroll.offset * 100}%`
    }
  })

  return (
    <group ref={group} position={[0, -0.2, -4]}>
      {items.map((item, i) => (
        <GalleryItem key={i} index={i} {...item} />
      ))}
    </group>
  )
}
