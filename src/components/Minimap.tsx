import { ARTWORKS } from '../artworks'
import { ROTUNDA_RADIUS } from './Gallery'

interface MinimapProps {
  playerPos: { x: number; z: number }
  playerRotation: number
  selectedIndex?: number | null
  onSelectArtwork?: (index: number) => void
}

export function Minimap({
  playerPos,
  playerRotation,
  selectedIndex,
  onSelectArtwork,
}: MinimapProps) {
  const radius = ROTUNDA_RADIUS // 20.0
  const mapSize = 136 // Tamaño en px del widget
  const mapRadius = mapSize / 2
  const worldScale = mapRadius / 25 // 20m * (68/25) = ~54px, escala proporcional dentro del radar

  const numItems = ARTWORKS.length

  return (
    <div
      style={{
        width: `${mapSize}px`,
        height: `${mapSize}px`,
        borderRadius: '50%',
        backgroundColor: 'rgba(5, 5, 10, 0.82)',
        border: '1.5px solid rgba(212, 175, 55, 0.45)',
        boxShadow: '0 0 20px rgba(212, 175, 55, 0.2) inset, 0 10px 25px rgba(0, 0, 0, 0.85)',
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        pointerEvents: 'auto',
      }}
    >
      {/* Retícula de Radar (Líneas de cuadrícula) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle, rgba(212, 175, 55, 0.25) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '17px 17px, 17px 17px, 17px 17px',
          backgroundPosition: 'center center',
          pointerEvents: 'none',
        }}
      />

      {/* Círculo guía de ubicación de obras */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: `${radius * 2 * worldScale}px`,
          height: `${radius * 2 * worldScale}px`,
          border: '1px dashed rgba(212, 175, 55, 0.35)',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Anillo de banco central */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: `${2.6 * 2 * worldScale}px`,
          height: `${2.6 * 2 * worldScale}px`,
          border: '1px solid rgba(212, 175, 55, 0.25)',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Puntos de Obras de Arte (Blips de Radar interactivos) */}
      {ARTWORKS.map((artwork, i) => {
        const angle = (i / numItems) * Math.PI * 2
        const wx = Math.sin(angle) * radius
        const wz = Math.cos(angle) * radius

        // Posición relativa al jugador
        const relX = (wx - playerPos.x) * worldScale
        const relZ = (wz - playerPos.z) * worldScale

        const screenX = mapRadius + relX
        const screenY = mapRadius + relZ

        const isCurrent = selectedIndex === i

        return (
          <button
            key={i}
            onClick={() => onSelectArtwork?.(i)}
            title={`Obra ${i + 1}: ${artwork.title}`}
            style={{
              position: 'absolute',
              left: `${screenX}px`,
              top: `${screenY}px`,
              width: isCurrent ? '10px' : '5px',
              height: isCurrent ? '10px' : '5px',
              backgroundColor: isCurrent ? '#FFF6E5' : '#D4AF37',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              boxShadow: isCurrent ? '0 0 10px #D4AF37, 0 0 15px #FFF' : '0 0 4px #D4AF37',
              border: isCurrent ? '1.5px solid #D4AF37' : 'none',
              padding: 0,
              cursor: 'pointer',
              zIndex: isCurrent ? 8 : 4,
              transition: 'all 0.2s ease',
            }}
          />
        )
      })}

      {/* Jugador (Punto Central con Flecha de Orientación) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '8px',
          height: '8px',
          backgroundColor: '#D4AF37',
          border: '1.5px solid #FFFFFF',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 10px rgba(212, 175, 55, 0.8)',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      />

      {/* Indicador de Mirada / Orientación del Jugador */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '0',
          height: '0',
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderBottom: '11px solid #D4AF37',
          transformOrigin: '50% 100%',
          transform: `translate(-50%, -100%) rotate(${playerRotation}rad)`,
          zIndex: 9,
          opacity: 0.9,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
