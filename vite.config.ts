import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The workspace is reached through a C: -> D: junction. Preserving symlinks
// stops Vite/Rollup from realpath-resolving module ids onto a second drive
// letter, which otherwise breaks HTML emit (build) and dep optimization (dev).
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    preserveSymlinks: true,
  },
})
