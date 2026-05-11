import { test, expect } from '@playwright/test'
import { injectMockWallet, mockApiRoutes } from '../helpers/setup'

const MARKETPLACE_URL = 'https://decentraland.org/marketplace'

/**
 * `/auth/callback` is reached after a social-OAuth redirect (Google, Discord,
 * Apple, X). Existing `web-social-flow.spec.ts` covers a handful of error
 * routes; this spec fills the remaining holes — direct navigation to callback
 * without preceding state, and the no-redirectTo guard.
 */
test.describe('Social callback: edge cases', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectMockWallet(context)
    await mockApiRoutes(page, { hasProfile: true })
    // Block Magic SDK network calls so getRedirectResult fails fast rather
    // than hanging on a real OAuth round-trip.
    await page.route('**/magic.link/**', route => route.abort())
    await page.route('**/api.toaster.magic.link/**', route => route.abort())
  })

  test('direct navigation to /auth/callback without OAuth state → does not stay stuck on callback', async ({ page }) => {
    await page.goto(`/auth/callback?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}`)

    // Eventually the page redirects away (to login or shows an error).
    await page.waitForTimeout(7000)
    const url = page.url()
    // Either escaped to /login OR rendered an error message — never just hangs on /callback.
    const onLogin = url.includes('/auth/login')
    const hasError = await page.getByText(/went wrong|error|try again/i).isVisible().catch(() => false)
    expect(onLogin || hasError).toBe(true)
  })

  test('callback with error=server_error → redirects to login', async ({ page }) => {
    await page.goto(`/auth/callback?error=server_error&redirectTo=${encodeURIComponent(MARKETPLACE_URL)}`)

    // Whatever the error code, callback page must route the user back to login
    // (possibly via invalidRedirection if the redirectTo is cross-origin and the
    // dapp's safeguard rewrites it — also acceptable for this test).
    await page.waitForURL(/\/auth\/(login|invalidRedirection)/, { timeout: 10_000 })
    expect(page.url()).not.toContain('/auth/callback')
  })

  test('callback with malformed state param → does not crash and does not land on quick-setup', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', e => pageErrors.push(e.message))

    await page.goto(`/auth/callback?state=%FF%FE-garbage-not-base64-or-json`)
    await page.waitForTimeout(5000)

    expect(page.url()).not.toContain('/quick-setup')
    expect(pageErrors).toEqual([])
  })
})
