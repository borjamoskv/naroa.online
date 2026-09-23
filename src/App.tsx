import { Suspense, lazy, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ARTWORKS, type Artwork } from './artworks'
import { ArtworkModal } from './components/ArtworkModal'
import { sound } from './utils/audio'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NavigationPill } from './components/NavigationPill'
import { HomeHero } from './components/HomeHero'
import { PremiumFooter } from './components/PremiumFooter'
import { VideogameHUD } from './components/VideogameHUD'
import { CustomCursor } from './components/CustomCursor'

// Vistas con Lazy Loading de Alta Eficiencia
const Scene = lazy(() => import('./components/Scene'))
const GalleryGrid = lazy(() => import('./components/GalleryGrid').then(m => ({ default: m.GalleryGrid })))
const CommissionCalculator = lazy(() => import('./components/CommissionCalculator').then(m => ({ default: m.CommissionCalculator })))

export type ViewMode = 'home' | 'coleccion' | '3d' | 'artista' | 'atelier'

const getViewFromHash = (hash: string): ViewMode => {
  if (hash === '#/coleccion' || hash === '#/destacada' || hash === '#/galeria' || hash === '#/obras') return 'coleccion'
  if (hash === '#/atelier' || hash === '#/encargos' || hash === '#/contacto') return 'atelier'
  if (hash === '#/artista' || hash === '#/sobre-mi' || hash === '#/about') return 'artista'
  if (hash === '#/3d' || hash === '#/museo' || hash === '#/espacio') return '3d'
  return 'home'
}

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

function MinimalLoader() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '16px',
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          border: '1.5px solid rgba(212, 175, 55, 0.2)',
          borderTopColor: '#D4AF37',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.68rem',
          letterSpacing: '0.2em',
          color: 'rgba(212, 175, 55, 0.8)',
          textTransform: 'uppercase',
        }}
      >
        MATERIALIZANDO...
      </span>
    </div>
  )
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return getViewFromHash(window.location.hash)
    }
    return 'home'
  })

  const [modalArtwork, setModalArtwork] = useState<Artwork | null>(() => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#obra-')) {
      const slug = window.location.hash.replace('#obra-', '')
      return ARTWORKS.find(a => toSlug(a.title) === slug || a.slug === slug) || null
    }
    return null
  })

  const [audioActive, setAudioActive] = useState<boolean>(sound.isEnabled())
  const [isWebGLMounted, setIsWebGLMounted] = useState(false)

  // Estados del Pabellón 3D
  const [is3DActive, setIs3DActive] = useState(false)
  const [interactionPrompt, setInteractionPrompt] = useState<string | null>(null)
  const [playerPos, setPlayerPos] = useState({ x: 0, z: 0 })
  const [playerRotation, setPlayerRotation] = useState(0)

  // Carga diferida de WebGL para rendimiento óptimo
  useEffect(() => {
    const timer = setTimeout(() => setIsWebGLMounted(true), 400)
    return () => clearTimeout(timer)
  }, [])

  // Desactivar estado inmersivo si salimos de la vista 3D
  const [prevView, setPrevView] = useState(currentView)
  if (currentView !== prevView) {
    setPrevView(currentView)
    if (currentView !== '3d' && is3DActive) {
      setIs3DActive(false)
    }
  }

  // Navegación reactiva por Hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      if (hash.startsWith('#obra-')) {
        const slug = hash.replace('#obra-', '')
        const match = ARTWORKS.find(a => toSlug(a.title) === slug || a.slug === slug)
        if (match) setModalArtwork(match)
      } else {
        const nextView = getViewFromHash(hash)
        setCurrentView(nextView)
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (modalArtwork) {
      const slug = modalArtwork.slug || toSlug(modalArtwork.title)
      window.location.hash = `obra-${slug}`
    }
  }, [modalArtwork])

  const handleInspect = (index: number) => {
    sound.playOpen()
    setModalArtwork(ARTWORKS[index])
    if (document.pointerLockElement) {
      document.exitPointerLock()
    }
  }

  const toggleAudio = () => {
    const newState = sound.toggleSound()
    setAudioActive(newState)
  }

  // Liberar puntero al pulsar ESC
  useEffect(() => {
    const handlePointerLockChange = () => {
      if (!document.pointerLockElement) {
        setIs3DActive(false)
      }
    }
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange)
  }, [])

  const isSceneVisible = currentView === '3d'

  return (
    <>
      {/* Cursor inercial de oro mineral */}
      <CustomCursor />

      <div className="ui-layer" style={{ pointerEvents: 'none' }}>
        {/* Barra de Navegación de Alta Gama */}
        {!is3DActive && (
          <div style={{ pointerEvents: 'auto', width: '100%', zIndex: 50 }}>
            <NavigationPill
              currentView={currentView}
              audioActive={audioActive}
              toggleAudio={toggleAudio}
            />
          </div>
        )}

        {/* ACT I: EL MONOLITO (Hero Monumental) */}
        {currentView === 'home' && <HomeHero />}

        {/* ACT II: LA COLECCIÓN (Exposición de Alta Definición) */}
        {currentView === 'coleccion' && (
          <div className="view-container" style={{ pointerEvents: 'auto' }}>
            <ErrorBoundary name="Colección Oficial">
              <Suspense fallback={<MinimalLoader />}>
                <GalleryGrid onInspect={handleInspect} />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {/* ACT III: ESPACIO 3D (Pabellón Arquitectónico) */}
        {currentView === '3d' && (
          <VideogameHUD
            isStarted={is3DActive}
            onStart={() => setIs3DActive(true)}
            onExit={() => {
              setIs3DActive(false)
              if (document.pointerLockElement) document.exitPointerLock()
            }}
            interactionPrompt={interactionPrompt}
            playerPos={playerPos}
            playerRotation={playerRotation}
          />
        )}

        {/* ACT IV: EL PALÍNDROMO (Artista & Manifiesto) */}
        {currentView === 'artista' && (
          <div
            className="view-container about-view"
            style={{
              maxWidth: '980px',
              margin: '0 auto',
              padding: '80px 24px 80px',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '48px',
                alignItems: 'center',
                background: 'rgba(8, 8, 12, 0.88)',
                border: '1px solid rgba(212, 175, 55, 0.35)',
                borderRadius: '24px',
                padding: 'clamp(28px, 5vw, 56px)',
                boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(212,175,55,0.08)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              {/* Retrato Oficial Nítido */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                style={{ position: 'relative' }}
              >
                <img
                  src="/assets/naroa-portrait-DW8XfHYG.webp"
                  alt="Naroa Gutiérrez Gil"
                  style={{
                    width: '100%',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 15px 40px rgba(0,0,0,0.9)',
                    display: 'block',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    e.currentTarget.src = '/assets/naroa-portrait-DW8XfHYG.jpg'
                  }}
                />
              </motion.div>

              {/* El Palíndromo & Identidad Visual Pura */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
              >
                <h1
                  style={{
                    fontSize: 'clamp(2.4rem, 5vw, 3.8rem)',
                    fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    lineHeight: 1.05,
                    margin: '0 0 10px 0',
                    color: '#FFFFFF',
                  }}
                >
                  AORAN / <span style={{ color: '#D4AF37' }}>NAROA</span>
                </h1>

                <p
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    color: '#D4AF37',
                    fontSize: '0.88rem',
                    letterSpacing: '0.25em',
                    margin: '0 0 32px 0',
                    textTransform: 'uppercase',
                  }}
                >
                  A NAROA LA ORAN A
                </p>

                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <a
                    href="https://www.instagram.com/naroa_art/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => sound.playTick()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(212, 175, 55, 0.15)',
                      border: '1px solid #D4AF37',
                      color: '#D4AF37',
                      padding: '12px 22px',
                      borderRadius: '30px',
                      fontSize: '0.82rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textDecoration: 'none',
                      transition: 'all 0.25s ease',
                      boxShadow: '0 0 20px rgba(212,175,55,0.25)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#D4AF37'
                      e.currentTarget.style.color = '#000000'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(212, 175, 55, 0.15)'
                      e.currentTarget.style.color = '#D4AF37'
                    }}
                  >
                    INSTAGRAM (@naroa_art) ↗
                  </a>

                  <a
                    href="https://www.facebook.com/naroa.artista.plastica"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => sound.playTick()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'rgba(255,255,255,0.85)',
                      padding: '12px 20px',
                      borderRadius: '30px',
                      fontSize: '0.82rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      textDecoration: 'none',
                      transition: 'all 0.25s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#FFFFFF'
                      e.currentTarget.style.color = '#FFFFFF'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                    }}
                  >
                    FACEBOOK ↗
                  </a>

                  <a
                    href="#/atelier"
                    onClick={() => sound.playTick()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'rgba(255,255,255,0.85)',
                      padding: '12px 20px',
                      borderRadius: '30px',
                      fontSize: '0.82rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      textDecoration: 'none',
                      transition: 'all 0.25s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#D4AF37'
                      e.currentTarget.style.color = '#D4AF37'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                    }}
                  >
                    ENCARGOS A MEDIDA ↗
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* ACT V: EL ATELIER (Encargos Bespoke) */}
        {currentView === 'atelier' && (
          <div className="view-container" style={{ pointerEvents: 'auto' }}>
            <ErrorBoundary name="Atelier de Encargos">
              <Suspense fallback={<MinimalLoader />}>
                <CommissionCalculator />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {!is3DActive && (
          <div style={{ pointerEvents: 'auto', width: '100%', marginTop: 'auto' }}>
            <PremiumFooter />
          </div>
        )}
      </div>

      {/* Escena 3D - Pabellón Arquitectónico (Three.js WebGL) */}
      {isWebGLMounted && (
        <ErrorBoundary name="Pabellón 3D (Three.js WebGL)">
          <Suspense fallback={null}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                opacity: isSceneVisible ? 1 : 0,
                pointerEvents: isSceneVisible ? 'auto' : 'none',
                transition: 'opacity 0.6s ease-in-out',
              }}
            >
              <Scene
                onInspectArtwork={handleInspect}
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

      {/* Lightbox Modal de Inspección Cinemático */}
      <ArtworkModal
        artwork={modalArtwork}
        currentIndex={modalArtwork ? ARTWORKS.findIndex(a => a.id === modalArtwork.id) : 0}
        onClose={() => setModalArtwork(null)}
        onNavigate={(idx) => {
          setModalArtwork(ARTWORKS[idx])
        }}
      />
    </>
  )
}
