import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/index.ts')
        }
      },
      outDir: resolve(__dirname, 'out/main')
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'preload/index.ts')
        }
      },
      outDir: resolve(__dirname, 'out/preload')
    }
  },
  renderer: {
    root: resolve(__dirname, '../renderer'),
    resolve: {
      alias: {
        '@': resolve(__dirname, '../renderer/src'),
        '@contracts': resolve(__dirname, '../../packages/contracts/ts')
      }
    },
    build: {
      outDir: resolve(__dirname, '../renderer/out'),
      rollupOptions: {
        input: {
          index: resolve(__dirname, '../renderer/index.html')
        }
      }
    },
    plugins: [react()],
    server: {
      port: 5173
    }
  }
})
