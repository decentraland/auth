/** The body passed the byte cap; told apart from a read that failed for another reason (a timeout, a reset). */
class ResponseTooLargeError extends Error {
  constructor(detail: string) {
    super(`Body is too large (${detail})`)
    this.name = 'ResponseTooLargeError'
  }
}

/**
 * Reads a response body as text without buffering more than `maxBytes`: the stream is cancelled the moment
 * the cap is passed, so a host cannot make the page download an arbitrary body. Falls back to `text()` with
 * the same cap where the body cannot be streamed.
 */
async function readTextWithCap(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader?.()
  if (!reader) {
    const text = await response.text()
    if (text.length > maxBytes) {
      throw new ResponseTooLargeError(`${text.length} characters`)
    }
    return text
  }
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new ResponseTooLargeError(`over ${maxBytes} bytes`)
    }
    chunks.push(decoder.decode(value, { stream: true }))
  }
  chunks.push(decoder.decode())
  return chunks.join('')
}

export { ResponseTooLargeError, readTextWithCap }
