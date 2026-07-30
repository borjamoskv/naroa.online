import { Suspense, lazy, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ARTWORKS, PORTAL, type Artwork } from './artworks'
import { ArtworkModal } from './components/ArtworkModal'

import { sound } from './utils/audio'

// Componentes estáticos
import { NavigationPill } from './components/NavigationPill'
import { HomeHero } from './components/HomeHero'
import { PremiumFooter } from './components/PremiumFooter'

// Vistas con Lazy Loading (Ultrathink Code-Splitting)
const Scene = lazy(() => import('./components/Scene'))
const GalleryGrid = lazy(() => import('./components/GalleryGrid').then(module => ({ default: module.GalleryGrid })))
const CommissionCalculator = lazy(() => import('./components/CommissionCalculator').then(module => ({ default: module.CommissionCalculator })))
const GamesHub = lazy(() => import('./components/GamesHub').then(module => ({ default: module.GamesHub })))
const BlogSection = lazy(() => import('./components/BlogSection').then(module => ({ default: module.BlogSection })))

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
  const [currentView, setCurrentView] = useState<'home' | '3d' | 'destacada' | 'encargos' | 'juegos' | 'about' | 'blog'>('home')
  const [current, setCurrent] = useState(0)
  const [targetIndex, setTargetIndex] = useState<number | null>(null)
  const [modalArtwork, setModalArtwork] = useState<Artwork | null>(null)
  const [audioActive, setAudioActive] = useState<boolean>(sound.isEnabled())
  const [isWebGLMounted, setIsWebGLMounted] = useState(false)

  // Ultrathink Deferred WebGL Mounting: 
  // Evitamos cargar y parsear Three.js durante el First Contentful Paint.
  useEffect(() => {
    const timer = setTimeout(() => setIsWebGLMounted(true), 800)
    return () => clearTimeout(timer)
  }, [])

  // Hash Navigation Handler
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      if (hash === '#/destacada' || hash === '#/galeria' || hash === '#/archivo') {
        setCurrentView('destacada')
      } else if (hash === '#/encargos' || hash === '#/contacto') {
        setCurrentView('encargos')
      } else if (hash === '#/juegos') {
        setCurrentView('juegos')
      } else if (hash === '#/blog') {
        setCurrentView('blog')
      } else if (hash === '#/sobre-mi' || hash === '#/about') {
        setCurrentView('about')
      } else if (hash === '#/3d') {
        setCurrentView('3d')
      } else if (hash.startsWith('#obra-')) {
        const slug = hash.replace('#obra-', '')
        const match = ARTWORKS.find(a => toSlug(a.title) === slug || a.slug === slug)
        if (match) setModalArtwork(match)
      } else {
        setCurrentView('home')
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (modalArtwork) {
      const slug = modalArtwork.slug || toSlug(modalArtwork.title)
      window.location.hash = `obra-${slug}`
    }
  }, [modalArtwork])

  const artwork = ARTWORKS[current]

  const handleNext = () => {
    sound.playTick()
    const next = (current + 1) % ARTWORKS.length
    setTargetIndex(next)
  }

  const handlePrev = () => {
    sound.playTick()
    const prev = (current - 1 + ARTWORKS.length) % ARTWORKS.length
    setTargetIndex(prev)
  }

  const handleSelectDot = (index: number) => {
    sound.playTick()
    setTargetIndex(index)
  }

  const handleInspect = (index: number) => {
    sound.playOpen()
    setModalArtwork(ARTWORKS[index])
  }

  const toggleAudio = () => {
    const newState = sound.toggleSound()
    setAudioActive(newState)
  }

  // Determinamos si Scene debe estar activo
  const isSceneActive = currentView === '3d' || currentView === 'destacada'

  return (
    <>
      <div className="ui-layer" style={{ pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto', width: '100%', zIndex: 50 }}>
          <NavigationPill currentView={currentView} audioActive={audioActive} toggleAudio={toggleAudio} />
        </div>

        {currentView === 'home' && <HomeHero />}

        {currentView === 'destacada' && (
          <div className="view-container" style={{ pointerEvents: 'auto' }}>
            <Suspense fallback={<Loader />}>
              <GalleryGrid onInspect={handleInspect} />
            </Suspense>
          </div>
        )}

        {currentView === '3d' && (
          <>
            <div className="ui-middle" style={{ pointerEvents: 'auto' }}>
              <motion.div
                className="headline premium-title"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <span className="premium-badge premium-badge--gold">HIPERREALISMO POP</span>
                <h1 style={{ fontSize: '2.5rem', marginTop: '1rem' }}>SALA 3D INMERSIVA</h1>
                <p className="premium-subtitle" style={{ margin: '1rem 0 2rem' }}>
                  Retratos que respiran en el espacio — acrílico, pizarra natural y mica mineral desde Bilbao.
                </p>
                <div className="headline-ctas" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <a href="#/encargos" className="premium-btn premium-btn--primary">
                    ⚡ ENCARGAR PIEZA ÚNICA
                  </a>
                  <span className="premium-subtitle" style={{ fontSize: '0.8rem', letterSpacing: '0.1em' }}>← TECLAS / ARRASTRAR 3D →</span>
                </div>
              </motion.div>
            </div>

            <div className="premium-caption-wrapper" role="region" aria-label="Navegación de obras" style={{ pointerEvents: 'auto' }}>
              <button className="premium-arrow" onClick={handlePrev} title="Obra anterior">‹</button>
              <div className="premium-caption">
                <div className="artwork-clickable" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className="premium-subtitle" style={{ fontFamily: 'monospace' }}>
                    {String(current + 1).padStart(2, '0')} / {String(ARTWORKS.length).padStart(2, '0')}
                  </span>
                  <button className="artwork-title-btn" onClick={() => handleInspect(current)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={artwork.id}
                        className="premium-title"
                        style={{ fontSize: '1.2rem', margin: 0 }}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                      >
                        {artwork.title}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                  <span className="premium-badge">{artwork.medium}</span>
                  <button
                    className="premium-btn"
                    style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}
                    onClick={() => handleInspect(current)}
                  >
                    INSPECCIONAR +
                  </button>
                </div>
              </div>
              <button className="premium-arrow" onClick={handleNext} title="Siguiente obra">›</button>
            </div>

            <div className="gallery-dots-bar brutal-dots" role="tablist" style={{ pointerEvents: 'auto' }}>
              {ARTWORKS.map((item, idx) => (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={idx === current}
                  className={`dot-item brutal-dot ${idx === current ? 'active' : ''}`}
                  onClick={() => handleSelectDot(idx)}
                  onMouseEnter={() => sound.playHover()}
                  title={`${item.title} (${idx + 1}/${ARTWORKS.length})`}
                />
              ))}
            </div>
          </>
        )}

        {currentView === 'encargos' && (
          <div className="view-container" style={{ pointerEvents: 'auto' }}>
            <Suspense fallback={<Loader />}>
              <CommissionCalculator />
            </Suspense>
          </div>
        )}

        {currentView === 'juegos' && (
          <div className="view-container" style={{ pointerEvents: 'auto' }}>
            <Suspense fallback={<Loader />}>
              <GamesHub />
            </Suspense>
          </div>
        )}

        {currentView === 'blog' && (
          <div className="view-container" style={{ pointerEvents: 'auto' }}>
            <Suspense fallback={<Loader />}>
              <BlogSection />
            </Suspense>
          </div>
        )}

        {currentView === 'about' && (
          <div className="view-container about-view" style={{ maxWidth: '1000px', margin: '0 auto', paddingTop: '100px', pointerEvents: 'auto' }}>
            <div className="premium-card about-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '40px', alignItems: 'center' }}>
              <motion.img
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                src="/assets/naroa-portrait-DW8XfHYG.jpg"
                alt="Naroa Gutiérrez Gil"
                style={{ width: '100%', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}
              />
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <span className="premium-badge premium-badge--gold">MANIFIESTO ARTÍSTICO</span>
                <h1 className="premium-title" style={{ fontSize: '2.8rem', marginTop: '1rem', lineHeight: '1.1' }}>
                  A O R A N / <span className="highlight-gold">N A R O A</span>
                </h1>
                <p className="premium-subtitle" style={{ color: '#D4AF37', fontWeight: 500, letterSpacing: '0.1em', marginTop: '0.5rem' }}>
                  A NAROA LA ORAN A
                </p>
                <p className="premium-subtitle" style={{ fontSize: '1.05rem', margin: '1.5rem 0 2rem' }}>
                  Artista visual en Bilbao especializada en hiperrealismo POP sobre pizarra natural y mica mineral.
                  Con más de 12.000 seguidores en su comunidad artística oficial. Cada piedra que uso tiene millones de años.
                  Cada retrato que pinto tiene la edad de quien lo mira.
                </p>
                <div className="about-links" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <a href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer" className="premium-btn premium-btn--primary">
                    📘 FACEBOOK ARTISTA (12K+ SEGUIDORES) ↗
                  </a>
                  <a href={PORTAL} target="_blank" rel="noopener noreferrer" className="premium-btn">
                    🌐 PORTAL OFICIAL: NAROAGUTIERREZGIL.COM ↗
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        <div style={{ pointerEvents: 'auto', width: '100%', marginTop: 'auto' }}>
          <PremiumFooter />
        </div>
      </div>

      {/* Escena 3D optimizada - Lazy Mounted */}
      {isWebGLMounted && (
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
              onCurrentChange={setCurrent}
              onInspectArtwork={handleInspect}
              targetIndex={targetIndex}
              active={isSceneActive}
            />
          </div>
        </Suspense>
      )}

      <ArtworkModal
        artwork={modalArtwork}
        currentIndex={modalArtwork ? ARTWORKS.findIndex((a) => a.id === modalArtwork.id) : 0}
        onClose={() => setModalArtwork(null)}
        onNavigate={(idx) => {
          setModalArtwork(ARTWORKS[idx])
          setTargetIndex(idx)
        }}
      />
    </>
  )
}
