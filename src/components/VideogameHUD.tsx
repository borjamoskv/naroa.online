import { ARTWORKS } from '../artworks'
import { sound } from '../utils/audio'

interface VideogameHUDProps {
  onExit: () => void
  selectedIndex: number | null
  onSelectArtwork: (index: number | null) => void
  onInspectArtwork: (index: number) => void
  onOpenCommission: (title: string) => void
}

/**
 * Capa de interfaz minimalista para el pabellón 3D.
 * Principio: La obra es el centro absoluto; la web se desvanece en silencio.
 */
export function VideogameHUD({
  onExit,
  selectedIndex,
  onSelectArtwork,
  onInspectArtwork,
  onOpenCommission,
}: VideogameHUDProps) {
  const selectedArtwork = selectedIndex !== null ? ARTWORKS[selectedIndex] : null

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedIndex === null) return
    const prev = (selectedIndex - 1 + ARTWORKS.length) % ARTWORKS.length
    sound.playTick()
    onSelectArtwork(prev)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedIndex === null) return
    const next = (selectedIndex + 1) % ARTWORKS.length
    sound.playTick()
    onSelectArtwork(next)
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px clamp(20px, 4vw, 48px)',
      }}
    >
      {/* ── 1. CABECERA: SILENCIO Y SALIDA DISCRETA ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.68rem',
            letterSpacing: '0.2em',
            color: 'rgba(255, 255, 255, 0.45)',
            textTransform: 'uppercase',
          }}
        >
          ROTONDA · 27 OBRAS
        </div>

        <button
          onClick={() => {
            sound.playTick()
            onExit()
          }}
          style={{
            pointerEvents: 'auto',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.55)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.72rem',
            letterSpacing: '0.14em',
            padding: '6px 12px',
            cursor: 'pointer',
            transition: 'color 0.25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#FFFFFF'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.55)'
          }}
        >
          ← HORIZONTE
        </button>
      </div>

      {/* ── 2. CARTELA CURATORIAL DISCRETA AL ENFOCAR UNA OBRA ── */}
      {selectedArtwork && selectedIndex !== null ? (
        <div
          style={{
            pointerEvents: 'auto',
            alignSelf: 'center',
            marginBottom: '84px',
            background: 'rgba(10, 11, 15, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '16px 24px',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxWidth: 'min(90vw, 560px)',
            textAlign: 'center',
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          {/* Título en tipografía serena */}
          <div
            style={{
              fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
              fontSize: '1.25rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: '#FFFFFF',
            }}
          >
            {selectedArtwork.title}
          </div>

          {/* Ficha técnica mínima */}
          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.68rem',
              letterSpacing: '0.08em',
              color: 'rgba(212, 175, 55, 0.85)',
            }}
          >
            {selectedArtwork.year} · {selectedArtwork.medium}
          </div>

          {/* Botones de acción artística esenciales */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              marginTop: '6px',
            }}
          >
            <button
              onClick={handlePrev}
              title="Obra anterior"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '1.1rem',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              ‹
            </button>

            <button
              onClick={() => {
                sound.playOpen()
                onInspectArtwork(selectedIndex)
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.68rem',
                letterSpacing: '0.12em',
                padding: '6px 16px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#D4AF37'
                e.currentTarget.style.color = '#D4AF37'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                e.currentTarget.style.color = '#FFFFFF'
              }}
            >
              LUPA 2.5X
            </button>

            <button
              onClick={() => {
                sound.playTick()
                onOpenCommission(selectedArtwork.title)
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(212, 175, 55, 0.35)',
                color: '#D4AF37',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.68rem',
                letterSpacing: '0.12em',
                padding: '6px 14px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              ENCARGO
            </button>

            <button
              onClick={handleNext}
              title="Siguiente obra"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '1.1rem',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              ›
            </button>

            <button
              onClick={() => {
                sound.playTick()
                onSelectArtwork(null)
              }}
              title="Volver a la sala"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                marginLeft: '6px',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        /* Sutil indicación contemplativa en reposo */
        <div
          style={{
            alignSelf: 'center',
            marginBottom: '84px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.65rem',
            letterSpacing: '0.18em',
            color: 'rgba(255, 255, 255, 0.3)',
            textTransform: 'uppercase',
          }}
        >
          DESLIZA PARA RECORRER · PULSA UNA OBRA PARA ACERCARTE
        </div>
      )}
    </div>
  )
}
