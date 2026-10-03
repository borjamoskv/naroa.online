import React, { useEffect, useRef, useState, useCallback } from 'react'
import { ARTWORKS } from '../artworks'
import { sound } from '../utils/audio'

// Paleta cromática atmosférica curada para cada una de las obras canónicas
const ARTWORK_AURA_COLORS: Record<number, string> = {
  1: 'rgba(185, 28, 28, 0.35)', // Marilyn Rocks (Carmesí Veneciano)
  2: 'rgba(30, 27, 75, 0.45)', // Amy Rocks (Cobalto Medianoche & Mica)
  3: 'rgba(24, 24, 27, 0.45)', // James Rocks (Grafito & Tungsteno)
  4: 'rgba(41, 37, 36, 0.45)', // Johnny Rocks (Sepia & Nogal Profundo)
  5: 'rgba(112, 26, 117, 0.38)', // Asúcar Celia Cruz (Fucsia & Sombra)
  6: 'rgba(59, 7, 100, 0.42)', // Baroque Farrokh (Púrpura Barroco Imperial)
  7: 'rgba(131, 24, 67, 0.35)', // Divinos: Marilyn (Magenta Sacro)
  8: 'rgba(30, 41, 59, 0.45)', // Divinos: Johnny (Pizarra Carbón)
  9: 'rgba(15, 23, 42, 0.50)', // Divinos: Amy (Negro Ígneo)
  10: 'rgba(69, 26, 3, 0.38)', // El Gran Dakari (Tierra & Bronce)
  11: 'rgba(31, 41, 55, 0.40)', // Audrey Hepburn (Platino Monolítico)
  12: 'rgba(127, 29, 29, 0.36)', // Geisha (Bermellón Kioto & Oro)
  13: 'rgba(120, 53, 15, 0.48)', // Lágrimas de Oro (Pan de Oro 24k)
  14: 'rgba(136, 19, 55, 0.35)', // Love (Rubí Pop)
  15: 'rgba(12, 74, 110, 0.40)', // La Pensadora (Azul Prusia Introspectivo)
  16: 'rgba(49, 46, 129, 0.38)', // Amor en Conserva (Acero Marino)
  17: 'rgba(113, 63, 18, 0.38)', // Cantinflas I (Ocre Festivo)
  18: 'rgba(28, 25, 23, 0.48)', // Dar la Lata (Acero & Pizarra)
  19: 'rgba(88, 28, 135, 0.42)', // Mr. Fahrenheit (Violeta Estelar)
  20: 'rgba(159, 18, 57, 0.38)', // Tedas Queen (Púrpura Regio)
  21: 'rgba(6, 95, 70, 0.36)', // Hammock in Tin (Esmeralda & Hojalata)
  22: 'rgba(22, 78, 99, 0.40)', // Sardine Tin Collage (Turquesa Pátina)
  23: 'rgba(63, 63, 70, 0.40)', // En Caja (Madera & Carbón)
  24: 'rgba(157, 23, 77, 0.35)', // Soy un Amor (Rosa Dorado)
  25: 'rgba(133, 77, 14, 0.45)', // The Golden Couple (Pan de Oro Doble)
  26: 'rgba(190, 24, 93, 0.35)', // Pink and Sparkles (Neón Mineral)
  27: 'rgba(20, 83, 45, 0.38)', // Monster Dragon (Jade Salvaje & Obsidiana)
  28: 'rgba(29, 78, 216, 0.40)', // Paul Rocks (Azul Cobalto & Lapislázuli)
  29: 'rgba(217, 119, 6, 0.38)', // Summer Monroe (Ámbar Estival & Oro)
  30: 'rgba(159, 18, 57, 0.45)', // La Famiglia (Carmesí Don Vito & Carbón)
  31: 'rgba(180, 83, 9, 0.40)', // Hacer el Indio (Terracota & Pluma)
  32: 'rgba(202, 138, 4, 0.42)', // Cantinflowers Kintsugi (Oro Kintsugi & Asfalto)
  33: 'rgba(161, 98, 7, 0.38)', // Espejo del Alma (Ocre Introspectivo)
  34: 'rgba(79, 70, 229, 0.40)', // DiviNos VaiVenes (Politena Sacro)
  35: 'rgba(225, 29, 72, 0.36)', // Autorretrato (Pastel Vivo & Carne)
  36: 'rgba(190, 18, 60, 0.44)', // Róisín (Tartán & Plumas Negras)
}

const ROMAN_NUMERALS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII',
  'XXVIII', 'XXIX', 'XXX', 'XXXI', 'XXXII', 'XXXIII', 'XXXIV', 'XXXV', 'XXXVI'
]



interface KineticHorizonProps {
  currentIndex: number
  onSelectArtwork: (index: number) => void
  onOpenLoupe: (index: number) => void
}

export function KineticHorizon({
  currentIndex,
  onSelectArtwork,
  onOpenLoupe,
}: KineticHorizonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1440
  )
  const [mouseCoord, setMouseCoord] = useState({ x: 0, y: 0 })
  const [cursorOverArtwork, setCursorOverArtwork] = useState<number | null>(null)

  // Espaciado continuo armónico entre monolitos (compone obra hero central + alas laterales visibles)
  const itemSpacing =
    viewportWidth < 640 ? Math.max(280, viewportWidth * 0.82) : Math.max(380, viewportWidth * 0.42)

  // Motor de física inercial (Virtual Momentum Scroll Engine)
  const targetXRef = useRef(currentIndex * itemSpacing)
  const currentXRef = useRef(currentIndex * itemSpacing)
  const velocityRef = useRef(0)
  const isDraggingRef = useRef(false)
  const hasDraggedRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartTargetXRef = useRef(0)
  const lastDragTimeRef = useRef(0)
  const lastDragXRef = useRef(0)
  const activeIndexRef = useRef(currentIndex)
  const lastAnnouncedIndexRef = useRef(currentIndex)
  const animationFrameRef = useRef<number | null>(null)

  // Estado para la renderización sin acceso a refs en el ciclo de render
  const [activeIdx, setActiveIdx] = useState(currentIndex)
  const [isDragging, setIsDragging] = useState(false)
  const [renderPos, setRenderPos] = useState(currentIndex * itemSpacing)

  // Sincronizar tamaño de pantalla dinámico
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      setViewportWidth(w)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Sincronizar targetX si currentIndex cambia desde el exterior (Índice, Hash, etc.)
  useEffect(() => {
    if (Math.abs(targetXRef.current - currentIndex * itemSpacing) > 10) {
      targetXRef.current = currentIndex * itemSpacing
      activeIndexRef.current = currentIndex
      lastAnnouncedIndexRef.current = currentIndex
      setActiveIdx(currentIndex)
    }
  }, [currentIndex, itemSpacing])

  // Precarga inteligente de imágenes adyacentes
  useEffect(() => {
    const indicesToPreload = [
      (currentIndex + 1) % ARTWORKS.length,
      (currentIndex + 2) % ARTWORKS.length,
      (currentIndex - 1 + ARTWORKS.length) % ARTWORKS.length,
    ]
    indicesToPreload.forEach((idx) => {
      const img = new Image()
      img.src = ARTWORKS[idx].url
    })
  }, [currentIndex])

  // Bucle de física inercial a 60/120 FPS
  useEffect(() => {
    let lastTime = performance.now()

    const updatePhysics = (now: number) => {
      const dt = Math.min(32, now - lastTime) / 16.666
      lastTime = now

      // Si el usuario no está arrastrando activamente, aplicar amortiguación inercial
      if (!isDraggingRef.current) {
        // Suavizado Lerp de alta costura (easing factor 0.082)
        const diff = targetXRef.current - currentXRef.current
        currentXRef.current += diff * 0.082 * dt

        // Cálculo de obra más próxima al centro focal
        const nearestIdx = Math.max(
          0,
          Math.min(ARTWORKS.length - 1, Math.round(currentXRef.current / itemSpacing))
        )

        // Si la inercia se está deteniendo suavemente, alinear con precisión magnética
        if (Math.abs(diff) < 1.5 && Math.abs(velocityRef.current) < 0.1) {
          currentXRef.current = targetXRef.current
        }

        // Anunciar cambio de obra al padre cuando cruza el ecuador focal
        if (nearestIdx !== lastAnnouncedIndexRef.current) {
          lastAnnouncedIndexRef.current = nearestIdx
          activeIndexRef.current = nearestIdx
          setActiveIdx(nearestIdx)
          sound.playHapticClick(1.0 + (nearestIdx % 3) * 0.08)
          onSelectArtwork(nearestIdx)
        }
      } else {
        // Durante el arrastre, seguir directamente a targetX con respuesta táctil inmediata
        currentXRef.current += (targetXRef.current - currentXRef.current) * 0.35 * dt
      }

      setRenderPos(currentXRef.current)
      animationFrameRef.current = requestAnimationFrame(updatePhysics)
    }

    animationFrameRef.current = requestAnimationFrame(updatePhysics)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [itemSpacing, onSelectArtwork])

  // Navegación secuencial suave (Prev / Next)
  const glideTo = useCallback(
    (newIndex: number) => {
      const clamped = Math.max(0, Math.min(ARTWORKS.length - 1, newIndex))
      sound.playHapticClick(1.1)
      targetXRef.current = clamped * itemSpacing
      lastAnnouncedIndexRef.current = clamped
      activeIndexRef.current = clamped
      onSelectArtwork(clamped)
    },
    [itemSpacing, onSelectArtwork]
  )

  const handleNext = useCallback(() => {
    glideTo(activeIndexRef.current + 1)
  }, [glideTo])

  const handlePrev = useCallback(() => {
    glideTo(activeIndexRef.current - 1)
  }, [glideTo])

  // Controles de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        handleNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        handlePrev()
      } else if (e.key === ' ' || e.key === 'Enter') {
        onOpenLoupe(activeIndexRef.current)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrev, onOpenLoupe])

  // Evento Wheel: convierte el scroll vertical o de trackpad en deslizamiento continuo fluido
  const handleWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    const maxX = (ARTWORKS.length - 1) * itemSpacing

    if (Math.abs(delta) > 6) {
      sound.playHapticSlide(delta * 0.04)
    }

    // Acumular desplazamiento continuo en el objetivo de inercia
    targetXRef.current = Math.max(0, Math.min(maxX, targetXRef.current + delta * 1.15))
  }

  // Interacción de Arrastre (Drag / Swipe con momentum)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    isDraggingRef.current = true
    hasDraggedRef.current = false
    setIsDragging(true)
    dragStartXRef.current = e.clientX
    dragStartTargetXRef.current = targetXRef.current
    lastDragXRef.current = e.clientX
    lastDragTimeRef.current = performance.now()
    velocityRef.current = 0
    sound.playHapticClick(0.9)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('naroa:cursor', { detail: { label: 'ARRASTRAR' } }))
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    setMouseCoord({ x: e.clientX, y: e.clientY })

    if (!isDraggingRef.current) return

    const totalDiff = e.clientX - dragStartXRef.current
    if (Math.abs(totalDiff) > 8) {
      hasDraggedRef.current = true
    }

    const now = performance.now()
    const dt = now - lastDragTimeRef.current
    const dx = e.clientX - lastDragXRef.current

    if (dt > 0) {
      velocityRef.current = dx / dt
      if (Math.abs(velocityRef.current) > 0.08) {
        sound.playHapticSlide(velocityRef.current)
      }
    }

    lastDragXRef.current = e.clientX
    lastDragTimeRef.current = now

    const maxX = (ARTWORKS.length - 1) * itemSpacing

    // Resistencia elástica sutil en los extremos
    let newTarget = dragStartTargetXRef.current - totalDiff * 1.1
    if (newTarget < 0) {
      newTarget = newTarget * 0.3
    } else if (newTarget > maxX) {
      newTarget = maxX + (newTarget - maxX) * 0.3
    }

    targetXRef.current = newTarget
  }

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsDragging(false)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('naroa:cursor', { detail: { label: null } }))
    }

    const maxX = (ARTWORKS.length - 1) * itemSpacing

    // Inyectar velocidad de lanzamiento por inercia
    let projectedTarget = targetXRef.current - velocityRef.current * 160
    projectedTarget = Math.max(0, Math.min(maxX, projectedTarget))

    // Ajustar con atracción magnética a la obra más cercana
    const targetIdx = Math.round(projectedTarget / itemSpacing)
    const finalSnappedTarget = targetIdx * itemSpacing

    targetXRef.current = Math.max(0, Math.min(maxX, finalSnappedTarget))
    sound.playHapticClick(1.05)
  }

  // Color de aura ambiental correspondiente a la obra central
  const currentArtworkId = ARTWORKS[activeIdx]?.id || 1
  const ambientAuraColor = ARTWORK_AURA_COLORS[currentArtworkId] || 'rgba(212, 175, 55, 0.28)'

  return (
    <div
      ref={containerRef}
      className="kinetic-stage"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        minHeight: '100vh',
        background: '#030305',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'pan-y',
      }}
    >
      {/* ATMÓSFERA CROMÁTICA VIVA (Cambia dinámicamente según la obra central) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 95% 75% at 50% 48%, ${ambientAuraColor} 0%, rgba(3, 3, 5, 0.95) 70%, #020204 100%)`,
          transition: 'background 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />


      {/* Viñeta de Sala de Museo & Chiaroscuro */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 35%, rgba(2, 2, 4, 0.88) 98%)',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />

      {/* FLECHA DE NAVEGACIÓN IZQUIERDA (FLOTANTE MINIMALISTA) */}
      <button
        className="desktop-only"
        data-cursor="ANTERIOR"
        onClick={(e) => {
          e.stopPropagation()
          handlePrev()
        }}
        disabled={activeIdx === 0}
        aria-label="Obra anterior"
        style={{
          position: 'absolute',
          left: 'clamp(14px, 2.5vw, 48px)',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 35,
          background: 'rgba(5, 5, 8, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '50%',
          width: 'clamp(42px, 4vw, 54px)',
          height: 'clamp(42px, 4vw, 54px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: activeIdx === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.65)',
          cursor: activeIdx === 0 ? 'default' : 'pointer',
          fontSize: '1.4rem',
          lineHeight: 1,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          transition: 'all 0.25s ease',
          fontFamily: 'var(--font-serif, serif)',
        }}
        onMouseEnter={(e) => {
          if (activeIdx > 0) {
            e.currentTarget.style.color = '#D4AF37'
            e.currentTarget.style.borderColor = '#D4AF37'
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = activeIdx === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.65)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
          e.currentTarget.style.transform = 'translateY(-50%) scale(1)'
        }}
      >
        ‹
      </button>

      {/* FLECHA DE NAVEGACIÓN DERECHA (FLOTANTE MINIMALISTA) */}
      <button
        className="desktop-only"
        data-cursor="SIGUIENTE"
        onClick={(e) => {
          e.stopPropagation()
          handleNext()
        }}
        disabled={activeIdx === ARTWORKS.length - 1}
        aria-label="Obra siguiente"
        style={{
          position: 'absolute',
          right: 'clamp(14px, 2.5vw, 48px)',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 35,
          background: 'rgba(5, 5, 8, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '50%',
          width: 'clamp(42px, 4vw, 54px)',
          height: 'clamp(42px, 4vw, 54px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: activeIdx === ARTWORKS.length - 1 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.65)',
          cursor: activeIdx === ARTWORKS.length - 1 ? 'default' : 'pointer',
          fontSize: '1.4rem',
          lineHeight: 1,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          transition: 'all 0.25s ease',
          fontFamily: 'var(--font-serif, serif)',
        }}
        onMouseEnter={(e) => {
          if (activeIdx < ARTWORKS.length - 1) {
            e.currentTarget.style.color = '#D4AF37'
            e.currentTarget.style.borderColor = '#D4AF37'
            e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = activeIdx === ARTWORKS.length - 1 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.65)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
          e.currentTarget.style.transform = 'translateY(-50%) scale(1)'
        }}
      >
        ›
      </button>

      {/* EL ESCENARIO PANORÁMICO CONTINUO (Continuous Horizon Runway) */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: '1400px',
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        {ARTWORKS.map((artwork, idx) => {
          // Desplazamiento respecto al centro focal de la pantalla
          const offset = idx * itemSpacing - renderPos

          // Optimización de rendimiento: omitir obras fuera del campo de visión extendido
          if (offset < -viewportWidth * 1.15 || offset > viewportWidth * 1.15) {
            return null
          }

          const normDist = offset / itemSpacing
          const absDist = Math.abs(normDist)

          // Modulación física continua de escala, rotación 3D, opacidad y desenfoque
          const scale = Math.max(0.70, 1 - absDist * 0.18)
          const rotateY = Math.max(-18, Math.min(18, -normDist * 14))
          const opacity = Math.max(0.24, 1 - absDist * 0.46)
          const zIndex = Math.round(50 - absDist * 18)
          const isCentered = absDist < 0.45
          const auraColor = ARTWORK_AURA_COLORS[artwork.id] || 'rgba(212, 175, 55, 0.3)'

          // Cálculo de coordenadas relativas normalizadas para perspectiva 3D interactiva y brillo de mica
          const winH = typeof window !== 'undefined' ? window.innerHeight : 900
          const normMouseX = Math.max(-1, Math.min(1, (mouseCoord.x - viewportWidth / 2) / (viewportWidth * 0.28)))
          const normMouseY = Math.max(-1, Math.min(1, (mouseCoord.y - winH / 2) / (winH * 0.36)))

          const interactiveTiltX = isCentered && cursorOverArtwork === idx ? -normMouseY * 13 : 0
          const interactiveTiltY = isCentered && cursorOverArtwork === idx ? normMouseX * 15 : 0

          // Coordenadas del foco especular de mica mineral (5% a 95%)
          const micaShineX = Math.round(Math.max(5, Math.min(95, 50 + normMouseX * 42)))
          const micaShineY = Math.round(Math.max(5, Math.min(95, 50 + normMouseY * 42)))

          return (
            <div
              key={artwork.id}
              data-cursor={isCentered ? 'LUPA' : 'EXPLORAR'}
              onClick={(e) => {
                e.stopPropagation()
                if (isCentered) {
                  sound.playOpen()
                  onOpenLoupe(idx)
                } else {
                  glideTo(idx)
                }
              }}
              onMouseEnter={() => setCursorOverArtwork(idx)}
              onMouseLeave={() => setCursorOverArtwork(null)}
              style={{
                position: 'absolute',
                left: `calc(50% + ${offset}px)`,
                top: '50%',
                transform: `translate(-50%, -50%) scale(${scale}) rotateX(${interactiveTiltX}deg) rotateY(${rotateY + interactiveTiltY}deg)`,
                transformOrigin: 'center center',
                transformStyle: 'preserve-3d',
                opacity,
                zIndex,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                pointerEvents: 'auto',
                transition: isDragging
                  ? 'none'
                  : 'transform 0.14s ease-out, opacity 0.15s ease-out',
              }}
            >
              {/* NUMERAL MONUMENTAL EN PARALLAX CLÁSICO DE ALTA COSTURA */}
              <div
                style={{
                  position: 'absolute',
                  top: '38%',
                  left: '50%',
                  transform: `translate(-50%, -50%) translateX(${offset * -0.15}px) translateZ(-60px)`,
                  fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                  fontSize: 'clamp(180px, 26vw, 340px)',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: '#D4AF37',
                  opacity: Math.max(0.012, 0.048 - absDist * 0.03),
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  zIndex: 1,
                  lineHeight: 0.8,
                }}
              >
                {ROMAN_NUMERALS[idx] || String(idx + 1).padStart(2, '0')}
              </div>

              {/* HALO ESPECULAR PROFUNDO DE LA PIEZA */}
              <div
                style={{
                  position: 'absolute',
                  width: '90%',
                  height: '80%',
                  background: `radial-gradient(circle, ${auraColor} 0%, rgba(212, 175, 55, 0.08) 50%, transparent 75%)`,
                  filter: 'blur(50px)',
                  transform: 'translateZ(-40px)',
                  pointerEvents: 'none',
                  opacity: isCentered ? 0.9 : 0.3,
                  transition: 'opacity 0.4s ease',
                }}
              />

              {/* CONTENEDOR DE LA OBRA (SILUETA GEOLÓGICA DE PIZARRA PURA) */}
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 10,
                  transformStyle: 'preserve-3d',
                }}
              >
                <img
                  src={artwork.url}
                  alt={artwork.title}
                  draggable={false}
                  style={{
                    maxHeight: 'clamp(460px, 66vh, 720px)',
                    maxWidth: 'clamp(320px, 50vw, 680px)',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                    filter: isCentered
                      ? `drop-shadow(${-normMouseX * 14}px ${25 - normMouseY * 10}px 50px rgba(0,0,0,0.92)) drop-shadow(0 8px 20px rgba(0,0,0,0.65))`
                      : 'drop-shadow(0 15px 30px rgba(0,0,0,0.85)) brightness(0.75)',
                    transform: cursorOverArtwork === idx && isCentered ? 'scale(1.025) translateZ(20px)' : 'scale(1) translateZ(0px)',
                    transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />

                {/* DESTELLO ESPECULAR CAÚSTICO MULTICAPA DE MICA MINERAL & ORO 24K */}
                {isCentered && (
                  <>
                    {/* Capa 1: Foco caústico radial de mica */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: `radial-gradient(circle 380px at ${micaShineX}% ${micaShineY}%, rgba(255, 255, 255, 0.46) 0%, rgba(212, 175, 55, 0.35) 22%, rgba(212, 175, 55, 0.08) 48%, transparent 72%)`,
                        mixBlendMode: 'color-dodge',
                        pointerEvents: 'none',
                        zIndex: 15,
                        opacity: cursorOverArtwork === idx ? 0.95 : 0.42,
                        transition: 'opacity 0.25s ease',
                      }}
                    />

                    {/* Capa 2: Franja laminar anisótropa de mica (shimmer sheen) */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: `linear-gradient(${112 + normMouseX * 24}deg, transparent 30%, rgba(255, 235, 175, 0.22) 46%, rgba(255, 255, 255, 0.65) 50%, rgba(212, 175, 55, 0.3) 54%, transparent 70%)`,
                        mixBlendMode: 'overlay',
                        pointerEvents: 'none',
                        zIndex: 16,
                        opacity: cursorOverArtwork === idx ? 0.88 : 0.22,
                        transition: 'opacity 0.25s ease',
                      }}
                    />
                  </>
                )}

                {/* SOMBRA DE CONTACTO MONUMENTAL DE LA PIEDRA */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '85%',
                    height: '28px',
                    background: 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.6) 45%, transparent 75%)',
                    filter: 'blur(6px)',
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                />

                {/* REFLEJO ESPECULAR DE SUELO EN OBSIDIANA (1:1 ALINEADO) */}
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%) scaleY(-1)',
                    height: 'clamp(80px, 14vh, 140px)',
                    overflow: 'hidden',
                    marginTop: '-6px',
                    pointerEvents: 'none',
                    opacity: isCentered ? 0.20 : 0.06,
                    filter: 'blur(3px)',
                    maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 85%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 85%)',
                    transition: 'opacity 0.4s ease',
                  }}
                >
                  <img
                    src={artwork.url}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    style={{
                      maxHeight: 'clamp(460px, 66vh, 720px)',
                      maxWidth: 'clamp(320px, 50vw, 680px)',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </div>
              </div>

              {/* CARTELA CURATORIAL ULTRA-MINIMALISTA (Flota con elegancia sin saturar) */}
              <div
                style={{
                  marginTop: 'clamp(6px, 1.2vh, 16px)',
                  textAlign: 'center',
                  opacity: Math.max(0, 1 - absDist * 1.8),
                  transform: `translateY(${absDist * 12}px)`,
                  transition: 'opacity 0.3s ease, transform 0.3s ease',
                  pointerEvents: isCentered ? 'auto' : 'none',
                  zIndex: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {artwork.kicker && isCentered && (
                  <div
                    style={{
                      fontFamily: 'var(--font-editorial, "Cormorant Garamond", Georgia, serif)',
                      fontStyle: 'italic',
                      fontSize: 'clamp(0.88rem, 1.2vw, 1.05rem)',
                      color: 'rgba(212, 175, 55, 0.95)',
                      letterSpacing: '0.04em',
                      marginBottom: '4px',
                      textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)',
                    }}
                  >
                    «{artwork.kicker}»
                  </div>
                )}

                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                    fontSize: 'clamp(1.4rem, 2.6vw, 2.2rem)',
                    fontWeight: 600,
                    letterSpacing: '0.16em',
                    color: '#FFFFFF',
                    textTransform: 'uppercase',
                    textShadow: '0 2px 14px rgba(0, 0, 0, 0.9)',
                  }}
                >
                  {artwork.title}
                </h2>

                <p
                  style={{
                    margin: '6px 0 0 0',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 'clamp(0.68rem, 0.9vw, 0.78rem)',
                    letterSpacing: '0.22em',
                    color: '#D4AF37',
                    textTransform: 'uppercase',
                  }}
                >
                  {artwork.year} · {artwork.medium}
                </p>

                {isCentered && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      marginTop: '8px',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '0.62rem',
                      letterSpacing: '0.18em',
                      color: 'rgba(255, 255, 255, 0.55)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(212, 175, 55, 0.28)',
                      padding: '3px 12px',
                      borderRadius: '20px',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    <span>🔍</span>
                    <span>PULSA PARA LUPA DE ALTA RESOLUCIÓN</span>
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* LÍNEA DE SCRUBBER TÁCTIL GOLDEN (PUNTOS CANÓNICOS) */}
      <div
        style={{
          position: 'relative',
          zIndex: 30,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          paddingBottom: 'clamp(84px, 11vh, 98px)', // Espacio para el HauteDock inferior
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          data-cursor="ARRASTRAR"
          style={{
            position: 'relative',
            width: 'clamp(280px, 44vw, 680px)',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
            const targetIndex = Math.round(ratio * (ARTWORKS.length - 1))
            glideTo(targetIndex)
          }}
        >
          {/* Línea base sutil */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: '1px',
              background: 'rgba(255, 255, 255, 0.15)',
            }}
          />

          {/* Marcadores discretos de las obras canónicas */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {ARTWORKS.map((_, idx) => {
              const isActive = idx === activeIdx
              return (
                <div
                  key={idx}
                  data-cursor="VER"
                  onClick={(e) => {
                    e.stopPropagation()
                    glideTo(idx)
                  }}
                  style={{
                    width: isActive ? '6px' : '2px',
                    height: isActive ? '6px' : '2px',
                    borderRadius: '50%',
                    background: isActive ? '#D4AF37' : 'rgba(255, 255, 255, 0.25)',
                    boxShadow: isActive ? '0 0 10px rgba(212, 175, 55, 0.9)' : 'none',
                    transition: 'all 0.25s ease',
                    cursor: 'pointer',
                  }}
                />
              )
            })}
          </div>

          {/* Maneta áurea flotante en tiempo real */}
          <div
            style={{
              position: 'absolute',
              left: `${(renderPos / ((ARTWORKS.length - 1) * itemSpacing)) * 100}%`,
              transform: 'translateX(-50%)',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#D4AF37',
              boxShadow: '0 0 14px rgba(212, 175, 55, 0.95)',
              transition: isDragging ? 'none' : 'left 0.12s ease-out',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Curatorial HUD / Interaction hints */}
        <div
          className="desktop-only"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            marginTop: '4px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.62rem',
            letterSpacing: '0.14em',
            color: 'rgba(255, 255, 255, 0.38)',
            textTransform: 'uppercase',
            userSelect: 'none',
          }}
        >
          <span>
            <strong style={{ color: '#D4AF37', fontWeight: 600 }}>← →</strong> NAVEGAR
          </span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>
            <strong style={{ color: '#D4AF37', fontWeight: 600 }}>ESPACIO</strong> LUPA ULTRA-HD
          </span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>
            <strong style={{ color: '#D4AF37', fontWeight: 600 }}>WHEEL</strong> INERCIA FLUIDA
          </span>
        </div>
      </div>
    </div>
  )
}
