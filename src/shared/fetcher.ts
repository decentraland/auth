import type { IFetchComponent } from '@well-known-components/interfaces'

// Compose cancellation without requiring AbortSignal.any, which is newer than the browsers supported
// by the auth site. Listeners stay attached through body consumption and are removed on cancellation.
function combineSignals(signals: AbortSignal[]): AbortSignal | undefined {
  const unique = [...new Set(signals)]
  if (unique.length < 2) return unique[0]
  const controller = new AbortController()
  const listeners = new Map<AbortSignal, () => void>()
  const abort = (signal: AbortSignal) => {
    controller.abort(signal.reason)
    for (const [source, listener] of listeners) source.removeEventListener('abort', listener)
    listeners.clear()
  }
  for (const signal of unique) {
    if (signal.aborted) {
      abort(signal)
      break
    }
    const listener = () => abort(signal)
    listeners.set(signal, listener)
    signal.addEventListener('abort', listener, { once: true })
  }
  return controller.signal
}

/**
 * Wrapper for fetch that preserves the browser context.
 *
 * The @well-known-components/fetch-component package uses createFetchComponent()
 * which internally passes fetch as a direct reference (globalThis.fetch).
 * This causes fetch to lose its binding to the window object, resulting in
 * "TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation"
 * when executed in the browser.
 *
 * This wrapper solves the problem by maintaining the correct context.
 */
const createFetcher = (defaultFetcherOptions?: RequestInit & { timeout?: number }) => {
  return {
    fetch: async (url: string, init?: RequestInit) => {
      const { timeout, ...defaultOptions } = defaultFetcherOptions ?? {}
      // A per-request signal must not replace caller cancellation or the deadline. Keep the
      // composed signal attached to the response too, so cancellation also aborts body reads.
      const signals = [defaultOptions.signal, init?.signal, timeout ? AbortSignal.timeout(timeout) : undefined].filter(
        (signal): signal is AbortSignal => !!signal
      )
      const signal = combineSignals(signals)
      signal?.throwIfAborted()
      const response = await fetch(url, { ...defaultOptions, ...init, signal })

      // `dcl-catalyst-client` expects a `node-fetch` like Response that has `.buffer()`.
      // In the browser, Response only implements `.arrayBuffer()`.
      const responseWithBuffer = response as unknown as Response & { buffer?: () => Promise<Uint8Array> }

      if (typeof responseWithBuffer.buffer !== 'function') {
        let cached: Uint8Array | undefined

        responseWithBuffer.buffer = async () => {
          if (!cached) {
            cached = new Uint8Array(await response.arrayBuffer())
          }

          return cached
        }
      }

      return responseWithBuffer
    }
  } as unknown as IFetchComponent
}

const fetcher = createFetcher()

export { createFetcher, fetcher }
