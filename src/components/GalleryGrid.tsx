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

  const heroArtwork = ARTWORKS.find((a) => a.slug === 'amy-rocks') || ARTWORKS[1]

  const categories: { id: CategoryFilter; label: string; count: number }[] = useMemo(() => {
    const counts = {
      all: ARTWORKS.length,
      slate: ARTWORKS.filter(
        (a) => a.medium.toLowerCase().includes('pizarra') || a.medium.toLowerCase().includes('mica')
      ).length,
      canvas: ARTWORKS.filter(
        (a) => a.medium.toLowerCase().includes('lienzo') || a.medium.toLowerCase().includes('óleo')
      ).length,
      music_pop: ARTWORKS.filter(
        (a) =>
          a.title.toLowerCase().includes('rocks') ||
          a.medium.toLowerCase().includes('divinos') ||
          a.description.toLowerCase().includes('soul') ||
          a.description.toLowerCase().includes('música') ||
          a.description.toLowerCase().includes('pop')
      ).length,
      enlata: ARTWORKS.filter(
        (a) => a.medium.toLowerCase().includes('en.lata') || a.title.toLowerCase().includes('lata')
      ).length,
    }

    return [
      { id: 'all', label: 'Todas las Obras', count: counts.all },
      { id: 'slate', label: 'Pizarra & Mica Mineral', count: counts.slate },
      { id: 'canvas', label: 'Lienzo & Óleo 3D', count: counts.canvas },
      { id: 'music_pop', label: 'Tributos Pop & Rock', count: counts.music_pop },
      { id: 'enlata', label: 'Serie En.lata', count: counts.enlata },
    ]
  }, [])

  const filteredArtworks = useMemo(() => {
    return ARTWORKS.filter((artwork) => {
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
    <div className="gallery-page" style={{ maxWidth: '1440px', margin: '0 auto', padding: '60px 24px 80px' }}>
      
      {/* OBRA PRINCIPAL EN SALA (Hero de Curaduría) */}
      <section
        style={{
          position: 'relative',
          background: 'radial-gradient(ellipse at 70% 40%, rgba(212, 175, 55, 0.08) 0%, rgba(5, 5, 8, 0.95) 70%)',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          borderRadius: '20px',
          padding: 'clamp(24px, 4vw, 48px)',
          marginBottom: '60px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(212, 175, 55, 0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '40px',
            alignItems: 'center',
          }}
        >
          {/* Imagen de Gran Formato con Relieve */}
          <div
            style={{
              position: 'relative',
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 20px 45px rgba(0,0,0,0.9)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: '#030305',
              cursor: 'pointer',
            }}
            onClick={() => {
              sound.playOpen()
              const idx = ARTWORKS.findIndex((a) => a.id === heroArtwork.id)
              onInspect(idx)
            }}
          >
            <img
              src={heroArtwork.url}
              alt={heroArtwork.title}
              style={{
                width: '100%',
                maxHeight: '520px',
                objectFit: 'cover',
                display: 'block',
                transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            />

            <div
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                background: 'rgba(5, 5, 8, 0.85)',
                border: '1px solid rgba(212, 175, 55, 0.5)',
                color: '#D4AF37',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 700,
                fontSize: '0.7rem',
                padding: '4px 10px',
                borderRadius: '4px',
                letterSpacing: '0.15em',
                backdropFilter: 'blur(8px)',
              }}
            >
              OBRA DESTACADA
            </div>
          </div>

          {/* Información Curatorial */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                color: '#D4AF37',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              {heroArtwork.medium}
            </span>

            <h1
              style={{
                fontSize: 'clamp(2.4rem, 5vw, 3.8rem)',
                fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                fontWeight: 700,
                color: '#FFFFFF',
                lineHeight: 1.05,
                margin: '0 0 14px 0',
                letterSpacing: '0.06em',
              }}
            >
              {heroArtwork.title}
            </h1>

            <p
              style={{
                color: 'rgba(255, 255, 255, 0.75)',
                fontSize: '1rem',
                lineHeight: 1.7,
                margin: '0 0 28px 0',
                fontFamily: 'var(--font-sans, system-ui, sans-serif)',
                fontWeight: 300,
                maxWidth: '540px',
              }}
            >
              {heroArtwork.description}
            </p>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  sound.playOpen()
                  const idx = ARTWORKS.findIndex((a) => a.id === heroArtwork.id)
                  onInspect(idx)
                }}
                style={{
                  background: 'linear-gradient(135deg, #F0E6D2 0%, #D4AF37 100%)',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '30px',
                  padding: '12px 28px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.12em',
                  cursor: 'pointer',
                  boxShadow: '0 0 25px rgba(212, 175, 55, 0.4)',
                  transition: 'all 0.25s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                🔍 INSPECCIONAR EN DETALLE
              </button>

              <a
                href="#/atelier"
                onClick={() => sound.playTick()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '30px',
                  padding: '12px 24px',
                  fontWeight: 500,
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.12em',
                  textDecoration: 'none',
                  transition: 'all 0.25s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#D4AF37'
                  e.currentTarget.style.color = '#D4AF37'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  e.currentTarget.style.color = '#FFFFFF'
                }}
              >
                SOLICITAR ENCARGO BESPOKE ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CABECERA DE FILTROS & BÚSQUEDA MINIMALISTA */}
      <header style={{ marginBottom: '36px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '24px',
            marginBottom: '26px',
          }}
        >
          <div>
            <span
              style={{
                color: '#D4AF37',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.75rem',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              CATÁLOGO RAZONADO
            </span>
            <h2
              style={{
                fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#FFFFFF',
                margin: 0,
              }}
            >
              COLECCIÓN <span style={{ color: '#D4AF37' }}>OFICIAL</span>
            </h2>
          </div>

          {/* Buscador de Obras */}
          <div style={{ position: 'relative', minWidth: '280px', flex: '1', maxWidth: '380px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título o materia..."
              style={{
                width: '100%',
                background: 'rgba(10, 10, 15, 0.8)',
                border: '1px solid rgba(212, 175, 55, 0.35)',
                borderRadius: '50px',
                padding: '11px 40px 11px 18px',
                color: '#FFFFFF',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-mono, monospace)',
                outline: 'none',
                backdropFilter: 'blur(10px)',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#D4AF37')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(212, 175, 55, 0.35)')}
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                ✕
              </button>
            ) : (
              <span
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  opacity: 0.45,
                  pointerEvents: 'none',
                  fontSize: '0.85rem',
                }}
              >
                🔍
              </span>
            )}
          </div>
        </div>

        {/* Píldoras de Categoría */}
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
                  background: isSelected ? '#D4AF37' : 'rgba(255, 255, 255, 0.04)',
                  color: isSelected ? '#000000' : 'rgba(255, 255, 255, 0.7)',
                  border: isSelected ? '1px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '30px',
                  padding: '7px 18px',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.08em',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 0 20px rgba(212, 175, 55, 0.35)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.5)'
                    e.currentTarget.style.color = '#FFFFFF'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'
                  }
                }}
              >
                {cat.label} ({cat.count})
              </button>
            )
          })}
        </div>
      </header>

      {/* REJILLA DE OBRAS DE ALTA DEFINICIÓN */}
      {filteredArtworks.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 20px',
            background: 'rgba(10, 10, 15, 0.4)',
            borderRadius: '16px',
            border: '1px dashed rgba(212, 175, 55, 0.25)',
          }}
        >
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 16px 0', fontFamily: 'var(--font-mono, monospace)' }}>
            No se encontraron obras con ese criterio.
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
              padding: '10px 22px',
              borderRadius: '25px',
              fontWeight: 700,
              fontSize: '0.8rem',
              fontFamily: 'var(--font-mono, monospace)',
              cursor: 'pointer',
            }}
          >
            RESTABLECER FILTROS
          </button>
        </div>
      ) : (
        <motion.div
          layout
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '28px',
          }}
        >
          <AnimatePresence>
            {filteredArtworks.map((artwork) => {
              const originalIdx = ARTWORKS.findIndex((a) => a.id === artwork.id)

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  key={artwork.id}
                  style={{
                    background: 'rgba(8, 8, 12, 0.92)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 12px 35px rgba(0, 0, 0, 0.7)',
                    cursor: 'pointer',
                    transition: 'border-color 0.3s, transform 0.3s, box-shadow 0.3s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.75)'
                    e.currentTarget.style.transform = 'translateY(-5px)'
                    e.currentTarget.style.boxShadow = '0 20px 45px rgba(0, 0, 0, 0.9), 0 0 25px rgba(212, 175, 55, 0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.7)'
                  }}
                  onClick={() => {
                    sound.playOpen()
                    onInspect(originalIdx)
                  }}
                >
                  {/* Contenedor Fotográfico */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '4/5',
                      overflow: 'hidden',
                      background: '#030305',
                    }}
                  >
                    <img
                      src={artwork.url}
                      alt={artwork.title}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    />

                    {/* Año en micro-etiqueta mineral */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'rgba(3, 3, 5, 0.8)',
                        border: '1px solid rgba(212, 175, 55, 0.4)',
                        color: '#D4AF37',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      {artwork.year}
                    </div>

                    {/* Distintivo 3D Gaussian Splats si procede */}
                    {artwork.splatUrl && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '12px',
                          left: '12px',
                          background: 'rgba(3, 3, 5, 0.85)',
                          border: '1px solid rgba(212, 175, 55, 0.6)',
                          color: '#FFFFFF',
                          padding: '3px 8px',
                          borderRadius: '4px',
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

                  {/* Metadatos Editoriales Puros */}
                  <div
                    style={{
                      padding: '18px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: '#FFFFFF',
                          margin: '0 0 6px 0',
                          fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {artwork.title}
                      </h3>
                      <p
                        style={{
                          fontSize: '0.78rem',
                          color: 'rgba(212, 175, 55, 0.85)',
                          margin: 0,
                          fontFamily: 'var(--font-mono, monospace)',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {artwork.medium}
                      </p>
                    </div>

                    {/* Línea de Acción Sutil */}
                    <div
                      style={{
                        marginTop: '16px',
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: '0.72rem',
                          color: 'rgba(255, 255, 255, 0.5)',
                          letterSpacing: '0.1em',
                        }}
                      >
                        DETALLE ↗
                      </span>
                      <span style={{ color: '#D4AF37', fontSize: '0.8rem' }}>●</span>
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
