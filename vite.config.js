import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import copyEditor from './tools/copy-editor/plugin.js'

// https://vite.dev/config/
export default defineConfig({
  // The copy editor (`npm run editor`) only exists while developing; it is never built or deployed
  plugins: [react(), copyEditor()],
  base: process.env.BASE_PATH || '/pallet-size-quote-calculator/',
  build: {
    rollupOptions: {
      // Landing page at the site root, the calculator at /app/, legal pages at /terms/ and /privacy/
      input: {
        main: resolve(__dirname, 'index.html'),
        // A second landing page layout, kept beside the first for comparison
        v2: resolve(__dirname, 'v2/index.html'),
        app: resolve(__dirname, 'app/index.html'),
        terms: resolve(__dirname, 'terms/index.html'),
        privacy: resolve(__dirname, 'privacy/index.html')
      }
    }
  }
})

