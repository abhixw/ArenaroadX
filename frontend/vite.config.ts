import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Source shared between this app and ../admin -- see ../packages/shared. Not an npm
      // package (no build step, no node_modules symlink): Vite/esbuild transpile these
      // .tsx files directly, same as local `@/*` source.
      '@shared': path.resolve(import.meta.dirname, '../packages/shared/src'),
    },
  },
  server: {
    fs: {
      // Vite's dev server otherwise refuses to serve files outside this project's own
      // root -- packages/shared lives one level up, at the repo root.
      allow: [path.resolve(import.meta.dirname, '..')],
    },
  },
})
