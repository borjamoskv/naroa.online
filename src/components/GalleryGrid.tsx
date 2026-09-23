import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ARTWORKS } from '../artworks'
import { sound } from '../utils/audio'

interface GalleryGridProps {
  onInspect: (index: number) => void
}

type CategoryFilter = 'all' | 'slate' | 'canvas' | 'music_pop' | 'enlata'

export function GalleryGrid({ onInspect }: GalleryGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const heroArtwork = ARTWORKS.find(a => a.slug === 'amy-rocks') || ARTWORKS[1]

  const categories: { id: CategoryFilter; label: string; count: number }[] = useMemo(() => {
    const counts = {
      all: ARTWORKS.length,
      slate: ARTWORKS.filter(a => a.medium.toLowerCase().includes('pizarra') || a.medium.toLowerCase().includes('mica')).length,
      canvas: ARTWORKS.filter(a => a.medium.toLowerCase().includes('lienzo') || a.medium.toLowerCase().includes('óleo')).length,
      music_pop: ARTWORKS.filter(a =>
        a.title.toLowerCase().includes('rocks') ||
        a.medium.toLowerCase().includes('divinos') ||
        a.description.toLowerCase().includes('soul') ||
        a.description.toLowerCase().includes('música') ||
        a.description.toLowerCase().includes('pop')
      ).length,
      enlata: ARTWORKS.filter(a => a.medium.toLowerCase().includes('en.lata') || a.title.toLowerCase().includes('lata')).length,
    }

    return [
      { id: 'all', label: 'Todas las Obras', count: counts.all },
      { id: 'slate', label: '💎 Pizarra & Mica Mineral', count: counts.slate },
      { id: 'canvas', label: '🖼️ Lienzo & Óleo 3D', count: counts.canvas },
      { id: 'music_pop', label: '⚡ Tributos Pop & Rock', count: counts.music_pop },
      { id: 'enlata', label: '🥫 Serie En.lata', count: counts.enlata },
    ]
  }, [])

  const filteredArtworks = useMemo(() => {
    return ARTWORKS.filter((artwork) => {
      // Category filter
      let matchesCategory = true
      const medLower = artwork.medium.toLowerCase()
      const titleLower = artwork.title.toLowerCase()
      const descLower = artwork.description.toLowerCase()

      if (selectedCategory === 'slate') {
        matchesCategory = medLower.includes('pizarra') || medLower.includes('mica')
      } else if (selectedCategory === 'canvas') {
        matchesCategory = medLower.includes('lienzo') || medLower.includes('óleo')
      } else if (selectedCategory === 'music_pop') {
        matchesCategory =
          titleLower.includes('rocks') ||
          medLower.includes('divinos') ||
          descLower.includes('soul') ||
          descLower.includes('música') ||
          descLower.includes('pop')
      } else if (selectedCategory === 'enlata') {
        matchesCategory = medLower.includes('en.lata') || titleLower.includes('lata')
      }

      if (!matchesCategory) return false

      // Search query filter
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        titleLower.includes(q) ||
        medLower.includes(q) ||
        descLower.includes(q) ||
        artwork.year.includes(q)
      )
    })
  }, [selectedCategory, searchQuery])

  return (
    <div className="gallery-page" style={{ maxWidth: '1400px', margin: '0 auto', padding: '100px 20px 60px' }}>
      
      {/* Ticker Marquesina Mineral */}
      <div 
        style={{
          background: 'rgba(10, 10, 14, 0.85)',
          borderTop: '1px solid rgba(212, 175, 55, 0.4)',
          borderBottom: '1px solid rgba(212, 175, 55, 0.4)',
          padding: '10px 0',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          marginBottom: '40px',
          boxShadow: '0 0 25px rgba(212, 175, 55, 0.1)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div 
          style={{
            display: 'inline-block',
            animation: 'marquee 28s linear infinite',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.8rem',
            letterSpacing: '0.2em',
            color: '#D4AF37',
            textTransform: 'uppercase'
          }}
        >
          ✦ UNIVERSO ARTÍSTICO NAROA · 27+ OBRAS ORIGINALES · AC RÍLICO, MICA MINERAL Y PIZARRA NATURAL · BILBAO · ENCARGOS PERSONALIZADOS A MEDIDA ✦
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          ✦ UNIVERSO ARTÍSTICO NAROA · 27+ OBRAS ORIGINALES · AC RÍLICO, MICA MINERAL Y PIZARRA NATURAL · BILBAO · ENCARGOS PERSONALIZADOS A MEDIDA ✦
        </div>
      </div>

      {/* HERO COLOSAL DE OBRA DESTACADA (Amy Winehouse) */}
      <section 
        className="gallery-hero-box" 
        style={{
          background: 'radial-gradient(circle at 70% 30%, rgba(43, 59, 229, 0.15) 0%, rgba(10, 10, 14, 0.95) 70%)',
          border: '1px solid rgba(212, 175, 55, 0.5)',
          borderRadius: '16px',
          padding: 'clamp(20px, 4vw, 40px)',
          marginBottom: '50px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(212, 175, 55, 0.15)'
        }}
      >
        <div 
          className="hero-artwork-wrap" 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '32px', 
            alignItems: 'center' 
          }}
        >
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)' }}>
            <img
              src={heroArtwork.url}
              alt={heroArtwork.title}
              className="gallery-hero-img"
              style={{ 
                width: '100%', 
                maxHeight: '480px', 
                objectFit: 'cover', 
                display: 'block',
                transition: 'transform 0.5s ease'
              }}
            />
            <div 
              style={{
                position: 'absolute',
                top: '14px',
                left: '14px',
                background: '#D4AF37',
                color: '#000',
                fontFamily: 'monospace',
                fontWeight: 900,
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: '4px',
                letterSpacing: '0.1em'
              }}
            >
              OBRA INSIGNIA
            </div>
          </div>

          <div className="hero-artwork-info">
            <span 
              style={{
                display: 'inline-block',
                background: 'rgba(212, 175, 55, 0.15)',
                border: '1px solid #D4AF37',
                color: '#D4AF37',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                letterSpacing: '0.15em',
                marginBottom: '12px'
              }}
            >
              PIZARRA NATURAL & MICA MINERAL
            </span>
            <h1 
              style={{ 
                fontSize: 'clamp(2rem, 5vw, 3.2rem)', 
                fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                fontWeight: 700,
                color: '#FFFFFF',
                lineHeight: 1.1,
                margin: '0 0 10px 0'
              }}
            >
              {heroArtwork.title}
            </h1>
            <p style={{ color: '#D4AF37', fontSize: '0.95rem', fontWeight: 600, margin: '0 0 16px 0', fontFamily: 'monospace' }}>
              {heroArtwork.year} · {heroArtwork.medium}
            </p>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: '0 0 24px 0' }}>
              {heroArtwork.description}
            </p>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  sound.playOpen()
                  const idx = ARTWORKS.findIndex(a => a.id === heroArtwork.id)
                  onInspect(idx)
                }}
                style={{
                  background: '#D4AF37',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                🔍 INSPECCIONAR EN DETALLE
              </button>
              <a 
                href="#/encargos" 
                onClick={() => sound.playTick()}
                style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#D4AF37'
                  e.currentTarget.style.color = '#D4AF37'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
                  e.currentTarget.style.color = '#FFFFFF'
                }}
              >
                ⚡ ENCARGAR RETRATO PERSONALIZADO ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CABECERA DE FILTROS & BÚSQUEDA */}
      <header className="gallery-header" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px', marginBottom: '24px' }}>
          <div>
            <span 
              style={{
                color: '#D4AF37',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '6px'
              }}
            >
              Catálogo Razonado · Colección Oficial
            </span>
            <h2 
              style={{
                fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                fontWeight: 700,
                color: '#FFFFFF',
                margin: 0
              }}
            >
              UNIVERSO <span style={{ color: '#D4AF37' }}>ARTÍSTICO</span>
            </h2>
          </div>

          {/* Buscador Interactivo */}
          <div style={{ position: 'relative', minWidth: '280px', flex: '1', maxWidth: '420px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por obra, técnica o año..."
              style={{
                width: '100%',
                background: 'rgba(15, 15, 20, 0.8)',
                border: '1px solid rgba(212, 175, 55, 0.4)',
                borderRadius: '50px',
                padding: '12px 42px 12px 20px',
                color: '#FFFFFF',
                fontSize: '0.9rem',
                outline: 'none',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#D4AF37'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(212, 175, 55, 0.4)'}
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            ) : (
              <span 
                style={{
                  position: 'absolute',
                  right: '18px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  opacity: 0.5,
                  pointerEvents: 'none'
                }}
              >
                🔍
              </span>
            )}
          </div>
        </div>

        {/* Píldoras de Categorías */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => {
                  sound.playTick()
                  setSelectedCategory(cat.id)
                }}
                style={{
                  background: isSelected ? '#D4AF37' : 'rgba(255, 255, 255, 0.05)',
                  color: isSelected ? '#000000' : 'rgba(255, 255, 255, 0.75)',
                  border: isSelected ? '1px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '30px',
                  padding: '8px 18px',
                  fontSize: '0.85rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 0 15px rgba(212, 175, 55, 0.35)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                    e.currentTarget.style.color = '#FFFFFF'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)'
                  }
                }}
              >
                {cat.label} ({cat.count})
              </button>
            )
          })}
        </div>

        {/* Contador de Resultados */}
        <div style={{ marginTop: '14px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
          Mostrando {filteredArtworks.length} de {ARTWORKS.length} piezas originales catalogadas
        </div>
      </header>

      {/* REJILLA DE OBRAS */}
      {filteredArtworks.length === 0 ? (
        <div 
          style={{ 
            textAlign: 'center', 
            padding: '60px 20px', 
            background: 'rgba(15,15,20,0.5)', 
            borderRadius: '16px', 
            border: '1px dashed rgba(212, 175, 55, 0.3)' 
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🔍</div>
          <h3 style={{ color: '#FFFFFF', margin: '0 0 8px 0' }}>No se encontraron obras con ese criterio</h3>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 20px 0', fontSize: '0.9rem' }}>
            Prueba a cambiar los términos de búsqueda o selecciona otra categoría.
          </p>
          <button
            onClick={() => {
              setSearchQuery('')
              setSelectedCategory('all')
            }}
            style={{
              background: '#D4AF37',
              color: '#000',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            RESTABLECER FILTROS
          </button>
        </div>
      ) : (
        <motion.div 
          layout 
          className="massive-gallery-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px'
          }}
        >
          <AnimatePresence>
            {filteredArtworks.map((artwork) => {
              const originalIdx = ARTWORKS.findIndex(a => a.id === artwork.id)
              const inquiryText = `Hola Naroa! Me interesa conocer la disponibilidad de tu obra "${artwork.title}" (${artwork.year}, ${artwork.medium}). ¿Está disponible?`
              const waUrl = `https://wa.me/34636060609?text=${encodeURIComponent(inquiryText)}`

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  key={artwork.id}
                  style={{
                    background: 'rgba(15, 15, 20, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
                    cursor: 'pointer',
                    transition: 'border-color 0.3s, transform 0.3s, box-shadow 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.8)'
                    e.currentTarget.style.transform = 'translateY(-4px)'
                    e.currentTarget.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 175, 55, 0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.6)'
                  }}
                  onClick={() => {
                    sound.playOpen()
                    onInspect(originalIdx)
                  }}
                >
                  {/* Contenedor Imagen */}
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '4/5', overflow: 'hidden', background: '#050508' }}>
                    <img 
                      src={artwork.url} 
                      alt={artwork.title} 
                      loading="lazy" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        display: 'block',
                        transition: 'transform 0.5s ease'
                      }} 
                    />
                    <div 
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'rgba(0, 0, 0, 0.75)',
                        border: '1px solid rgba(212, 175, 55, 0.5)',
                        color: '#D4AF37',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backdropFilter: 'blur(6px)'
                      }}
                    >
                      {artwork.year}
                    </div>

                    {artwork.splatUrl && (
                      <div 
                        style={{
                          position: 'absolute',
                          bottom: '12px',
                          left: '12px',
                          background: 'linear-gradient(135deg, rgba(43,59,229,0.9), rgba(212,175,55,0.9))',
                          color: '#fff',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontFamily: 'monospace',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backdropFilter: 'blur(6px)'
                        }}
                      >
                        ✨ 3DGS 360°
                      </div>
                    )}
                  </div>

                  {/* Metadatos y Acciones */}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                    <div>
                      <h3 
                        style={{ 
                          fontSize: '1.2rem', 
                          fontWeight: 700, 
                          color: '#FFFFFF', 
                          margin: '0 0 6px 0',
                          fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)'
                        }}
                      >
                        {artwork.title}
                      </h3>
                      <p 
                        style={{ 
                          fontSize: '0.8rem', 
                          color: '#D4AF37', 
                          margin: '0 0 14px 0', 
                          fontFamily: 'monospace',
                          lineHeight: 1.4
                        }}
                      >
                        {artwork.medium}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          sound.playOpen()
                          onInspect(originalIdx)
                        }}
                        style={{
                          flex: 1,
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: '#FFFFFF',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#D4AF37'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
                      >
                        🔍 VER DETALLE
                      </button>
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation()
                          sound.playTick()
                        }}
                        style={{
                          background: 'rgba(37, 211, 102, 0.15)',
                          border: '1px solid rgba(37, 211, 102, 0.4)',
                          color: '#25D366',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#25D366'
                          e.currentTarget.style.color = '#000'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(37, 211, 102, 0.15)'
                          e.currentTarget.style.color = '#25D366'
                        }}
                        title="Consultar disponibilidad en WhatsApp"
                      >
                        💬 WHATSAPP
                      </a>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
