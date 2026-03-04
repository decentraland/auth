import react from '@vitejs/plugin-react-swc'
import { defineConfig, loadEnv } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const envVariables = loadEnv(mode, process.cwd())

  return {
    plugins: [
      react(),
      // The catalyst client requires node polyfills to work in the browser.
      nodePolyfills()
    ],
    define: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'process.env': {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        VITE_REACT_APP_DCL_DEFAULT_ENV: envVariables.VITE_REACT_APP_DCL_DEFAULT_ENV
      }
    },
    ...(command === 'build'
      ? {
          base: envVariables.VITE_BASE_URL,
          build: {
            commonjsOptions: {
              transformMixedEsModules: true
            },
            // Disable sourcemaps in production to reduce memory usage during build
            sourcemap: false,
            // Increase chunk size warning limit (thirdweb is large)
            chunkSizeWarningLimit: 2000,
            rollupOptions: {
              output: {
                // Split large dependencies into separate chunks to reduce memory pressure
                manualChunks: {
                  thirdweb: ['thirdweb'],
                  vendor: ['react', 'react-dom', 'react-router-dom'],
                  ui: ['decentraland-ui2']
                }
              }
            }
          }
        }
      : undefined)
  }
})
