import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// El recuento de obras del index.html no se escribe a mano: sale de las mismas
// fuentes que el catálogo público (catalogo.json + obras de vaivenes.json).
function catalogueCount(): number {
  const read = (name: string) => JSON.parse(readFileSync(new URL(`./classic/data/${name}.json`, import.meta.url), 'utf8'))
  const slugs = new Set<string>(read('catalogo').projects.map((p: { slug: string }) => p.slug))
  for (const image of read('vaivenes').images as { slug?: string; work_slug?: string }[]) {
    const slug = image.work_slug ?? image.slug
    if (slug) slugs.add(slug)
  }
  if (!slugs.size) throw new Error('El catálogo está vacío: no hay recuento que publicar')
  return slugs.size
}

function catalogueCountPlugin(): Plugin {
  return {
    name: 'naroa-catalogue-count',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('%OBRAS_TOTAL%', String(catalogueCount())),
    },
  }
}

// Configuración optimizada de Vite con manualChunks function para Rolldown/Rollup
export default defineConfig({
  base: './',
  plugins: [react(), catalogueCountPlugin()],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/') || id.includes('/node_modules/three-stdlib/') || id.includes('/node_modules/maath/')) return 'three-core';
          if (id.includes('/node_modules/@react-three/')) return 'react-three';
          if (id.includes('/node_modules/framer-motion/')) return 'framer-motion';
        }
      }
    }
  }
})
