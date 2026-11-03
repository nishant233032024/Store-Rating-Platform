import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// The browser always talks to the frontend origin (/api/...). Vite forwards
// those requests to the Express server, which keeps the auth cookie first-party
// during local development and avoids CORS entirely.
const API_TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:3001'

const proxy = {
  '/api': {
    target: API_TARGET,
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy,
  },
  preview: {
    port: 4173,
    proxy,
  },
  base: '/',
})
