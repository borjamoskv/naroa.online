import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ARTWORKS } from '../artworks'
import { sound } from '../utils/audio'

interface GameDef {
  id: string
  title: string
  category: string
  icon: string
  desc: string
  badge?: string
  playable?: boolean
}

const ALL_GAMES: GameDef[] = [
  { id: 'scratch', title: 'Revelador de Mica', category: 'INTERACTIVO', icon: '✨', desc: 'Rasca la pizarra para liberar los destellos de mica mineral.', badge: 'JUGABLE AHORA', playable: true },
  { id: 'kintsugi', title: 'Kintsugi Emocional', category: 'ALQUIMIA', icon: '🥇', desc: 'Repara grietas sobre la pizarra aplicando hilos de pan de oro.', badge: 'JUGABLE AHORA', playable: true },
  { id: 'puzzle', title: 'Puzzle Deslizante', category: 'PUZZLE', icon: '🧩', desc: 'Reconstruye el retrato dividiéndolo en piezas móviles.', badge: 'JUGABLE AHORA', playable: true },
  { id: 'memory', title: 'Memory Artístico', category: 'LÓGICA', icon: '🧠', desc: 'Encuentra las parejas de lienzos e iconos de Naroa.', badge: 'JUGABLE AHORA', playable: true },
  { id: 'quiz', title: 'Quiz Hiperrealista', category: 'TRIVIA', icon: '⚡', desc: 'Demuestra cuánto sabes sobre las obras y materiales de Naroa.', badge: 'JUGABLE AHORA', playable: true },
  { id: 'tetris', title: 'Tetris de Lienzos', category: 'ARCADE', icon: '🕹️', desc: 'Encaja los bloques formados por texturas de acrílico.', badge: 'SALA ARCADE' },
  { id: 'snake', title: 'Snake del Arte', category: 'CLÁSICO', icon: '🐍', desc: 'Guía la serpiente para recoger pigmentos y mica mineral.', badge: 'JUGABLE AHORA', playable: true },
  { id: 'breakout', title: 'Breakout Pizarra', category: 'ARCADE', icon: '🧱', desc: 'Rompe los bloques de piedra con la bola de cristal.', badge: 'JUGABLE AHORA', playable: true },
  { id: 'color_match', title: 'Color Match Pop', category: 'VELOCIDAD', icon: '🌈', desc: 'Identifica la paleta exacta usada en cada retrato.', badge: 'JUGABLE AHORA', playable: true },
  { id: 'sound_matrix', title: 'Matriz Sonora Soul', category: 'AUDIO', icon: '🎵', desc: 'Toca las notas que acompañan a la serie Tributos Musicales.', badge: 'SALA ARCADE' },
  { id: 'spot_difference', title: 'Siete Diferencias', category: 'OBSERVACIÓN', icon: '🔍', desc: 'Compara dos versiones del retrato de Amy Winehouse.', badge: 'SALA ARCADE' },
  { id: 'brush_frenzy', title: 'Pincelada Rápida', category: 'REFLEJOS', icon: '🖌️', desc: 'Aplica capas de barniz antes de que venza el temporizador.', badge: 'SALA ARCADE' },
  { id: 'gold_rush', title: 'Fiebre de Pan de Oro', category: 'HABILIDAD', icon: '🏆', desc: 'Atrapa las láminas de oro cayendo en el estudio de Bilbao.', badge: 'SALA ARCADE' },
  { id: 'mica_catch', title: 'Cazador de Mica', category: 'REACCIÓN', icon: '💫', desc: 'Recolecta cristales minerales brillantes para la mezcla de pintura.', badge: 'SALA ARCADE' },
  { id: 'canvas_runner', title: 'Canvas Runner 3D', category: 'ACTION', icon: '🏃', desc: 'Esquiva obstáculos recorriendo la exposición virtual.', badge: 'SALA ARCADE' },
  { id: 'portrait_studio', title: 'Laboratorio de Sombras', category: 'CREATIVO', icon: '💡', desc: 'Ajusta los focos para resaltar la mirada hiperrealista.', badge: 'SALA ARCADE' },
  { id: 'museum_dash', title: 'Carrera de Galería', category: 'CARRERAS', icon: '🏛️', desc: 'Transporta las obras embaladas en tiempo récord.', badge: 'SALA ARCADE' },
  { id: 'art_invaders', title: 'Art Invaders', category: 'RETRO', icon: '👾', desc: 'Defiende la sala de exposiciones con rayos neón.', badge: 'SALA ARCADE' },
  { id: 'pixel_artist', title: 'Pixel Art Naroa', category: 'PIXEL', icon: '👾', desc: 'Recrea los retratos punto por punto en baja resolución.', badge: 'SALA ARCADE' },
]

// ── MINI-JUEGO 1: REVELADOR DE MICA (Scratch Art) ──────────────
function ScratchMicaGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [percent, setPercent] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#1b1b22'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Partículas de mica mineral iniciales sobre la capa slate
    for (let i = 0; i < 350; i++) {
      ctx.fillStyle = Math.random() > 0.4 ? '#D4AF37' : '#FFFFFF'
      ctx.globalAlpha = Math.random() * 0.8
      ctx.beginPath()
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1.0

    // Texto guía
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✨ RASCA LA PIZARRA PARA LIBERAR LA MICA', canvas.width / 2, canvas.height / 2)
  }, [])

  const scratch = (x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas || done) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 36, 0, Math.PI * 2)
    ctx.fill()

    sound.playScratch()

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let transparent = 0
    for (let i = 3; i < imgData.data.length; i += 16) {
      if (imgData.data[i] === 0) transparent++
    }
    const total = imgData.data.length / 16
    const pct = Math.min(100, Math.round((transparent / total) * 100))
    setPercent(pct)

    if (pct >= 75 && !done) {
      setDone(true)
      sound.playVictory()
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1 && e.type !== 'touchmove') return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    scratch(x, y)
  }

  return (
    <div style={{ textAlign: 'center', margin: '16px auto', maxWidth: '480px' }}>
      <div style={{ marginBottom: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
        REVELADO DE MICA MINERAL: <strong>{percent}%</strong> / 75% {done && '🎉 ¡OBRA REVELADA!'}
      </div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: '12px', overflow: 'hidden', border: '3px solid #D4AF37', boxShadow: '0 10px 30px rgba(212,175,55,0.3)' }}>
        <img
          src="/assets/hq-amy-BRTriASV.webp"
          alt="Amy Winehouse — Naroa Gutiérrez Gil"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <canvas
          ref={canvasRef}
          width={480}
          height={480}
          onPointerDown={handlePointerMove}
          onPointerMove={handlePointerMove}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
        />
      </div>
    </div>
  )
}

// ── MINI-JUEGO 2: KINTSUGI EMOCIONAL (Pan de Oro) ──────────────
function KintsugiGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [percent, setPercent] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#121217'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Dibujar grietas oscuras
    ctx.strokeStyle = '#050508'
    ctx.lineWidth = 10
    ctx.lineCap = 'round'

    ctx.beginPath()
    ctx.moveTo(60, 0)
    ctx.lineTo(140, 180)
    ctx.lineTo(260, 280)
    ctx.lineTo(420, 480)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(260, 280)
    ctx.lineTo(470, 200)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, 360)
    ctx.lineTo(160, 320)
    ctx.lineTo(260, 280)
    ctx.stroke()

    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🥇 APLICA PAN DE ORO SOBRE LAS GRIETAS OSCURAS', canvas.width / 2, 40)
  }, [])

  const paintGold = (x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas || done) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#FFD700'
    ctx.shadowColor = '#D4AF37'
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.fill()

    sound.playGoldSparkle()

    setPercent((p) => {
      const next = Math.min(100, p + 2)
      if (next >= 80 && !done) {
        setDone(true)
        sound.playVictory()
      }
      return next
    })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1 && e.type !== 'touchmove') return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    paintGold(x, y)
  }

  return (
    <div style={{ textAlign: 'center', margin: '16px auto', maxWidth: '480px' }}>
      <div style={{ marginBottom: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
        RESTAURACIÓN PAN DE ORO 24K: <strong>{percent}%</strong> {done && '🥇 ¡OBRA REPARADA CON ÉXITO!'}
      </div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: '12px', overflow: 'hidden', border: '3px solid #D4AF37', boxShadow: '0 10px 30px rgba(212,175,55,0.3)' }}>
        <canvas
          ref={canvasRef}
          width={480}
          height={480}
          onPointerDown={handlePointerMove}
          onPointerMove={handlePointerMove}
          style={{ width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
        />
      </div>
    </div>
  )
}

function createShuffledTiles() {
  const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── MINI-JUEGO 3: PUZZLE DESLIZANTE ────────────────────────────
function SlidingPuzzleGame() {
  const [tiles, setTiles] = useState(createShuffledTiles)
  const [moves, setMoves] = useState(0)
  const [won, setWon] = useState(false)

  const shuffle = () => {
    setTiles(createShuffledTiles())
    setMoves(0)
    setWon(false)
  }

  const moveTile = (index: number) => {
    const emptyIndex = tiles.indexOf(8)
    const rowIdx = Math.floor(index / 3)
    const colIdx = index % 3
    const rowEmpty = Math.floor(emptyIndex / 3)
    const colEmpty = emptyIndex % 3

    if (Math.abs(rowIdx - rowEmpty) + Math.abs(colIdx - colEmpty) === 1) {
      const newTiles = [...tiles]
      ;[newTiles[index], newTiles[emptyIndex]] = [newTiles[emptyIndex], newTiles[index]]
      setTiles(newTiles)
      setMoves((m) => m + 1)
      sound.playTick()

      if (newTiles.every((val, idx) => val === idx)) {
        setWon(true)
        sound.playVictory()
      }
    }
  }

  return (
    <div style={{ textAlign: 'center', margin: '16px auto', maxWidth: '420px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
        <span>MOVIMIENTOS: <strong>{moves}</strong></span>
        <button className="brutal-btn" onClick={shuffle}>↻ MEZCLAR</button>
      </div>

      {won ? (
        <div className="victory-banner brutal-card">
          <h2>🧩 ¡PUZZLE HIPERREALISTA RECONSTRUIDO!</h2>
          <p>Has completado el retrato en {moves} movimientos.</p>
          <button className="brutal-cta-btn brutal-cta-btn--whatsapp" onClick={shuffle}>
            JUGAR DE NUEVO
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', padding: '6px', background: '#000', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.2)' }}>
          {tiles.map((tileVal, idx) => {
            if (tileVal === 8) {
              return <div key={idx} style={{ aspectRatio: '1/1', background: '#111' }} />
            }
            const row = Math.floor(tileVal / 3)
            const col = tileVal % 3
            return (
              <button
                key={idx}
                onClick={() => moveTile(idx)}
                style={{
                  aspectRatio: '1/1',
                  backgroundImage: 'url(/assets/marilyn-rocks--qPeLHxE.webp)',
                  backgroundSize: '300% 300%',
                  backgroundPosition: `${(col / 2) * 100}% ${(row / 2) * 100}%`,
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── MINI-JUEGO 4: COLOR MATCH POP ────────────────────────────
function ColorMatchGame() {
  const PALETTES = [
    { name: 'Mica Gold (Amy Winehouse)', color: '#D4AF37', options: ['#D4AF37', '#2B3BE5', '#E63946', '#2A9D8F'] },
    { name: 'Pop Cobalt (Johnny Depp)', color: '#2B3BE5', options: ['#9B5DE5', '#2B3BE5', '#F4A261', '#E76F51'] },
    { name: 'Pan de Oro (DiviNos Marilyn)', color: '#FFD700', options: ['#C0C0C0', '#FFD700', '#CD7F32', '#B8860B'] },
    { name: 'Slate Dark (Pizarra Natural)', color: '#1B1B22', options: ['#1B1B22', '#333340', '#050508', '#4A4A5A'] },
    { name: 'Crimson Pop (Marilyn Rocks)', color: '#E63946', options: ['#F72585', '#7209B7', '#E63946', '#480CA8'] },
  ]

  const [currentIdx, setCurrentIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)

  const handlePick = (opt: string) => {
    if (opt === PALETTES[currentIdx].color) {
      setScore(s => s + 150)
      setStreak(st => st + 1)
      sound.playGoldSparkle()
    } else {
      setStreak(0)
      sound.playTick()
    }
    setCurrentIdx(idx => (idx + 1) % PALETTES.length)
  }

  const current = PALETTES[currentIdx]

  return (
    <div style={{ textAlign: 'center', margin: '16px auto', maxWidth: '420px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
        <span>PUNTOS: <strong>{score}</strong></span>
        <span>RACHA: <strong>{streak} 🔥</strong></span>
      </div>

      <div className="brutal-card" style={{ padding: '24px', background: '#0a0a0f', border: '3px solid #D4AF37' }}>
        <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.1rem', marginBottom: '12px' }}>
          Identifica la paleta: <span style={{ color: '#D4AF37' }}>{current.name}</span>
        </h3>

        <div
          style={{
            width: '100px',
            height: '100px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            backgroundColor: current.color,
            boxShadow: `0 0 30px ${current.color}`,
            border: '3px solid #fff'
          }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {current.options.map((opt, i) => (
            <button
              key={i}
              className="brutal-btn"
              onClick={() => handlePick(opt)}
              style={{
                backgroundColor: opt,
                color: opt === '#1B1B22' || opt === '#050508' ? '#fff' : '#000',
                fontWeight: 'bold',
                padding: '14px',
                border: '2px solid rgba(255,255,255,0.4)',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── MINI-JUEGO 5: SNAKE DEL ARTE ──────────────────────────────
function SnakeArtGame() {
  const [snake, setSnake] = useState<[number, number][]>([[5, 5], [4, 5], [3, 5]])
  const [food, setFood] = useState<[number, number]>([10, 10])
  const [dir, setDir] = useState<'UP' | 'DOWN' | 'LEFT' | 'RIGHT'>('RIGHT')
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)

  const GRID_SIZE = 14

  useEffect(() => {
    if (gameOver) return
    const interval = setInterval(() => {
      setSnake((prev) => {
        const head = [...prev[0]] as [number, number]
        if (dir === 'UP') head[1] -= 1
        if (dir === 'DOWN') head[1] += 1
        if (dir === 'LEFT') head[0] -= 1
        if (dir === 'RIGHT') head[0] += 1

        if (head[0] < 0 || head[0] >= GRID_SIZE || head[1] < 0 || head[1] >= GRID_SIZE) {
          setGameOver(true)
          sound.playTick()
          return prev
        }

        for (const segment of prev) {
          if (segment[0] === head[0] && segment[1] === head[1]) {
            setGameOver(true)
            sound.playTick()
            return prev
          }
        }

        const newSnake = [head, ...prev]
        if (head[0] === food[0] && head[1] === food[1]) {
          setScore((s) => s + 100)
          sound.playGoldSparkle()
          setFood([
            Math.floor(Math.random() * GRID_SIZE),
            Math.floor(Math.random() * GRID_SIZE),
          ])
        } else {
          newSnake.pop()
        }
        return newSnake
      })
    }, 160)

    return () => clearInterval(interval)
  }, [dir, food, gameOver])

  const restart = () => {
    setSnake([[5, 5], [4, 5], [3, 5]])
    setFood([10, 10])
    setDir('RIGHT')
    setScore(0)
    setGameOver(false)
  }

  return (
    <div style={{ textAlign: 'center', margin: '16px auto', maxWidth: '380px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
        <span>MICA RECOLECTADA: <strong>{score} PTS</strong></span>
        <button className="brutal-btn" onClick={restart}>↻ REINICIAR</button>
      </div>

      {gameOver ? (
        <div className="victory-banner brutal-card">
          <h2>💥 ¡FIN DE LA PARTIDA!</h2>
          <p>Puntuación Final: {score} PTS</p>
          <button className="brutal-cta-btn brutal-cta-btn--whatsapp" onClick={restart}>
            VOLVER A INTENTAR
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, gap: '2px', background: '#111116', padding: '6px', borderRadius: '12px', border: '3px solid #D4AF37' }}>
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
              const x = i % GRID_SIZE
              const y = Math.floor(i / GRID_SIZE)
              const isSnake = snake.some((s) => s[0] === x && s[1] === y)
              const isHead = snake[0][0] === x && snake[0][1] === y
              const isFood = food[0] === x && food[1] === y

              return (
                <div
                  key={i}
                  style={{
                    aspectRatio: '1/1',
                    borderRadius: isFood ? '50%' : '3px',
                    backgroundColor: isHead ? '#D4AF37' : isSnake ? '#2B3BE5' : isFood ? '#FFD700' : '#08080c',
                    boxShadow: isFood ? '0 0 10px #FFD700' : 'none'
                  }}
                />
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '12px' }}>
            <div />
            <button className="brutal-btn" onClick={() => setDir('UP')}>▲</button>
            <div />
            <button className="brutal-btn" onClick={() => setDir('LEFT')}>◀</button>
            <button className="brutal-btn" onClick={() => setDir('DOWN')}>▼</button>
            <button className="brutal-btn" onClick={() => setDir('RIGHT')}>▶</button>
          </div>
        </>
      )}
    </div>
  )
}

// ── COMPONENTE PRINCIPAL: SALA DE JUEGOS ────────────────────────
export function GamesHub() {
  const [activeGame, setActiveGame] = useState<string | null>(null)

  // ESTADO PARA MEMORY GAME
  const memoryDeck = [...ARTWORKS.slice(0, 6), ...ARTWORKS.slice(0, 6)].map((item, index) => ({
    instanceId: index,
    artworkId: item.id,
    title: item.title,
    url: item.url,
  }))

  const [cards, setCards] = useState(() => memoryDeck.sort(() => Math.random() - 0.5))
  const [flipped, setFlipped] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [moves, setMoves] = useState(0)

  const handleCardClick = (index: number) => {
    if (flipped.length === 2 || flipped.includes(index) || matched.includes(index)) return

    const newFlipped = [...flipped, index]
    setFlipped(newFlipped)

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1)
      const [firstIdx, secondIdx] = newFlipped
      if (cards[firstIdx].artworkId === cards[secondIdx].artworkId) {
        setMatched((m) => [...m, cards[firstIdx].artworkId])
        setFlipped([])
        sound.playGoldSparkle()
      } else {
        setTimeout(() => setFlipped([]), 900)
      }
    }
  }

  const resetMemory = () => {
    setCards(memoryDeck.sort(() => Math.random() - 0.5))
    setFlipped([])
    setMatched([])
    setMoves(0)
  }

  // ESTADO PARA QUIZ GAME
  const QUIZ_QUESTIONS = [
    {
      q: '¿En qué ciudad tiene su estudio principal la artista Naroa Gutiérrez Gil?',
      options: ['Bilbao', 'Madrid', 'Barcelona', 'Donostia'],
      correct: 0,
    },
    {
      q: '¿Cuál es la superficie mineral estrella usada en sus retratos más emblemáticos?',
      options: ['Lienzo sintético', 'Pizarra natural con mica mineral', 'Madera de pino', 'Mármol blanco'],
      correct: 1,
    },
    {
      q: '¿Qué estilo caracteriza la obra de Naroa?',
      options: ['Cubismo analítico', 'Hiperrealismo POP & Mixed Media', 'Surrealismo abstracto', 'Impresionismo puro'],
      correct: 1,
    },
    {
      q: '¿Qué material precioso de 24k se integra en las obras de la serie DiviNos?',
      options: ['Plata esterlina', 'Pan de Oro de 24k', 'Bronce pulido', 'Diamantes de imitación'],
      correct: 1,
    },
    {
      q: '¿Qué icono de la música protagoniza el lienzo "Amy Rocks"?',
      options: ['Janis Joplin', 'Amy Winehouse', 'Aretha Franklin', 'Whitney Houston'],
      correct: 1,
    },
  ]
  const [quizIdx, setQuizIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [quizDone, setQuizDone] = useState(false)

  const answerQuiz = (optionIdx: number) => {
    if (optionIdx === QUIZ_QUESTIONS[quizIdx].correct) {
      setScore((s) => s + 100)
      sound.playGoldSparkle()
    } else {
      sound.playTick()
    }
    if (quizIdx + 1 < QUIZ_QUESTIONS.length) {
      setQuizIdx((i) => i + 1)
    } else {
      setQuizDone(true)
      sound.playVictory()
    }
  }

  const resetQuiz = () => {
    setQuizIdx(0)
    setScore(0)
    setQuizDone(false)
  }

  return (
    <div className="games-page brutal-container">
      {/* Ticker Arcade */}
      <div className="brutal-marquee-bar brutal-marquee-bar--cyan">
        <div className="brutal-marquee-content">
          <span>🎮 SALA DE JUEGOS NAROA · 21 MINIJUEGOS ARTÍSTICOS · KINTSUGI · REVELADOR DE MICA · PUZZLE · MEMORY · QUIZ 🎮</span>
          <span>🎮 SALA DE JUEGOS NAROA · 21 MINIJUEGOS ARTÍSTICOS · KINTSUGI · REVELADOR DE MICA · PUZZLE · MEMORY · QUIZ 🎮</span>
        </div>
      </div>

      <header className="games-header">
        <span className="brutal-badge brutal-badge--yellow">ARCADE INTERACTIVO 2026</span>
        <h1 className="brutal-title">
          SALA DE <span className="highlight-pink">JUEGOS</span>
        </h1>
        <p className="brutal-subtitle">
          21 experiencias interactivas creadas con las texturas, iconos y minerales de Naroa Gutiérrez Gil.
        </p>
      </header>

      {/* MODAL / CONTENEDOR DE JUEGO ACTIVO */}
      <AnimatePresence>
        {activeGame && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="active-game-modal brutal-card"
          >
            <div className="game-modal-top">
              <span className="brutal-badge brutal-badge--pink">
                {ALL_GAMES.find((g) => g.id === activeGame)?.title}
              </span>
              <button className="brutal-btn close-game-btn" onClick={() => setActiveGame(null)}>
                ✖ CERRAR JUEGO
              </button>
            </div>

            {/* JUEGO 1: REVELADOR DE MICA */}
            {activeGame === 'scratch' && <ScratchMicaGame />}

            {/* JUEGO 2: KINTSUGI EMOCIONAL */}
            {activeGame === 'kintsugi' && <KintsugiGame />}

            {/* JUEGO 3: PUZZLE DESLIZANTE */}
            {activeGame === 'puzzle' && <SlidingPuzzleGame />}

            {/* JUEGO 4: MEMORY */}
            {activeGame === 'memory' && (
              <div className="memory-game-box">
                <div className="game-stats-bar">
                  <span>MOVIMIENTOS: <strong>{moves}</strong></span>
                  <span>PAREJAS LOGRADAS: <strong>{matched.length} / 6</strong></span>
                  <button className="brutal-btn reset-btn" onClick={resetMemory}>↻ REINICIAR</button>
                </div>

                {matched.length === 6 ? (
                  <div className="victory-banner brutal-card">
                    <h2>🏆 ¡VICTORIA HIPERREALISTA!</h2>
                    <p>Has completado el Memory en {moves} movimientos.</p>
                    <button className="brutal-cta-btn brutal-cta-btn--whatsapp" onClick={resetMemory}>
                      JUGAR DE NUEVO
                    </button>
                  </div>
                ) : (
                  <div className="memory-grid">
                    {cards.map((card, idx) => {
                      const isFlipped = flipped.includes(idx) || matched.includes(card.artworkId)
                      return (
                        <button
                          key={idx}
                          className={`memory-card brutal-btn ${isFlipped ? 'flipped' : ''}`}
                          onClick={() => handleCardClick(idx)}
                        >
                          {isFlipped ? (
                            <img src={card.url} alt={card.title} className="memory-img" />
                          ) : (
                            <div className="memory-back">
                              <span>AORAN</span>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* JUEGO 5: QUIZ */}
            {activeGame === 'quiz' && (
              <div className="quiz-game-box">
                {!quizDone ? (
                  <div className="quiz-card">
                    <div className="quiz-progress">Pregunta {quizIdx + 1} de {QUIZ_QUESTIONS.length}</div>
                    <h3 className="quiz-q">{QUIZ_QUESTIONS[quizIdx].q}</h3>
                    <div className="quiz-options">
                      {QUIZ_QUESTIONS[quizIdx].options.map((opt, oIdx) => (
                        <button
                          key={oIdx}
                          className="brutal-btn quiz-opt-btn"
                          onClick={() => answerQuiz(oIdx)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="victory-banner brutal-card">
                    <h2>🎉 ¡QUIZ COMPLETADO!</h2>
                    <p>Puntuación Total: <strong>{score} PTS</strong></p>
                    <button className="brutal-cta-btn brutal-cta-btn--email" onClick={resetQuiz}>
                      REPETIR QUIZ
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* JUEGO 6: COLOR MATCH */}
            {activeGame === 'color_match' && <ColorMatchGame />}

            {/* JUEGO 7: SNAKE */}
            {activeGame === 'snake' && <SnakeArtGame />}

            {/* OTROS JUEGOS ARCADE */}
            {activeGame !== 'scratch' && activeGame !== 'kintsugi' && activeGame !== 'puzzle' && activeGame !== 'memory' && activeGame !== 'quiz' && activeGame !== 'color_match' && activeGame !== 'snake' && (
              <div className="generic-game-preview">
                <div className="arcade-screen brutal-card">
                  <div className="arcade-text">
                    <span className="arcade-icon">🕹️</span>
                    <h3>SALA ARCADE POP</h3>
                    <p>Has seleccionado <strong>{ALL_GAMES.find((g) => g.id === activeGame)?.title}</strong>.</p>
                    <p className="arcade-hint">Experiencia interactiva inmersiva con texturas de pizarra y mica mineral.</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* GRID DE LOS 21 JUEGOS */}
      <div className="games-grid">
        {ALL_GAMES.map((game) => (
          <div
            key={game.id}
            className={`game-card brutal-card ${game.playable ? 'game-card--playable' : ''}`}
            onClick={() => setActiveGame(game.id)}
          >
            <div className="game-top">
              <span className="game-category-tag">{game.category}</span>
              {game.badge && <span className="game-badge">{game.badge}</span>}
            </div>
            <div className="game-icon">{game.icon}</div>
            <h3 className="game-title">{game.title}</h3>
            <p className="game-desc">{game.desc}</p>
            <button className="brutal-btn play-btn">
              {game.playable ? '▶ JUGAR AHORA' : '🕹️ PROBAR'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
