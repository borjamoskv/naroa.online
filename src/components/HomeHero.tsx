import React, { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { sound } from '../utils/audio'
import { ARTWORKS } from '../artworks'

interface MicaFlake {
  x: number
  y: number
  originX: number
  originY: number
  size: number
  speedY: number
  speedX: number
  opacity: number
  pulse: number
  color: string
}

function InteractiveMicaCanvas({ mousePos }: { mousePos: { x: number; y: number } }) {
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

    const flakes: MicaFlake[] = Array.from({ length: 85 }, () => {
      const rx = Math.random() * width
      const ry = Math.random() * height
      return {
        x: rx,
        y: ry,
        originX: rx,
        originY: ry,
        size: Math.random() * 2.4 + 0.6,
        speedY: -(Math.random() * 0.3 + 0.08),
        speedX: (Math.random() - 0.5) * 0.16,
        opacity: Math.random() * 0.55 + 0.25,
        pulse: Math.random() * Math.PI * 2,
        color: Math.random() > 0.45 ? 'rgba(212, 175, 55,' : 'rgba(255, 250, 240,',
      }
    })

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i]
        f.y += f.speedY
        f.x += f.speedX
        f.pulse += 0.02

        // Repel or swirl gently around mouse
        const dx = mousePos.x - f.x
        const dy = mousePos.y - f.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 180) {
          const force = (180 - dist) / 180
          f.x -= (dx / dist) * force * 1.2
          f.y -= (dy / dist) * force * 1.2
        }

        if (f.y < -10) {
          f.y = height + 10
          f.x = Math.random() * width
        }
        if (f.x < -10) f.x = width + 10
        if (f.x > width + 10) f.x = -10

        const alpha = Math.max(0.1, Math.min(0.9, f.opacity + Math.sin(f.pulse) * 0.2))

        ctx.fillStyle = `${f.color} ${alpha})`
        ctx.shadowColor = '#D4AF37'
        ctx.shadowBlur = f.size > 2 ? 6 : 2
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2)
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

const HERO_SHOWCASE = [
  {
    id: 1,
    title: 'Marilyn Rocks',
    year: '2024',
    medium: 'Óleo & Acrílico sobre Lienzo Texturado',
    badge: 'PIEZA MAESTRA · GRAN FORMATO',
    image: '/assets/marilyn-rocks--qPeLHxE.webp',
    artworkIndex: 0,
  },
  {
    id: 2,
    title: 'Amy Rocks',
    year: '2024',
    medium: 'Pizarra Natural con Mica Mineral & Acrílico',
    badge: 'PIEDRA FÓSIL · MICA MINERAL',
    image: '/assets/hq-amy-BRTriASV.webp',
    artworkIndex: 1,
  },
  {
    id: 5,
    title: '¡Asúcar! Celia Cruz',
    year: '2024',
    medium: 'Acrílico & Pigmentos sobre Pizarra Natural',
    badge: 'COLECCIÓN PRIVADA · RELIEVE',
    image: '/assets/celia-cruz-cantinflowers-DO-SRKMB.webp',
    artworkIndex: 4,
  },
]

interface HomeHeroProps {
  onInspectArtwork?: (index: number) => void
}

export function HomeHero({ onInspectArtwork }: HomeHeroProps) {
  const [mouseCoord, setMouseCoord] = useState({ x: 0, y: 0 })
  const [activeArtworkIdx, setActiveArtworkIdx] = useState(0)
  const [spotlightPercent, setSpotlightPercent] = useState({ x: 50, y: 50 })
  const [isPlayingAudio, setIsPlayingAudio] = useState(() => sound.isEnabled())

  const activeArtwork = HERO_SHOWCASE[activeArtworkIdx]

  // Física de inclinación 3D (Framer Motion Springs)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springConfig = { damping: 28, stiffness: 180, mass: 0.6 }
  const rotateX = useSpring(useTransform(mouseY, [-300, 300], [9, -9]), springConfig)
  const rotateY = useSpring(useTransform(mouseX, [-400, 400], [-10, 10]), springConfig)
  const translateX = useSpring(useTransform(mouseX, [-400, 400], [-8, 8]), springConfig)
  const translateY = useSpring(useTransform(mouseY, [-300, 300], [-8, 8]), springConfig)

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const clientX = e.clientX - rect.left
    const clientY = e.clientY - rect.top

    mouseX.set(clientX - centerX)
    mouseY.set(clientY - centerY)
    setMouseCoord({ x: e.clientX, y: e.clientY })

    // Porcentaje para el foco de luz especular sobre la obra
    setSpotlightPercent({
      x: Math.round((clientX / rect.width) * 100),
      y: Math.round((clientY / rect.height) * 100),
    })
  }

  const handleSwitchArtwork = (idx: number) => {
    sound.playTick()
    setActiveArtworkIdx(idx)
  }

  const handleInspectClick = () => {
    sound.playOpen()
    if (onInspectArtwork) {
      onInspectArtwork(activeArtwork.artworkIndex)
    } else {
      window.location.hash = `#obra-${ARTWORKS[activeArtwork.artworkIndex]?.slug || 'marilyn-rocks'}`
    }
  }

  return (
    <section
      className="hero-exhibition"
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 'calc(100vh - 72px)',
        background: 'radial-gradient(ellipse 90% 70% at 50% 40%, #0c0d14 0%, #030305 100%)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(24px, 4vw, 56px) clamp(20px, 4vw, 48px)',
        boxSizing: 'border-box',
      }}
    >
      {/* Shaders de Partículas de Mica Mineral en Background */}
      <InteractiveMicaCanvas mousePos={mouseCoord} />

      {/* Viñeteado Cinemático de Museo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 40%, rgba(3, 3, 5, 0.85) 95%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Grid de 2 Columnas de Alta Gama: Tipografía Curatorial & Monolito 3D */}
      <div
        className="hero-grid"
        style={{
          position: 'relative',
          zIndex: 5,
          maxWidth: '1440px',
          width: '100%',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'clamp(32px, 5vw, 64px)',
          alignItems: 'center',
        }}
      >
        {/* COLUMNA 1: DISCURSO CURATORIAL & IDENTIDAD */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Micro-etiqueta mineral de estudio */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(5, 5, 8, 0.8)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              padding: '5px 14px',
              borderRadius: '30px',
              width: 'fit-content',
              marginBottom: '16px',
              backdropFilter: 'blur(10px)',
              maxWidth: '100%',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#D4AF37',
                boxShadow: '0 0 10px #D4AF37',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 'clamp(0.62rem, 2vw, 0.72rem)',
                letterSpacing: 'clamp(0.1em, 1.5vw, 0.2em)',
                color: '#FFFFFF',
                textTransform: 'uppercase',
              }}
            >
              ESTUDIO BILBAO // 43.2630° N, 2.9350° W
            </span>
          </div>

          {/* Título Monumental del Artista */}
          <h1
            style={{
              fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
              fontSize: 'clamp(1.9rem, 5vw, 4.6rem)',
              fontWeight: 700,
              letterSpacing: '0.06em',
              lineHeight: 1.05,
              color: '#FFFFFF',
              margin: '0 0 12px 0',
              textTransform: 'uppercase',
              wordBreak: 'break-word',
            }}
          >
            NAROA <br />
            <span style={{ color: '#D4AF37' }}>GUTIÉRREZ GIL</span>
          </h1>

          {/* Materia & Disciplina */}
          <p
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 'clamp(0.68rem, 1.4vw, 0.88rem)',
              letterSpacing: 'clamp(0.12em, 1.5vw, 0.22em)',
              color: 'rgba(255, 255, 255, 0.8)',
              margin: '0 0 10px 0',
              textTransform: 'uppercase',
            }}
          >
            PIZARRA NATURAL · MICA MINERAL · HIPERREALISMO
          </p>

          {/* Palíndromo Canónico de Naroa */}
          <p
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 'clamp(0.72rem, 1.6vw, 0.84rem)',
              letterSpacing: 'clamp(0.14em, 1.8vw, 0.24em)',
              color: '#D4AF37',
              margin: '0 0 26px 0',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            AORAN / NAROA · A NAROA LA ORAN A
          </p>

          {/* Selector Curatorial de Obras Clave */}
          <div
            style={{
              marginBottom: '32px',
              background: 'rgba(8, 8, 12, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '16px 20px',
              maxWidth: '480px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.68rem',
                letterSpacing: '0.2em',
                color: 'rgba(212, 175, 55, 0.9)',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '10px',
              }}
            >
              SELECCIÓN EN SALA:
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {HERO_SHOWCASE.map((item, idx) => {
                const isSelected = activeArtworkIdx === idx
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSwitchArtwork(idx)}
                    style={{
                      background: isSelected ? '#D4AF37' : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected ? '#000000' : 'rgba(255, 255, 255, 0.75)',
                      border: isSelected ? '1px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.12)',
                      padding: '8px 14px',
                      borderRadius: '25px',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '0.72rem',
                      fontWeight: isSelected ? 700 : 500,
                      letterSpacing: '0.08em',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 0 16px rgba(212, 175, 55, 0.35)' : 'none',
                    }}
                  >
                    {String(idx + 1).padStart(2, '0')} · {item.title}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Botones de Acción de Alta Gama */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
            <a
              href="#/coleccion"
              onClick={() => sound.playTick()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: '#000000',
                background: 'linear-gradient(135deg, #F0E6D2 0%, #D4AF37 100%)',
                textDecoration: 'none',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.82rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                padding: '13px 26px',
                borderRadius: '30px',
                boxShadow: '0 0 25px rgba(212, 175, 55, 0.4)',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 0 35px rgba(212, 175, 55, 0.65)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 0 25px rgba(212, 175, 55, 0.4)'
              }}
            >
              EXPLORAR COLECCIÓN ↗
            </a>

            <a
              href="#/3d"
              onClick={() => sound.playOpen()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: '#FFFFFF',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(212, 175, 55, 0.4)',
                textDecoration: 'none',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.82rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                padding: '13px 24px',
                borderRadius: '30px',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#D4AF37'
                e.currentTarget.style.background = 'rgba(212, 175, 55, 0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.4)'
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              }}
            >
              ESPACIO 3D ↗
            </a>

            <a
              href="#/atelier"
              onClick={() => sound.playTick()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'rgba(255, 255, 255, 0.7)',
                textDecoration: 'none',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.82rem',
                letterSpacing: '0.1em',
                padding: '12px 18px',
                borderRadius: '30px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#D4AF37')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)')}
            >
              ATELIER BESPOKE ↗
            </a>
          </div>
        </motion.div>

        {/* COLUMNA 2: EL MONOLITO 3D CON FOCO ESPECULAR */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'relative',
            perspective: '1200px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Tarjeta Monolito con Física Inercial */}
          <motion.div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '560px',
              aspectRatio: '4/5',
              rotateX,
              rotateY,
              x: translateX,
              y: translateY,
              transformStyle: 'preserve-3d',
              cursor: 'pointer',
            }}
            onClick={handleInspectClick}
          >
            {/* Halo de Resplandor Dorado Posterior */}
            <div
              style={{
                position: 'absolute',
                inset: '-10px',
                background: 'radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, rgba(43, 59, 229, 0.08) 50%, transparent 75%)',
                filter: 'blur(35px)',
                transform: 'translateZ(-30px)',
                pointerEvents: 'none',
                borderRadius: '24px',
              }}
            />

            {/* Marco de Pizarra Fósil */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                borderRadius: '18px',
                overflow: 'hidden',
                border: '1px solid rgba(212, 175, 55, 0.45)',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.92), 0 0 30px rgba(212, 175, 55, 0.1)',
                background: '#050508',
              }}
            >
              {/* Imagen de la Obra Activa con Crossfade */}
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeArtwork.id}
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  src={activeArtwork.image}
                  alt={`${activeArtwork.title} — ${activeArtwork.medium} — Naroa Gutiérrez Gil`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center 20%',
                    filter: 'brightness(0.97) contrast(1.06)',
                    display: 'block',
                  }}
                />
              </AnimatePresence>

              {/* Foco Especular Dinámico sobre la Textura de Pizarra */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `radial-gradient(circle 260px at ${spotlightPercent.x}% ${spotlightPercent.y}%, rgba(212, 175, 55, 0.24) 0%, rgba(255, 255, 255, 0.08) 25%, transparent 70%)`,
                  mixBlendMode: 'overlay',
                  pointerEvents: 'none',
                  transition: 'background 0.04s ease-out',
                }}
              />

              {/* Distintivo de Obra Maestra en esquina superior izquierda */}
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
                  padding: '5px 12px',
                  borderRadius: '20px',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D4AF37', display: 'inline-block' }} />
                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.65rem', letterSpacing: '0.18em', color: '#FFFFFF', textTransform: 'uppercase' }}>
                  {activeArtwork.badge}
                </span>
              </div>

              {/* Año y Título en esquina inferior derecha */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  right: '16px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.68rem',
                  letterSpacing: '0.12em',
                  color: 'rgba(255, 255, 255, 0.8)',
                  background: 'rgba(5, 5, 8, 0.82)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  padding: '5px 12px',
                  borderRadius: '4px',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {activeArtwork.title} · {activeArtwork.year}
              </div>

              {/* Botón flotante "ZOOM TEXTURA" en esquina inferior izquierda */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(212, 175, 55, 0.15)',
                  border: '1px solid #D4AF37',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  backdropFilter: 'blur(10px)',
                  color: '#D4AF37',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                }}
              >
                🔍 ZOOM TEXTURA 200% ↗
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Indicador de Sonido Atmosférico "Boards of Burgos" en la esquina inferior izquierda */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        onClick={() => {
          const next = sound.toggleSound()
          setIsPlayingAudio(next)
        }}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '28px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          padding: '7px 14px',
          borderRadius: '30px',
          background: 'rgba(10, 10, 14, 0.8)',
          border: '1px solid rgba(212, 175, 55, 0.25)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
        title="Banda Sonora: Boards of Burgos (Borja Moskv, 2024)"
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'flex-end',
            gap: '2px',
            height: '12px',
          }}
        >
          <span
            style={{
              width: '2px',
              height: isPlayingAudio ? '12px' : '4px',
              background: '#D4AF37',
              borderRadius: '1px',
              animation: isPlayingAudio ? 'eqPulse 0.8s ease-in-out infinite alternate' : 'none',
            }}
          />
          <span
            style={{
              width: '2px',
              height: isPlayingAudio ? '8px' : '4px',
              background: '#D4AF37',
              borderRadius: '1px',
              animation: isPlayingAudio ? 'eqPulse 0.6s ease-in-out 0.2s infinite alternate' : 'none',
            }}
          />
          <span
            style={{
              width: '2px',
              height: isPlayingAudio ? '10px' : '4px',
              background: '#D4AF37',
              borderRadius: '1px',
              animation: isPlayingAudio ? 'eqPulse 0.9s ease-in-out 0.4s infinite alternate' : 'none',
            }}
          />
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.68rem',
            letterSpacing: '0.15em',
            color: isPlayingAudio ? '#D4AF37' : 'rgba(255, 255, 255, 0.45)',
          }}
        >
          {isPlayingAudio ? 'BOARDS OF BURGOS · 2024' : 'AUDIO EN REPOSO'}
        </span>
      </motion.div>
    </section>
  )
}
