import * as THREE from 'three'
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Image, useScroll } from '@react-three/drei'
import { easing } from 'maath'

// A single item in the gallery
function GalleryItem({ position, scale, url, index, rotation }: any) {
  const ref = useRef<any>()
  const [hovered, hover] = useState(false)
  
  useFrame((state, delta) => {
    if (ref.current) {
      // Add a subtle floating effect
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + index) * 0.1
      // Smooth hover effects on material properties
      easing.damp3(ref.current.scale, hovered ? [scale[0] * 1.05, scale[1] * 1.05, 1] : scale, 0.2, delta)
      easing.damp(ref.current.material, 'grayscale', hovered ? 0 : 0.8, 0.2, delta)
      easing.damp(ref.current.material, 'color', hovered ? '#ffffff' : '#666666', 0.2, delta)
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

export function Gallery() {
  const group = useRef<THREE.Group>(null)
  const scroll = useScroll()

  // Generate 8 items placed in a cylinder/circle around the center
  const numItems = 8
  const radius = 5

  const items = Array.from({ length: numItems }, (_, i) => {
    const angle = (i / numItems) * Math.PI * 2
    const x = Math.sin(angle) * radius
    const z = Math.cos(angle) * radius
    // Point towards the center
    const rotation = [0, angle, 0]
    return {
      position: [x, 0, z],
      rotation: rotation,
      url: '/image1.jpg',
      scale: [3, 4, 1]
    }
  })

  useFrame((state, delta) => {
    if (group.current) {
      // Rotate the entire gallery based on the scroll offset
      // scroll.offset goes from 0 to 1 over the total scroll area
      const targetRotation = scroll.offset * Math.PI * 2
      easing.damp(group.current.rotation, 'y', targetRotation, 0.25, delta)
    }
  })

  return (
    <group ref={group} position={[0, -0.5, -4]}>
      {items.map((item, i) => (
        <GalleryItem key={i} index={i} {...item} />
      ))}
    </group>
  )
}
