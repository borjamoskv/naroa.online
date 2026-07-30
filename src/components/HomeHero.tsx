import { motion } from 'framer-motion'
import { sound } from '../utils/audio'

export function HomeHero() {
  return (
    <section className="hero-immersive">
      {/* Imagen de fondo fullscreen */}
      <div className="hero-immersive__image-wrapper">
        <motion.img
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          src="/assets/marilyn-rocks--qPeLHxE.webp"
          alt="Marilyn Rocks — Naroa Gutiérrez Gil · Acrílico sobre pizarra"
          className="hero-immersive__image"
        />
      </div>

      {/* Overlays cinematográficos */}
      <div className="hero-immersive__overlay"></div>
      <div className="hero-immersive__overlay--top"></div>
      <div className="hero-immersive__overlay--bottom"></div>
      <div className="hero-immersive__grain"></div>

      {/* Contenido centrado con animación escalonada */}
      <motion.div 
        className="hero-immersive__content"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.5, ease: [0.25, 1, 0.5, 1] }}
      >
        <span className="hero-immersive__eyebrow">Artista Visual · Bilbao</span>
        <h1 className="hero-immersive__title">
          <span>Naroa</span>
          <span className="hero-immersive__title-accent">Gutiérrez Gil</span>
        </h1>
        <p className="hero-immersive__subtitle">Hiperrealismo POP · Mixed Media</p>
        <div className="hero-immersive__divider"></div>
        <a href="#/destacada" className="hero-immersive__cta" onClick={() => sound.playTick()}>
          <span>Explorar Obra</span>
          <span className="hero-immersive__cta-arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M17 7H7M17 7V17"/>
            </svg>
          </span>
        </a>
      </motion.div>

      {/* Metadatos flotantes */}
      <motion.div 
        className="hero-immersive__meta hero-immersive__meta--left"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, delay: 0.8 }}
      >
        <span>Técnica</span>
        <span className="hero-immersive__meta-value">Óleo · Acrílico · Pizarra</span>
      </motion.div>
      
      <motion.div 
        className="hero-immersive__meta hero-immersive__meta--right"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, delay: 0.8 }}
      >
        <span>Colección</span>
        <span className="hero-immersive__meta-value">40+ Obras Originales</span>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div 
        className="hero-immersive__scroll"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
      >
        <span className="hero-immersive__scroll-label">Scroll</span>
        <div className="hero-immersive__scroll-line"></div>
        <div className="hero-immersive__scroll-dot"></div>
      </motion.div>
    </section>
  )
}
