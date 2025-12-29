import type { IFetchComponent } from '@well-known-components/interfaces'

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
export const fetcher = {
  fetch: async (url: string, init?: RequestInit) => {
    const response = await fetch(url, init)

    // dcl-catalyst-client expects a `node-fetch`-like Response that has `.buffer()`.
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
