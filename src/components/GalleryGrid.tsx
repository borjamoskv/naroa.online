import { motion } from 'framer-motion'
import { ARTWORKS } from '../artworks'
import { sound } from '../utils/audio'

interface GalleryGridProps {
  onInspect: (index: number) => void
}

export function GalleryGrid({ onInspect }: GalleryGridProps) {
  const heroArtwork = ARTWORKS.find(a => a.slug === 'amy-rocks') || ARTWORKS[1]

  return (
    <div className="gallery-page brutal-container">
      {/* Ticker Marquesina */}
      <div className="brutal-marquee-bar">
        <div className="brutal-marquee-content">
          <span>💥 UNIVERSO ARTÍSTICO NAROA · 27+ OBRAS ORIGINALES · AC RÍLICO, MICA MINERAL Y PIZARRA NATURAL · BILBAO 💥</span>
          <span>💥 UNIVERSO ARTÍSTICO NAROA · 27+ OBRAS ORIGINALES · AC RÍLICO, MICA MINERAL Y PIZARRA NATURAL · BILBAO 💥</span>
        </div>
      </div>

      {/* HERO COLOSAL DE OBRA DESTACADA (Amy Winehouse) */}
      <section className="gallery-hero-box brutal-card" style={{ marginBottom: '32px', borderColor: 'var(--brutal-pink)' }}>
        <div className="hero-artwork-wrap" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'center' }}>
          <img
            src={heroArtwork.url}
            alt={heroArtwork.title}
            className="gallery-hero-img"
            style={{ width: '100%', maxHeight: '480px', objectFit: 'cover', border: '3px solid #000', boxShadow: '5px 5px 0px #000' }}
          />
          <div className="hero-artwork-info">
            <span className="brutal-badge brutal-badge--yellow">OBRA PROTAGONISTA</span>
            <h1 className="brutal-title" style={{ fontSize: '3rem' }}>{heroArtwork.title}</h1>
            <p className="brutal-badge brutal-badge--pink" style={{ marginTop: '6px' }}>{heroArtwork.year} · {heroArtwork.medium}</p>
            <p className="brutal-subtitle" style={{ fontSize: '0.95rem', margin: '16px 0' }}>{heroArtwork.description}</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="brutal-btn"
                onClick={() => {
                  sound.playOpen()
                  const idx = ARTWORKS.findIndex(a => a.id === heroArtwork.id)
                  onInspect(idx)
                }}
              >
                🔍 INSPECCIONAR EN DETALLE
              </button>
              <a href="#/encargos" className="brutal-cta-btn brutal-cta-btn--whatsapp" style={{ width: 'auto', padding: '10px 18px' }}>
                ⚡ ENCARGAR PARECIDO
              </a>
            </div>
          </div>
        </div>
      </section>

      <header className="gallery-header">
        <span className="brutal-badge brutal-badge--cyan">COLECCIÓN COMPLETA</span>
        <h2 className="brutal-title">
          UNIVERSO <span className="highlight-yellow">ARTÍSTICO</span>
        </h2>
        <p className="brutal-subtitle">
          Cada trazo es una historia. Cada pieza en pizarra o lienzo es un fragmento del alma pop.
        </p>
      </header>

      {/* REJILLA DE TAMAÑOS VARIABLES */}
      <div className="massive-gallery-grid">
        {ARTWORKS.map((artwork, idx) => {
          const sizeClass = artwork.sizeCategory ? `grid-item--${artwork.sizeCategory}` : 'grid-item--medium'
          return (
            <motion.div
              key={artwork.id}
              className={`gallery-item-card brutal-card ${sizeClass}`}
              whileHover={{ scale: 1.02 }}
              onMouseEnter={() => document.body.classList.add('hovering-artwork')}
              onMouseLeave={() => document.body.classList.remove('hovering-artwork')}
              onClick={() => {
                sound.playOpen()
                onInspect(idx)
              }}
            >
              <div className="item-img-container">
                <img src={artwork.url} alt={artwork.title} className="item-img" loading="lazy" />
                <div className="item-overlay">
                  <span className="item-badge">{artwork.year}</span>
                  <h3 className="item-title">{artwork.title}</h3>
                  <span className="item-medium">{artwork.medium}</span>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
