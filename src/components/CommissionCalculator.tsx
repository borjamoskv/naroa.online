import { useState } from 'react'
import { sound } from '../utils/audio'

interface OptionItem {
  id: string
  label: string
  sublabel: string
  icon: string
}

const SUBJECT_OPTIONS: OptionItem[] = [
  { id: 'individual', label: 'Retrato Individual', sublabel: 'Rostro único', icon: '👤' },
  { id: 'couple', label: 'Pareja / Dúo', sublabel: 'Dos miradas', icon: '👥' },
  { id: 'icon', label: 'Icono Pop', sublabel: 'Mito de la música o cine', icon: '⚡' },
  { id: 'pet', label: 'Mascota', sublabel: 'Animal de compañía', icon: '🐾' },
]

const MEDIUM_OPTIONS: OptionItem[] = [
  { id: 'slate_mica', label: 'Pizarra Natural & Mica', sublabel: 'Relieve mineral y destellos únicos', icon: '💎' },
  { id: 'canvas_3d', label: 'Lienzo 3D Texturado', sublabel: 'Grosor escultórico y acrílico gestual', icon: '🖼️' },
  { id: 'gold_mixed', label: 'Pan de Oro 24K & Mixta', sublabel: 'Láminas de oro puro y pigmentos', icon: '🌟' },
]

const SIZE_OPTIONS: OptionItem[] = [
  { id: 'medium', label: 'Presencia (50 × 70 cm)', sublabel: 'Formato equilibrado', icon: '🎨' },
  { id: 'large', label: 'Monumental (100 × 80 cm)', sublabel: 'Gran impacto visual', icon: '🏛️' },
  { id: 'small', label: 'Íntimo (30 × 40 cm)', sublabel: 'Espacio personal', icon: '📐' },
]

export function CommissionCalculator() {
  const [subject, setSubject] = useState<string>('individual')
  const [medium, setMedium] = useState<string>('slate_mica')
  const [size, setSize] = useState<string>('medium')

  const selectedSubject = SUBJECT_OPTIONS.find(s => s.id === subject) || SUBJECT_OPTIONS[0]
  const selectedMedium = MEDIUM_OPTIONS.find(m => m.id === medium) || MEDIUM_OPTIONS[0]
  const selectedSize = SIZE_OPTIONS.find(sz => sz.id === size) || SIZE_OPTIONS[0]

  const summaryText = `Hola Naroa! Deseo encargar un retrato personalizado a medida:
- Motivo: ${selectedSubject.label}
- Soporte: ${selectedMedium.label}
- Formato: ${selectedSize.label}

¿Podemos coordinar la fotografía de referencia y detalles?`

  const whatsappUrl = `https://wa.me/34636060609?text=${encodeURIComponent(summaryText)}`
  const mailtoUrl = `mailto:naroa@naroa.eu?subject=${encodeURIComponent(`Encargo - ${selectedSubject.label}`)}&body=${encodeURIComponent(summaryText)}`

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '100px 20px 60px' }}>
      
      {/* Cabecera Minimalista */}
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 
          style={{ 
            fontSize: 'clamp(2.4rem, 6vw, 4rem)', 
            fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
            color: '#FFFFFF',
            letterSpacing: '0.1em',
            margin: '0 0 10px 0',
            lineHeight: 1.1
          }}
        >
          ENCARGOS <span style={{ color: '#D4AF37' }}>EXCLUSIVOS</span>
        </h1>
        <p 
          style={{ 
            fontFamily: 'var(--font-mono, monospace)', 
            color: '#D4AF37', 
            fontSize: '0.85rem', 
            letterSpacing: '0.2em', 
            textTransform: 'uppercase',
            margin: 0
          }}
        >
          Atelier Naroa Gutiérrez Gil · Bilbao
        </p>
      </header>

      {/* Grid Visual de Selección */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '28px', alignItems: 'start' }}>
        
        {/* Selector de Opciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Sujeto */}
          <div style={{ background: 'rgba(15, 15, 20, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '20px', backdropFilter: 'blur(10px)' }}>
            <div style={{ color: '#D4AF37', fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px' }}>
              01 · MOTIVO
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
              {SUBJECT_OPTIONS.map(opt => {
                const isSelected = subject === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      sound.playTick()
                      setSubject(opt.id)
                    }}
                    style={{
                      background: isSelected ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '2px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '14px 10px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 0 15px rgba(212, 175, 55, 0.25)' : 'none'
                    }}
                  >
                    <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>{opt.icon}</div>
                    <div style={{ color: isSelected ? '#D4AF37' : '#FFFFFF', fontWeight: 700, fontSize: '0.85rem' }}>{opt.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Soporte */}
          <div style={{ background: 'rgba(15, 15, 20, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '20px', backdropFilter: 'blur(10px)' }}>
            <div style={{ color: '#D4AF37', fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px' }}>
              02 · MATERIA & TÉCNICA
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {MEDIUM_OPTIONS.map(opt => {
                const isSelected = medium === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      sound.playTick()
                      setMedium(opt.id)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      background: isSelected ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '2px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 0 15px rgba(212, 175, 55, 0.25)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '1.8rem' }}>{opt.icon}</span>
                    <div>
                      <div style={{ color: isSelected ? '#D4AF37' : '#FFFFFF', fontWeight: 700, fontSize: '0.95rem' }}>{opt.label}</div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginTop: '2px' }}>{opt.sublabel}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Formato */}
          <div style={{ background: 'rgba(15, 15, 20, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '20px', backdropFilter: 'blur(10px)' }}>
            <div style={{ color: '#D4AF37', fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px' }}>
              03 · DIMENSIÓN
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
              {SIZE_OPTIONS.map(opt => {
                const isSelected = size === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      sound.playTick()
                      setSize(opt.id)
                    }}
                    style={{
                      background: isSelected ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '2px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 0 15px rgba(212, 175, 55, 0.25)' : 'none'
                    }}
                  >
                    <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>{opt.icon}</div>
                    <div style={{ color: isSelected ? '#D4AF37' : '#FFFFFF', fontWeight: 700, fontSize: '0.85rem' }}>{opt.label}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Resumen Inmersivo & Salida Directa */}
        <div style={{ position: 'sticky', top: '100px' }}>
          <div 
            style={{ 
              background: 'radial-gradient(circle at top right, rgba(212,175,55,0.15) 0%, rgba(15, 15, 20, 0.95) 75%)',
              border: '1px solid rgba(212, 175, 55, 0.5)',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(212, 175, 55, 0.15)',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <span style={{ color: '#D4AF37', fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Pieza a Medida
              </span>
              <h2 style={{ fontSize: '1.6rem', color: '#FFFFFF', margin: '8px 0 0', fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)' }}>
                {selectedSubject.label}
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Sustrato:</span>
                <span style={{ color: '#D4AF37', fontWeight: 600 }}>{selectedMedium.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Formato:</span>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{selectedSize.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Elaboración:</span>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Artesanal en Bilbao</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sound.playTick()}
                style={{
                  background: '#25D366',
                  color: '#000000',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  padding: '14px 20px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  boxShadow: '0 5px 25px rgba(37, 211, 102, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                💬 CONSULTAR ENCARGO (WHATSAPP) ↗
              </a>
              <a
                href={mailtoUrl}
                onClick={() => sound.playTick()}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  transition: 'all 0.2s ease'
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
                ✉️ naroa@naroa.eu ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
