import { test, expect } from '@playwright/test'
import { injectMockWallet, injectPreviousConnection, mockApiRoutes, MOCK_WALLET } from '../helpers/setup'

const MARKETPLACE_URL = 'https://decentraland.org/marketplace'

/**
 * Defends the cached-session restore path against malformed / expired payloads
 * in localStorage. `connection-persistence.spec.ts` covers the happy SSO path;
 * these specs ensure a poisoned localStorage doesn't break the dapp UX.
 */
test.describe('Cached session: edge cases', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('decentraland-connect storage with malformed JSON → app falls back to login', async ({ context, page }) => {
    await context.addInitScript(() => {
      localStorage.setItem('decentraland-connect-storage-key', 'this is not json {')
    })
    await mockApiRoutes(page, { hasProfile: true })

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}`)

    // App must render the login page (or initiate auto-connect), NOT crash with
    // an unhandled JSON.parse error.
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.waitForTimeout(500)
    expect(errors).toEqual([])
  })

  test('expired SSO identity for connected wallet → purged on read, page works', async ({ context, page }) => {
    // Pre-populate the SSO key for MOCK_WALLET (the address the mock provider
    // returns) with an expired identity. `localStorageGetIdentity` rejects it
    // and clears it the first time the app tries to restore the session.
    const address = MOCK_WALLET.toLowerCase()
    await context.addInitScript(addr => {
      const expiredIdentity = {
        ephemeralIdentity: {
          address: '0x0000000000000000000000000000000000000002',
          publicKey: '0x' + '00'.repeat(64),
          privateKey: '0x' + '00'.repeat(32)
        },
        expiration: new Date(Date.now() - 60_000).toISOString(),
        authChain: []
      }
      localStorage.setItem(`single-sign-on-${addr}`, JSON.stringify(expiredIdentity))
    }, address)

    await injectPreviousConnection(context)
    await mockApiRoutes(page, { hasProfile: false })

    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const stillThere = await page.evaluate(addr => localStorage.getItem(`single-sign-on-${addr}`), address)
    expect(stillThere).toBeNull()
  })

  test('localStorage.setItem throws (quota exceeded simulation) → page does not crash', async ({ context, page }) => {
    await context.addInitScript(() => {
      const original = window.localStorage.setItem.bind(window.localStorage)
      let calls = 0
      window.localStorage.setItem = (key: string, value: string) => {
        calls += 1
        // Allow the first few writes (page init, mocks) then start throwing
        // to simulate quota exceeded mid-flow.
        if (calls > 10 && key.startsWith('decentraland-connect')) {
          throw new DOMException('QuotaExceededError', 'QuotaExceededError')
        }
        return original(key, value)
      }
    })
    await mockApiRoutes(page, { hasProfile: true })

    const pageErrors: string[] = []
    page.on('pageerror', e => pageErrors.push(e.message))

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // QuotaExceeded shouldn't crash the React tree — uncaught pageerror is the
    // failure signal. `decentraland-connect` writes are write-through, errors
    // in setItem should be caught/swallowed by the library.
    expect(pageErrors.filter(e => e.includes('QuotaExceededError'))).toEqual([])
  })
})
