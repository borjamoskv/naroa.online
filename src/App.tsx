import { Suspense, lazy, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ARTWORKS, PORTAL, type Artwork } from './artworks'
import { ArtworkModal } from './components/ArtworkModal'
import { CommissionCalculator } from './components/CommissionCalculator'
import { GamesHub } from './components/GamesHub'
import { GalleryGrid } from './components/GalleryGrid'
import { BlogSection } from './components/BlogSection'
import { sound } from './utils/audio'

const toSlug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const Scene = lazy(() => import('./components/Scene'))

function Loader() {
  return (
    <div className="loader">
      <div className="spinner"></div>
      <div className="loader-text">MATERIALIZANDO PIZARRA Y MICA...</div>
    </div>
  )
}

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | '3d' | 'destacada' | 'encargos' | 'juegos' | 'about' | 'blog'>('home')
  const [current, setCurrent] = useState(0)
  const [targetIndex, setTargetIndex] = useState<number | null>(null)
  const [modalArtwork, setModalArtwork] = useState<Artwork | null>(null)
  const [audioActive, setAudioActive] = useState<boolean>(sound.isEnabled())

  // Hash Navigation Handler
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      if (hash === '#/destacada' || hash === '#/galeria') {
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

  return (
    <>
      <div className="ui-layer">
        {/* Cabecera Flotante Premium */}
        <motion.header
          className="header premium-header"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
        >
          <a href="#/" className="premium-logo" onClick={() => { sound.playTick(); window.location.hash = '#/'; }}>
            N
          </a>

          <nav className="nav premium-nav">
            <a
              href="#/"
              className={currentView === 'home' ? 'active' : ''}
              onClick={() => sound.playTick()}
            >
              Home
            </a>
            <a
              href="#/destacada"
              className={currentView === 'destacada' ? 'active' : ''}
              onClick={() => sound.playTick()}
            >
              Obra
            </a>
            <a
              href="#/sobre-mi"
              className={currentView === 'about' ? 'active' : ''}
              onClick={() => sound.playTick()}
            >
              Sobre mi
            </a>
            <a
              href="#/blog"
              className={currentView === 'blog' ? 'active' : ''}
              onClick={() => sound.playTick()}
            >
              Blog
            </a>
            <a
              href="#/encargos"
              className={`premium-btn-contact ${currentView === 'encargos' ? 'active' : ''}`}
              onClick={() => sound.playTick()}
            >
              CONTACTO
            </a>
          </nav>

          <button
            className={`audio-btn premium-audio-btn ${audioActive ? 'active' : ''}`}
            onClick={toggleAudio}
            title={audioActive ? 'Desactivar audio FX' : 'Activar audio FX'}
          >
            <span className="audio-equalizer">
              <span className="eq-bar bar-1"></span>
              <span className="eq-bar bar-2"></span>
              <span className="eq-bar bar-3"></span>
            </span>
          </button>
        </motion.header>

        {/* VISTA 1: HOME (Premium Layout) */}
        {currentView === 'home' && (
          <div className="view-container premium-home-view">
            <div className="premium-home-split">
              
              {/* Mitad Izquierda (Imagen + Etiqueta de Técnica) */}
              <div className="premium-home-left">
                <div className="premium-hero-img-wrapper">
                  <div className="premium-eco-studio">Eco Studio</div>
                  <img
                    src="/assets/marilyn-rocks--qPeLHxE.webp"
                    alt="Marilyn Rocks — Naroa Gutiérrez Gil"
                    className="premium-hero-img"
                  />
                  <div className="premium-technique-badge">
                    <span className="badge-label">TÉCNICA</span>
                    <span className="badge-value">ÓLEO · ACRÍLICO · PIZARRA</span>
                  </div>
                </div>
              </div>

              {/* Mitad Derecha (Tipografía Fina + CTA) */}
              <div className="premium-home-right">
                
                <div className="premium-top-meta">
                  <div className="premium-pill-outline">ARTISTA VISUAL</div>
                  <div className="premium-meta-info">
                    <span className="meta-label">COLECCIÓN</span>
                    <span className="meta-value">40+ OBRAS ORIGINALES</span>
                  </div>
                </div>

                <div className="premium-center-content">
                  <h1 className="premium-main-title">
                    HIPERREALISMO POP · MIXED<br/>MEDIA
                  </h1>
                </div>

                <div className="premium-bottom-cta">
                  <a href="#/destacada" className="premium-cta-btn" onClick={() => sound.playTick()}>
                    EXPLORAR OBRA ↗
                  </a>
                </div>

                <div className="premium-scroll-indicator">
                  <span className="scroll-text">SCROLL</span>
                  <span className="scroll-dot"></span>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: OBRA / GALERÍA MASIVA (Rejilla completa como naroa.online) */}
        {currentView === 'destacada' && (
          <div className="view-container">
            <GalleryGrid onInspect={handleInspect} />
          </div>
        )}

        {/* VISTA 3: EXPOSICIÓN 3D */}
        {currentView === '3d' && (
          <>
            <div className="ui-middle">
              <motion.div
                className="headline brutal-headline"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <span className="brutal-badge brutal-badge--yellow">HIPERREALISMO POP</span>
                <h1>SALA 3D INMERSIVA</h1>
                <p>
                  Retratos que respiran en el espacio — acrílico, pizarra natural y mica mineral desde Bilbao.
                </p>
                <div className="headline-ctas">
                  <a href="#/encargos" className="brutal-cta-btn brutal-cta-btn--whatsapp">
                    ⚡ ENCARGAR PIEZA ÚNICA
                  </a>
                  <span className="hint-text">← TECLAS / ARRASTRAR 3D →</span>
                </div>
              </motion.div>
            </div>

            {/* Selector de Obras en la Escena 3D */}
            <div className="artwork-caption-wrapper brutal-caption-wrapper" role="region" aria-label="Navegación de obras">
              <button className="caption-arrow brutal-arrow" onClick={handlePrev} title="Obra anterior">
                ‹
              </button>

              <div className="artwork-caption brutal-caption">
                <div className="artwork-clickable">
                  <span className="artwork-index brutal-index">
                    {String(current + 1).padStart(2, '0')} / {String(ARTWORKS.length).padStart(2, '0')}
                  </span>
                  <button className="artwork-title-btn" onClick={() => handleInspect(current)}>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={artwork.id}
                        className="artwork-title brutal-artwork-title"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                      >
                        {artwork.title}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                  <span className="artwork-medium-badge brutal-badge">{artwork.medium}</span>
                  <button
                    className="artwork-cta-btn brutal-btn"
                    onClick={() => handleInspect(current)}
                  >
                    INSPECCIONAR +
                  </button>
                </div>
              </div>

              <button className="caption-arrow brutal-arrow" onClick={handleNext} title="Siguiente obra">
                ›
              </button>
            </div>

            {/* Dots Direct Navigation */}
            <div className="gallery-dots-bar brutal-dots" role="tablist">
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

        {/* VISTA 4: ENCARGOS & CONTACTO */}
        {currentView === 'encargos' && (
          <div className="view-container">
            <CommissionCalculator />
          </div>
        )}

        {/* VISTA 5: SALA DE JUEGOS */}
        {currentView === 'juegos' && (
          <div className="view-container">
            <GamesHub />
          </div>
        )}

        {/* VISTA 6: BLOG (WORDPRESS LIVE SYNC) */}
        {currentView === 'blog' && (
          <div className="view-container">
            <BlogSection />
          </div>
        )}

        {/* VISTA 7: SOBRE MÍ / MANIFIESTO */}
        {currentView === 'about' && (
          <div className="view-container brutal-container about-view">
            <div className="brutal-card about-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '28px', alignItems: 'center' }}>
              <img
                src="/assets/naroa-portrait-DW8XfHYG.jpg"
                alt="Naroa Gutiérrez Gil"
                style={{ width: '100%', borderRadius: '4px', border: '3px solid #000', boxShadow: '5px 5px 0px var(--brutal-yellow)' }}
              />
              <div>
                <span className="brutal-badge brutal-badge--pink">MANIFIESTO ARTÍSTICO</span>
                <h1 className="brutal-title">
                  A O R A N / <span className="highlight-yellow">N A R O A</span>
                </h1>
                <p className="about-subtitle" style={{ color: 'var(--brutal-cyan)', fontWeight: 700, margin: '8px 0' }}>
                  A NAROA LA ORAN A
                </p>
                <p className="about-lead" style={{ lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.9)' }}>
                  Artista visual en Bilbao especializada en hiperrealismo POP sobre pizarra natural y mica mineral.
                  Con más de 12.000 seguidores en su comunidad artística oficial. Cada piedra que uso tiene millones de años.
                  Cada retrato que pinto tiene la edad de quien lo mira.
                </p>
                <div className="about-links" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <a
                    href="https://www.facebook.com/naroa.artista.plastica"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="brutal-cta-btn brutal-cta-btn--email"
                  >
                    📘 FACEBOOK ARTISTA (12K+ SEGUIDORES) ↗
                  </a>
                  <a
                    href={PORTAL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="brutal-cta-btn"
                  >
                    🌐 PORTAL OFICIAL: NAROAGUTIERREZGIL.COM ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Brutalista */}
        <footer className="footer brutal-footer">
          <div className="footer-left">
            <span>© 2026 NAROA GUTIÉRREZ GIL · BILBAO</span>
            <a href="mailto:naroa@naroa.eu" className="footer-link">naroa@naroa.eu</a>
          </div>
          <div className="coordinates">KOBETAMENDI // 43.2630° N, 2.9350° W</div>
        </footer>
      </div>

      {/* Escena Three.js renderizada de fondo para la vista 3D */}
      <Suspense fallback={<Loader />}>
        <Scene
          onCurrentChange={setCurrent}
          onInspectArtwork={handleInspect}
          targetIndex={targetIndex}
        />
      </Suspense>

      {/* Modal de Inspección */}
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
