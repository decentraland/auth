import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  ...(command === 'build'
    ? {
        base: '/auth',
        optimizeDeps: {
          esbuildOptions: {
            // Node.js global to browser globalThis
            define: {
              global: 'globalThis'
            }
          },
          build: {
            commonjsOptions: {
              transformMixedEsModules: true
            },
            sourcemap: true
          }
        }
      }
    : undefined)
}))
