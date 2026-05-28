import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Proxy usado apenas em desenvolvimento local (docker-compose)
    proxy: {
      '/api': { target: 'http://backend:8000', changeOrigin: true },
      '/uploads': { target: 'http://backend:8000', changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000
  }
})
