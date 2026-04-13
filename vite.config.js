import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: {
    headers: {
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': "frame-ancestors 'self' https://digicollabo.com https://*.digicollabo.com https://*.thefusebase.app",
    },
  },
})
