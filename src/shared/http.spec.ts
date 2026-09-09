import { ResponseTooLargeError, readTextWithCap } from './http'

/** A response whose body streams the given chunks, recording whether it was cancelled. */
function streamingResponse(chunks: string[]): { response: Response; cancel: jest.Mock } {
  const encoder = new TextEncoder()
  const queue = chunks.map(chunk => encoder.encode(chunk))
  const cancel = jest.fn().mockResolvedValue(undefined)
  const reader = {
    read: jest
      .fn()
      .mockImplementation(() => Promise.resolve(queue.length ? { done: false, value: queue.shift() } : { done: true, value: undefined })),
    cancel
  }
  return { response: { body: { getReader: () => reader } } as unknown as Response, cancel }
}

describe('when reading a response body under a byte cap', () => {
  describe('and the body streams in chunks that stay under the cap', () => {
    let response: Response

    beforeEach(() => {
      response = streamingResponse(['{"na', 'me":"x"}']).response
    })

    it('should return the decoded text of every chunk', async () => {
      await expect(readTextWithCap(response, 64)).resolves.toBe('{"name":"x"}')
    })
  })

  describe('and the streamed body passes the cap', () => {
    let response: Response
    let cancel: jest.Mock

    beforeEach(() => {
      ;({ response, cancel } = streamingResponse(['x'.repeat(40), 'y'.repeat(40)]))
    })

    it('should stop reading with a ResponseTooLargeError', async () => {
      await expect(readTextWithCap(response, 64)).rejects.toBeInstanceOf(ResponseTooLargeError)
    })

    it('should cancel the stream so nothing more is downloaded', async () => {
      await readTextWithCap(response, 64).catch(() => undefined)
      expect(cancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('and a chunk splits a multi-byte character', () => {
    let response: Response

    beforeEach(() => {
      const bytes = new TextEncoder().encode('€')
      const reader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ done: false, value: bytes.slice(0, 1) })
          .mockResolvedValueOnce({ done: false, value: bytes.slice(1) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        cancel: jest.fn()
      }
      response = { body: { getReader: () => reader } } as unknown as Response
    })

    it('should decode it whole across the chunks', async () => {
      await expect(readTextWithCap(response, 64)).resolves.toBe('€')
    })
  })

  describe('and the body cannot be streamed', () => {
    let response: Response

    beforeEach(() => {
      response = { text: () => Promise.resolve('x'.repeat(100)) } as unknown as Response
    })

    it('should fall back to text() and still refuse a body over the cap', async () => {
      await expect(readTextWithCap(response, 64)).rejects.toBeInstanceOf(ResponseTooLargeError)
    })

    it('should return a body under the cap', async () => {
      await expect(readTextWithCap(response, 200)).resolves.toBe('x'.repeat(100))
    })
  })
})
