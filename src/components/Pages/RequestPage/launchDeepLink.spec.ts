import { isMobile } from '../LoginPage/utils'
import { launchDeepLink } from './utils'

jest.mock('../LoginPage/utils', () => ({
  isMobile: jest.fn()
}))

describe('when launching a deep link', () => {
  let deepLinkUrl: string

  beforeEach(() => {
    deepLinkUrl = 'decentraland://open?signin=anIdentityId'
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.resetAllMocks()
    document.body.innerHTML = ''
  })

  describe('and the browser window loses focus', () => {
    let launchPromise: Promise<boolean>

    beforeEach(() => {
      jest.mocked(isMobile).mockReturnValueOnce(false)
      launchPromise = launchDeepLink(deepLinkUrl)
      window.dispatchEvent(new Event('blur'))
    })

    it('should report that the application was launched', async () => {
      await expect(launchPromise).resolves.toBe(true)
    })

    it('should remove the deep-link iframe', async () => {
      await launchPromise
      expect(document.querySelector(`iframe[src="${deepLinkUrl}"]`)).not.toBeInTheDocument()
    })
  })

  describe('and the page becomes hidden', () => {
    let launchPromise: Promise<boolean>
    let originalVisibilityState: PropertyDescriptor | undefined

    beforeEach(() => {
      originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState')
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      jest.mocked(isMobile).mockReturnValueOnce(false)
      launchPromise = launchDeepLink(deepLinkUrl)
      document.dispatchEvent(new Event('visibilitychange'))
    })

    afterEach(() => {
      if (originalVisibilityState) {
        Object.defineProperty(document, 'visibilityState', originalVisibilityState)
      } else {
        delete (document as unknown as { visibilityState?: DocumentVisibilityState }).visibilityState
      }
    })

    it('should report that the application was launched', async () => {
      await expect(launchPromise).resolves.toBe(true)
    })
  })

  describe('and the page is unloaded', () => {
    let launchPromise: Promise<boolean>

    beforeEach(() => {
      jest.mocked(isMobile).mockReturnValueOnce(false)
      launchPromise = launchDeepLink(deepLinkUrl)
      window.dispatchEvent(new Event('pagehide'))
    })

    it('should report that the application was launched', async () => {
      await expect(launchPromise).resolves.toBe(true)
    })
  })

  describe('and no application-launch signal is received', () => {
    let launchPromise: Promise<boolean>

    beforeEach(() => {
      jest.useFakeTimers()
      jest.mocked(isMobile).mockReturnValueOnce(false)
      launchPromise = launchDeepLink(deepLinkUrl)
      jest.advanceTimersByTime(5000)
    })

    it('should report that the application was not launched', async () => {
      await expect(launchPromise).resolves.toBe(false)
    })

    it('should remove the deep-link iframe', async () => {
      await launchPromise
      expect(document.querySelector(`iframe[src="${deepLinkUrl}"]`)).not.toBeInTheDocument()
    })
  })

  describe('and the browser is running on mobile', () => {
    let launchPromise: Promise<boolean>
    let originalLocation: Location

    beforeEach(() => {
      originalLocation = window.location
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, href: '' }
      })
      jest.mocked(isMobile).mockReturnValueOnce(true)
      launchPromise = launchDeepLink(deepLinkUrl)
    })

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation
      })
    })

    it('should navigate directly to the deep link', () => {
      expect(window.location.href).toBe(deepLinkUrl)
    })

    it('should report that the application was launched', async () => {
      await expect(launchPromise).resolves.toBe(true)
    })
  })
})
