import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sound } from '../utils/audio'
import { ARTWORKS } from '../artworks'

export interface MicaSystemProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onOpenCommission: () => void
  onOpenArtwork: (index: number) => void
  onOpen3D: () => void
  onOpenIndex: () => void
}

interface ChatMessage {
  id: string
  sender: 'mica' | 'user'
  text: string
  actions?: Array<{
    label: string
    onClick: () => void
    isPrimary?: boolean
  }>
  time: string
}

const QUICK_PROMPTS = [
  '¿Cómo es el proceso para encargar un retrato?',
  '¿Qué es el "kintsugi vital" y la mica mineral?',
  'Tarifas y formatos orientativos',
  '¿Hacéis envíos a toda España?',
  'Contactar con Naroa por WhatsApp',
]

const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

export function MicaSystem({
  isOpen,
  onToggle,
  onClose,
  onOpenCommission,
  onOpenArtwork,
  onOpen3D,
  onOpenIndex,
}: MicaSystemProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'greeting',
      sender: 'mica',
      text: '🎭 ¿Y si tu rostro fuera arte? Soy MICA. Naroa pinta retratos que capturan lo invisible. Cuéntame qué imaginas.',
      actions: [
        {
          label: '⚡ Encargar un Retrato',
          onClick: onOpenCommission,
          isPrimary: true,
        },
        {
          label: '🏛 Explorar Museo 3D',
          onClick: onOpen3D,
        },
      ],
      time: 'Ahora',
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 150)
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen, messages, isTyping])

  const generateMicaResponse = (rawQuery: string): { text: string; actions?: ChatMessage['actions'] } => {
    const q = normalizeText(rawQuery)

    // Intención: Proceso de encargo / encargar / fotos
    if (
      q.includes('encarg') ||
      q.includes('proceso') ||
      q.includes('foto') ||
      q.includes('como funciona') ||
      q.includes('pedido') ||
      q.includes('pintar')
    ) {
      return {
        text: '🎨 Los retratos de Naroa son "kintsugi vital". Captura tu esencia con acrílico y mica mineral sobre pizarra natural. El proceso es muy personal:\n\n1. Envías una o varias fotos con buena iluminación.\n2. Naroa selecciona la piedra fósil y plantea el encuadre.\n3. Pinta la obra a mano con relieve y reflejos de luz (4 a 6 semanas).\n4. Entrega con certificado de autenticidad numerado.\n\n¿Quieres configurar tu idea en el atelier o escribirle directamente por WhatsApp?',
        actions: [
          {
            label: '⚡ Abrir Atelier de Encargos',
            onClick: onOpenCommission,
            isPrimary: true,
          },
          {
            label: 'WhatsApp con Naroa ↗',
            onClick: () => {
              window.open(
                'https://wa.me/34636060609?text=' +
                  encodeURIComponent('Hola Naroa, me gustaría consultar un retrato personalizado a partir de fotografía.'),
                '_blank'
              )
            },
          },
        ],
      }
    }

    // Intención: Precios / tarifas / cuánto cuesta
    if (
      q.includes('precio') ||
      q.includes('cuanto') ||
      q.includes('cuesta') ||
      q.includes('tarifa') ||
      q.includes('presupuesto') ||
      q.includes('valen')
    ) {
      return {
        text: '💎 Cada pieza es única y esculpida sobre soporte geológico. Como orientación:\n\n• Formato Íntimo (20×30 cm): desde ~350€\n• Formato Singular (40×50 cm): desde ~650€\n• Gran Formato & Colección: desde ~1.200€\n\nTodos incluyen pizarra natural milenaria sellada, destellos minerales de mica, soporte expositor y certificado de autenticidad.',
        actions: [
          {
            label: '⚡ Simular Presupuesto en Atelier',
            onClick: onOpenCommission,
            isPrimary: true,
          },
          {
            label: 'Consultar Presupuesto Exacto ↗',
            onClick: () => {
              window.open(
                'https://wa.me/34636060609?text=' +
                  encodeURIComponent('Hola Naroa, quisiera solicitar presupuesto para un encargo personalizado.'),
                '_blank'
              )
            },
          },
        ],
      }
    }

    // Intención: Técnica / Pizarra / Mica mineral / Kintsugi
    if (
      q.includes('tecnica') ||
      q.includes('mica') ||
      q.includes('pizarra') ||
      q.includes('kintsugi') ||
      q.includes('material') ||
      q.includes('mineral') ||
      q.includes('piedra')
    ) {
      return {
        text: '🪨 La técnica de Naroa es alquimia geológica pura: rescata pizarra natural con millones de años de historia fósil y pinta sobre sus fracturas con acrílicos de alta pigmentación. Al final, incrusta mica mineral en capas estratégicas — es ese destello dinámico en los ojos que parece respirar y cobrar vida según caminas frente al cuadro.',
        actions: [
          {
            label: '🔍 Inspeccionar Obras en Taller',
            onClick: () => {
              onOpenArtwork(0)
            },
            isPrimary: true,
          },
          {
            label: '🏛 Ver en Sala 3D',
            onClick: onOpen3D,
          },
        ],
      }
    }

    // Intención: Envíos / Bilbao / España / Dónde está
    if (
      q.includes('envio') ||
      q.includes('espana') ||
      q.includes('bilbao') ||
      q.includes('donde') ||
      q.includes('taller') ||
      q.includes('estudio') ||
      q.includes('llegar')
    ) {
      return {
        text: '📦 El estudio físico de Naroa se encuentra en Bilbao (País Vasco). Realizamos envíos de obras aseguradas a toda España (Península, Baleares, Canarias) y a nivel internacional en cajas de madera/impacto isotérmicas para garantizar su perfecta integridad geológica.',
        actions: [
          {
            label: '⚡ Encargar con Envío Seguro',
            onClick: onOpenCommission,
            isPrimary: true,
          },
        ],
      }
    }

    // Intención: Obras específicas / Galería / Catálogo
    const foundArtwork = ARTWORKS.find(
      (a) =>
        normalizeText(a.title).includes(q) ||
        (q.includes('amy') && a.slug === 'amy-rocks') ||
        (q.includes('marilyn') && a.slug === 'divinos-marilyn') ||
        (q.includes('johnny') && a.slug === 'johnny-depp') ||
        (q.includes('celia') && a.slug === 'celia-cruz') ||
        (q.includes('cantinflas') && a.slug.includes('cantinflas')) ||
        (q.includes('audrey') && a.slug.includes('audrey'))
    )

    if (foundArtwork) {
      const idx = ARTWORKS.indexOf(foundArtwork)
      return {
        text: `✨ «${foundArtwork.title}» (${foundArtwork.year}) es una de las piezas más emblemáticas: realizada en ${foundArtwork.medium}. ${foundArtwork.description}`,
        actions: [
          {
            label: `🔍 Ver "${foundArtwork.title}" a Fondo`,
            onClick: () => onOpenArtwork(idx),
            isPrimary: true,
          },
          {
            label: 'Consultar Disponibilidad ↗',
            onClick: () => {
              window.open(
                `https://wa.me/34636060609?text=${encodeURIComponent(
                  `Hola Naroa! Estoy preguntando a MICA por la obra "${foundArtwork.title}" y deseo consultar su disponibilidad o encargo similar.`
                )}`,
                '_blank'
              )
            },
          },
        ],
      }
    }

    if (q.includes('galeria') || q.includes('obra') || q.includes('catalogo') || q.includes('coleccion')) {
      return {
        text: '🖼 La colección alberga más de 27 piezas catalogadas sobre pizarra, divididas en series míticas: "Rocks", "DiviNos", "Iconos Pop" y ensamblajes en relieve. ¿Te gustaría ver el índice completo o explorarlas en el horizonte?',
        actions: [
          {
            label: '📚 Abrir Índice Visual',
            onClick: onOpenIndex,
            isPrimary: true,
          },
          {
            label: '🏛 Pasear en Museo 3D',
            onClick: onOpen3D,
          },
        ],
      }
    }

    // Intención: Exposiciones / Quién es Naroa
    if (q.includes('exposici') || q.includes('quien es') || q.includes('trayectoria') || q.includes('naroa')) {
      return {
        text: '👑 Naroa Gutiérrez Gil es artista plástica bilbaína pionera en fusionar el lenguaje pop con la nobleza de la pizarra milenaria y la mica viva. Ha expuesto en muestras como "DiviNos VaiVenes" en Politena (Sopela) e intervenciones con Walking Gallery Bilbao.',
        actions: [
          {
            label: 'Conocer más de la Artista ↗',
            onClick: () => {
              window.open('https://www.instagram.com/naroa_art/', '_blank')
            },
          },
        ],
      }
    }

    // Intención: Saludos / agradecimientos
    if (q.includes('hola') || q.includes('kaixo') || q.includes('buenas') || q.includes('que tal')) {
      return {
        text: '¡Kaixo! Me alegra que estés aquí. Pregúntame sobre retratos por encargo, la técnica de la mica o cualquier obra de la sala.',
        actions: [
          {
            label: '🎨 ¿Cómo encargar un retrato?',
            onClick: () => handleSendPrompt('¿Cómo es el proceso para encargar un retrato?'),
          },
          {
            label: '💎 ¿Qué es la mica mineral?',
            onClick: () => handleSendPrompt('¿Qué es el "kintsugi vital" y la mica mineral?'),
          },
        ],
      }
    }

    if (q.includes('gracias') || q.includes('eskerrik') || q.includes('agur') || q.includes('adios')) {
      return {
        text: '¡Un placer mineral! Eskerrik asko a ti por contemplar este arte. Si te surge cualquier idea para inmortalizar un rostro, aquí seguiré vibrando. ✨',
      }
    }

    // Respuesta inteligente fallback
    return {
      text: '💎 Mis cristales de mica sintonizan con tu pregunta. Te puedo orientar en detalle sobre retratos por encargo, precios y tamaños, o abrir la lupa de alta resolución sobre cualquier cuadro.',
      actions: [
        {
          label: '⚡ Atelier de Encargos',
          onClick: onOpenCommission,
          isPrimary: true,
        },
        {
          label: 'WhatsApp Directo ↗',
          onClick: () => {
            window.open(
              'https://wa.me/34636060609?text=' +
                encodeURIComponent('Hola Naroa, tengo una consulta sobre tus obras y encargos.'),
              '_blank'
            )
          },
        },
      ],
    }
  }

  const handleSendPrompt = (promptText: string) => {
    sound.playTick()
    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: promptText,
      time: 'Ahora',
    }
    setMessages((prev) => [...prev, userMsg])
    setIsTyping(true)

    setTimeout(() => {
      sound.playHover()
      const response = generateMicaResponse(promptText)
      const micaMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'mica',
        text: response.text,
        actions: response.actions,
        time: 'Ahora',
      }
      setMessages((prev) => [...prev, micaMsg])
      setIsTyping(false)
    }, 450)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    const text = inputValue.trim()
    setInputValue('')
    handleSendPrompt(text)
  }

  return (
    <>
      {/* TRIGGER ORB FLOTANTE EN ESQUINA INFERIOR DERECHA (FIEL AL SCREENSHOT) */}
      <motion.button
        onClick={() => {
          sound.playTick()
          onToggle()
        }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label="Abrir asistente MICA"
        title="MICA SYSTEM v∞ · Curadora del Estudio"
        style={{
          position: 'fixed',
          bottom: '26px',
          right: 'clamp(16px, 3vw, 36px)',
          zIndex: 160,
          width: '52px',
          height: '52px',
          borderRadius: '16px',
          background: isOpen
            ? '#D4AF37'
            : 'radial-gradient(circle at 30% 30%, rgba(212, 175, 55, 0.4), rgba(5, 5, 8, 0.95))',
          border: '1px solid ' + (isOpen ? '#FFFFFF' : 'rgba(212, 175, 55, 0.55)'),
          color: isOpen ? '#000000' : '#D4AF37',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isOpen
            ? '0 0 30px rgba(212, 175, 55, 0.6), 0 10px 30px rgba(0,0,0,0.8)'
            : '0 8px 32px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 175, 55, 0.25)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          transition: 'background 0.3s ease, border-color 0.3s ease, color 0.3s ease',
        }}
      >
        <span style={{ fontSize: isOpen ? '1.2rem' : '1.35rem', lineHeight: 1 }}>{isOpen ? '✕' : '💎'}</span>
        {!isOpen && (
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.55rem',
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: '#D4AF37',
              marginTop: '2px',
            }}
          >
            MICA
          </span>
        )}
      </motion.button>

      {/* PANEL MODAL FLOTANTE DE ALTA COSTURA (MICA SYSTEM v∞) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.94 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              bottom: '90px',
              right: 'clamp(16px, 3vw, 36px)',
              zIndex: 165,
              width: 'clamp(320px, 92vw, 410px)',
              maxHeight: 'min(620px, 78vh)',
              background: 'rgba(9, 9, 13, 0.94)',
              border: '1px solid rgba(212, 175, 55, 0.35)',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow:
                '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 45px rgba(212, 175, 55, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              overflow: 'hidden',
            }}
          >
            {/* CABECERA (EXACTA AL SCREENSHOT: MICA SYSTEM v∞ + En línea) */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
                background: 'linear-gradient(180deg, rgba(212, 175, 55, 0.08) 0%, rgba(0,0,0,0) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '12px',
                    background: 'rgba(212, 175, 55, 0.15)',
                    border: '1px solid rgba(212, 175, 55, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    boxShadow: '0 0 15px rgba(212, 175, 55, 0.25)',
                  }}
                >
                  💎
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: '#D4AF37',
                        letterSpacing: '0.08em',
                      }}
                    >
                      MICA SYSTEM v∞
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#10B981',
                        boxShadow: '0 0 8px #10B981',
                        display: 'inline-block',
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '0.66rem',
                        color: 'rgba(255, 255, 255, 0.55)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      En línea · Curadora del Estudio
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  sound.playTick()
                  onClose()
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  padding: '6px',
                  lineHeight: 1,
                  borderRadius: '50%',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#FFFFFF'
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                ✕
              </button>
            </div>

            {/* CONTENEDOR DE MENSAJES CON SCROLL */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '100%',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '88%',
                      padding: '12px 16px',
                      borderRadius: m.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background:
                        m.sender === 'user'
                          ? 'linear-gradient(135deg, #D4AF37 0%, #B89628 100%)'
                          : 'rgba(25, 25, 34, 0.85)',
                      border:
                        m.sender === 'user'
                          ? '1px solid rgba(255, 255, 255, 0.2)'
                          : '1px solid rgba(212, 175, 55, 0.2)',
                      color: m.sender === 'user' ? '#000000' : '#EDEDED',
                      fontFamily: m.sender === 'user' ? 'var(--font-sans, sans-serif)' : 'var(--font-sans, sans-serif)',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-line',
                      boxShadow:
                        m.sender === 'user'
                          ? '0 4px 16px rgba(212, 175, 55, 0.3)'
                          : '0 4px 16px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {m.text}

                    {/* Botones de acción integrados en la respuesta */}
                    {m.actions && m.actions.length > 0 && (
                      <div
                        style={{
                          marginTop: '12px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        {m.actions.map((act, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              sound.playTick()
                              act.onClick()
                            }}
                            style={{
                              background: act.isPrimary ? '#D4AF37' : 'rgba(255, 255, 255, 0.08)',
                              border: act.isPrimary
                                ? '1px solid #FFFFFF'
                                : '1px solid rgba(212, 175, 55, 0.35)',
                              color: act.isPrimary ? '#000000' : '#D4AF37',
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!act.isPrimary) {
                                e.currentTarget.style.background = 'rgba(212, 175, 55, 0.15)'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!act.isPrimary) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                              }
                            }}
                          >
                            {act.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Indicador de escritura animado */}
              {isTyping && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '0.72rem',
                      color: '#D4AF37',
                      letterSpacing: '0.08em',
                    }}
                  >
                    MICA sintonizando mica mineral...
                  </span>
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    style={{ color: '#D4AF37' }}
                  >
                    ●
                  </motion.span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* CHIPS DE PREGUNTAS RÁPIDAS (HORIZONTAL SCROLL) */}
            <div
              className="hide-scrollbar"
              style={{
                padding: '6px 16px 10px',
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendPrompt(prompt)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(212, 175, 55, 0.25)',
                    borderRadius: '16px',
                    padding: '5px 12px',
                    color: 'rgba(255, 255, 255, 0.75)',
                    fontFamily: 'var(--font-sans, sans-serif)',
                    fontSize: '0.73rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#D4AF37'
                    e.currentTarget.style.background = 'rgba(212, 175, 55, 0.12)'
                    e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                    e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.25)'
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* FORMULARIO DE ENTRADA CON BOTÓN DORADO ➤ */}
            <form
              onSubmit={handleFormSubmit}
              style={{
                padding: '12px 16px 16px',
                background: 'rgba(5, 5, 8, 0.75)',
                borderTop: '1px solid rgba(212, 175, 55, 0.15)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Pregúntame sobre retratos, precios o la mica..."
                style={{
                  flex: 1,
                  background: 'rgba(20, 20, 28, 0.95)',
                  border: '1px solid rgba(212, 175, 55, 0.25)',
                  borderRadius: '14px',
                  padding: '10px 14px',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-sans, sans-serif)',
                  fontSize: '0.82rem',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#D4AF37'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.25)'
                }}
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: inputValue.trim() ? '#D4AF37' : 'rgba(212, 175, 55, 0.2)',
                  border: 'none',
                  color: inputValue.trim() ? '#000000' : 'rgba(255, 255, 255, 0.3)',
                  cursor: inputValue.trim() ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  boxShadow: inputValue.trim() ? '0 0 14px rgba(212, 175, 55, 0.4)' : 'none',
                }}
              >
                ➤
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
