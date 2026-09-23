import { useEffect, useState } from 'react'
import { Minimap } from './Minimap'

interface VideogameHUDProps {
  onStart: () => void;
  onExit?: () => void;
  isStarted: boolean;
  interactionPrompt: string | null;
  playerPos: { x: number; z: number };
  playerRotation: number;
}

export function VideogameHUD({ onStart, onExit, isStarted, interactionPrompt, playerPos, playerRotation }: VideogameHUDProps) {
  const [glitch, setGlitch] = useState(false)

  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

  // Efecto de Glitch aleatorio
  useEffect(() => {
    if (!isStarted) return
    const interval = setInterval(() => {
      if (Math.random() > 0.8) {
        setGlitch(true)
        setTimeout(() => setGlitch(false), 150)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [isStarted])

  if (!isStarted) {
    return (
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 100,
          backgroundColor: 'rgba(0, 0, 0, 0.92)',
          backgroundImage: 'radial-gradient(circle at center, rgba(43,59,229,0.2) 0%, transparent 70%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          pointerEvents: 'auto',
          padding: '20px',
          textAlign: 'center'
        }}
      >
        <div style={{ position: 'relative' }}>
          <h1 style={{ 
            fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', 
            letterSpacing: '0.25em', 
            marginBottom: '0.8rem', 
            textShadow: '0 0 30px #2B3BE5, 0 0 10px #D4AF37',
            fontFamily: 'monospace',
            fontWeight: 900
          }}>
            N A R O A <span style={{ color: '#D4AF37' }}>/</span> O S
          </h1>
          <div style={{ position: 'absolute', top: -10, right: -15, background: '#D4AF37', color: 'black', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
            v1.2.0 (HIGH-EXERGY)
          </div>
        </div>
        
        <p style={{ fontSize: 'clamp(0.9rem, 3vw, 1.2rem)', marginBottom: '2.5rem', opacity: 0.8, letterSpacing: '0.15em', fontFamily: 'monospace', maxWidth: '600px' }}>
          {isTouchDevice 
            ? '📱 [DISPOSITIVO TÁCTIL] TOCA ENTRAR PARA NAVEGAR EL MUSEO VIRTUAL' 
            : '[W A S D] MOVER • [RATÓN] CÁMARA • [E / CLICK] INSPECCIONAR'}
        </p>
        
        <button 
          onClick={onStart}
          className="premium-btn premium-btn--primary"
          style={{ 
            fontSize: 'clamp(1.1rem, 3.5vw, 1.5rem)', 
            padding: '1.2rem 3rem',
            border: '2px solid #D4AF37',
            background: 'rgba(212,175,55,0.15)',
            boxShadow: '0 0 25px rgba(212,175,55,0.3) inset',
            animation: 'pulse 2s infinite',
            cursor: 'pointer'
          }}
        >
          [ CLICK ] INICIALIZAR SIMULACIÓN
        </button>

        <a
          href="#/"
          style={{
            marginTop: '24px',
            color: 'rgba(255, 255, 255, 0.5)',
            textDecoration: 'none',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            letterSpacing: '0.1em',
            padding: '8px 18px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '4px',
            transition: 'all 0.2s ease'
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
          ← VOLVER AL PORTFOLIO WEB
        </a>
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
        padding: '30px',
        // Scanlines CSS muy sutiles
        background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.05) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))',
        backgroundSize: '100% 4px, 6px 100%'
      }}
    >
      {/* Top HUD */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ 
          background: 'rgba(0,0,0,0.7)', 
          borderLeft: '4px solid #D4AF37', 
          padding: '12px 20px',
          color: '#D4AF37',
          fontFamily: 'monospace',
          backdropFilter: 'blur(8px)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          transform: glitch ? 'translateX(5px)' : 'translateX(0)',
          transition: 'transform 0.1s'
        }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Nivel de Exergía</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>MAX_CAPACITY</div>
        </div>

        <button
          onClick={() => {
            if (onExit) onExit()
            else if (document.pointerLockElement) document.exitPointerLock()
          }}
          style={{
            pointerEvents: 'auto',
            background: 'rgba(212,175,55,0.2)',
            border: '1px solid #D4AF37',
            color: '#D4AF37',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            fontWeight: 700,
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 0 15px rgba(212,175,55,0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#D4AF37'
            e.currentTarget.style.color = '#000000'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(212,175,55,0.2)'
            e.currentTarget.style.color = '#D4AF37'
          }}
        >
          ✕ SALIR AL MENÚ
        </button>
        
        <div style={{ 
          background: 'rgba(0,0,0,0.7)', 
          borderRight: '4px solid #2B3BE5', 
          padding: '12px 20px',
          color: '#2B3BE5',
          fontFamily: 'monospace',
          backdropFilter: 'blur(8px)',
          textAlign: 'right'
        }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Protocolo Activo</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>ULTRATHINK Ω</div>
        </div>
      </div>

      {/* Crosshair Dinámica */}
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: isTargeting ? '8px' : '4px',
          height: isTargeting ? '8px' : '4px',
          backgroundColor: isTargeting ? 'transparent' : 'rgba(255,255,255,0.8)',
          border: isTargeting ? '2px solid #D4AF37' : 'none',
          borderRadius: '50%',
          boxShadow: isTargeting ? '0 0 15px #D4AF37' : '0 0 10px rgba(255,255,255,0.5)',
          transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      />
      
      {/* Brackets del Crosshair que reaccionan al Target */}
      <div style={{ 
        position: 'absolute', top: '50%', left: '50%', 
        transform: `translate(-50%, ${isTargeting ? '-25px' : '-15px'})`, 
        width: '2px', height: '10px', 
        backgroundColor: isTargeting ? '#D4AF37' : 'rgba(255,255,255,0.5)',
        transition: 'all 0.2s'
      }} />
      <div style={{ 
        position: 'absolute', top: '50%', left: '50%', 
        transform: `translate(-50%, ${isTargeting ? '15px' : '5px'})`, 
        width: '2px', height: '10px', 
        backgroundColor: isTargeting ? '#D4AF37' : 'rgba(255,255,255,0.5)',
        transition: 'all 0.2s'
      }} />
      <div style={{ 
        position: 'absolute', top: '50%', left: '50%', 
        transform: `translate(${isTargeting ? '-25px' : '-15px'}, -50%)`, 
        width: '10px', height: '2px', 
        backgroundColor: isTargeting ? '#D4AF37' : 'rgba(255,255,255,0.5)',
        transition: 'all 0.2s'
      }} />
      <div style={{ 
        position: 'absolute', top: '50%', left: '50%', 
        transform: `translate(${isTargeting ? '15px' : '5px'}, -50%)`, 
        width: '10px', height: '2px', 
        backgroundColor: isTargeting ? '#D4AF37' : 'rgba(255,255,255,0.5)',
        transition: 'all 0.2s'
      }} />

      {/* Interacción Promt Cinemático */}
      {interactionPrompt && (
        <div 
          style={{
            position: 'absolute',
            top: '55%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent)',
            padding: '10px 40px',
            color: '#D4AF37',
            fontFamily: 'monospace',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            letterSpacing: '0.2em',
            textShadow: '0 0 10px #D4AF37',
            borderTop: '1px solid rgba(212,175,55,0.5)',
            borderBottom: '1px solid rgba(212,175,55,0.5)',
            animation: 'pulse 1.5s infinite'
          }}
        >
          {interactionPrompt}
        </div>
      )}

      {/* Bottom HUD: Controles + Radar Minimap */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => {
              if (onExit) onExit()
              else if (document.pointerLockElement) document.exitPointerLock()
            }}
            style={{ 
              color: 'rgba(255,255,255,0.7)', 
              fontFamily: 'monospace', 
              fontSize: '0.85rem',
              background: 'rgba(0,0,0,0.6)',
              padding: '6px 16px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
              pointerEvents: 'auto',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#D4AF37'
              e.currentTarget.style.borderColor = '#D4AF37'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
            }}
          >
            [ESC / CLICK] SALIR DEL SIMULADOR
          </button>
        </div>

        {/* Minimapa Radar (Bottom-Right) */}
        <Minimap playerPos={playerPos} playerRotation={playerRotation} />
      </div>
    </div>
  )
}
