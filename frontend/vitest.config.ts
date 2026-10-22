import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Pruebas del frontend (Vitest + Testing Library). Configuración aparte de
// vite.config.ts para no cargar los polyfills ni el proxy del servidor de desarrollo.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
})
