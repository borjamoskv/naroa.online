import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuración optimizada de Vite con manualChunks function para Rolldown/Rollup
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'three']
        }
      }
    }
  }
})
