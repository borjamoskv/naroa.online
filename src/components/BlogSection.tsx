import { useEffect, useState } from 'react'
import { sound } from '../utils/audio'

interface Post {
  id: number
  title: string
  URL: string
  date: string
  excerpt: string
  featured_image?: string
}

const FALLBACK_POSTS: Post[] = [
  {
    id: 1,
    title: 'Exposición Hiperrealismo POP en Bilbao',
    URL: 'https://naroagutierrez.wordpress.com/',
    date: '2026-06-15',
    excerpt: 'Reflexiones sobre el proceso de pintar Amy Winehouse y Marilyn Monroe sobre placas de pizarra natural con mica mineral.'
  },
  {
    id: 2,
    title: 'El Secreto de la Mica Mineral en el Arte',
    URL: 'https://naroagutierrez.wordpress.com/',
    date: '2026-05-20',
    excerpt: 'Cómo los destellos naturales del cuarzo y la mica transforman la luz en los retratos según la posición del espectador.'
  },
  {
    id: 3,
    title: 'Serie DiviNos & Tributos Musicales',
    URL: 'https://naroagutierrez.wordpress.com/',
    date: '2026-04-10',
    excerpt: 'Un recorrido por las piezas dedicadas a Freddie Mercury, Celia Cruz, Camarón de la Isla y Johnny Depp.'
  }
]

export function BlogSection() {
  const [posts, setPosts] = useState<Post[]>(FALLBACK_POSTS)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    fetch('https://public-api.wordpress.com/rest/v1.1/sites/naroagutierrez.wordpress.com/posts/?number=6')
      .then(res => res.json())
      .then(data => {
        if (data && data.posts && data.posts.length > 0) {
          setPosts(data.posts)
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  return (
    <div className="blog-page" style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 20px 80px' }}>
      
      {/* Ticker Marquesina Mineral */}
      <div 
        style={{
          background: 'rgba(10, 10, 14, 0.85)',
          borderTop: '1px solid rgba(212, 175, 55, 0.4)',
          borderBottom: '1px solid rgba(212, 175, 55, 0.4)',
          padding: '10px 0',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          marginBottom: '40px',
          boxShadow: '0 0 25px rgba(212, 175, 55, 0.1)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div 
          style={{
            display: 'inline-block',
            animation: 'marquee 25s linear infinite',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            letterSpacing: '0.2em',
            color: '#D4AF37',
            textTransform: 'uppercase'
          }}
        >
          ✦ WORDPRESS LIVE SYNC · NAROAGUTIERREZ.WORDPRESS.COM · DIARIO DE ARTE · REFLEXIONES DE NAROA GUTIÉRREZ GIL ✦
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          ✦ WORDPRESS LIVE SYNC · NAROAGUTIERREZ.WORDPRESS.COM · DIARIO DE ARTE · REFLEXIONES DE NAROA GUTIÉRREZ GIL ✦
        </div>
      </div>

      <header style={{ textAlign: 'center', marginBottom: '50px' }}>
        <span 
          style={{
            display: 'inline-block',
            background: 'rgba(212, 175, 55, 0.15)',
            border: '1px solid #D4AF37',
            color: '#D4AF37',
            padding: '6px 16px',
            borderRadius: '30px',
            fontSize: '0.8rem',
            fontWeight: 700,
            fontFamily: 'monospace',
            letterSpacing: '0.15em',
            marginBottom: '16px'
          }}
        >
          DIARIO DE TALLER & EXPOSICIONES
        </span>
        <h1 
          style={{ 
            fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', 
            fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
            color: '#FFFFFF',
            margin: '0 0 16px 0',
            lineHeight: 1.1
          }}
        >
          REFLEXIONES Y <span style={{ color: '#D4AF37' }}>PROCESOS</span>
        </h1>
        <p style={{ maxWidth: '650px', margin: '0 auto', color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem', lineHeight: 1.6 }}>
          Textos curatoriales, reflexiones en el taller de Bilbao y crónicas de exposiciones sincronizadas en tiempo real.
        </p>
      </header>

      {loading && (
        <div style={{ textAlign: 'center', color: '#D4AF37', fontFamily: 'monospace', fontSize: '0.85rem', margin: '30px 0' }}>
          CARGANDO BITÁCORA EN TIEMPO REAL DESDE WORDPRESS...
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
        {posts.map(post => (
          <article 
            key={post.id} 
            style={{
              background: 'rgba(15, 15, 20, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#D4AF37'
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 175, 55, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.6)'
            }}
          >
            <div>
              <span 
                style={{
                  display: 'inline-block',
                  color: '#D4AF37',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  marginBottom: '12px'
                }}
              >
                {new Date(post.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              <h2 
                style={{ 
                  fontSize: '1.35rem', 
                  color: '#FFFFFF', 
                  fontFamily: 'var(--font-serif, "Cinzel", Georgia, serif)',
                  fontWeight: 700,
                  lineHeight: 1.3,
                  margin: '0 0 14px 0'
                }}
              >
                {post.title}
              </h2>
              <div
                style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 20px 0' }}
                dangerouslySetInnerHTML={{ __html: post.excerpt }}
              />
            </div>

            <a
              href={post.URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => sound.playTick()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(212, 175, 55, 0.12)',
                border: '1px solid #D4AF37',
                color: '#D4AF37',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                marginTop: 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#D4AF37'
                e.currentTarget.style.color = '#000000'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(212, 175, 55, 0.12)'
                e.currentTarget.style.color = '#D4AF37'
              }}
            >
              LEER ARTÍCULO EN WORDPRESS ↗
            </a>
          </article>
        ))}
      </div>
    </div>
  )
}
