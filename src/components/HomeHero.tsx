import React, { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { sound } from '../utils/audio'

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
        size: Math.random() * 2.5 + 0.6,
        speedY: -(Math.random() * 0.35 + 0.08),
        speedX: (Math.random() - 0.5) * 0.18,
        opacity: Math.random() * 0.6 + 0.25,
        pulse: Math.random() * Math.PI * 2,
        color: Math.random() > 0.35 ? '#D4AF37' : '#FFFFFF',
      }
    })

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      flakes.forEach((f) => {
        f.y += f.speedY
        f.x += f.speedX
        f.pulse += 0.025

        // Interacción sutil con el cursor (dispersión electromagnética de polvo mineral)
        const dx = f.x - mousePos.x
        const dy = f.y - mousePos.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 140) {
          const force = (140 - dist) / 140
          f.x += (dx / dist) * force * 1.8
          f.y += (dy / dist) * force * 1.8
        }

        const currentOpacity = Math.max(0.12, f.opacity + Math.sin(f.pulse) * 0.22)

        if (f.y < -10) f.y = height + 10
        if (f.x < -10) f.x = width + 10
        if (f.x > width + 10) f.x = -10

        ctx.save()
        ctx.fillStyle = f.color
        ctx.globalAlpha = currentOpacity
        ctx.shadowColor = f.color
        ctx.shadowBlur = f.color === '#D4AF37' ? 10 : 5
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      animId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animId)
    }
  }, [mousePos])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 4,
      }}
    />
  )
}

export function HomeHero() {
  const [mouseCoord, setMouseCoord] = useState({ x: -1000, y: -1000 })
  const [isPlayingAudio, setIsPlayingAudio] = useState(sound.isEnabled())

  // Parallax interactivo ultra-suave
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springConfig = { damping: 28, stiffness: 90, mass: 0.8 }
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), springConfig)
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), springConfig)
  const translateX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-12, 12]), springConfig)
  const translateY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-10, 10]), springConfig)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    mouseX.set(x)
    mouseY.set(y)
    setMouseCoord({ x: e.clientX, y: e.clientY })
  }

  const handleAudioToggle = () => {
    const active = sound.toggleSound()
    setIsPlayingAudio(active)
  }

  return (
    <section
      className="hero-immersive"
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100dvh',
        background: 'radial-gradient(ellipse 90% 70% at 50% 45%, #0d0e14 0%, #030305 100%)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: '1200px',
      }}
    >
      {/* Shaders de Mica Mineral Interactivos */}
      <InteractiveMicaCanvas mousePos={mouseCoord} />

      {/* Degradados cinemáticos de viñeteo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 35%, rgba(3, 3, 5, 0.85) 90%)',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '240px',
          background: 'linear-gradient(to top, #030305 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />

      {/* Obra Central Monumental con Parallax & Especularidad Mineral */}
      <motion.div
        style={{
          position: 'relative',
          width: 'min(90vw, 760px)',
          height: 'min(68vh, 620px)',
          rotateX,
          rotateY,
          x: translateX,
          y: translateY,
          transformStyle: 'preserve-3d',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Halo Áurico Mineral Trasero */}
        <div
          style={{
            position: 'absolute',
            width: '85%',
            height: '85%',
            background: 'radial-gradient(circle, rgba(212, 175, 55, 0.16) 0%, rgba(43, 59, 229, 0.08) 45%, transparent 70%)',
            filter: 'blur(50px)',
            transform: 'translateZ(-40px)',
            pointerEvents: 'none',
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 40px rgba(212, 175, 55, 0.12)',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            background: '#050508',
          }}
        >
          <img
            src="/assets/marilyn-rocks--qPeLHxE.webp"
            alt="Marilyn Rocks — Pizarra Natural & Mica Mineral — Naroa Gutiérrez Gil"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 20%',
              filter: 'brightness(0.96) contrast(1.08)',
              display: 'block',
            }}
          />

          {/* Micro-etiqueta flotante de Colección en la esquina superior */}
          <div
            style={{
              position: 'absolute',
              top: '18px',
              left: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(5, 5, 8, 0.75)',
              border: '1px solid rgba(212, 175, 55, 0.35)',
              padding: '4px 12px',
              borderRadius: '20px',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D4AF37', display: 'inline-block' }} />
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.68rem', letterSpacing: '0.2em', color: '#FFFFFF', textTransform: 'uppercase' }}>
              PIEZA MAESTRA · PIZARRA FÓSIL
            </span>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: '18px',
              right: '20px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.68rem',
              letterSpacing: '0.15em',
              color: 'rgba(255, 255, 255, 0.6)',
              background: 'rgba(5, 5, 8, 0.75)',
              padding: '4px 10px',
              borderRadius: '4px',
              backdropFilter: 'blur(8px)',
            }}
          >
            MARILYN ROCKS · 2024
          </div>
        </motion.div>
      </motion.div>

      {/* Capa Tipográfica & Acciones Principales */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'absolute',
          bottom: '5vh',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          zIndex: 10,
          pointerEvents: 'auto',
          width: '90%',
          maxWidth: '850px',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
            fontSize: 'clamp(2.4rem, 6vw, 4.6rem)',
            fontWeight: 700,
            letterSpacing: '0.14em',
            lineHeight: 1.05,
            color: '#FFFFFF',
            margin: '0 0 10px 0',
            textTransform: 'uppercase',
            textShadow: '0 10px 40px rgba(0,0,0,0.9)',
          }}
        >
          NAROA <span style={{ color: '#D4AF37' }}>GUTIÉRREZ GIL</span>
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 'clamp(0.72rem, 1.6vw, 0.88rem)',
            letterSpacing: '0.35em',
            color: 'rgba(255, 255, 255, 0.75)',
            margin: '0 0 26px 0',
            textTransform: 'uppercase',
          }}
        >
          PIZARRA NATURAL · MICA MINERAL · HIPERREALISMO
        </p>

        {/* Acciones de Alta Gama (Purga de Botones Dispersos) */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
          <a
            href="#/destacada"
            onClick={() => sound.playTick()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#000000',
              textDecoration: 'none',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.82rem',
              fontWeight: 700,
              letterSpacing: '0.15em',
              padding: '13px 30px',
              borderRadius: '50px',
              background: 'linear-gradient(135deg, #F0E6D2 0%, #D4AF37 100%)',
              boxShadow: '0 0 25px rgba(212, 175, 55, 0.45)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'
              e.currentTarget.style.boxShadow = '0 0 35px rgba(212, 175, 55, 0.7)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)'
              e.currentTarget.style.boxShadow = '0 0 25px rgba(212, 175, 55, 0.45)'
            }}
          >
            EXPLORAR COLECCIÓN ↗
          </a>

          <a
            href="#/3d"
            onClick={() => sound.playTick()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.82rem',
              fontWeight: 600,
              letterSpacing: '0.15em',
              padding: '13px 28px',
              borderRadius: '50px',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              background: 'rgba(15, 15, 20, 0.65)',
              backdropFilter: 'blur(15px)',
              WebkitBackdropFilter: 'blur(15px)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#D4AF37'
              e.currentTarget.style.color = '#D4AF37'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
              e.currentTarget.style.color = '#FFFFFF'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            ESPACIO MUSEÍSTICO 3D
          </a>

          <a
            href="#/encargos"
            onClick={() => sound.playTick()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'rgba(255, 255, 255, 0.7)',
              textDecoration: 'none',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.78rem',
              fontWeight: 500,
              letterSpacing: '0.15em',
              padding: '13px 22px',
              borderRadius: '50px',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              background: 'rgba(212, 175, 55, 0.06)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#D4AF37'
              e.currentTarget.style.color = '#D4AF37'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.3)'
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'
            }}
          >
            ATELIER BESPOKE ⚡
          </a>
        </div>
      </motion.div>

      {/* Telemetría Sonora "Boards of Burgos" en la esquina inferior izquierda */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        onClick={handleAudioToggle}
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '28px',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          padding: '8px 14px',
          borderRadius: '30px',
          background: 'rgba(10, 10, 14, 0.7)',
          border: '1px solid rgba(212, 175, 55, 0.25)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transition: 'border-color 0.2s ease',
        }}
        title="Banda Sonora Original: Boards of Burgos (Borja Moskv, 2024)"
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '14px' }}>
          {[0.6, 1, 0.4, 0.8].map((val, idx) => (
            <motion.span
              key={idx}
              animate={isPlayingAudio ? { height: ['4px', `${val * 14}px`, '4px'] } : { height: '3px' }}
              transition={{ repeat: Infinity, duration: 0.8 + idx * 0.2, ease: 'easeInOut' }}
              style={{
                width: '2px',
                background: '#D4AF37',
                borderRadius: '1px',
                display: 'inline-block',
              }}
            />
          ))}
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.68rem',
            letterSpacing: '0.12em',
            color: isPlayingAudio ? '#D4AF37' : 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
          }}
        >
          {isPlayingAudio ? 'BOARDS OF BURGOS · 2024' : 'AUDIO EN REPOSO'}
        </span>
      </motion.div>

      {/* Coordenadas de Bilbao / Kobetamendi en la esquina inferior derecha */}
      <div
        style={{
          position: 'absolute',
          bottom: '26px',
          right: '28px',
          zIndex: 10,
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.65rem',
          letterSpacing: '0.2em',
          color: 'rgba(255, 255, 255, 0.35)',
          textTransform: 'uppercase',
          display: 'none',
        }}
        className="hero-coordinates-desktop"
      >
        KOBETAMENDI // 43.2630° N, 2.9350° W
      </div>
    </section>
  )
}
