import { useEffect, useState, useRef } from 'react'

export function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 })
  const [isPointer, setIsPointer] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isClicking, setIsClicking] = useState(false)

  const trailingPos = useRef({ x: -100, y: -100 })
  const [smoothPos, setSmoothPos] = useState({ x: -100, y: -100 })

  useEffect(() => {
    // Desactivar en pantallas táctiles o punteros no precisos
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
      return
    }

    let animId: number

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY })
      if (!isVisible) setIsVisible(true)

      const target = e.target as HTMLElement | null
      if (target) {
        const isClickable =
          window.getComputedStyle(target).cursor === 'pointer' ||
          target.tagName === 'A' ||
          target.tagName === 'BUTTON' ||
          target.closest('a') !== null ||
          target.closest('button') !== null
        setIsPointer(isClickable)
      }
    }

    const handleMouseDown = () => setIsClicking(true)
    const handleMouseUp = () => setIsClicking(false)
    const handleMouseLeave = () => setIsVisible(false)
    const handleMouseEnter = () => setIsVisible(true)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseenter', handleMouseEnter)

    // Interpolación cinemática suave para el anillo exterior
    const render = () => {
      trailingPos.current.x += (position.x - trailingPos.current.x) * 0.18
      trailingPos.current.y += (position.y - trailingPos.current.y) * 0.18
      setSmoothPos({ x: trailingPos.current.x, y: trailingPos.current.y })
      animId = requestAnimationFrame(render)
    }
    animId = requestAnimationFrame(render)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseenter', handleMouseEnter)
      cancelAnimationFrame(animId)
    }
  }, [position, isVisible])

  if (!isVisible) return null

  return (
    <>
      {/* Núcleo de Oro Mineral Instantáneo */}
      <div
        style={{
          position: 'fixed',
          top: position.y,
          left: position.x,
          width: isClicking ? '8px' : '4px',
          height: isClicking ? '8px' : '4px',
          backgroundColor: '#D4AF37',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 999999,
          boxShadow: '0 0 8px rgba(212, 175, 55, 0.8)',
          transition: 'width 0.15s ease, height 0.15s ease',
        }}
      />

      {/* Anillo de Inercia Fluida con Estética Obsidian & Gold */}
      <div
        style={{
          position: 'fixed',
          top: smoothPos.y,
          left: smoothPos.x,
          width: isPointer ? '48px' : '26px',
          height: isPointer ? '48px' : '26px',
          border: isPointer ? '1px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.35)',
          backgroundColor: isPointer ? 'rgba(212, 175, 55, 0.08)' : 'transparent',
          borderRadius: '50%',
          transform: `translate(-50%, -50%) scale(${isClicking ? 0.85 : 1})`,
          pointerEvents: 'none',
          zIndex: 999998,
          backdropFilter: isPointer ? 'blur(2px)' : 'none',
          transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), height 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, background-color 0.25s ease, transform 0.15s ease',
        }}
      />
    </>
  )
}
