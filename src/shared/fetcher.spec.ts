import { createFetcher } from './fetcher'

describe('when fetch has caller cancellation, per-request cancellation and a deadline', () => {
  let caller: AbortController
  let request: AbortController
  let deadline: AbortController
  let fetchSpy: jest.SpyInstance
  let timeoutSpy: jest.SpyInstance
  let pending: ReturnType<ReturnType<typeof createFetcher>['fetch']>

  beforeEach(() => {
    caller = new AbortController()
    request = new AbortController()
    deadline = new AbortController()
    timeoutSpy = jest.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(deadline.signal)
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
        })
    )
    pending = createFetcher({ signal: caller.signal, timeout: 10000 }).fetch('https://catalyst.example/profile', { signal: request.signal })
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    timeoutSpy.mockRestore()
  })

  it('should preserve the caller signal even when the request supplied another signal', async () => {
    caller.abort()
    await expect(pending).rejects.toBe(caller.signal.reason)
  })

  it('should honor the per-request signal', async () => {
    request.abort()
    await expect(pending).rejects.toBe(request.signal.reason)
  })

  it('should preserve the deadline even when cancellation signals were supplied', async () => {
    deadline.abort()
    await expect(pending).rejects.toBe(deadline.signal.reason)
  })
})
