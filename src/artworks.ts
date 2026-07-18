export const PORTAL = 'https://naroagutierrezgil.com'

export interface Artwork {
  url: string
  title: string
  href: string
}

// Las 8 obras de la sala 3D. href apunta a su página real en el portal;
// las dos de la serie Divinos no tienen página propia y van al índice /obra/.
export const ARTWORKS: Artwork[] = [
  { url: '/assets/marilyn-rocks--qPeLHxE.webp', title: 'Marilyn Rocks', href: `${PORTAL}/obra/marilyn-rocks/` },
  { url: '/assets/hq-amy-BRTriASV.webp', title: 'Amy Rocks', href: `${PORTAL}/obra/amy-rocks/` },
  { url: '/assets/hq-james-CjsTrO7r.webp', title: 'James Rocks', href: `${PORTAL}/obra/james-rocks/` },
  { url: '/assets/hq-johnny-5ueL8eU0.webp', title: 'Johnny Rocks', href: `${PORTAL}/obra/johnny-rocks/` },
  { url: '/assets/celia-cruz-cantinflowers-DO-SRKMB.webp', title: 'Asúcar (Celia Cruz)', href: `${PORTAL}/obra/asucar-celia-cruz/` },
  { url: '/assets/baroque-farrokh-mjg4ClA9.webp', title: 'Baroque Farrokh', href: `${PORTAL}/obra/baroque-farrokh/` },
  { url: '/assets/divinos-marilyn-By8KYPMI.webp', title: 'Divinos: Marilyn', href: `${PORTAL}/obra/` },
  { url: '/assets/divinos-johnny-gl9M1ZKj.webp', title: 'Divinos: Johnny', href: `${PORTAL}/obra/` },
]
