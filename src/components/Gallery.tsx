import * as THREE from 'three'
import { useRef, useState, useEffect } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Image, useScroll } from '@react-three/drei'
import { easing } from 'maath'
import { ARTWORKS } from '../artworks'

interface GalleryItemProps {
  position: [number, number, number]
  rotation: [number, number, number]
  url: string
  href: string
  scale: [number, number, number]
  index: number
  reducedMotion: boolean
}

function GalleryItem({ position, scale, url, href, index, rotation, reducedMotion }: GalleryItemProps) {
  const ref = useRef<any>(null)
  const [hovered, hover] = useState(false)

  useFrame((state, delta) => {
    if (ref.current) {
      // Flotación sutil (desactivada con movimiento reducido)
      ref.current.position.y = reducedMotion
        ? position[1]
        : position[1] + Math.sin(state.clock.elapsedTime + index) * 0.08

      // De gris a color vibrante al pasar el cursor
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
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          hover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          hover(false)
          document.body.style.cursor = 'auto'
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          window.open(href, '_blank', 'noopener,noreferrer')
        }}
        toneMapped={false}
      />
    </group>
  )
}

// Navegación con flechas del teclado sobre el contenedor de scroll de drei
function KeyboardNav({ count }: { count: number }) {
  const scroll = useScroll()

  useEffect(() => {
    const el = scroll.el
    const step = () => (el.scrollHeight - el.clientHeight) / count
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        el.scrollBy({ top: step(), behavior: 'smooth' })
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        el.scrollBy({ top: -step(), behavior: 'smooth' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scroll, count])

  return null
}

interface GalleryProps {
  onCurrentChange?: (index: number) => void
  reducedMotion: boolean
}

export function Gallery({ onCurrentChange, reducedMotion }: GalleryProps) {
  const group = useRef<THREE.Group>(null)
  const scroll = useScroll()
  const lastCurrent = useRef(-1)

  const numItems = ARTWORKS.length
  const radius = 5.2

  const items = ARTWORKS.map((artwork, i) => {
    const angle = (i / numItems) * Math.PI * 2
    return {
      position: [Math.sin(angle) * radius, 0, Math.cos(angle) * radius] as [number, number, number],
      rotation: [0, angle, 0] as [number, number, number],
      url: artwork.url,
      href: artwork.href,
      scale: [3, 4, 1] as [number, number, number],
    }
  })

  useFrame((_, delta) => {
    if (group.current) {
      const targetRotation = scroll.offset * Math.PI * 2
      easing.damp(group.current.rotation, 'y', targetRotation, 0.25, delta)

      // Obra de frente: la de mayor coseno respecto a la cámara
      const rotation = group.current.rotation.y
      let best = 0
      let bestCos = -Infinity
      for (let i = 0; i < numItems; i++) {
        const c = Math.cos((i / numItems) * Math.PI * 2 + rotation)
        if (c > bestCos) {
          bestCos = c
          best = i
        }
      }
      if (best !== lastCurrent.current) {
        lastCurrent.current = best
        onCurrentChange?.(best)
      }
    }
  })

  return (
    <group ref={group} position={[0, -0.2, -4]}>
      {items.map((item, i) => (
        <GalleryItem key={i} index={i} reducedMotion={reducedMotion} {...item} />
      ))}
      <KeyboardNav count={numItems} />
    </group>
  )
}
