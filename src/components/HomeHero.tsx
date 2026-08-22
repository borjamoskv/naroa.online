import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { sound } from '../utils/audio'

function MicaParticles() {
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

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.2 + 0.6,
      speedY: -(Math.random() * 0.4 + 0.1),
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.7 + 0.2,
      pulse: Math.random() * Math.PI * 2,
      color: Math.random() > 0.4 ? '#D4AF37' : '#FFFFFF',
    }))

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      particles.forEach((p) => {
        p.y += p.speedY
        p.x += p.speedX
        p.pulse += 0.03
        const currentOpacity = Math.max(0.1, p.opacity + Math.sin(p.pulse) * 0.25)

        if (p.y < -10) p.y = height + 10
        if (p.x < -10) p.x = width + 10
        if (p.x > width + 10) p.x = -10

        ctx.save()
        ctx.fillStyle = p.color
        ctx.globalAlpha = currentOpacity
        ctx.shadowColor = p.color
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
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
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  )
}

export function HomeHero() {
  return (
    <section className="hero-immersive" style={{ background: '#000', position: 'relative', overflow: 'hidden' }}>
      <MicaParticles />

      {/* Imagen de fondo fullscreen - Estática y nítida */}
      <div className="hero-immersive__image-wrapper" style={{ opacity: 0.9 }}>
        <motion.img
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 2, ease: 'easeOut' }}
          src="/assets/marilyn-rocks--qPeLHxE.webp"
          alt="Marilyn Rocks — Naroa Gutiérrez Gil"
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '40px' }}
        />
      </div>

      {/* Contenido Minimalista - Nombre y accesos */}
      <motion.div
        className="hero-immersive__content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, delay: 0.8 }}
        style={{ position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'auto', zIndex: 10 }}
      >
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.25em', color: '#D4AF37', margin: '0 0 16px 0', textTransform: 'uppercase' }}>
          Naroa Gutiérrez Gil · Hiperrealismo POP & Mica Mineral
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <a
            href="#/destacada"
            onClick={() => sound.playTick()}
            style={{
              display: 'inline-block',
              color: '#fff',
              textDecoration: 'none',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.85rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
              padding: '10px 28px',
              border: '1px solid rgba(212, 175, 55, 0.6)',
              borderRadius: '50px',
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 0 20px rgba(212,175,55,0.2)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#D4AF37'
              e.currentTarget.style.color = '#000'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.6)'
              e.currentTarget.style.color = '#fff'
            }}
          >
            EXPLORAR GALERÍA ↗
          </a>
          <a
            href="#/3d"
            onClick={() => sound.playTick()}
            style={{
              display: 'inline-block',
              color: '#fff',
              textDecoration: 'none',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.85rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
              padding: '10px 28px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '50px',
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            }}
          >
            ENTRAR MUSEO 3D 🕹️
          </a>
        </div>
      </motion.div>
    </section>
  )
}
