/// <reference types="vitest" />
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standalone vite config for IDE / tooling. The Electron build runs through
// apps/electron-main/electron.vite.config.ts which sets the renderer root +
// alias. This config mirrors those settings so direct `vite build` (e.g. for
// browser-only previews) also works.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@contracts': resolve(__dirname, '../../packages/contracts/ts'),
      '@preload-types': resolve(__dirname, '../electron-main/preload/index.ts')
    }
  },
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    outDir: 'out',
    emptyOutDir: true
  },
  // Phase 2 plan 02-03: vitest config for renderer reducer + DOM tests.
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts']
  }
})
