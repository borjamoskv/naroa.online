export function PremiumFooter() {
  return (
    <footer className="premium-footer">
      <div className="premium-footer-left">
        <span>© 2026 NAROA GUTIÉRREZ GIL · BILBAO</span>
        <a href="mailto:naroa@naroagutierrezgil.com" className="premium-footer-link">
          naroa@naroagutierrezgil.com
        </a>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
        <a
          href="https://www.facebook.com/naroa.artista.plastica"
          target="_blank"
          rel="noopener noreferrer"
          className="premium-footer-link"
        >
          Facebook
        </a>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
        <a
          href="https://www.instagram.com/naroa_art/"
          target="_blank"
          rel="noopener noreferrer"
          className="premium-footer-link"
        >
          Instagram
        </a>
      </div>
      <div className="coordinates">KOBETAMENDI // 43.2630° N, 2.9350° W</div>
    </footer>
  )
}
