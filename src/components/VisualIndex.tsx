import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ARTWORKS } from '../artworks'
import { sound } from '../utils/audio'

interface VisualIndexProps {
  isOpen: boolean
  onClose: () => void
  onSelectArtwork: (index: number) => void
}

type FilterCategory = 'all' | 'rocks' | 'divinos' | 'kintsugi' | 'drawing'

interface VisualIndexCardProps {
  artwork: (typeof ARTWORKS)[0]
  originalIndex: number
  onSelect: () => void
}

function VisualIndexCard({ artwork, originalIndex, onSelect }: VisualIndexCardProps) {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })
  const [isHovered, setIsHovered] = useState(false)
  const aspect = artwork.aspectRatio || 0.75

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    setMousePos({ x, y })
  }

  return (
    <motion.div
      data-cursor="INSPECT"
      className="visual-index-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => {
        sound.playOpen()
        onSelect()
      }}
      onMouseEnter={() => {
        setIsHovered(true)
        sound.playHapticClick(0.92)
      }}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'transform 0.3s ease',
      }}
      whileHover={{ y: -6 }}
    >
      {/* Contenedor de la Pieza con Caustic Mica Sheen */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: aspect >= 1.2 ? '16/10' : aspect >= 0.9 ? '1/1' : '3/4',
          background: 'rgba(255, 255, 255, 0.02)',
          border: isHovered ? '1px solid rgba(212, 175, 55, 0.55)' : '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          boxShadow: isHovered
            ? '0 20px 48px rgba(0, 0, 0, 0.92), 0 0 24px rgba(212, 175, 55, 0.14)'
            : 'none',
          transition: 'border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease',
        }}
      >
        <img
          src={artwork.url}
          alt={`${artwork.title} — Hiperrealismo POP sobre ${artwork.medium} (${artwork.year}) | Naroa Gutiérrez Gil`}
          loading="lazy"
          style={{
            maxHeight: '100%',
            maxWidth: '100%',
            objectFit: 'contain',
            filter:
              'drop-shadow(0 16px 28px rgba(0,0,0,0.92)) drop-shadow(0 4px 10px rgba(0,0,0,0.6))',
            transform: isHovered ? 'scale(1.035)' : 'scale(1)',
            transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />

        {/* Destello cáustico de mica mineral */}
        {isHovered && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle 240px at ${mousePos.x}% ${mousePos.y}%, rgba(212, 175, 55, 0.32) 0%, rgba(255, 255, 255, 0.12) 30%, transparent 70%)`,
              mixBlendMode: 'screen',
              pointerEvents: 'none',
              zIndex: 15,
            }}
          />
        )}

        {/* Número de Colección */}
        <span
          style={{
            position: 'absolute',
            top: '8px',
            left: '10px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.65rem',
            letterSpacing: '0.15em',
            color: 'rgba(212, 175, 55, 0.8)',
            fontWeight: 700,
          }}
        >
          {String(originalIndex + 1).padStart(2, '0')}
        </span>

        {/* Píldora de formato */}
        <span
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '10px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.58rem',
            letterSpacing: '0.12em',
            color: 'rgba(255, 255, 255, 0.45)',
            background: 'rgba(0, 0, 0, 0.65)',
            padding: '2px 6px',
            borderRadius: '8px',
          }}
        >
          {aspect >= 1.2 ? 'APAISADO' : aspect >= 0.9 ? 'CUADRADO' : 'VERTICAL'}
        </span>
      </div>

      {/* Metadatos Curatorial */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <h3
          style={{
            fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
            fontSize: '0.98rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: isHovered ? '#D4AF37' : '#FFFFFF',
            margin: 0,
            lineHeight: 1.2,
            textTransform: 'uppercase',
            transition: 'color 0.2s ease',
          }}
        >
          {artwork.title}
        </h3>
        {artwork.kicker && (
          <span
            style={{
              fontFamily: 'var(--font-editorial, "Cormorant Garamond", Georgia, serif)',
              fontStyle: 'italic',
              fontSize: '0.86rem',
              color: 'rgba(212, 175, 55, 0.95)',
              lineHeight: 1.25,
              letterSpacing: '0.02em',
            }}
          >
            «{artwork.kicker}»
          </span>
        )}
        <p
          style={{
            fontFamily: 'var(--font-editorial, "Cormorant Garamond", Georgia, serif)',
            fontStyle: 'italic',
            fontSize: '0.84rem',
            color: 'rgba(255, 255, 255, 0.65)',
            margin: 0,
            letterSpacing: '0.03em',
          }}
        >
          {artwork.year} · {artwork.medium}
        </p>
      </div>
    </motion.div>
  )
}

export function VisualIndex({ isOpen, onClose, onSelectArtwork }: VisualIndexProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredItems = useMemo(() => {
    return ARTWORKS.map((artwork, originalIndex) => ({ artwork, originalIndex })).filter(({ artwork }) => {
      // 1. Filtro temático de serie curatorial
      if (activeFilter === 'rocks') {
        if (artwork.category !== 'rocks') return false
      } else if (activeFilter === 'divinos') {
        if (artwork.category !== 'divinos') return false
      } else if (activeFilter === 'kintsugi') {
        if (artwork.category !== 'kintsugi') return false
      } else if (activeFilter === 'drawing') {
        if (artwork.category !== 'drawing') return false
      }

      // 2. Filtro textual de búsqueda instantánea
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = artwork.title.toLowerCase().includes(q)
        const matchMedium = artwork.medium.toLowerCase().includes(q)
        const matchYear = artwork.year.includes(q)
        const matchDesc = artwork.description.toLowerCase().includes(q)
        const matchKicker = (artwork.kicker || '').toLowerCase().includes(q)
        const matchQuote = (artwork.quote || '').toLowerCase().includes(q)
        if (!matchTitle && !matchMedium && !matchYear && !matchDesc && !matchKicker && !matchQuote) return false
      }

      return true
    })
  }, [activeFilter, searchQuery])

  if (!isOpen) return null

  const FILTER_TABS: { key: FilterCategory; label: string }[] = [
    { key: 'all', label: `TODAS (${ARTWORKS.length})` },
    { key: 'rocks', label: `ROCKS & PIZARRA (${ARTWORKS.filter((a) => a.category === 'rocks').length})` },
    { key: 'divinos', label: `DIVINOS & POP (${ARTWORKS.filter((a) => a.category === 'divinos').length})` },
    { key: 'kintsugi', label: `KINTSUGI & LATAS (${ARTWORKS.filter((a) => a.category === 'kintsugi').length})` },
    { key: 'drawing', label: `DIBUJO & PASTEL (${ARTWORKS.filter((a) => a.category === 'drawing').length})` },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(2, 2, 4, 0.97)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* BARRA SUPERIOR FIJA: CABECERA Y FILTROS CURATORIALES */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(2, 2, 4, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(212, 175, 55, 0.18)',
          padding: '18px clamp(16px, 4vw, 56px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '1680px',
          margin: '0 auto',
        }}
      >
        {/* FILA 1: TÍTULO, CONTADOR Y BOTÓN DE CIERRE */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
            <span
              style={{
                fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                fontSize: '1.15rem',
                letterSpacing: '0.14em',
                color: '#FFFFFF',
                fontWeight: 600,
              }}
            >
              ÍNDICE VISUAL
            </span>
            <span style={{ color: 'rgba(212, 175, 55, 0.4)' }}>·</span>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.74rem',
                color: '#D4AF37',
                letterSpacing: '0.18em',
              }}
            >
              {filteredItems.length} DE {ARTWORKS.length} OBRAS
            </span>
          </div>

          <button
            data-cursor="CERRAR"
            onClick={() => {
              sound.playClose()
              onClose()
            }}
            style={{
              background: 'transparent',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              color: '#D4AF37',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.74rem',
              letterSpacing: '0.15em',
              padding: '7px 18px',
              borderRadius: '30px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#D4AF37'
              e.currentTarget.style.background = '#D4AF37'
              e.currentTarget.style.color = '#000000'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.3)'
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#D4AF37'
            }}
          >
            CERRAR ÍNDICE ✕
          </button>
        </div>

        {/* FILA 2: CHIPS DE FILTRADO Y BUSCADOR EN TIEMPO REAL */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {/* Píldoras de serie */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {FILTER_TABS.map((tab) => {
              const active = activeFilter === tab.key
              return (
                <button
                  key={tab.key}
                  data-cursor="FILTRO"
                  onClick={() => {
                    sound.playHapticClick(active ? 1.0 : 1.15)
                    setActiveFilter(tab.key)
                  }}
                  style={{
                    background: active ? 'rgba(212, 175, 55, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid ' + (active ? '#D4AF37' : 'rgba(255, 255, 255, 0.12)'),
                    color: active ? '#D4AF37' : 'rgba(255, 255, 255, 0.6)',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.68rem',
                    letterSpacing: '0.12em',
                    padding: '5px 12px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      sound.playHapticClick(0.85)
                      e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.4)'
                      e.currentTarget.style.color = '#FFFFFF'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'
                    }
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Campo de búsqueda */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              minWidth: '220px',
              flex: '1 1 240px',
              maxWidth: '380px',
            }}
          >
            <input
              type="text"
              data-cursor="BUSCAR"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, técnica..."
              aria-label="Buscar obra en el índice"
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                borderRadius: '24px',
                padding: '6px 34px 6px 14px',
                color: '#FFFFFF',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.72rem',
                letterSpacing: '0.06em',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s ease, background 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#D4AF37'
                e.currentTarget.style.background = 'rgba(212, 175, 55, 0.08)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.25)'
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              }}
            />
            {searchQuery ? (
              <button
                data-cursor="LIMPIAR"
                onClick={() => {
                  sound.playTick()
                  setSearchQuery('')
                }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  padding: 0,
                }}
              >
                ✕
              </button>
            ) : (
              <span
                style={{
                  position: 'absolute',
                  right: '12px',
                  color: 'rgba(212, 175, 55, 0.4)',
                  fontSize: '0.75rem',
                  pointerEvents: 'none',
                }}
              >
                ⌕
              </span>
            )}
          </div>
        </div>
      </div>

      {/* GRID EDITORIAL CON RATIOS NATIVOS */}
      <div
        style={{
          maxWidth: '1680px',
          margin: '0 auto',
          padding: '36px clamp(16px, 4vw, 56px) 120px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(250px, 22vw, 360px), 1fr))',
          gap: 'clamp(24px, 3vw, 44px)',
          alignItems: 'start',
        }}
      >
        {filteredItems.map(({ artwork, originalIndex }) => (
          <VisualIndexCard
            key={artwork.id}
            artwork={artwork}
            originalIndex={originalIndex}
            onSelect={() => {
              onSelectArtwork(originalIndex)
              onClose()
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}
