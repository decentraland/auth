import { captureException } from '@sentry/react'
import { trackEvent } from './analytics'
import { handleError } from './errorHandler'

jest.mock('@sentry/react', () => ({
  captureException: jest.fn()
}))

jest.mock('./analytics', () => ({
  trackEvent: jest.fn()
}))

const mockCaptureException = captureException as jest.Mock

describe('handleError → captureException', () => {
  beforeEach(() => {
    mockCaptureException.mockClear()
  })

  describe('when the thrown value is a plain object with code and message (EIP-1193 style)', () => {
    it('should wrap it in an Error and preserve the original fields under extra', () => {
      const rpcLikeError = { code: 4900, message: 'Wallet disconnected', data: { foo: 'bar' } }

      handleError(rpcLikeError, 'connect', { skipTracking: true })

      expect(mockCaptureException).toHaveBeenCalledTimes(1)
      const [capturedError, options] = mockCaptureException.mock.calls[0]
      expect(capturedError).toBeInstanceOf(Error)
      expect(capturedError.message).toBe('Wallet disconnected')
      expect(options.extra).toEqual(
        expect.objectContaining({
          code: 4900,
          data: JSON.stringify({ foo: 'bar' })
        })
      )
    })
  })

  describe('when the thrown value is already an Error', () => {
    it('should pass it through unchanged', () => {
      const realError = new Error('boom')

      handleError(realError, 'context', { skipTracking: true })

      const [capturedError] = mockCaptureException.mock.calls[0]
      expect(capturedError).toBe(realError)
    })
  })

  describe('when the thrown value is a string', () => {
    it('should wrap it in a new Error', () => {
      handleError('something broke', 'context', { skipTracking: true })

      const [capturedError] = mockCaptureException.mock.calls[0]
      expect(capturedError).toBeInstanceOf(Error)
      expect(capturedError.message).toBe('something broke')
    })
  })

  describe('when the thrown value is a non-Error object without a message', () => {
    it('should still produce an Error and surface the shape under extra', () => {
      handleError({ code: -32603 }, 'context', { skipTracking: true })

      const [capturedError, options] = mockCaptureException.mock.calls[0]
      expect(capturedError).toBeInstanceOf(Error)
      expect(capturedError.message).toBe('Unknown error (non-Error thrown)')
      expect(options.extra).toEqual(expect.objectContaining({ code: -32603 }))
    })
  })

  describe('when the error has skipReporting=true', () => {
    it('should not call captureException', () => {
      const skippable = Object.assign(new Error('skip me'), { skipReporting: true })

      handleError(skippable, 'context', { skipTracking: true })

      expect(mockCaptureException).not.toHaveBeenCalled()
    })
  })

  describe('when caller passes sentryExtra', () => {
    it('should merge it on top of the normalised shape', () => {
      handleError({ code: 4900, message: 'disconnected' }, 'context', {
        skipTracking: true,
        sentryExtra: { url: 'https://decentraland.org/auth/login' }
      })

      const [, options] = mockCaptureException.mock.calls[0]
      expect(options.extra).toEqual(
        expect.objectContaining({
          code: 4900,
          url: 'https://decentraland.org/auth/login'
        })
      )
    })
  })
})

describe('handleError → expected wallet conditions', () => {
  const mockTrackEvent = trackEvent as jest.Mock

  beforeEach(() => {
    mockCaptureException.mockClear()
    mockTrackEvent.mockClear()
  })

  const expectedConditions: [string, unknown][] = [
    ['a locked wallet', Object.assign(new Error('There was an error unlocking your wallet.'), { name: 'ErrorUnlockingWallet' })],
    ['a wallet prompt already pending', { code: -32002, message: "Request of type 'wallet_requestPermissions' already pending" }],
    ['the WalletConnect modal being dismissed', new Error('User closed the modal without connecting')]
  ]

  it.each(expectedConditions)('should not report %s to Sentry', (_case, error) => {
    handleError(error, 'context')

    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it.each(expectedConditions)('should still track %s, since the login did fail for the user', (_case, error) => {
    handleError(error, 'context')

    expect(mockTrackEvent).toHaveBeenCalled()
  })

  it('should return the message so callers can still render it', () => {
    const message = handleError(new Error('User closed the modal without connecting'), 'context')

    expect(message).toBe('User closed the modal without connecting')
  })

  describe('and the failure is a genuine fault', () => {
    it('should still be reported', () => {
      handleError({ code: -32603, message: 'Internal error' }, 'context')

      expect(mockCaptureException).toHaveBeenCalledTimes(1)
    })
  })
})
