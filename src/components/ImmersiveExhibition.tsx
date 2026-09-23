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

    const particles: MicaParticle[] = Array.from({ length: 95 }, () => {
      const rx = Math.random() * width
      const ry = Math.random() * height
      return {
        x: rx,
        y: ry,
        size: Math.random() * 2.2 + 0.6,
        speedY: -(Math.random() * 0.28 + 0.06),
        speedX: (Math.random() - 0.5) * 0.15,
        opacity: Math.random() * 0.55 + 0.25,
        pulse: Math.random() * Math.PI * 2,
        color: Math.random() > 0.4 ? 'rgba(212, 175, 55,' : 'rgba(255, 255, 255,',
      }
    })

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.y += p.speedY
        p.x += p.speedX
        p.pulse += 0.02

        const dx = mousePos.x - p.x
        const dy = mousePos.y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 160) {
          const force = (160 - dist) / 160
          p.x -= (dx / dist) * force * 1.0
          p.y -= (dy / dist) * force * 1.0
        }

        if (p.y < -10) {
          p.y = height + 10
          p.x = Math.random() * width
        }
        if (p.x < -10) p.x = width + 10
        if (p.x > width + 10) p.x = -10

        const alpha = Math.max(0.1, Math.min(0.9, p.opacity + Math.sin(p.pulse) * 0.2))

        ctx.fillStyle = `${p.color} ${alpha})`
        ctx.shadowColor = '#D4AF37'
        ctx.shadowBlur = p.size > 1.8 ? 5 : 2
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

interface ImmersiveExhibitionProps {
  onInspectArtwork: (index: number) => void
}

export function ImmersiveExhibition({ onInspectArtwork }: ImmersiveExhibitionProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mouseCoord, setMouseCoord] = useState({ x: 0, y: 0 })
  const [spotlightPos, setSpotlightPos] = useState({ x: 50, y: 50 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)
  const lastWheelTime = useRef(0)

  const currentArtwork = ARTWORKS[currentIndex]

  // Física 3D del lienzo central
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springConfig = { damping: 26, stiffness: 180, mass: 0.6 }
  const rotateX = useSpring(useTransform(mouseY, [-300, 300], [8, -8]), springConfig)
  const rotateY = useSpring(useTransform(mouseX, [-400, 400], [-9, 9]), springConfig)
  const translateX = useSpring(useTransform(mouseX, [-400, 400], [-6, 6]), springConfig)
  const translateY = useSpring(useTransform(mouseY, [-300, 300], [-6, 6]), springConfig)

  const handleNext = useCallback(() => {
    sound.playTick()
    setCurrentIndex((prev) => (prev + 1) % ARTWORKS.length)
  }, [])

  const handlePrev = useCallback(() => {
    sound.playTick()
    setCurrentIndex((prev) => (prev - 1 + ARTWORKS.length) % ARTWORKS.length)
  }, [])

  // Teclado (flechas)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        handleNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        handlePrev()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrev])

  // Rueda de ratón / Trackpad con throttling
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now()
    if (now - lastWheelTime.current < 280) return

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(delta) > 25) {
      lastWheelTime.current = now
      if (delta > 0) {
        handleNext()
      } else {
        handlePrev()
      }
    }
  }

  // Interacción táctil / Drag
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartX.current = e.touches[0].clientX
    setIsDragging(true)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging) return
    const diff = dragStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 45) {
      if (diff > 0) handleNext()
      else handlePrev()
    }
    setIsDragging(false)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
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
  }

  return (
    <div
      className="immersive-stage"
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 'calc(100vh - 72px)',
        height: 'calc(100vh - 72px)',
        background: 'radial-gradient(ellipse 95% 75% at 50% 45%, #0d0e14 0%, #030305 100%)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 'clamp(14px, 2vh, 24px) clamp(16px, 3vw, 40px)',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* Polvo de Mica Mineral en suspensión */}
      <AmbientMicaDust mousePos={mouseCoord} />

      {/* Viñeteado de Sala de Museo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 35%, rgba(3, 3, 5, 0.82) 90%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* CABECERA MINIMALISTA SUPERIOR (Índice y Palíndromo) */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: '1440px',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.78rem',
              color: '#D4AF37',
              letterSpacing: '0.18em',
              fontWeight: 700,
            }}
          >
            {String(currentIndex + 1).padStart(2, '0')} / {String(ARTWORKS.length).padStart(2, '0')}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.72rem',
              color: 'rgba(255,255,255,0.65)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            EXPOSICIÓN CANÓNICA
          </span>
        </div>

        {/* Palíndromo Sutil */}
        <div
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.72rem',
            letterSpacing: '0.22em',
            color: 'rgba(212, 175, 55, 0.8)',
            textTransform: 'uppercase',
          }}
          className="desktop-only"
        >
          AORAN / NAROA · A NAROA LA ORAN A
        </div>
      </div>

      {/* ESCENARIO MONUMENTAL CENTRAL (Lienzo Monolito Flotante) */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: '1400px',
          padding: '10px 0',
        }}
      >
        {/* Flecha Izquierda Flotante */}
        <button
          onClick={handlePrev}
          aria-label="Obra anterior"
          style={{
            position: 'absolute',
            left: 'clamp(8px, 2vw, 36px)',
            zIndex: 20,
            background: 'rgba(5, 5, 8, 0.65)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            color: '#FFFFFF',
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.2rem',
            backdropFilter: 'blur(12px)',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#D4AF37'
            e.currentTarget.style.color = '#D4AF37'
            e.currentTarget.style.transform = 'scale(1.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.3)'
            e.currentTarget.style.color = '#FFFFFF'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          ‹
        </button>

        {/* Monolito 3D Central */}
        <motion.div
          style={{
            position: 'relative',
            height: 'min(58vh, 580px)',
            width: 'min(90vw, 860px)',
            maxHeight: '580px',
            rotateX,
            rotateY,
            x: translateX,
            y: translateY,
            transformStyle: 'preserve-3d',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => onInspectArtwork(currentIndex)}
        >
          {/* Halo de Resplandor Dorado Posterior */}
          <div
            style={{
              position: 'absolute',
              width: '92%',
              height: '92%',
              background: 'radial-gradient(circle, rgba(212, 175, 55, 0.22) 0%, rgba(43, 59, 229, 0.06) 55%, transparent 75%)',
              filter: 'blur(45px)',
              transform: 'translateZ(-40px)',
              pointerEvents: 'none',
              borderRadius: '24px',
            }}
          />

          {/* Marco de Alta Definición */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid rgba(212, 175, 55, 0.45)',
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 40px rgba(212, 175, 55, 0.12)',
              background: '#040406',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Imagen Principal con Animación de Transición de Obra */}
            <AnimatePresence mode="wait">
              <motion.img
                key={currentArtwork.id}
                src={currentArtwork.url}
                alt={`${currentArtwork.title} — ${currentArtwork.medium} — Naroa Gutiérrez Gil`}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.03 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  filter: 'brightness(0.98) contrast(1.05)',
                }}
              />
            </AnimatePresence>

            {/* Foco Especular Dinámico sobre la Textura */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(circle 280px at ${spotlightPos.x}% ${spotlightPos.y}%, rgba(212, 175, 55, 0.25) 0%, rgba(255, 255, 255, 0.08) 25%, transparent 70%)`,
                mixBlendMode: 'overlay',
                pointerEvents: 'none',
                transition: 'background 0.04s ease-out',
              }}
            />

            {/* Micro-etiqueta superior izquierda */}
            <div
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(5, 5, 8, 0.8)',
                border: '1px solid rgba(212, 175, 55, 0.4)',
                padding: '4px 12px',
                borderRadius: '20px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D4AF37' }} />
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.65rem',
                  letterSpacing: '0.15em',
                  color: '#FFFFFF',
                  textTransform: 'uppercase',
                }}
              >
                {currentArtwork.year} · ORIGINAL
              </span>
            </div>

            {/* Botón flotante "ZOOM TEXTURA 200%" en esquina inferior izquierda */}
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(5, 5, 8, 0.85)',
                border: '1px solid #D4AF37',
                padding: '5px 14px',
                borderRadius: '20px',
                color: '#D4AF37',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
              }}
            >
              🔍 LUPA TEXTURA 200% ↗
            </div>

            {/* 3DGS badge si procede */}
            {currentArtwork.splatUrl && (
              <div
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'rgba(5, 5, 8, 0.85)',
                  border: '1px solid rgba(212, 175, 55, 0.6)',
                  color: '#FFFFFF',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  backdropFilter: 'blur(8px)',
                  letterSpacing: '0.1em',
                }}
              >
                ✦ 3DGS 360°
              </div>
            )}
          </div>
        </motion.div>

        {/* Flecha Derecha Flotante */}
        <button
          onClick={handleNext}
          aria-label="Obra siguiente"
          style={{
            position: 'absolute',
            right: 'clamp(8px, 2vw, 36px)',
            zIndex: 20,
            background: 'rgba(5, 5, 8, 0.65)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            color: '#FFFFFF',
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.2rem',
            backdropFilter: 'blur(12px)',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#D4AF37'
            e.currentTarget.style.color = '#D4AF37'
            e.currentTarget.style.transform = 'scale(1.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.3)'
            e.currentTarget.style.color = '#FFFFFF'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          ›
        </button>
      </div>

      {/* PEDESTAL TIPOGRÁFICO INFERIOR (Metadatos & Acciones) */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '16px',
          width: '100%',
          maxWidth: '1440px',
          margin: '0 auto',
        }}
      >
        {/* Título de la Obra y Soporte */}
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentArtwork.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                  fontSize: 'clamp(1.6rem, 3.5vw, 2.8rem)',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#FFFFFF',
                  margin: '0 0 6px 0',
                  lineHeight: 1.1,
                }}
              >
                {currentArtwork.title}
              </h2>
              <p
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 'clamp(0.72rem, 1.4vw, 0.85rem)',
                  color: '#D4AF37',
                  letterSpacing: '0.14em',
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                {currentArtwork.medium}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Acciones de Museo */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => onInspectArtwork(currentIndex)}
            style={{
              background: 'linear-gradient(135deg, #F0E6D2 0%, #D4AF37 100%)',
              color: '#000000',
              border: 'none',
              borderRadius: '30px',
              padding: '11px 22px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              fontSize: '0.78rem',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(212, 175, 55, 0.35)',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            INSPECCIONAR DETALLE ↗
          </button>

          <a
            href="#/coleccion"
            onClick={() => sound.playTick()}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'rgba(255, 255, 255, 0.85)',
              borderRadius: '30px',
              padding: '11px 20px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.78rem',
              letterSpacing: '0.1em',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#D4AF37'
              e.currentTarget.style.color = '#D4AF37'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)'
            }}
          >
            VER CATÁLOGO (27) ↗
          </a>

          <a
            href="#/atelier"
            onClick={() => sound.playTick()}
            className="desktop-only"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              color: '#D4AF37',
              borderRadius: '30px',
              padding: '11px 20px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.78rem',
              letterSpacing: '0.1em',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#D4AF37'
              e.currentTarget.style.color = '#000000'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              e.currentTarget.style.color = '#D4AF37'
            }}
          >
            ENCARGO A MEDIDA ↗
          </a>
        </div>
      </div>
    </div>
  )
}
