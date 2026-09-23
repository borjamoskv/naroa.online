import { useState } from 'react'
import { sound } from '../utils/audio'

interface OptionItem {
  id: string
  label: string
  sublabel: string
  code: string
}

const SUBJECT_OPTIONS: OptionItem[] = [
  { id: 'individual', label: 'Retrato Individual', sublabel: 'Rostro único', code: '01' },
  { id: 'couple', label: 'Pareja / Dúo', sublabel: 'Dos miradas', code: '02' },
  { id: 'icon', label: 'Icono Cultural', sublabel: 'Música, cine & pop', code: '03' },
  { id: 'pet', label: 'Retrato Animal', sublabel: 'Mascota y compañía', code: '04' },
]

const MEDIUM_OPTIONS: OptionItem[] = [
  { id: 'slate_mica', label: 'Pizarra Natural & Mica Mineral', sublabel: 'Relieve fósil de millones de años y destello mineral', code: 'SLATE' },
  { id: 'canvas_3d', label: 'Lienzo 3D Texturado', sublabel: 'Grosor matérico escultórico y acrílico gestual', code: 'CANVAS' },
  { id: 'gold_mixed', label: 'Pan de Oro 24K & Técnica Mixta', sublabel: 'Láminas de oro puro y pigmentos minerales', code: 'GOLD' },
]

const SIZE_OPTIONS: OptionItem[] = [
  { id: 'medium', label: 'Presencia (50 × 70 cm)', sublabel: 'Escala equilibrada', code: '50×70' },
  { id: 'large', label: 'Monumental (100 × 80 cm)', sublabel: 'Gran escala museística', code: '100×80' },
  { id: 'small', label: 'Íntimo (30 × 40 cm)', sublabel: 'Colección de gabinete', code: '30×40' },
]

export function CommissionCalculator() {
  const [subject, setSubject] = useState<string>('individual')
  const [medium, setMedium] = useState<string>('slate_mica')
  const [size, setSize] = useState<string>('medium')

  const selectedSubject = SUBJECT_OPTIONS.find((s) => s.id === subject) || SUBJECT_OPTIONS[0]
  const selectedMedium = MEDIUM_OPTIONS.find((m) => m.id === medium) || MEDIUM_OPTIONS[0]
  const selectedSize = SIZE_OPTIONS.find((sz) => sz.id === size) || SIZE_OPTIONS[0]

  const summaryText = `Hola Naroa! Deseo encargar una pieza exclusiva a medida:
- Motivo: ${selectedSubject.label}
- Soporte: ${selectedMedium.label}
- Formato: ${selectedSize.label}

¿Podemos coordinar la fotografía de referencia y detalles del encargo?`

  const whatsappUrl = `https://wa.me/34636060609?text=${encodeURIComponent(summaryText)}`
  const mailtoUrl = `mailto:naroa@naroa.eu?subject=${encodeURIComponent(
    `Encargo Bespoke - ${selectedSubject.label}`
  )}&body=${encodeURIComponent(summaryText)}`

  return (
    <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '60px 24px 80px' }}>
      {/* Cabecera Atelier */}
      <header style={{ textAlign: 'center', marginBottom: '48px' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            color: '#D4AF37',
            fontSize: '0.75rem',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: '8px',
          }}
        >
          ATELIER NAROA GUTIÉRREZ GIL · BILBAO
        </span>
        <h1
          style={{
            fontSize: 'clamp(2.4rem, 5vw, 4rem)',
            fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
            color: '#FFFFFF',
            letterSpacing: '0.08em',
            margin: '0 0 12px 0',
            lineHeight: 1.1,
          }}
        >
          ENCARGOS <span style={{ color: '#D4AF37' }}>A MEDIDA</span>
        </h1>
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.65)',
            fontSize: '0.95rem',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          Cada encargo es una pieza original irrepetible, pintada a mano sobre piedra fósil o lienzo escultórico con certificado de autenticidad.
        </p>
      </header>

      {/* Grid Visual de Selección */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px',
          alignItems: 'start',
        }}
      >
        {/* Selector de Opciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 01 · MOTIVO */}
          <div
            style={{
              background: 'rgba(8, 8, 12, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div
              style={{
                color: '#D4AF37',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.72rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}
            >
              01 · MOTIVO PRINCIPAL
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
              {SUBJECT_OPTIONS.map((opt) => {
                const isSelected = subject === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      sound.playTick()
                      setSubject(opt.id)
                    }}
                    style={{
                      background: isSelected ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '1.5px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '16px 12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 0 20px rgba(212, 175, 55, 0.2)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        color: isSelected ? '#D4AF37' : 'rgba(255,255,255,0.4)',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        marginBottom: '8px',
                      }}
                    >
                      {opt.code}
                    </div>
                    <div style={{ color: isSelected ? '#D4AF37' : '#FFFFFF', fontWeight: 600, fontSize: '0.85rem' }}>
                      {opt.label}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 02 · MATERIA & TÉCNICA */}
          <div
            style={{
              background: 'rgba(8, 8, 12, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div
              style={{
                color: '#D4AF37',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.72rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}
            >
              02 · MATERIA & TÉCNICA
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {MEDIUM_OPTIONS.map((opt) => {
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
                      gap: '16px',
                      background: isSelected ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '1.5px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 0 20px rgba(212, 175, 55, 0.2)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: isSelected ? '#000000' : '#D4AF37',
                        background: isSelected ? '#D4AF37' : 'rgba(212, 175, 55, 0.15)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        letterSpacing: '0.1em',
                      }}
                    >
                      {opt.code}
                    </span>
                    <div>
                      <div style={{ color: isSelected ? '#D4AF37' : '#FFFFFF', fontWeight: 600, fontSize: '0.92rem' }}>
                        {opt.label}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', marginTop: '2px' }}>
                        {opt.sublabel}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 03 · DIMENSIÓN */}
          <div
            style={{
              background: 'rgba(8, 8, 12, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div
              style={{
                color: '#D4AF37',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.72rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}
            >
              03 · DIMENSIÓN
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
              {SIZE_OPTIONS.map((opt) => {
                const isSelected = size === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      sound.playTick()
                      setSize(opt.id)
                    }}
                    style={{
                      background: isSelected ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '1.5px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 0 20px rgba(212, 175, 55, 0.2)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '0.68rem',
                        color: isSelected ? '#D4AF37' : 'rgba(255,255,255,0.4)',
                        marginBottom: '6px',
                      }}
                    >
                      {opt.code}
                    </div>
                    <div style={{ color: isSelected ? '#D4AF37' : '#FFFFFF', fontWeight: 600, fontSize: '0.85rem' }}>
                      {opt.label}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Resumen & Concierge Privado */}
        <div style={{ position: 'sticky', top: '100px' }}>
          <div
            style={{
              background: 'radial-gradient(circle at top right, rgba(212,175,55,0.12) 0%, rgba(8, 8, 12, 0.95) 75%)',
              border: '1px solid rgba(212, 175, 55, 0.4)',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(212, 175, 55, 0.1)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.72rem',
                letterSpacing: '0.2em',
                color: '#D4AF37',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '10px',
              }}
            >
              FICHA DE ENCARGO BESPOKE
            </span>

            <h2
              style={{
                fontSize: '1.6rem',
                fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                color: '#FFFFFF',
                margin: '0 0 20px 0',
                lineHeight: 1.2,
              }}
            >
              CONFIGURACIÓN <span style={{ color: '#D4AF37' }}>SELECCIONADA</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontFamily: 'var(--font-mono, monospace)' }}>
                  MOTIVO
                </span>
                <div style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>
                  {selectedSubject.label}
                </div>
              </div>

              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontFamily: 'var(--font-mono, monospace)' }}>
                  SOPORTE & MATERIA
                </span>
                <div style={{ color: '#D4AF37', fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>
                  {selectedMedium.label}
                </div>
              </div>

              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontFamily: 'var(--font-mono, monospace)' }}>
                  DIMENSIÓN
                </span>
                <div style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>
                  {selectedSize.label}
                </div>
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
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.08em',
                  padding: '14px 20px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  boxShadow: '0 5px 25px rgba(37, 211, 102, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'transform 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                CONSULTAR DISPONIBILIDAD (WHATSAPP) ↗
              </a>
              <a
                href={mailtoUrl}
                onClick={() => sound.playTick()}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.08em',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
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
                ✉ naroa@naroa.eu ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
