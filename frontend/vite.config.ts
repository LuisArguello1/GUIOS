import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
export default defineConfig(({ mode }) => ({
  define: {
    __BUNDLED_DEV__: 'false',
  },
  base: mode === 'production' ? '/static/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['stream', 'util', 'buffer'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      overrides: {
        fs: 'oxc',
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    open: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8050',
        changeOrigin: true,
        secure: false,
        timeout: 180000,
        proxyTimeout: 180000,
      },
      '/media': {
        target: 'http://127.0.0.1:8050',
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: 'http://127.0.0.1:8050',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      // Force victory-vendor to use ESM modules instead of CJS transpiled code.
      // The CJS version (lib-vendor/) has variable naming patterns that clash
      // with Rollup's minifier when bundled across chunks, causing
      // "n is not a function" errors in production.
      'victory-vendor/d3-array': path.resolve(
        __dirname,
        'node_modules/victory-vendor/es/d3-array.js'
      ),
      'victory-vendor/d3-scale': path.resolve(
        __dirname,
        'node_modules/victory-vendor/es/d3-scale.js'
      ),
      'victory-vendor/d3-shape': path.resolve(
        __dirname,
        'node_modules/victory-vendor/es/d3-shape.js'
      ),
      'victory-vendor/d3-interpolate': path.resolve(
        __dirname,
        'node_modules/victory-vendor/es/d3-interpolate.js'
      ),
      'victory-vendor/d3-time': path.resolve(
        __dirname,
        'node_modules/victory-vendor/es/d3-time.js'
      ),
      'victory-vendor/d3-timer': path.resolve(
        __dirname,
        'node_modules/victory-vendor/es/d3-timer.js'
      ),
      'victory-vendor/d3-ease': path.resolve(
        __dirname,
        'node_modules/victory-vendor/es/d3-ease.js'
      ),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Isolate recharts and d3 deps in their own chunk to prevent
          // variable name collisions with other chunks during minification
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/victory-vendor') ||
            id.includes('node_modules/d3-array') ||
            id.includes('node_modules/d3-scale') ||
            id.includes('node_modules/d3-shape') ||
            id.includes('node_modules/d3-interpolate') ||
            id.includes('node_modules/d3-time') ||
            id.includes('node_modules/d3-timer') ||
            id.includes('node_modules/d3-ease') ||
            id.includes('node_modules/d3-color') ||
            id.includes('node_modules/d3-format') ||
            id.includes('node_modules/d3-path')
          ) {
            return 'recharts';
          }
          if (id.includes('node_modules/three')) {
            return 'three-vendor';
          }
          if (id.includes('node_modules/xlsx')) {
            return 'xlsx-vendor';
          }
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) {
            return 'motion-vendor';
          }
          if (id.includes('node_modules/@tiptap') || id.includes('node_modules/prosemirror')) {
            return 'editor-vendor';
          }
        },
      },
    },
  },
}))
