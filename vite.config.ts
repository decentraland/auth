import react from '@vitejs/plugin-react-swc'
import { defineConfig, loadEnv } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { federation } from '@module-federation/vite'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const envVariables = loadEnv(mode, process.cwd())

  return {
    plugins: [
      react(),
      // The catalyst client requires node polyfills to work in the browser.
      nodePolyfills(),
      federation({
        name: 'auth',
        filename: 'remoteEntry.js',
        manifest: true,
        dts: false,
        exposes: {
          './App': './src/MFApp.tsx'
        },
        shared: {
          // Core React
          react: { singleton: true },
          'react-dom': { singleton: true },
          // NOTE: react-router-dom is NOT shared - auth uses v6, other remotes use v5
          // NOTE: ethers is NOT shared - auth uses v6, other remotes use v5
          // NOTE: @sentry/react is NOT shared - auth uses v9, other remotes use v7
          // Decentraland UI
          'decentraland-ui': { singleton: true },
          'decentraland-ui2': { singleton: true },
          'semantic-ui-css': { singleton: true },
          // Decentraland core libraries
          'decentraland-connect': { singleton: true },
          'decentraland-transactions': { singleton: true },
          'decentraland-crypto-fetch': { singleton: true },
          '@dcl/single-sign-on-client': { singleton: true },
          '@dcl/crypto': { singleton: true },
          'dcl-catalyst-client': { singleton: true },
          // Large shared libraries
          thirdweb: { singleton: true },
          'lottie-react': { singleton: true },
          // Utilities
          classnames: { singleton: true },
        }
      })
    ],
    server: {
      port: 3004,
      origin: 'http://localhost:3004'
    },
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
            target: 'chrome89',
            commonjsOptions: {
              transformMixedEsModules: true
            },
            // Disable sourcemaps in production to reduce memory usage during build
            sourcemap: false,
            // Increase chunk size warning limit (thirdweb is large)
            chunkSizeWarningLimit: 2000
          }
        }
      : undefined)
  }
})
