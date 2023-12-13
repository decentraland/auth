import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const envVariables = loadEnv(mode, process.cwd())

  return {
    plugins: [react()],
    ...(command === 'build'
      ? {
          base: envVariables.VITE_BASE_URL,
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
  }
})
