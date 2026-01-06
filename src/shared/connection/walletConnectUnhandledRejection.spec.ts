// Rationale: WalletConnect can emit unhandled rejections for stale session/proposal state.
// This suite verifies we intercept those specific cases and cleanup WC storage keys without touching unrelated keys.
describe('walletConnectUnhandledRejection', () => {
  let addEventListenerSpy: jest.SpyInstance
  let unhandledRejectionHandler: ((event: any) => void) | undefined

  beforeEach(async () => {
    unhandledRejectionHandler = undefined

    addEventListenerSpy = jest.spyOn(window, 'addEventListener').mockImplementation((type: any, listener: any) => {
      if (type === 'unhandledrejection') {
        unhandledRejectionHandler = listener
      }
    })

    await import('./walletConnectUnhandledRejection')
  })

  afterEach(() => {
    addEventListenerSpy.mockRestore()
    jest.resetAllMocks()
    localStorage.clear()
  })

  describe('when the rejection reason matches a stale WalletConnect session error', () => {
    let event: { reason: unknown; preventDefault: jest.Mock; stopImmediatePropagation: jest.Mock }

    beforeEach(() => {
      localStorage.setItem('wc@2:clientId', 'x')
      localStorage.setItem('unrelated', 'y')
      event = {
        reason: new Error("No matching key. session topic doesn't exist: 123"),
        preventDefault: jest.fn(),
        stopImmediatePropagation: jest.fn()
      }

      unhandledRejectionHandler?.(event)
    })

    it('should prevent the default and reset the WalletConnect connection', () => {
      expect(event.preventDefault).toHaveBeenCalledTimes(1)
      expect(event.stopImmediatePropagation).toHaveBeenCalledTimes(1)
      expect(localStorage.getItem('wc@2:clientId')).toBeNull()
      expect(localStorage.getItem('unrelated')).toBe('y')
    })
  })

  describe('when the rejection reason does not match a stale WalletConnect session error', () => {
    let event: { reason: unknown; preventDefault: jest.Mock; stopImmediatePropagation: jest.Mock }

    beforeEach(() => {
      localStorage.setItem('wc@2:clientId', 'x')
      event = {
        reason: new Error('Some other error'),
        preventDefault: jest.fn(),
        stopImmediatePropagation: jest.fn()
      }

      unhandledRejectionHandler?.(event)
    })

    it('should not prevent the default or reset the WalletConnect connection', () => {
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(event.stopImmediatePropagation).not.toHaveBeenCalled()
      expect(localStorage.getItem('wc@2:clientId')).toBe('x')
    })
  })
})
