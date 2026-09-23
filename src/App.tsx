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

// Vistas con Lazy Loading (Ultrathink Code-Splitting)
const Scene = lazy(() => import('./components/Scene'))
const GalleryGrid = lazy(() => import('./components/GalleryGrid').then(module => ({ default: module.GalleryGrid })))
const CommissionCalculator = lazy(() => import('./components/CommissionCalculator').then(module => ({ default: module.CommissionCalculator })))
const GamesHub = lazy(() => import('./components/GamesHub').then(module => ({ default: module.GamesHub })))
const BlogSection = lazy(() => import('./components/BlogSection').then(module => ({ default: module.BlogSection })))

type ViewMode = 'home' | '3d' | 'destacada' | 'encargos' | 'juegos' | 'about' | 'blog'

const getViewFromHash = (hash: string): ViewMode => {
  if (hash === '#/destacada' || hash === '#/galeria' || hash === '#/archivo' || hash === '#/coleccion') return 'destacada'
  if (hash === '#/encargos' || hash === '#/contacto' || hash === '#/atelier') return 'encargos'
  if (hash === '#/juegos') return 'juegos'
  if (hash === '#/blog') return 'blog'
  if (hash === '#/sobre-mi' || hash === '#/about') return 'about'
  if (hash === '#/3d') return '3d'
  return 'home'
}

const toSlug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function Loader() {
  return (
    <div className="loader">
      <div className="spinner"></div>
      <div className="loader-text">MATERIALIZANDO...</div>
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
  
  // Estados del Videojuego FPS
  const [isStarted, setIsStarted] = useState(false)
  const [prevView, setPrevView] = useState(currentView)
  const [interactionPrompt, setInteractionPrompt] = useState<string | null>(null)
  const [playerPos, setPlayerPos] = useState({ x: 0, z: 0 })
  const [playerRotation, setPlayerRotation] = useState(0)

  // Desactivar isStarted si salimos de la vista 3D
  if (currentView !== prevView) {
    setPrevView(currentView)
    if (currentView !== '3d' && isStarted) {
      setIsStarted(false)
    }
  }

  // Ultrathink Deferred WebGL Mounting: 
  useEffect(() => {
    const timer = setTimeout(() => setIsWebGLMounted(true), 600)
    return () => clearTimeout(timer)
  }, [])

  // Hash Navigation Handler
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
    // Liberar puntero temporalmente al inspeccionar
    if (document.pointerLockElement) {
      document.exitPointerLock()
    }
  }

  const toggleAudio = () => {
    const newState = sound.toggleSound()
    setAudioActive(newState)
  }

  const isSceneActive = currentView === '3d'

  // Escuchar cuando el usuario presiona ESC para salir del PointerLock
  useEffect(() => {
    const handlePointerLockChange = () => {
      if (!document.pointerLockElement) {
        setIsStarted(false)
      }
    }
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange)
  }, [])

  return (
    <>
      <CustomCursor />
      <div className="ui-layer" style={{ pointerEvents: 'none' }}>
        
        {/* Mostrar Navbar SIEMPRE que NO hayamos iniciado el modo FPS inmersivo */}
        {!isStarted && (
          <div style={{ pointerEvents: 'auto', width: '100%', zIndex: 50 }}>
            <NavigationPill currentView={currentView} audioActive={audioActive} toggleAudio={toggleAudio} />
          </div>
        )}

        {currentView === 'home' && <HomeHero />}

        {currentView === 'destacada' && (
          <div className="view-container" style={{ pointerEvents: 'auto' }}>
            <ErrorBoundary name="Galería Destacada">
              <Suspense fallback={<Loader />}>
                <GalleryGrid onInspect={handleInspect} />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {currentView === '3d' && (
          <VideogameHUD 
            isStarted={isStarted} 
            onStart={() => setIsStarted(true)} 
            onExit={() => {
              setIsStarted(false)
              if (document.pointerLockElement) document.exitPointerLock()
            }}
            interactionPrompt={interactionPrompt} 
            playerPos={playerPos}
            playerRotation={playerRotation}
          />
        )}

        {currentView === 'encargos' && (
          <div className="view-container" style={{ pointerEvents: 'auto' }}>
            <ErrorBoundary name="Calculadora de Encargos">
              <Suspense fallback={<Loader />}>
                <CommissionCalculator />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {currentView === 'juegos' && (
          <div className="view-container" style={{ pointerEvents: 'auto' }}>
            <ErrorBoundary name="Centro de Juegos">
              <Suspense fallback={<Loader />}>
                <GamesHub />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {currentView === 'blog' && (
          <div className="view-container" style={{ pointerEvents: 'auto' }}>
            <ErrorBoundary name="Blog / Manifiesto">
              <Suspense fallback={<Loader />}>
                <BlogSection />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {currentView === 'about' && (
          <div className="view-container about-view" style={{ maxWidth: '960px', margin: '0 auto', paddingTop: '100px', paddingBottom: '60px', pointerEvents: 'auto' }}>
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '40px', 
                alignItems: 'center',
                background: 'rgba(15, 15, 20, 0.85)',
                border: '1px solid rgba(212, 175, 55, 0.4)',
                borderRadius: '20px',
                padding: 'clamp(24px, 5vw, 48px)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(212,175,55,0.1)',
                backdropFilter: 'blur(15px)'
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                style={{ position: 'relative' }}
              >
                <img
                  src="/assets/naroa-portrait-DW8XfHYG.webp"
                  alt="Naroa Gutiérrez Gil"
                  style={{ 
                    width: '100%', 
                    borderRadius: '14px', 
                    border: '1px solid rgba(255,255,255,0.15)', 
                    boxShadow: '0 15px 35px rgba(0,0,0,0.9)',
                    display: 'block',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    e.currentTarget.src = '/assets/naroa-portrait-DW8XfHYG.jpg'
                  }}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
              >
                <h1 
                  style={{ 
                    fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', 
                    fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    lineHeight: 1.1,
                    margin: '0 0 8px 0',
                    color: '#FFFFFF'
                  }}
                >
                  AORAN / <span style={{ color: '#D4AF37' }}>NAROA</span>
                </h1>

                <p 
                  style={{ 
                    fontFamily: 'var(--font-mono, monospace)',
                    color: '#D4AF37', 
                    fontSize: '0.85rem', 
                    letterSpacing: '0.2em', 
                    margin: '0 0 28px 0',
                    textTransform: 'uppercase'
                  }}
                >
                  A NAROA LA ORAN A
                </p>

                <blockquote 
                  style={{ 
                    margin: '0 0 32px 0',
                    padding: '0 0 0 18px',
                    borderLeft: '2px solid #D4AF37',
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: 'clamp(1.05rem, 2.5vw, 1.25rem)',
                    lineHeight: 1.7,
                    fontStyle: 'italic',
                    fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)'
                  }}
                >
                  «Cada piedra que uso tiene millones de años.<br />
                  Cada retrato que pinto tiene la edad de quien lo mira.»
                </blockquote>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <a 
                    href="https://www.instagram.com/naroa_art/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={() => sound.playTick()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(212, 175, 55, 0.15)',
                      border: '1px solid #D4AF37',
                      color: '#D4AF37',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 0 15px rgba(212,175,55,0.2)'
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
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'rgba(255,255,255,0.8)',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#FFFFFF'
                      e.currentTarget.style.color = '#FFFFFF'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
                    }}
                  >
                    FACEBOOK ↗
                  </a>
                  <a 
                    href="#/encargos" 
                    onClick={() => sound.playTick()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'rgba(255,255,255,0.8)',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#D4AF37'
                      e.currentTarget.style.color = '#D4AF37'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
                    }}
                  >
                    ENCARGOS & CONTACTO ↗
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {!isStarted && (
          <div style={{ pointerEvents: 'auto', width: '100%', marginTop: 'auto' }}>
            <PremiumFooter />
          </div>
        )}
      </div>

      {/* Escena 3D - FPS Game Engine */}
      {isWebGLMounted && (
        <ErrorBoundary name="Galería 3D (Three.js WebGL)">
          <Suspense fallback={null}>
            <div style={{ 
              position: 'absolute', 
              inset: 0, 
              zIndex: 1,
              opacity: isSceneActive ? 1 : 0, 
              pointerEvents: isSceneActive ? 'auto' : 'none',
              transition: 'opacity 0.5s ease-in-out'
            }}>
              <Scene
                onInspectArtwork={handleInspect}
                active={isSceneActive}
                setInteractionPrompt={setInteractionPrompt}
                isStarted={isStarted}
                onPlayerMove={(pos, rot) => {
                  setPlayerPos(pos)
                  setPlayerRotation(rot)
                }}
              />
            </div>
          </Suspense>
        </ErrorBoundary>
      )}

      <ArtworkModal
        artwork={modalArtwork}
        currentIndex={modalArtwork ? ARTWORKS.findIndex((a) => a.id === modalArtwork.id) : 0}
        onClose={() => setModalArtwork(null)}
        onNavigate={(idx) => {
          setModalArtwork(ARTWORKS[idx])
        }}
      />
    </>
  )
}
