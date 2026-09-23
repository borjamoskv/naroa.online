import { Minimap } from './Minimap'
import { sound } from '../utils/audio'

interface VideogameHUDProps {
  onStart: () => void
  onExit?: () => void
  isStarted: boolean
  interactionPrompt: string | null
  playerPos: { x: number; z: number }
  playerRotation: number
}

export function VideogameHUD({
  onStart,
  onExit,
  isStarted,
  interactionPrompt,
  playerPos,
  playerRotation,
}: VideogameHUDProps) {
  const isTouchDevice =
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

  if (!isStarted) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 100,
          backgroundColor: 'rgba(3, 3, 5, 0.94)',
          backgroundImage:
            'radial-gradient(circle at center, rgba(212, 175, 55, 0.08) 0%, rgba(3, 3, 5, 0.98) 75%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          pointerEvents: 'auto',
          padding: '24px',
          textAlign: 'center',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <span
            style={{
              display: 'inline-block',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.72rem',
              letterSpacing: '0.25em',
              color: '#D4AF37',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            ESPACIO ARQUITECTÓNICO VIRTUAL · TRES DIMENSIONES
          </span>
          <h1
            style={{
              fontSize: 'clamp(2.4rem, 6vw, 4.4rem)',
              fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
              fontWeight: 700,
              letterSpacing: '0.12em',
              lineHeight: 1.1,
              margin: '0 0 12px 0',
              color: '#FFFFFF',
              textShadow: '0 0 40px rgba(212, 175, 55, 0.25)',
            }}
          >
            PABELLÓN <span style={{ color: '#D4AF37' }}>MUSEÍSTICO</span>
          </h1>
        </div>

        <p
          style={{
            fontSize: 'clamp(0.85rem, 2vw, 1rem)',
            marginBottom: '2.5rem',
            color: 'rgba(255, 255, 255, 0.7)',
            letterSpacing: '0.15em',
            fontFamily: 'var(--font-mono, monospace)',
            maxWidth: '620px',
            lineHeight: 1.6,
          }}
        >
          {isTouchDevice
            ? '📱 Recorrido 360° táctil. Desliza para explorar la sala y pulsa sobre cualquier obra.'
            : '[ W A S D ] Explorar Sala · [ Ratón ] Perspectiva Libre · [ Clic ] Inspeccionar Obra'}
        </p>

        <button
          onClick={() => {
            sound.playOpen()
            onStart()
          }}
          style={{
            fontSize: 'clamp(0.9rem, 2.5vw, 1.05rem)',
            fontFamily: 'var(--font-mono, monospace)',
            fontWeight: 700,
            letterSpacing: '0.18em',
            padding: '16px 38px',
            borderRadius: '50px',
            border: '1px solid #D4AF37',
            background: 'linear-gradient(135deg, #F0E6D2 0%, #D4AF37 100%)',
            color: '#000000',
            boxShadow: '0 0 35px rgba(212, 175, 55, 0.4)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'
            e.currentTarget.style.boxShadow = '0 0 45px rgba(212, 175, 55, 0.65)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)'
            e.currentTarget.style.boxShadow = '0 0 35px rgba(212, 175, 55, 0.4)'
          }}
        >
          ENTRAR AL PABELLÓN 3D ↗
        </button>

        <button
          onClick={() => {
            sound.playTick()
            if (onExit) onExit()
          }}
          style={{
            marginTop: '28px',
            background: 'transparent',
            color: 'rgba(255, 255, 255, 0.5)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.8rem',
            letterSpacing: '0.14em',
            padding: '8px 20px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '30px',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#D4AF37'
            e.currentTarget.style.borderColor = '#D4AF37'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
          }}
        >
          ← VOLVER AL HORIZONTE
        </button>
      </div>
    )
  }

  const isTargeting = interactionPrompt !== null

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
        padding: '24px 32px',
      }}
    >
      {/* Top HUD: Identificador de Sala & Salida */}
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
            background: 'rgba(5, 5, 8, 0.75)',
            border: '1px solid rgba(212, 175, 55, 0.25)',
            borderRadius: '25px',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#D4AF37',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.72rem',
              letterSpacing: '0.15em',
              color: '#FFFFFF',
              textTransform: 'uppercase',
            }}
          >
            SALA PRINCIPAL · BILBAO
          </span>
        </div>

        <button
          onClick={() => {
            sound.playTick()
            if (onExit) onExit()
            else if (document.pointerLockElement) document.exitPointerLock()
          }}
          style={{
            pointerEvents: 'auto',
            background: 'rgba(5, 5, 8, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.75rem',
            letterSpacing: '0.12em',
            padding: '8px 18px',
            borderRadius: '25px',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
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
          ✕ SALIR [ESC]
        </button>
      </div>

      {/* Retícula Central Sutil de Museo */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: isTargeting ? '28px' : '4px',
          height: isTargeting ? '28px' : '4px',
          backgroundColor: isTargeting ? 'transparent' : 'rgba(212, 175, 55, 0.8)',
          border: isTargeting ? '1.5px solid #D4AF37' : 'none',
          borderRadius: '50%',
          boxShadow: isTargeting ? '0 0 15px rgba(212, 175, 55, 0.5)' : 'none',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* Tooltip Flotante al Apuntar a una Obra */}
      {interactionPrompt && (
        <div
          style={{
            position: 'absolute',
            top: '56%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(5, 5, 8, 0.85)',
            border: '1px solid rgba(212, 175, 55, 0.4)',
            borderRadius: '30px',
            padding: '8px 22px',
            color: '#D4AF37',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.8rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8)',
          }}
        >
          {interactionPrompt}
        </div>
      )}

      {/* Bottom HUD: Controles & Plano de Planta (Minimap) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          width: '100%',
        }}
      >
        <div
          style={{
            background: 'rgba(5, 5, 8, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '8px 16px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.68rem',
              letterSpacing: '0.12em',
              color: 'rgba(255, 255, 255, 0.6)',
              textTransform: 'uppercase',
            }}
          >
            {isTouchDevice ? 'TOCA PARA DETALLES' : 'WASD: RECORRER · CLIC: INSPECCIONAR'}
          </span>
        </div>

        {/* Radar / Minimap */}
        <div style={{ pointerEvents: 'none' }}>
          <Minimap playerPos={playerPos} playerRotation={playerRotation} />
        </div>
      </div>
    </div>
  )
}
