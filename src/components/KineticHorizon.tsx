import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { ARTWORKS } from '../artworks'
import { sound } from '../utils/audio'

interface MicaParticle {
  x: number
  y: number
  size: number
  speedY: number
  speedX: number
  opacity: number
  pulse: number
  color: string
}

function AmbientMicaDust({ mousePos }: { mousePos: { x: number; y: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    const particles: MicaParticle[] = Array.from({ length: 85 }, () => {
      const rx = Math.random() * width
      const ry = Math.random() * height
      return {
        x: rx,
        y: ry,
        size: Math.random() * 2.0 + 0.6,
        speedY: -(Math.random() * 0.25 + 0.05),
        speedX: (Math.random() - 0.5) * 0.12,
        opacity: Math.random() * 0.5 + 0.2,
        pulse: Math.random() * Math.PI * 2,
        color: Math.random() > 0.35 ? 'rgba(212, 175, 55,' : 'rgba(255, 255, 255,',
      }
    })

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.y += p.speedY
        p.x += p.speedX
        p.pulse += 0.018

        const dx = mousePos.x - p.x
        const dy = mousePos.y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 150) {
          const force = (150 - dist) / 150
          p.x -= (dx / dist) * force * 0.9
          p.y -= (dy / dist) * force * 0.9
        }

        if (p.y < -10) {
          p.y = height + 10
          p.x = Math.random() * width
        }
        if (p.x < -10) p.x = width + 10
        if (p.x > width + 10) p.x = -10

        const alpha = Math.max(0.1, Math.min(0.85, p.opacity + Math.sin(p.pulse) * 0.2))

        ctx.fillStyle = `${p.color} ${alpha})`
        ctx.shadowColor = '#D4AF37'
        ctx.shadowBlur = p.size > 1.6 ? 4 : 1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      animId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
    }
  }, [mousePos])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  )
}

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
  const [mouseCoord, setMouseCoord] = useState({ x: 0, y: 0 })
  const [spotlightPos, setSpotlightPos] = useState({ x: 50, y: 50 })
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)
  const lastWheelTime = useRef(0)

  const currentArtwork = ARTWORKS[currentIndex]
  const prevIndex = (currentIndex - 1 + ARTWORKS.length) % ARTWORKS.length
  const nextIndex = (currentIndex + 1) % ARTWORKS.length

  const prevArtwork = ARTWORKS[prevIndex]
  const nextArtwork = ARTWORKS[nextIndex]

  // Física 3D sutil del lienzo central al mover el cursor
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springConfig = { damping: 28, stiffness: 200, mass: 0.5 }
  const rotateX = useSpring(useTransform(mouseY, [-300, 300], [6, -6]), springConfig)
  const rotateY = useSpring(useTransform(mouseX, [-400, 400], [-7, 7]), springConfig)

  const handleNext = useCallback(() => {
    sound.playTick()
    onSelectArtwork((currentIndex + 1) % ARTWORKS.length)
  }, [currentIndex, onSelectArtwork])

  const handlePrev = useCallback(() => {
    sound.playTick()
    onSelectArtwork((currentIndex - 1 + ARTWORKS.length) % ARTWORKS.length)
  }, [currentIndex, onSelectArtwork])

  // Controles de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        handleNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        handlePrev()
      } else if (e.key === ' ' || e.key === 'Enter') {
        onOpenLoupe(currentIndex)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrev, onOpenLoupe, currentIndex])

  // Rueda de ratón / Trackpad con amortiguación
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now()
    if (now - lastWheelTime.current < 260) return

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(delta) > 22) {
      lastWheelTime.current = now
      if (delta > 0) handleNext()
      else handlePrev()
    }
  }

  // Interacción táctil / Arrastre
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartX.current = e.touches[0].clientX
    setIsDragging(true)
    setDragOffset(0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const diff = e.touches[0].clientX - dragStartX.current
    setDragOffset(diff * 0.4)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging) return
    const diff = e.changedTouches[0].clientX - dragStartX.current
    if (Math.abs(diff) > 40) {
      if (diff > 0) handlePrev()
      else handleNext()
    }
    setIsDragging(false)
    setDragOffset(0)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragStartX.current = e.clientX
    setIsDragging(true)
    setDragOffset(0)
  }

  const handleMouseMoveGlobal = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const clientX = e.clientX - rect.left
    const clientY = e.clientY - rect.top

    mouseX.set(clientX - centerX)
    mouseY.set(clientY - centerY)
    setMouseCoord({ x: e.clientX, y: e.clientY })

    setSpotlightPos({
      x: Math.round((clientX / rect.width) * 100),
      y: Math.round((clientY / rect.height) * 100),
    })

    if (isDragging) {
      const diff = e.clientX - dragStartX.current
      setDragOffset(diff * 0.35)
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return
    const diff = e.clientX - dragStartX.current
    if (Math.abs(diff) > 45) {
      if (diff > 0) handlePrev()
      else handleNext()
    }
    setIsDragging(false)
    setDragOffset(0)
  }

  return (
    <div
      className="kinetic-stage"
      onMouseMove={handleMouseMoveGlobal}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        minHeight: '100vh',
        background: 'radial-gradient(ellipse 90% 70% at 50% 48%, #090a10 0%, #020204 100%)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      {/* Polvo de Mica Mineral en Suspensión Cuántica */}
      <AmbientMicaDust mousePos={mouseCoord} />

      {/* Viñeta de Museo & Chiaroscuro */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 40%, rgba(2, 2, 4, 0.85) 95%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* EL HORIZONTE CINÉTICO 3D (Tríptico en Perspectiva Real) */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: '1600px',
          width: '100%',
          overflow: 'visible',
        }}
      >
        {/* BOTÓN PREV FLOTANTE MINIMALISTA */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handlePrev()
          }}
          aria-label="Obra anterior"
          style={{
            position: 'absolute',
            left: 'clamp(16px, 3.5vw, 60px)',
            zIndex: 25,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.45)',
            cursor: 'pointer',
            padding: '20px',
            fontSize: '1.8rem',
            lineHeight: 1,
            transition: 'all 0.3s ease',
            fontFamily: 'var(--font-serif, serif)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#D4AF37'
            e.currentTarget.style.transform = 'translateX(-4px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)'
            e.currentTarget.style.transform = 'translateX(0)'
          }}
        >
          ‹
        </button>

        {/* CONTENEDOR KINÉTICO CON DRAG */}
        <motion.div
          animate={{ x: dragOffset }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            position: 'relative',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* OBRA ANTERIOR (EN ALA IZQUIERDA) */}
          <div
            onClick={(e) => {
              e.stopPropagation()
              handlePrev()
            }}
            className="desktop-only"
            style={{
              position: 'absolute',
              right: 'calc(50% + min(42vw, 420px))',
              height: 'clamp(360px, 52vh, 520px)',
              width: 'auto',
              maxHeight: '520px',
              opacity: 0.35,
              transform: 'rotateY(16deg) scale(0.8)',
              transformOrigin: 'right center',
              filter: 'blur(2px) brightness(0.65)',
              transition: 'all 0.4s ease',
              cursor: 'pointer',
              zIndex: 3,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.6'
              e.currentTarget.style.filter = 'blur(1px) brightness(0.85)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.35'
              e.currentTarget.style.filter = 'blur(2px) brightness(0.65)'
            }}
          >
            <img
              src={prevArtwork.url}
              alt={prevArtwork.title}
              style={{
                height: '100%',
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
                filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.9))',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* OBRA CENTRAL MONUMENTAL (HERO VISUAL ABSOLUTO) */}
          <motion.div
            style={{
              position: 'relative',
              height: 'clamp(440px, 66vh, 720px)',
              width: 'min(92vw, 840px)',
              maxHeight: '720px',
              rotateX,
              rotateY,
              transformStyle: 'preserve-3d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
            onClick={(e) => {
              e.stopPropagation()
              sound.playOpen()
              onOpenLoupe(currentIndex)
            }}
          >
            {/* Halo de Resplandor Dorado Áureo (Profundidad Mineral) */}
            <div
              style={{
                position: 'absolute',
                width: '88%',
                height: '88%',
                background: 'radial-gradient(circle, rgba(212, 175, 55, 0.28) 0%, rgba(20, 25, 45, 0.08) 55%, transparent 75%)',
                filter: 'blur(55px)',
                transform: 'translateZ(-50px)',
                pointerEvents: 'none',
              }}
            />

            {/* LA OBRA ORIGINAL (SIN MARCO ARTIFICIAL — SILUETA GEOLÓGICA PURA) */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentArtwork.id}
                initial={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 1.04, filter: 'blur(4px)' }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'relative',
                  height: '100%',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={currentArtwork.url}
                  alt={`${currentArtwork.title} — ${currentArtwork.medium} — Naroa Gutiérrez Gil`}
                  style={{
                    maxHeight: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    filter: 'drop-shadow(0 35px 70px rgba(0, 0, 0, 0.98)) drop-shadow(0 0 25px rgba(212, 175, 55, 0.12))',
                    cursor: 'zoom-in',
                  }}
                />

                {/* Haz de Luz Especular Galería sobre la Textura de la Pizarra */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(circle 320px at ${spotlightPos.x}% ${spotlightPos.y}%, rgba(212, 175, 55, 0.22) 0%, rgba(255, 255, 255, 0.07) 30%, transparent 70%)`,
                    mixBlendMode: 'overlay',
                    pointerEvents: 'none',
                    transition: 'background 0.04s ease-out',
                  }}
                />
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* OBRA SIGUIENTE (EN ALA DERECHA) */}
          <div
            onClick={(e) => {
              e.stopPropagation()
              handleNext()
            }}
            className="desktop-only"
            style={{
              position: 'absolute',
              left: 'calc(50% + min(42vw, 420px))',
              height: 'clamp(360px, 52vh, 520px)',
              width: 'auto',
              maxHeight: '520px',
              opacity: 0.35,
              transform: 'rotateY(-16deg) scale(0.8)',
              transformOrigin: 'left center',
              filter: 'blur(2px) brightness(0.65)',
              transition: 'all 0.4s ease',
              cursor: 'pointer',
              zIndex: 3,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.6'
              e.currentTarget.style.filter = 'blur(1px) brightness(0.85)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.35'
              e.currentTarget.style.filter = 'blur(2px) brightness(0.65)'
            }}
          >
            <img
              src={nextArtwork.url}
              alt={nextArtwork.title}
              style={{
                height: '100%',
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
                filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.9))',
                pointerEvents: 'none',
              }}
            />
          </div>
        </motion.div>

        {/* BOTÓN NEXT FLOTANTE MINIMALISTA */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleNext()
          }}
          aria-label="Obra siguiente"
          style={{
            position: 'absolute',
            right: 'clamp(16px, 3.5vw, 60px)',
            zIndex: 25,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.45)',
            cursor: 'pointer',
            padding: '20px',
            fontSize: '1.8rem',
            lineHeight: 1,
            transition: 'all 0.3s ease',
            fontFamily: 'var(--font-serif, serif)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#D4AF37'
            e.currentTarget.style.transform = 'translateX(4px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)'
            e.currentTarget.style.transform = 'translateX(0)'
          }}
        >
          ›
        </button>
      </div>

      {/* PLACA CURATORIAL EDITORIAL INFERIOR (Pura Elegancia de Museo) */}
      <footer
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '0 24px 96px',
          maxWidth: '900px',
          margin: '0 auto',
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentArtwork.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            {/* Título en Cinzel Monumental */}
            <h1
              style={{
                fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                fontSize: 'clamp(1.35rem, 3.8vw, 2.7rem)',
                fontWeight: 600,
                letterSpacing: '0.1em',
                color: '#FFFFFF',
                margin: 0,
                lineHeight: 1.15,
                textTransform: 'uppercase',
              }}
            >
              {currentArtwork.title}
            </h1>

            {/* Técnica y Materialidad */}
            <p
              style={{
                fontFamily: 'var(--font-editorial, "Cormorant Garamond", Georgia, serif)',
                fontStyle: 'italic',
                fontSize: 'clamp(0.95rem, 1.8vw, 1.25rem)',
                color: '#D4AF37',
                letterSpacing: '0.06em',
                margin: '2px 0 0 0',
              }}
            >
              {currentArtwork.medium}
            </p>

            {/* Micro-invitación táctil a la Lupa */}
            <div
              style={{
                marginTop: '10px',
                pointerEvents: 'auto',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 14px',
                borderRadius: '20px',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                background: 'rgba(5, 5, 8, 0.4)',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.25s ease',
              }}
              onClick={() => {
                sound.playOpen()
                onOpenLoupe(currentIndex)
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#D4AF37'
                e.currentTarget.style.background = 'rgba(212, 175, 55, 0.12)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.25)'
                e.currentTarget.style.background = 'rgba(5, 5, 8, 0.4)'
              }}
            >
              <span style={{ fontSize: '0.75rem', color: '#D4AF37' }}>✦</span>
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.66rem',
                  letterSpacing: '0.18em',
                  color: 'rgba(255, 255, 255, 0.75)',
                  textTransform: 'uppercase',
                }}
              >
                PULSAR PARA EXPLORAR TEXTURA FÓSIL
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </footer>
    </div>
  )
}
