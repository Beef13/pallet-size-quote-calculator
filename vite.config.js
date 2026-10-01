import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/pallet-size-quote-calculator/',
  build: {
    rollupOptions: {
      // Landing page at the site root, the calculator at /app/
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html')
      }
    }
  }
})

