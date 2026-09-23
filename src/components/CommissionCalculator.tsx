import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sound } from '../utils/audio'

interface OptionItem {
  id: string
  label: string
  sublabel: string
  badge?: string
  multiplier: number
  icon: string
}

const SUBJECT_OPTIONS: OptionItem[] = [
  { id: 'individual', label: 'Retrato Individual', sublabel: '1 rostro (Familiar, Autoretrato, Icono)', multiplier: 1.0, icon: '👤' },
  { id: 'couple', label: 'Pareja / Dúo', sublabel: '2 personas (Parejas, Hermanos, Amigos)', multiplier: 1.45, icon: '👥' },
  { id: 'pet', label: 'Retrato de Mascota', sublabel: 'Perros, gatos, animales de compañía', multiplier: 0.9, icon: '🐾' },
  { id: 'icon', label: 'Icono Pop Personalizado', sublabel: 'Tributo a artista, músico o mito contemporáneo', multiplier: 1.15, icon: '⚡' },
  { id: 'family', label: 'Familia / Grupo', sublabel: '3 o más figuras en composición armónica', multiplier: 1.85, icon: '✨' },
]

const MEDIUM_OPTIONS: OptionItem[] = [
  { id: 'slate_mica', label: 'Pizarra Natural + Mica Mineral', sublabel: 'La técnica insignia de Naroa con destellos minerales únicos', badge: 'MÁS SOLICITADO', multiplier: 1.2, icon: '💎' },
  { id: 'canvas_3d', label: 'Lienzo 3D + Acrílico Texturado', sublabel: 'Grosor especial con textura gestual e hiperrealismo', multiplier: 1.0, icon: '🖼️' },
  { id: 'gold_mixed', label: 'Mixed Media + Pan de Oro 24K', sublabel: 'Integración de pan de oro auténtico y pigmentos minerales puros', badge: 'EDICIÓN EXCLUSIVA', multiplier: 1.35, icon: '🌟' },
]

const SIZE_OPTIONS: OptionItem[] = [
  { id: 'small', label: 'Íntimo (30 × 40 cm)', sublabel: 'Ideal para espacios acogedores o despacho', multiplier: 380, icon: '📐' },
  { id: 'medium', label: 'Presencia (50 × 70 cm)', sublabel: 'El formato más equilibrado y demandado para salón o estudio', badge: 'RECOMENDADO', multiplier: 680, icon: '🎨' },
  { id: 'large', label: 'Monumental (100 × 80 cm)', sublabel: 'Gran formato de alto impacto visual y protagonismo espacial', multiplier: 1250, icon: '🏛️' },
  { id: 'custom', label: 'Medida Especial / Díptico', sublabel: 'Para proyectos específicos, murales o composiciones modulares', multiplier: 1500, icon: '✂️' },
]

const FAQS = [
  {
    q: '¿Qué necesito para encargar un retrato personalizado?',
    a: 'Solo necesitas una o varias fotos con buena iluminación. Naroa te asesorará personalmente sobre la mejor imagen para convertirla en una pieza hiperrealista con textura y relieve mineral.'
  },
  {
    q: '¿Cuánto tarda en pintarse y entregarse la obra?',
    a: 'El proceso artesanal sobre piedra o lienzo requiere habitualmente entre 3 y 5 semanas de dedicación minuciosa. Recibirás fotografías y vídeos del proceso para ver nacer la obra paso a paso.'
  },
  {
    q: '¿Cómo se realizan los envíos?',
    a: 'Cada pieza se embala en cajas de madera o aislamiento protector rígido y se envía 100% asegurada mediante mensajería prioritaria tanto en España como en el extranjero.'
  },
  {
    q: '¿Se entrega con Certificado de Autenticidad?',
    a: 'Sí, cada encargo incluye el Certificado de Autenticidad original firmado a mano por Naroa Gutiérrez Gil, detallando fecha, materiales, soporte y registro en el archivo de la artista.'
  }
]

export function CommissionCalculator() {
  const [subject, setSubject] = useState<string>('individual')
  const [medium, setMedium] = useState<string>('slate_mica')
  const [size, setSize] = useState<string>('medium')
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const selectedSubject = SUBJECT_OPTIONS.find(s => s.id === subject) || SUBJECT_OPTIONS[0]
  const selectedMedium = MEDIUM_OPTIONS.find(m => m.id === medium) || MEDIUM_OPTIONS[0]
  const selectedSize = SIZE_OPTIONS.find(sz => sz.id === size) || SIZE_OPTIONS[1]

  const basePrice = selectedSize.multiplier * selectedSubject.multiplier * selectedMedium.multiplier
  const minPrice = Math.round(basePrice * 0.95 / 10) * 10
  const maxPrice = Math.round(basePrice * 1.15 / 10) * 10

  const summaryText = `Hola Naroa! Me gustaría encargar un retrato personalizado a medida:
- Tipo: ${selectedSubject.label} (${selectedSubject.icon})
- Soporte/Técnica: ${selectedMedium.label} (${selectedMedium.icon})
- Tamaño: ${selectedSize.label} (${selectedSize.icon})
- Presupuesto estimado: ${minPrice}€ - ${maxPrice}€

¿Podemos hablar de la fotografía de referencia y plazos?`

  const whatsappUrl = `https://wa.me/34636060609?text=${encodeURIComponent(summaryText)}`
  const mailtoUrl = `mailto:naroa@naroa.eu?subject=${encodeURIComponent(`Encargo Retrato - ${selectedSubject.label}`)}&body=${encodeURIComponent(summaryText)}`

  return (
    <div className="commission-page" style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 20px 80px' }}>
      
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
            animation: 'marquee 25s linear infinite',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            letterSpacing: '0.2em',
            color: '#D4AF37',
            textTransform: 'uppercase'
          }}
        >
          ⚡ CADA PIEDRA TIENE MILLONES DE AÑOS · ENCARGA TU RETRATO ÚNICO · RETRATOS EN BILBAO · MICA MINERAL & PIZARRA NATURAL ⚡
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          ⚡ CADA PIEDRA TIENE MILLONES DE AÑOS · ENCARGA TU RETRATO ÚNICO · RETRATOS EN BILBAO · MICA MINERAL & PIZARRA NATURAL ⚡
        </div>
      </div>

      <header style={{ textAlign: 'center', marginBottom: '50px' }}>
        <span 
          style={{
            display: 'inline-block',
            background: 'rgba(212, 175, 55, 0.15)',
            border: '1px solid #D4AF37',
            color: '#D4AF37',
            padding: '6px 16px',
            borderRadius: '30px',
            fontSize: '0.8rem',
            fontWeight: 700,
            fontFamily: 'monospace',
            letterSpacing: '0.15em',
            marginBottom: '16px'
          }}
        >
          ATELIER DE RETRATOS · ENCARGOS 2026
        </span>
        <h1 
          style={{ 
            fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', 
            fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
            color: '#FFFFFF',
            margin: '0 0 16px 0',
            lineHeight: 1.1
          }}
        >
          DISEÑA TU <span style={{ color: '#D4AF37' }}>RETRATO</span>
        </h1>
        <p style={{ maxWidth: '650px', margin: '0 auto', color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem', lineHeight: 1.6 }}>
          Convierte un instante o una mirada en una obra de arte hiperrealista sobre pizarra natural con mica mineral o lienzo 3D.
          Configura los detalles y obtén una estimación inmediata para contactar con Naroa.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', alignItems: 'start' }}>
        
        {/* Panel Izquierdo: Configuración */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* PASO 1: Sujeto */}
          <div style={{ background: 'rgba(15, 15, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ background: '#D4AF37', color: '#000', fontFamily: 'monospace', fontWeight: 900, padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>01</span>
              <h2 style={{ fontSize: '1.25rem', color: '#FFFFFF', margin: 0, fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)' }}>¿A quién deseas inmortalizar?</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
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
                      boxShadow: isSelected ? '0 0 15px rgba(212, 175, 55, 0.2)' : 'none'
                    }}
                  >
                    <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{opt.icon}</div>
                    <div style={{ color: isSelected ? '#D4AF37' : '#FFFFFF', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>{opt.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>{opt.sublabel}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* PASO 2: Técnica & Soporte */}
          <div style={{ background: 'rgba(15, 15, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ background: '#D4AF37', color: '#000', fontFamily: 'monospace', fontWeight: 900, padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>02</span>
              <h2 style={{ fontSize: '1.25rem', color: '#FFFFFF', margin: 0, fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)' }}>Elige Soporte & Técnica</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                      gap: '16px',
                      background: isSelected ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '2px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 0 15px rgba(212, 175, 55, 0.2)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '2rem' }}>{opt.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ color: isSelected ? '#D4AF37' : '#FFFFFF', fontWeight: 700, fontSize: '0.95rem' }}>{opt.label}</span>
                        {opt.badge && (
                          <span style={{ background: '#D4AF37', color: '#000', fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>{opt.sublabel}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* PASO 3: Formato */}
          <div style={{ background: 'rgba(15, 15, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ background: '#D4AF37', color: '#000', fontFamily: 'monospace', fontWeight: 900, padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>03</span>
              <h2 style={{ fontSize: '1.25rem', color: '#FFFFFF', margin: 0, fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)' }}>Selecciona el Formato</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
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
                      boxShadow: isSelected ? '0 0 15px rgba(212, 175, 55, 0.2)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '1.4rem' }}>{opt.icon}</span>
                      {opt.badge && (
                        <span style={{ background: 'rgba(212, 175, 55, 0.2)', color: '#D4AF37', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ color: isSelected ? '#D4AF37' : '#FFFFFF', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>{opt.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>{opt.sublabel}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Panel Derecho: Resumen en vivo & Acciones */}
        <div style={{ position: 'sticky', top: '100px' }}>
          <div 
            style={{ 
              background: 'radial-gradient(circle at top right, rgba(212,175,55,0.12) 0%, rgba(15, 15, 20, 0.95) 70%)',
              border: '1px solid rgba(212, 175, 55, 0.6)',
              borderRadius: '20px',
              padding: '30px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(212, 175, 55, 0.15)',
              backdropFilter: 'blur(15px)'
            }}
          >
            <div style={{ textAlign: 'center', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px' }}>
              <span style={{ color: '#D4AF37', fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Presupuesto Orientativo
              </span>
              <div style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 800, color: '#FFFFFF', margin: '8px 0', fontFamily: 'monospace' }}>
                {minPrice}€ — {maxPrice}€
              </div>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                *Incluye IVA, certificado oficial de autenticidad y seguro de transporte
              </span>
            </div>

            {/* Especificaciones elegidas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Sujeto:</span>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{selectedSubject.icon} {selectedSubject.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Técnica:</span>
                <span style={{ color: '#D4AF37', fontWeight: 600 }}>{selectedMedium.icon} {selectedMedium.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Formato:</span>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{selectedSize.icon} {selectedSize.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Plazo de taller:</span>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>⏳ 3 a 5 semanas</span>
              </div>
            </div>

            {/* Garantías del Atelier */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', padding: '14px', marginBottom: '24px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>✓ Certificado de Autenticidad firmado por Naroa</div>
              <div>✓ Embalaje rígido de alta seguridad para pizarra y lienzo</div>
              <div>✓ Envío de fotografías semanales del proceso</div>
            </div>

            {/* Botones de Conversión */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                  boxShadow: '0 5px 20px rgba(37, 211, 102, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                💬 SOLICITAR POR WHATSAPP ↗
              </a>
              <a
                href={mailtoUrl}
                onClick={() => sound.playTick()}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.2s'
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
                ✉️ SOLICITAR POR EMAIL (naroa@naroa.eu)
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Sección Proceso de Encargo en 4 Fases */}
      <section style={{ marginTop: '80px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '60px' }}>
        <h2 
          style={{ 
            fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', 
            textAlign: 'center', 
            color: '#FFFFFF', 
            fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
            margin: '0 0 40px 0' 
          }}
        >
          CÓMO TRABAJAMOS <span style={{ color: '#D4AF37' }}>JUNTOS</span>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          {[
            { num: '01', title: 'Conversación Inicial', desc: 'Me envías tus fotos de referencia y me cuentas la historia detrás de la persona o mascota a retratar.' },
            { num: '02', title: 'Boceto & Selección', desc: 'Definimos la composición, paleta de color y materiales (pizarra, mica, lienzo) antes de dar el primer trazo.' },
            { num: '03', title: 'Creación & Avances', desc: 'Pinto la obra. Recibes fotos del avance para que sientas cómo cobra vida paso a paso.' },
            { num: '04', title: 'Entrega & Certificado', desc: 'Envío asegurado en caja protectora con su Certificado de Autenticidad oficial firmado por Naroa.' },
          ].map((step, idx) => (
            <div 
              key={idx}
              style={{
                background: 'rgba(15, 15, 20, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '24px',
                transition: 'border-color 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#D4AF37'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            >
              <div style={{ color: '#D4AF37', fontFamily: 'monospace', fontWeight: 900, fontSize: '1.2rem', marginBottom: '8px' }}>{step.num}</div>
              <h3 style={{ color: '#FFFFFF', fontSize: '1.1rem', margin: '0 0 10px 0' }}>{step.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Sección */}
      <section style={{ marginTop: '70px' }}>
        <h2 
          style={{ 
            fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', 
            textAlign: 'center', 
            color: '#FFFFFF', 
            fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
            margin: '0 0 30px 0' 
          }}
        >
          PREGUNTAS <span style={{ color: '#D4AF37' }}>FRECUENTES</span>
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '800px', margin: '0 auto' }}>
          {FAQS.map((faq, idx) => (
            <div 
              key={idx} 
              style={{ 
                background: 'rgba(15, 15, 20, 0.8)', 
                border: '1px solid rgba(255, 255, 255, 0.1)', 
                borderRadius: '12px',
                overflow: 'hidden'
              }}
            >
              <button
                onClick={() => {
                  sound.playTick()
                  setOpenFaq(openFaq === idx ? null : idx)
                }}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: '18px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: '#FFFFFF',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span>{faq.q}</span>
                <span style={{ color: '#D4AF37', fontSize: '1.3rem', marginLeft: '12px' }}>{openFaq === idx ? '−' : '+'}</span>
              </button>
              <AnimatePresence>
                {openFaq === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p style={{ padding: '0 24px 20px', margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
