import { Suspense, lazy, useState, useEffect, useCallback } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { ARTWORKS } from './artworks'
import { sound } from './utils/audio'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CustomCursor } from './components/CustomCursor'
import { KineticHorizon } from './components/KineticHorizon'
import { StudioLoupe } from './components/StudioLoupe'
import { VisualIndex } from './components/VisualIndex'
import { ArtistManifesto } from './components/ArtistManifesto'
import { CommissionCalculator } from './components/CommissionCalculator'
import { HauteDock, type ActiveMode } from './components/HauteDock'
import { VideogameHUD } from './components/VideogameHUD'
import { MicaSystem } from './components/MicaSystem'

// Carga diferida de WebGL para rendimiento sub-segundo
const Scene = lazy(() => import('./components/Scene'))

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export default function App() {
  const [activeMode, setActiveMode] = useState<ActiveMode>('horizon')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loupeIndex, setLoupeIndex] = useState<number | null>(null)
  const [isIndexOpen, setIsIndexOpen] = useState(false)
  const [isArtistOpen, setIsArtistOpen] = useState(false)
  const [isCommissionOpen, setIsCommissionOpen] = useState(false)
  const [commissionPieceTitle, setCommissionPieceTitle] = useState<string | undefined>(undefined)
  const [isMicaOpen, setIsMicaOpen] = useState(false)

  const [audioActive, setAudioActive] = useState<boolean>(sound.isEnabled())
  const [isWebGLMounted, setIsWebGLMounted] = useState(false)

  // Estado de enfoque en el Pabellón 3D
  const [selected3DIndex, setSelected3DIndex] = useState<number | null>(null)

  // Carga diferida de WebGL
  useEffect(() => {
    const timer = setTimeout(() => setIsWebGLMounted(true), 350)
    return () => clearTimeout(timer)
  }, [])

  // Control del scroll en modo 3D
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('mode-3d-active', activeMode === '3d')
    }
  }, [activeMode])

  // Enrutamiento reactivo por Hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      if (hash.startsWith('#obra-')) {
        const slug = hash.replace('#obra-', '')
        const idx = ARTWORKS.findIndex((a) => toSlug(a.title) === slug || a.slug === slug)
        if (idx !== -1) {
          setCurrentIndex(idx)
          setLoupeIndex(idx)
        }
      } else if (hash === '#/3d' || hash === '#/museo' || hash === '#/espacio' || hash === '#/rotonda') {
        setActiveMode('3d')
      } else if (
        hash === '#/indice' ||
        hash === '#/catalogo' ||
        hash === '#/coleccion' ||
        hash === '#/obras' ||
        hash === '#/galeria' ||
        hash === '#/gallery' ||
        hash === '#/destacada'
      ) {
        setActiveMode('horizon')
        setIsIndexOpen(true)
      } else if (hash === '#/mica' || hash === '#/chat' || hash === '#/asistente') {
        setIsMicaOpen(true)
      } else if (
        hash === '#/artista' ||
        hash === '#/atelier' ||
        hash === '#/contacto' ||
        hash === '#/about' ||
        hash === '#/trayectoria' ||
        hash === '#/sobre-mi' ||
        hash === '#/bio'
      ) {
        setIsArtistOpen(true)
      } else if (hash === '#/encargos' || hash === '#/commission' || hash === '#/bespoke') {
        setIsCommissionOpen(true)
      } else if (hash === '#/home' || hash === '#/' || hash === '') {
        setActiveMode('horizon')
        setIsIndexOpen(false)
        setIsArtistOpen(false)
        setIsCommissionOpen(false)
        setIsMicaOpen(false)
        setSelected3DIndex(null)
        setLoupeIndex(null)
      } else {
        setActiveMode('horizon')
        setSelected3DIndex(null)
        setLoupeIndex(null)
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Sincronizar hash con la obra abierta en lupa
  useEffect(() => {
    if (loupeIndex !== null) {
      const art = ARTWORKS[loupeIndex]
      const slug = art.slug || toSlug(art.title)
      window.location.hash = `obra-${slug}`
    } else if (window.location.hash.startsWith('#obra-')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [loupeIndex])

  const handleInspectArtwork = useCallback((index: number) => {
    sound.playOpen()
    setCurrentIndex(index)
    setLoupeIndex(index)
    if (document.pointerLockElement) {
      document.exitPointerLock()
    }
  }, [])

  const toggleAudio = () => {
    const newState = sound.toggleSound()
    setAudioActive(newState)
  }

  // Atajos de teclado globales de alta gama (I: Índice, A: Artista, S: Sonido, 3: 3D)
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.key === 'i' || e.key === 'I') {
        setIsIndexOpen((prev) => !prev)
      } else if (e.key === 'a' || e.key === 'A') {
        setIsArtistOpen((prev) => !prev)
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMicaOpen((prev) => !prev)
      } else if (e.key === 's' || e.key === 'S') {
        const nextState = sound.toggleSound()
        setAudioActive(nextState)
      } else if (e.key === '3') {
        setActiveMode((prev) => {
          const next = prev === '3d' ? 'horizon' : '3d'
          window.location.hash = next === '3d' ? '#/3d' : '#/'
          return next
        })
      }
    }
    window.addEventListener('keydown', handleGlobalKeys)
    return () => window.removeEventListener('keydown', handleGlobalKeys)
  }, [])


  const isSceneVisible = activeMode === '3d'

  return (
    <div className={`app-shell ${activeMode === '3d' ? 'mode-3d-active' : ''}`}>
      {/* Telemetría Vercel Web Analytics */}
      <Analytics />

      {/* Cursor inercial de oro mineral */}
      <CustomCursor />

      {/* Dock Minimalista Flotante Haute Joaillerie */}
      <HauteDock
        activeMode={activeMode}
        currentIndex={activeMode === '3d' && selected3DIndex !== null ? selected3DIndex : currentIndex}
        totalArtworks={ARTWORKS.length}
        onSelectMode={(mode) => {
          setActiveMode(mode)
          if (mode === 'horizon') {
            window.location.hash = '#/'
          } else {
            window.location.hash = '#/3d'
          }
        }}
        onOpenIndex={() => setIsIndexOpen(true)}
        onOpenArtist={() => setIsArtistOpen(true)}
        onOpenCommission={() => {
          setCommissionPieceTitle(undefined)
          setIsCommissionOpen(true)
        }}
        isMicaOpen={isMicaOpen}
        onToggleMica={() => setIsMicaOpen((prev) => !prev)}
        audioActive={audioActive}
        toggleAudio={toggleAudio}
      />

      {/* EXPERIENCIA PRINCIPAL: HORIZONTE CINÉTICO MONUMENTAL */}
      <main className="main-content" style={{ display: isSceneVisible ? 'none' : 'block' }}>
        <KineticHorizon
          currentIndex={currentIndex}
          onSelectArtwork={setCurrentIndex}
          onOpenLoupe={handleInspectArtwork}
        />
      </main>

      {/* MODO LUPA DE TALLER: ZOOM 2.5X Y FOCO ESPECULAR */}
      <StudioLoupe
        artworkIndex={loupeIndex}
        onClose={() => setLoupeIndex(null)}
        onNavigate={(idx) => {
          setCurrentIndex(idx)
          setLoupeIndex(idx)
        }}
        onOpenCommission={(pieceTitle) => {
          setLoupeIndex(null)
          setCommissionPieceTitle(pieceTitle)
          setIsCommissionOpen(true)
        }}
      />

      {/* ÍNDICE VISUAL DE ALTA COSTURA (OBRAS CANÓNICAS) */}
      <VisualIndex
        isOpen={isIndexOpen}
        onClose={() => setIsIndexOpen(false)}
        onSelectArtwork={(idx) => {
          setCurrentIndex(idx)
          setActiveMode('horizon')
        }}
      />

      {/* MANIFIESTO ARTISTA, PALÍNDROMO & ATELIER BESPOKE */}
      <ArtistManifesto
        isOpen={isArtistOpen}
        onClose={() => setIsArtistOpen(false)}
      />

      {/* CALCULADORA / FORMULARIO INTERACTIVO DE ENCARGOS BESPOKE */}
      <CommissionCalculator
        isOpen={isCommissionOpen}
        onClose={() => {
          setIsCommissionOpen(false)
          setCommissionPieceTitle(undefined)
        }}
        initialPieceTitle={commissionPieceTitle}
      />

      {/* ASISTENTE CONVERSACIONAL SOTA: MICA SYSTEM v∞ */}
      <MicaSystem
        isOpen={isMicaOpen}
        onToggle={() => setIsMicaOpen((prev) => !prev)}
        onClose={() => setIsMicaOpen(false)}
        onOpenCommission={(pieceTitle) => {
          setIsMicaOpen(false)
          setCommissionPieceTitle(pieceTitle)
          setIsCommissionOpen(true)
        }}
        onOpenArtwork={(idx) => {
          setIsMicaOpen(false)
          setCurrentIndex(idx)
          setLoupeIndex(idx)
        }}
        onOpen3D={() => {
          setIsMicaOpen(false)
          setActiveMode('3d')
          window.location.hash = '#/3d'
        }}
        onOpenIndex={() => {
          setIsMicaOpen(false)
          setIsIndexOpen(true)
        }}
        currentArtwork={loupeIndex !== null ? ARTWORKS[loupeIndex] : ARTWORKS[currentIndex]}
      />

      {/* CAPA CURATORIAL MINIMALISTA PABELLÓN 3D */}
      {isSceneVisible && (
        <VideogameHUD
          onExit={() => {
            setSelected3DIndex(null)
            setActiveMode('horizon')
          }}
          selectedIndex={selected3DIndex}
          onSelectArtwork={setSelected3DIndex}
          onInspectArtwork={handleInspectArtwork}
          onOpenCommission={(title) => {
            setCommissionPieceTitle(title)
            setIsCommissionOpen(true)
          }}
        />
      )}

      {/* ESCENA 3D ARQUITECTÓNICA (THREE.JS WEBGL) */}
      {isWebGLMounted && (
        <ErrorBoundary name="Pabellón 3D (Three.js WebGL)">
          <Suspense fallback={null}>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: isSceneVisible ? 10 : -1,
                opacity: isSceneVisible ? 1 : 0,
                pointerEvents: isSceneVisible ? 'auto' : 'none',
                transition: 'opacity 0.6s ease-in-out',
              }}
            >
              <Scene
                onInspectArtwork={handleInspectArtwork}
                selectedIndex={selected3DIndex}
                onSelectArtwork={setSelected3DIndex}
                active={isSceneVisible}
              />
            </div>
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  )
}
