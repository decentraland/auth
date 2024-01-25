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
            sourcemap: true
          }
        }
      : undefined)
  }
})
