import * as THREE from 'three'
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Image, useScroll } from '@react-three/drei'
import { easing } from 'maath'

interface GalleryItemProps {
  position: [number, number, number]
  rotation: [number, number, number]
  url: string
  scale: [number, number, number]
  index: number
}

function GalleryItem({ position, scale, url, index, rotation }: GalleryItemProps) {
  const ref = useRef<any>(null)
  const [hovered, hover] = useState(false)
  
  useFrame((state, delta) => {
    if (ref.current) {
      // Subtle float
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + index) * 0.08
      
      // Grayscale to vibrant color transition on hover
      easing.damp3(ref.current.scale, hovered ? [scale[0] * 1.05, scale[1] * 1.05, 1] : scale, 0.2, delta)
      easing.damp(ref.current.material, 'grayscale', hovered ? 0 : 0.85, 0.2, delta)
      easing.dampC(ref.current.material.color, hovered ? '#ffffff' : '#777777', 0.2, delta)
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
    </group>
  )
}

const urls = [
  '/assets/marilyn-rocks--qPeLHxE.webp',
  '/assets/hq-amy-BRTriASV.webp',
  '/assets/hq-james-CjsTrO7r.webp',
  '/assets/hq-johnny-5ueL8eU0.webp',
  '/assets/celia-cruz-cantinflowers-DO-SRKMB.webp',
  '/assets/baroque-farrokh-mjg4ClA9.webp',
  '/assets/divinos-marilyn-By8KYPMI.webp',
  '/assets/divinos-johnny-gl9M1ZKj.webp'
]

export function Gallery() {
  const group = useRef<THREE.Group>(null)
  const scroll = useScroll()

  const numItems = urls.length
  const radius = 5.2

  const items = Array.from({ length: numItems }, (_, i) => {
    const angle = (i / numItems) * Math.PI * 2
    const x = Math.sin(angle) * radius
    const z = Math.cos(angle) * radius
    const rotation = [0, angle, 0]
    return {
      position: [x, 0, z] as [number, number, number],
      rotation: rotation as [number, number, number],
      url: urls[i],
      scale: [3, 4, 1] as [number, number, number]
    }
  })

  useFrame((_, delta) => {
    if (group.current) {
      const targetRotation = scroll.offset * Math.PI * 2
      easing.damp(group.current.rotation, 'y', targetRotation, 0.25, delta)
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
