import { Buffer } from 'buffer'

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process?: any
  }
}

// Some toolchains inject a partial `process` stub (only `env`) in the browser.
// `readable-stream` expects `process.browser` + `process.version` to exist.
// We patch the global object early to avoid runtime crashes inside node shims.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalAny = globalThis as any

if (globalAny.process) {
  globalAny.process.browser = true
  if (typeof globalAny.process.version !== 'string') {
    globalAny.process.version = ''
  }
  if (!globalAny.process.env) {
    globalAny.process.env = {}
  }
}

if (!globalAny.Buffer) {
  globalAny.Buffer = Buffer
}

if (!globalAny.global) {
  globalAny.global = globalAny
}
