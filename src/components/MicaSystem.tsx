import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sound } from '../utils/audio'
import { ARTWORKS, type Artwork } from '../artworks'

export interface MicaSystemProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onOpenCommission: (pieceTitle?: string) => void
  onOpenArtwork: (index: number) => void
  onOpen3D: () => void
  onOpenIndex: () => void
  currentArtwork?: Artwork | null
}

interface ChatAction {
  label: string
  onClick: () => void
  isPrimary?: boolean
}

interface ChatMessage {
  id: string
  sender: 'mica' | 'user'
  fullText: string
  displayedText: string
  isStreaming?: boolean
  artworkCard?: {
    artwork: Artwork
    index: number
  }
  actions?: ChatAction[]
  time: string
}

const QUICK_PROMPTS = [
  '¿Cómo es el proceso para encargar un retrato?',
  '¿Qué es el "kintsugi vital" y la mica mineral?',
  'Tarifas y formatos orientativos',
  '¿Hacéis envíos a toda España?',
  'Obras destacadas de Naroa',
  'Hablar con Naroa por WhatsApp',
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
  currentArtwork,
}: MicaSystemProps) {
  // Saludo inicial enriquecido contextualmente
  const initialGreeting = useMemo<ChatMessage>(() => {
    if (currentArtwork) {
      return {
        id: 'greeting',
        sender: 'mica',
        fullText: `🎭 ¡Hola! Soy MICA. Veo que estás observando «${currentArtwork.title}» (${currentArtwork.year}).\n\nEn esta obra, Naroa combinó ${currentArtwork.medium}. ¿Te gustaría encargar un retrato personalizado con esta misma técnica sobre pizarra, o explorar los destellos minerales en detalle?`,
        displayedText: `🎭 ¡Hola! Soy MICA. Veo que estás observando «${currentArtwork.title}» (${currentArtwork.year}).\n\nEn esta obra, Naroa combinó ${currentArtwork.medium}. ¿Te gustaría encargar un retrato personalizado con esta misma técnica sobre pizarra, o explorar los destellos minerales en detalle?`,
        isStreaming: false,
        artworkCard: {
          artwork: currentArtwork,
          index: ARTWORKS.findIndex((a) => a.id === currentArtwork.id),
        },
        actions: [
          {
            label: `⚡ Encargar similar a ${currentArtwork.title}`,
            onClick: () => onOpenCommission(currentArtwork.title),
            isPrimary: true,
          },
          {
            label: '💎 Técnica de la Mica',
            onClick: () => handleSendPrompt('¿Qué es el "kintsugi vital" y la mica mineral?'),
          },
          {
            label: '🏛 Explorar Museo 3D',
            onClick: onOpen3D,
          },
        ],
        time: 'Ahora',
      }
    }
    return {
      id: 'greeting',
      sender: 'mica',
      fullText:
        '🎭 ¿Y si tu rostro fuera arte? Soy MICA. Naroa pinta retratos que capturan lo invisible. Cuéntame qué imaginas o pregúntame sobre retratos, precios y la técnica de la mica mineral.',
      displayedText:
        '🎭 ¿Y si tu rostro fuera arte? Soy MICA. Naroa pinta retratos que capturan lo invisible. Cuéntame qué imaginas o pregúntame sobre retratos, precios y la técnica de la mica mineral.',
      isStreaming: false,
      actions: [
        {
          label: '⚡ Encargar un Retrato',
          onClick: () => onOpenCommission(),
          isPrimary: true,
        },
        {
          label: '💎 ¿Qué es el kintsugi vital?',
          onClick: () => handleSendPrompt('¿Qué es el "kintsugi vital" y la mica mineral?'),
        },
        {
          label: '🏛 Explorar Museo 3D',
          onClick: onOpen3D,
        },
      ],
      time: 'Ahora',
    }
  }, [currentArtwork?.id])

  const [messages, setMessages] = useState<ChatMessage[]>([initialGreeting])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll suave al pie al recibir o streamear mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 120)
      setTimeout(() => inputRef.current?.focus(), 280)
    }
  }, [isOpen, messages.length, isTyping])

  // Motor de Streaming orgánico carácter por carácter (simulación de flujo cognitivo)
  const streamMessage = (msgId: string, fullText: string) => {
    let currentLen = 0
    const totalLen = fullText.length
    const interval = setInterval(() => {
      currentLen = Math.min(totalLen, currentLen + 3)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                displayedText: fullText.slice(0, currentLen),
                isStreaming: currentLen < totalLen,
              }
            : m
        )
      )
      scrollToBottom()

      if (currentLen >= totalLen) {
        clearInterval(interval)
        setIsTyping(false)
        sound.playHover()
      }
    }, 14)
  }

  // Motor NLP de Generación de Respuesta
  const generateMicaResponse = (
    rawQuery: string
  ): {
    text: string
    actions?: ChatAction[]
    artworkCard?: ChatMessage['artworkCard']
  } => {
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
        text: '🎨 Los retratos de Naroa son "kintsugi vital". Captura tu esencia con acrílico y mica mineral sobre pizarra natural milenaria.\n\nEl proceso es íntimo y colaborativo:\n1. **Envío de Fotos:** Nos envías una o varias fotografías de referencia con buena luz.\n2. **Elección de Soporte:** Naroa selecciona la lámina de pizarra con las fracturas geológicas idóneas.\n3. **Creación:** Pinta a mano capa a capa y aplica incrustaciones de mica mineral pura (4 a 6 semanas).\n4. **Entrega Asegurada:** Se entrega con certificado de autenticidad y embalaje isotérmico.\n\n¿Quieres configurar tu encargo a medida o prefieres escribirle directamente por WhatsApp?',
        actions: [
          {
            label: '⚡ Abrir Atelier de Encargos',
            onClick: () => onOpenCommission(),
            isPrimary: true,
          },
          {
            label: 'WhatsApp Directo con Naroa ↗',
            onClick: () => {
              window.open(
                'https://wa.me/34636060609?text=' +
                  encodeURIComponent(
                    'Hola Naroa! MICA me ha explicado el proceso de retratos en pizarra y quisiera consultar un encargo a partir de fotografía.'
                  ),
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
        text: '💎 Cada pieza es única, irrepetible y esculpida sobre soporte geológico. Como orientación:\n\n• **Formato Íntimo (30×40 cm):** desde ~350€\n• **Formato Presencia (50×70 cm):** desde ~650€\n• **Formato Monumental (100×80 cm):** desde ~1.200€\n\nTodos los encargos incluyen tratamiento de sellado de la pizarra, incrustaciones de mica mineral con reflejo especular, herrajes de sujeción reforzados y certificado de autenticidad.',
        actions: [
          {
            label: '⚡ Simular Presupuesto en Atelier',
            onClick: () => onOpenCommission(),
            isPrimary: true,
          },
          {
            label: 'Presupuesto Rápido por WhatsApp ↗',
            onClick: () => {
              window.open(
                'https://wa.me/34636060609?text=' +
                  encodeURIComponent('Hola Naroa, quisiera solicitar presupuesto exacto para un encargo personalizado.'),
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
      const sampleArt = ARTWORKS.find((a) => a.slug === 'amy-rocks') || ARTWORKS[1]
      const sampleIdx = ARTWORKS.indexOf(sampleArt)
      return {
        text: '🪨 La técnica de Naroa es pura alquimia geológica: rescata losas de pizarra natural con millones de años de historia fósil y pinta directamente sobre sus fracturas con acrílicos de alta pigmentación. Al final, incrusta mica mineral en capas estratégicas — es ese destello dinámico en los ojos que parece respirar y cambiar de matiz según la incidencia de la luz ambiental.',
        artworkCard: {
          artwork: sampleArt,
          index: sampleIdx,
        },
        actions: [
          {
            label: '🔍 Inspeccionar «Amy Rocks» en Taller',
            onClick: () => onOpenArtwork(sampleIdx),
            isPrimary: true,
          },
          {
            label: '🏛 Pasear en Museo 3D',
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
        text: '📦 El estudio físico de Naroa está ubicado en Bilbao (País Vasco). Realizamos envíos de obras aseguradas a toda España (Península, Baleares, Canarias) y a nivel internacional en cajas de madera/impacto isotérmicas para garantizar su perfecta integridad geológica.',
        actions: [
          {
            label: '⚡ Encargar con Envío Seguro',
            onClick: () => onOpenCommission(),
            isPrimary: true,
          },
        ],
      }
    }

    // Intención: Búsqueda de obra específica
    const foundArtwork = ARTWORKS.find(
      (a) =>
        normalizeText(a.title).includes(q) ||
        (q.includes('amy') && a.slug === 'amy-rocks') ||
        (q.includes('marilyn') && a.slug.includes('marilyn')) ||
        (q.includes('johnny') && a.slug.includes('johnny')) ||
        (q.includes('celia') && a.slug.includes('celia')) ||
        (q.includes('cantinflas') && a.slug.includes('cantinflas')) ||
        (q.includes('audrey') && a.slug.includes('audrey')) ||
        (q.includes('james') && a.slug.includes('james')) ||
        (q.includes('dakari') && a.slug.includes('dakari'))
    )

    if (foundArtwork) {
      const idx = ARTWORKS.indexOf(foundArtwork)
      return {
        text: `✨ «${foundArtwork.title}» (${foundArtwork.year}) es una de las piezas más emblemáticas del catálogo: realizada en ${foundArtwork.medium}.\n\n${foundArtwork.description}`,
        artworkCard: {
          artwork: foundArtwork,
          index: idx,
        },
        actions: [
          {
            label: `🔍 Inspeccionar "${foundArtwork.title}" a 2.5x`,
            onClick: () => onOpenArtwork(idx),
            isPrimary: true,
          },
          {
            label: `⚡ Encargar pieza similar`,
            onClick: () => onOpenCommission(foundArtwork.title),
          },
          {
            label: 'Consultar por WhatsApp ↗',
            onClick: () => {
              window.open(
                `https://wa.me/34636060609?text=${encodeURIComponent(
                  `Hola Naroa! MICA me ha mostrado la obra "${foundArtwork.title}" y deseo consultar disponibilidad o encargar una pieza de este estilo.`
                )}`,
                '_blank'
              )
            },
          },
        ],
      }
    }

    // Intención: Galería / Catálogo
    if (q.includes('galeria') || q.includes('obra') || q.includes('catalogo') || q.includes('coleccion')) {
      return {
        text: `🖼 La colección actual alberga ${ARTWORKS.length} obras canónicas en catálogo: series "Rocks" (iconos con mica mineral), "DiviNos" (arquetipos pop en gran escala), "Vaivenes" y piezas de autor sobre pizarra natural. ¿Te gustaría recorrer el índice visual o sumergirte en la rotonda 3D?`,
        actions: [
          {
            label: `📚 Abrir Índice Visual (${ARTWORKS.length} Obras)`,
            onClick: onOpenIndex,
            isPrimary: true,
          },
          {
            label: '🏛 Entrar a la Rotonda 3D',
            onClick: onOpen3D,
          },
        ],
      }
    }

    // Intención: Artista / Exposiciones / Redes
    if (q.includes('exposici') || q.includes('quien es') || q.includes('trayectoria') || q.includes('naroa') || q.includes('facebook')) {
      return {
        text: '👑 Naroa Gutiérrez Gil es artista plástica bilbaína con más de 15 años de trayectoria. Pionera en el uso de pizarra fósil y mica mineral reflectante, ha protagonizado muestras como "DiviNos VaiVenes" en Politena Espacio de Arte (Bilbao), "Vaivenes" en Copper Deli y Bwall Collective.',
        actions: [
          {
            label: 'Facebook Oficial (@naroa.artista.plastica) ↗',
            onClick: () => {
              window.open('https://www.facebook.com/naroa.artista.plastica', '_blank')
            },
            isPrimary: true,
          },
          {
            label: 'Instagram (@naroa_art) ↗',
            onClick: () => {
              window.open('https://www.instagram.com/naroa_art/', '_blank')
            },
          },
          {
            label: '⚡ Encargar una Obra Bespoke',
            onClick: () => onOpenCommission(),
          },
        ],
      }
    }

    // Intención: Saludos
    if (q.includes('hola') || q.includes('kaixo') || q.includes('buenas') || q.includes('que tal')) {
      return {
        text: '¡Kaixo! Me alegra saludarte. Soy MICA, la curadora mineral de este espacio. Pregúntame sobre cómo encargar un retrato, las tarifas, o cualquier obra que desees contemplar.',
        actions: [
          {
            label: '🎨 ¿Cómo encargar un retrato?',
            onClick: () => handleSendPrompt('¿Cómo es el proceso para encargar un retrato?'),
          },
          {
            label: '💶 Tarifas y formatos',
            onClick: () => handleSendPrompt('Tarifas y formatos orientativos'),
          },
        ],
      }
    }

    if (q.includes('gracias') || q.includes('eskerrik') || q.includes('agur') || q.includes('adios')) {
      return {
        text: '¡Un placer mineral! Eskerrik asko a ti por dedicar tiempo a contemplar este arte. Si te surge cualquier idea para inmortalizar un rostro en piedra y luz, aquí estaré. ✨',
      }
    }

    // Fallback inteligente
    return {
      text: '💎 Mis cristales de mica sintonizan con tu consulta. Puedo orientarte en detalle sobre retratos por encargo, simular un presupuesto en el atelier, o abrir la lupa de alta resolución sobre cualquier cuadro.',
      actions: [
        {
          label: '⚡ Atelier de Encargos',
          onClick: () => onOpenCommission(),
          isPrimary: true,
        },
        {
          label: 'WhatsApp con Naroa ↗',
          onClick: () => {
            window.open(
              'https://wa.me/34636060609?text=' +
                encodeURIComponent('Hola Naroa, tengo una consulta sobre tus retratos y obras en pizarra.'),
              '_blank'
            )
          },
        },
      ],
    }
  }

  const handleSendPrompt = (promptText: string) => {
    sound.playTick()
    const userMsgId = String(Date.now())
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      fullText: promptText,
      displayedText: promptText,
      time: 'Ahora',
    }
    setMessages((prev) => [...prev, userMsg])
    setIsTyping(true)

    setTimeout(() => {
      const response = generateMicaResponse(promptText)
      const micaMsgId = String(Date.now() + 1)
      const micaMsg: ChatMessage = {
        id: micaMsgId,
        sender: 'mica',
        fullText: response.text,
        displayedText: '',
        isStreaming: true,
        artworkCard: response.artworkCard,
        actions: response.actions,
        time: 'Ahora',
      }
      setMessages((prev) => [...prev, micaMsg])
      streamMessage(micaMsgId, response.text)
    }, 380)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return
    const text = inputValue.trim()
    setInputValue('')
    handleSendPrompt(text)
  }

  // Renderizador de texto enriquecido con soporte de negrita y enlaces interactivos
  const renderFormattedText = (text: string) => {
    const parts = text.split('\n')
    return parts.map((paragraph, pIdx) => {
      // Reemplazar **negrita**
      const boldSegments = paragraph.split(/(\*\*.*?\*\*)/g)
      return (
        <span key={pIdx} style={{ display: 'block', minHeight: paragraph ? undefined : '0.6em' }}>
          {boldSegments.map((segment, sIdx) => {
            if (segment.startsWith('**') && segment.endsWith('**')) {
              return (
                <strong key={sIdx} style={{ color: '#D4AF37', fontWeight: 700 }}>
                  {segment.slice(2, -2)}
                </strong>
              )
            }
            return <span key={sIdx}>{segment}</span>
          })}
        </span>
      )
    })
  }

  return (
    <>
      {/* TRIGGER ORB FLOTANTE EN ESQUINA INFERIOR DERECHA (ALTA COSTURA) */}
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
          width: '54px',
          height: '54px',
          borderRadius: '18px',
          background: isOpen
            ? '#D4AF37'
            : 'radial-gradient(circle at 30% 30%, rgba(212, 175, 55, 0.4), rgba(5, 5, 8, 0.96))',
          border: '1px solid ' + (isOpen ? '#FFFFFF' : 'rgba(212, 175, 55, 0.55)'),
          color: isOpen ? '#000000' : '#D4AF37',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isOpen
            ? '0 0 32px rgba(212, 175, 55, 0.65), 0 10px 30px rgba(0,0,0,0.8)'
            : '0 8px 32px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 175, 55, 0.25)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
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

      {/* PANEL FLOTANTE DE ALTA COSTURA (MICA SYSTEM v∞) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 35, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.94 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              bottom: '90px',
              right: 'clamp(14px, 2.8vw, 36px)',
              zIndex: 165,
              width: 'clamp(320px, 92vw, 420px)',
              maxHeight: 'min(640px, 80vh)',
              background: 'rgba(8, 8, 12, 0.95)',
              border: '1px solid rgba(212, 175, 55, 0.38)',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow:
                '0 25px 65px rgba(0, 0, 0, 0.96), 0 0 45px rgba(212, 175, 55, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(36px)',
              WebkitBackdropFilter: 'blur(36px)',
              overflow: 'hidden',
            }}
          >
            {/* CABECERA MICA SYSTEM v∞ */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(212, 175, 55, 0.22)',
                background: 'linear-gradient(180deg, rgba(212, 175, 55, 0.1) 0%, rgba(0,0,0,0) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'rgba(212, 175, 55, 0.18)',
                    border: '1px solid rgba(212, 175, 55, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    boxShadow: '0 0 18px rgba(212, 175, 55, 0.28)',
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
                        fontSize: '0.9rem',
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
                        fontSize: '0.68rem',
                        color: 'rgba(255, 255, 255, 0.6)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      En línea · Curadora del Estudio
                    </span>
                  </div>
                </div>
              </div>

              {/* Botón Cerrar */}
              <button
                onClick={() => {
                  sound.playTick()
                  onClose()
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontSize: '1.15rem',
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
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.55)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                ✕
              </button>
            </div>

            {/* CONTENEDOR DE MENSAJES */}
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
                      maxWidth: '90%',
                      padding: '12px 16px',
                      borderRadius: m.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background:
                        m.sender === 'user'
                          ? 'linear-gradient(135deg, #D4AF37 0%, #B89628 100%)'
                          : 'rgba(25, 25, 34, 0.88)',
                      border:
                        m.sender === 'user'
                          ? '1px solid rgba(255, 255, 255, 0.25)'
                          : '1px solid rgba(212, 175, 55, 0.22)',
                      color: m.sender === 'user' ? '#000000' : '#EDEDED',
                      fontFamily: 'var(--font-sans, sans-serif)',
                      fontSize: '0.86rem',
                      lineHeight: 1.55,
                      boxShadow:
                        m.sender === 'user'
                          ? '0 4px 16px rgba(212, 175, 55, 0.3)'
                          : '0 4px 16px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {renderFormattedText(m.displayedText || m.fullText)}

                    {/* Caret animado durante el streaming */}
                    {m.isStreaming && (
                      <span
                        style={{
                          color: '#D4AF37',
                          fontWeight: 900,
                          marginLeft: '2px',
                          display: 'inline-block',
                        }}
                      >
                        ▍
                      </span>
                    )}

                    {/* TARJETA INTERACTIVA DE OBRA RELACIONADA (RICH CARD) */}
                    {m.artworkCard && !m.isStreaming && (
                      <div
                        style={{
                          marginTop: '12px',
                          background: 'rgba(10, 10, 15, 0.8)',
                          border: '1px solid rgba(212, 175, 55, 0.35)',
                          borderRadius: '14px',
                          padding: '10px',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center',
                        }}
                      >
                        <img
                          src={m.artworkCard.artwork.url}
                          alt={m.artworkCard.artwork.title}
                          style={{
                            width: '54px',
                            height: '54px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid rgba(212, 175, 55, 0.3)',
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4
                            style={{
                              margin: '0 0 2px 0',
                              fontFamily: 'var(--font-serif, "Cinzel", serif)',
                              fontSize: '0.85rem',
                              color: '#FFFFFF',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {m.artworkCard.artwork.title}
                          </h4>
                          <p
                            style={{
                              margin: 0,
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: '0.68rem',
                              color: '#D4AF37',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {m.artworkCard.artwork.year} · Pizarra & Mica
                          </p>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                            <button
                              onClick={() => {
                                sound.playTick()
                                onOpenArtwork(m.artworkCard!.index)
                              }}
                              style={{
                                background: 'rgba(212, 175, 55, 0.15)',
                                border: '1px solid rgba(212, 175, 55, 0.4)',
                                color: '#D4AF37',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '0.66rem',
                                fontFamily: 'var(--font-mono, monospace)',
                                cursor: 'pointer',
                              }}
                            >
                              🔍 Lupa 2.5x
                            </button>
                            <button
                              onClick={() => {
                                sound.playTick()
                                onOpenCommission(m.artworkCard!.artwork.title)
                              }}
                              style={{
                                background: '#D4AF37',
                                border: 'none',
                                color: '#000000',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '0.66rem',
                                fontFamily: 'var(--font-mono, monospace)',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              ⚡ Encargar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BOTONES DE ACCIÓN INTEGRADOS */}
                    {m.actions && m.actions.length > 0 && !m.isStreaming && (
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
                              border: act.isPrimary ? '1px solid #FFFFFF' : '1px solid rgba(212, 175, 55, 0.35)',
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
                                e.currentTarget.style.background = 'rgba(212, 175, 55, 0.16)'
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
                    color: 'rgba(255, 255, 255, 0.78)',
                    fontFamily: 'var(--font-sans, sans-serif)',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#D4AF37'
                    e.currentTarget.style.background = 'rgba(212, 175, 55, 0.14)'
                    e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.78)'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                    e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.25)'
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* FORMULARIO DE ENTRADA CON PASARELA WHATSAPP Y BOTÓN ➤ */}
            <form
              onSubmit={handleFormSubmit}
              style={{
                padding: '12px 16px 16px',
                background: 'rgba(5, 5, 8, 0.8)',
                borderTop: '1px solid rgba(212, 175, 55, 0.16)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              {/* Botón WhatsApp Directo en barra de chat */}
              <button
                type="button"
                onClick={() => {
                  sound.playTick()
                  window.open(
                    'https://wa.me/34636060609?text=' +
                      encodeURIComponent(
                        inputValue.trim()
                          ? `Hola Naroa! Te escribo desde el chat de tu web: "${inputValue.trim()}"`
                          : 'Hola Naroa! Estoy en tu web oficial y deseo consultar información sobre tus retratos por encargo.'
                      ),
                    '_blank'
                  )
                }}
                title="Hablar directamente con Naroa en WhatsApp"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'rgba(37, 211, 102, 0.12)',
                  border: '1px solid rgba(37, 211, 102, 0.4)',
                  color: '#25D366',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(37, 211, 102, 0.25)'
                  e.currentTarget.style.borderColor = '#25D366'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(37, 211, 102, 0.12)'
                  e.currentTarget.style.borderColor = 'rgba(37, 211, 102, 0.4)'
                }}
              >
                💬
              </button>

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
                  fontSize: '0.84rem',
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
                  flexShrink: 0,
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
