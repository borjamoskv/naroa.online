import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
  { id: 'pet', label: 'Retrato de Mascota', sublabel: 'Perros, gatos, animales de compañía', multiplier: 0.9, icon: '🐶' },
  { id: 'icon', label: 'Icono Pop Personalizado', sublabel: 'Tributo a artista, músico o mito pop', multiplier: 1.15, icon: '⚡' },
  { id: 'family', label: 'Familia / Grupo', sublabel: '3 o más figuras en composición', multiplier: 1.85, icon: '✨' },
]

const MEDIUM_OPTIONS: OptionItem[] = [
  { id: 'slate_mica', label: 'Pizarra Natural + Mica Mineral', sublabel: 'La técnica insignia de Naroa con destellos minerales', badge: 'MÁS POPULAR', multiplier: 1.2, icon: '💎' },
  { id: 'canvas_3d', label: 'Lienzo 3D + Acrílico', sublabel: 'Grosor especial con textura gestual e hiperrealismo', multiplier: 1.0, icon: '🖼️' },
  { id: 'gold_mixed', label: 'Mixed Media + Pan de Oro', sublabel: 'Integración de pan de oro de 24k y pigmentos puros', badge: 'EXCLUSIVO', multiplier: 1.35, icon: '🌟' },
]

const SIZE_OPTIONS: OptionItem[] = [
  { id: 'small', label: 'Íntimo (30 × 40 cm)', sublabel: 'Ideal para espacios acogedores o escritorio', multiplier: 380, icon: '📐' },
  { id: 'medium', label: 'Presencia (50 × 70 cm)', sublabel: 'El formato más equilibrado para salón o estudio', badge: 'RECOMENDADO', multiplier: 680, icon: '🎨' },
  { id: 'large', label: 'Monumental (100 × 80 cm)', sublabel: 'Gran formato de alto impacto visual', multiplier: 1250, icon: '🏛️' },
  { id: 'custom', label: 'Medida Especial', sublabel: 'Para proyectos específicos o murales', multiplier: 1500, icon: '✂️' },
]

const FAQS = [
  {
    q: '¿Qué necesito para encargar un retrato personalizado?',
    a: 'Solo necesitas una o varias fotos de buena calidad con iluminación clara. Naroa te guiará personalmente en la elección de la foto ideal para convertirla en una pieza única.'
  },
  {
    q: '¿Cuánto tarda en pintarse y entregarse la obra?',
    a: 'El proceso artesanal hiperrealista requiere entre 3 y 6 semanas de elaboración. Recibirás fotografías de los avances semana a semana para ver cómo cobra vida.'
  },
  {
    q: '¿Cómo se realizan los envíos?',
    a: 'Todas las obras se embalan en cajas de madera o protección rígida de alta resistencia y se envían aseguradas a cualquier punto de España y del extranjero.'
  },
  {
    q: '¿Se entregan con Certificado de Autenticidad?',
    a: 'Sí, cada obra incluye el Certificado de Autenticidad firmado por Naroa Gutiérrez Gil, detallando la fecha, materiales (pizarra, mica, acrílicos) y número de registro.'
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

  const summaryText = `Hola Naroa! Me gustaría encargar un retrato personalizado.
- Tipo: ${selectedSubject.label} (${selectedSubject.icon})
- Soporte/Técnica: ${selectedMedium.label} (${selectedMedium.icon})
- Tamaño: ${selectedSize.label} (${selectedSize.icon})
- Presupuesto estimado: ${minPrice}€ - ${maxPrice}€

¿Podemos hablar de los detalles?`

  const whatsappUrl = `https://wa.me/34600000000?text=${encodeURIComponent(summaryText)}`
  const mailtoUrl = `mailto:naroa@naroa.eu?subject=${encodeURIComponent(`Encargo Retrato - ${selectedSubject.label}`)}&body=${encodeURIComponent(summaryText)}`

  return (
    <div className="commission-page brutal-container">
      {/* Ticker Marquesina Brutalista */}
      <div className="brutal-marquee-bar">
        <div className="brutal-marquee-content">
          <span>⚡ CADA PIEDRA TIENE MILLONES DE AÑOS · ENCARGA TU RETRATO ÚNICO · RETRATOS EN BILBAO · MICA MINERAL & PIZARRA NATURAL ⚡</span>
          <span>⚡ CADA PIEDRA TIENE MILLONES DE AÑOS · ENCARGA TU RETRATO ÚNICO · RETRATOS EN BILBAO · MICA MINERAL & PIZARRA NATURAL ⚡</span>
        </div>
      </div>

      <header className="commission-header">
        <span className="brutal-badge brutal-badge--pink">ENCARGOS EXCLUSIVOS 2026</span>
        <h1 className="brutal-title">
          DISEÑA TU <span className="highlight-yellow">RETRATO</span>
        </h1>
        <p className="brutal-subtitle">
          Transforma una fotografía en una obra de arte hiperrealista sobre pizarra, mica mineral o lienzo.
          Personaliza los detalles a continuación para obtener una estimación inmediata.
        </p>
      </header>

      <div className="commission-grid">
        {/* Panel Izquierdo: Configuración paso a paso */}
        <div className="calculator-panel">
          {/* PASO 1: Sujeto */}
          <div className="calc-step-card brutal-card">
            <div className="step-num-badge">01</div>
            <h2 className="step-title">¿A quién quieres inmortalizar?</h2>
            <div className="options-grid">
              {SUBJECT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`opt-btn brutal-btn ${subject === opt.id ? 'active' : ''}`}
                  onClick={() => setSubject(opt.id)}
                >
                  <span className="opt-icon">{opt.icon}</span>
                  <div className="opt-text">
                    <span className="opt-label">{opt.label}</span>
                    <span className="opt-sub">{opt.sublabel}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* PASO 2: Técnica & Soporte */}
          <div className="calc-step-card brutal-card">
            <div className="step-num-badge">02</div>
            <h2 className="step-title">Elige Soporte & Técnica</h2>
            <div className="options-grid">
              {MEDIUM_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`opt-btn brutal-btn ${medium === opt.id ? 'active' : ''}`}
                  onClick={() => setMedium(opt.id)}
                >
                  {opt.badge && <span className="opt-badge">{opt.badge}</span>}
                  <span className="opt-icon">{opt.icon}</span>
                  <div className="opt-text">
                    <span className="opt-label">{opt.label}</span>
                    <span className="opt-sub">{opt.sublabel}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* PASO 3: Formato */}
          <div className="calc-step-card brutal-card">
            <div className="step-num-badge">03</div>
            <h2 className="step-title">Selecciona el Formato</h2>
            <div className="options-grid">
              {SIZE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`opt-btn brutal-btn ${size === opt.id ? 'active' : ''}`}
                  onClick={() => setSize(opt.id)}
                >
                  {opt.badge && <span className="opt-badge opt-badge--cyan">{opt.badge}</span>}
                  <span className="opt-icon">{opt.icon}</span>
                  <div className="opt-text">
                    <span className="opt-label">{opt.label}</span>
                    <span className="opt-sub">{opt.sublabel}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel Derecho: Resumen en vivo & Enlaces de Conversión Directa */}
        <div className="summary-panel">
          <div className="brutal-card summary-card sticky-card">
            <div className="summary-top">
              <span className="brutal-tag brutal-tag--green">PRESUPUESTO ESTIMADO</span>
              <div className="price-display">
                <span className="price-range">{minPrice}€ — {maxPrice}€</span>
                <span className="price-note">*Impuestos y certificado incluidos</span>
              </div>
            </div>

            <div className="summary-specs">
              <div className="spec-item">
                <span className="spec-key">Sujeto</span>
                <span className="spec-val">{selectedSubject.icon} {selectedSubject.label}</span>
              </div>
              <div className="spec-item">
                <span className="spec-key">Soporte</span>
                <span className="spec-val">{selectedMedium.icon} {selectedMedium.label}</span>
              </div>
              <div className="spec-item">
                <span className="spec-key">Formato</span>
                <span className="spec-val">{selectedSize.icon} {selectedSize.label}</span>
              </div>
              <div className="spec-item">
                <span className="spec-key">Tiempo estimado</span>
                <span className="spec-val">⏳ 3 a 5 semanas</span>
              </div>
            </div>

            <div className="guarantees-box">
              <div className="g-item">✓ Certificado de Autenticidad Firmado</div>
              <div className="g-item">✓ Embalaje seguro de madera/protección</div>
              <div className="g-item">✓ Seguimiento fotográfico del proceso</div>
            </div>

            <div className="action-buttons">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="brutal-cta-btn brutal-cta-btn--whatsapp"
              >
                💬 SOLICITAR POR WHATSAPP
              </a>
              <a
                href={mailtoUrl}
                className="brutal-cta-btn brutal-cta-btn--email"
              >
                ✉️ SOLICITAR POR EMAIL
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Sección Proceso de Encargo en 4 Fases */}
      <section className="process-section">
        <h2 className="section-brutal-title">
          CÓMO TRABAJAMOS <span className="highlight-pink">JUNTOS</span>
        </h2>
        <div className="process-grid">
          <div className="process-card brutal-card">
            <div className="process-num">01</div>
            <h3>Conversación Inicial</h3>
            <p>Me envías tus fotos de referencia y me cuentas la historia detrás de la persona o mascota a retratar.</p>
          </div>
          <div className="process-card brutal-card">
            <div className="process-num">02</div>
            <h3>Boceto & Selección</h3>
            <p>Definimos la composición, paleta de color y materiales (pizarra, mica, lienzo) antes de dar el primer trazo.</p>
          </div>
          <div className="process-card brutal-card">
            <div className="process-num">03</div>
            <h3>Creación & Avances</h3>
            <p>Pinto la obra. Recibes fotos del avance para que sientas cómo cobra vida paso a paso.</p>
          </div>
          <div className="process-card brutal-card">
            <div className="process-num">04</div>
            <h3>Entrega & Certificado</h3>
            <p>Envío asegurado en caja protectora con su Certificado de Autenticidad oficial firmado por Naroa.</p>
          </div>
        </div>
      </section>

      {/* FAQ Sección */}
      <section className="faq-section">
        <h2 className="section-brutal-title">
          PREGUNTAS <span className="highlight-cyan">FRECUENTES</span>
        </h2>
        <div className="faq-list">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="faq-item brutal-card">
              <button
                className="faq-question-btn"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <span>{faq.q}</span>
                <span className="faq-arrow">{openFaq === idx ? '−' : '+'}</span>
              </button>
              <AnimatePresence>
                {openFaq === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="faq-answer-content"
                  >
                    <p>{faq.a}</p>
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
