import { useEffect, useState, useRef } from 'react'

export function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 })
  const [isPointer, setIsPointer] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isClicking, setIsClicking] = useState(false)
  const [cursorLabel, setCursorLabel] = useState<string | null>(null)

  const trailingPos = useRef({ x: -100, y: -100 })
  const [smoothPos, setSmoothPos] = useState({ x: -100, y: -100 })
  const programmaticLabelRef = useRef<string | null>(null)

  useEffect(() => {
    // Desactivar en pantallas táctiles o punteros no precisos (coarse pointer)
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
      return
    }

    let animId: number

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY })
      if (!isVisible) setIsVisible(true)

      // Si hay un label programático forzado (ej. durante drag), respetarlo
      if (programmaticLabelRef.current) {
        setCursorLabel(programmaticLabelRef.current)
        setIsPointer(true)
        return
      }

      const target = e.target as HTMLElement | null
      if (target) {
        // 1. Detección de atributo declarativo data-cursor
        const cursorEl = target.closest('[data-cursor]') as HTMLElement | null
        const label = cursorEl ? cursorEl.getAttribute('data-cursor') : null
        setCursorLabel(label)

        // 2. Detección de elementos interactivos
        const isClickable =
          Boolean(label) ||
          window.getComputedStyle(target).cursor === 'pointer' ||
          target.tagName === 'A' ||
          target.tagName === 'BUTTON' ||
          target.closest('a') !== null ||
          target.closest('button') !== null ||
          target.getAttribute('role') === 'button'
        setIsPointer(isClickable)
      }
    }

    // Evento personalizado para mutaciones programáticas (e.g. durante drag continuo)
    const handleCustomCursorEvent = (e: Event) => {
      const customEvt = e as CustomEvent<{ label?: string | null }>
      if (customEvt.detail) {
        const nextLabel = customEvt.detail.label ?? null
        programmaticLabelRef.current = nextLabel
        setCursorLabel(nextLabel)
        if (nextLabel) setIsPointer(true)
      }
    }

    const handleMouseDown = () => setIsClicking(true)
    const handleMouseUp = () => setIsClicking(false)
    const handleMouseLeave = () => setIsVisible(false)
    const handleMouseEnter = () => setIsVisible(true)

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseenter', handleMouseEnter)
    window.addEventListener('naroa:cursor' as any, handleCustomCursorEvent)

    // Interpolación cinemática suave para el seguidor exterior (Lerp factor 0.20)
    const render = () => {
      trailingPos.current.x += (position.x - trailingPos.current.x) * 0.20
      trailingPos.current.y += (position.y - trailingPos.current.y) * 0.20
      setSmoothPos({ x: trailingPos.current.x, y: trailingPos.current.y })
      animId = requestAnimationFrame(render)
    }
    animId = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseenter', handleMouseEnter)
      window.removeEventListener('naroa:cursor' as any, handleCustomCursorEvent)
      cancelAnimationFrame(animId)
    }
  }, [position, isVisible])

  if (!isVisible) return null

  return (
    <>
      {/* 1. Micro-puntero central de latencia cero (oro mineral) */}
      <div
        style={{
          position: 'fixed',
          top: position.y,
          left: position.x,
          width: isClicking ? '6px' : '4px',
          height: isClicking ? '6px' : '4px',
          backgroundColor: '#D4AF37',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 9999999,
          boxShadow: '0 0 8px rgba(212, 175, 55, 0.95)',
          transition: 'width 0.12s ease, height 0.12s ease',
        }}
      />

      {/* 2. Anillo / Cápsula fluida con mix-blend-mode: difference de alta costura */}
      <div
        style={{
          position: 'fixed',
          top: smoothPos.y,
          left: smoothPos.x,
          transform: `translate(-50%, -50%) scale(${isClicking ? 0.88 : 1})`,
          pointerEvents: 'none',
          zIndex: 9999998,
          mixBlendMode: 'difference',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition:
            'transform 0.12s ease-out, width 0.28s cubic-bezier(0.16, 1, 0.3, 1), height 0.28s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.25s ease, background-color 0.2s ease, border-color 0.2s ease',
          ...(cursorLabel
            ? {
                minWidth: '78px',
                height: '32px',
                padding: '0 12px',
                borderRadius: '16px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #FFFFFF',
              }
            : isPointer
            ? {
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                border: '1.5px solid #FFFFFF',
              }
            : {
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.55)',
              }),
        }}
      >
        {cursorLabel && (
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.62rem',
              fontWeight: 800,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#000000',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            {cursorLabel}
          </span>
        )}
      </div>
    </>
  )
}
