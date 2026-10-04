import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev-server proxy for /api. This keeps the browser on a single origin in
  // development, so the session cookie is first-party and CORS is never
  // involved. Used when VITE_API_URL is left unset; when it is set, requests go
  // straight to that origin instead.
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})