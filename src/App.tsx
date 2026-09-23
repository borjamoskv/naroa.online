import { Suspense, lazy, useState, useEffect, useCallback } from 'react'
import { ARTWORKS } from './artworks'
import { sound } from './utils/audio'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CustomCursor } from './components/CustomCursor'
import { KineticHorizon } from './components/KineticHorizon'
import { StudioLoupe } from './components/StudioLoupe'
import { VisualIndex } from './components/VisualIndex'
import { ArtistManifesto } from './components/ArtistManifesto'
import { HauteDock, type ActiveMode } from './components/HauteDock'
import { VideogameHUD } from './components/VideogameHUD'

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

  const [audioActive, setAudioActive] = useState<boolean>(sound.isEnabled())
  const [isWebGLMounted, setIsWebGLMounted] = useState(false)

  // Estados del Pabellón 3D
  const [is3DActive, setIs3DActive] = useState(false)
  const [interactionPrompt, setInteractionPrompt] = useState<string | null>(null)
  const [playerPos, setPlayerPos] = useState({ x: 0, z: 0 })
  const [playerRotation, setPlayerRotation] = useState(0)

  // Carga diferida de WebGL
  useEffect(() => {
    const timer = setTimeout(() => setIsWebGLMounted(true), 350)
    return () => clearTimeout(timer)
  }, [])

  // Control del scroll en modo 3D
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('mode-3d-active', is3DActive || activeMode === '3d')
    }
  }, [is3DActive, activeMode])

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
      } else if (hash === '#/3d' || hash === '#/museo' || hash === '#/espacio') {
        setActiveMode('3d')
      } else if (hash === '#/indice' || hash === '#/catalogo' || hash === '#/coleccion' || hash === '#/obras') {
        setIsIndexOpen(true)
      } else if (hash === '#/artista' || hash === '#/atelier' || hash === '#/contacto' || hash === '#/about') {
        setIsArtistOpen(true)
      } else {
        setActiveMode('horizon')
        setIs3DActive(false)
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

  // Liberar puntero al pulsar ESC en modo 3D
  useEffect(() => {
    const handlePointerLockChange = () => {
      if (!document.pointerLockElement && activeMode === '3d') {
        setIs3DActive(false)
      }
    }
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange)
  }, [activeMode])

  const isSceneVisible = activeMode === '3d'

  return (
    <div className={`app-shell ${activeMode === '3d' ? 'mode-3d-active' : ''}`}>
      {/* Cursor inercial de oro mineral */}
      <CustomCursor />

      {/* Dock Minimalista Flotante Haute Joaillerie */}
      <HauteDock
        activeMode={activeMode}
        currentIndex={currentIndex}
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
      />

      {/* ÍNDICE VISUAL DE ALTA COSTURA (27 OBRAS CANÓNICAS) */}
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

      {/* HUD DE CONTROL PABELLÓN 3D */}
      {isSceneVisible && (
        <VideogameHUD
          isStarted={is3DActive}
          onStart={() => setIs3DActive(true)}
          onExit={() => {
            setIs3DActive(false)
            if (document.pointerLockElement) document.exitPointerLock()
            setActiveMode('horizon')
          }}
          interactionPrompt={interactionPrompt}
          playerPos={playerPos}
          playerRotation={playerRotation}
        />
      )}

      {/* ESCENA 3D (THREE.JS WEBGL) */}
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
                active={isSceneVisible}
                setInteractionPrompt={setInteractionPrompt}
                isStarted={is3DActive}
                onPlayerMove={(pos, rot) => {
                  setPlayerPos(pos)
                  setPlayerRotation(rot)
                }}
              />
            </div>
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  )
}
