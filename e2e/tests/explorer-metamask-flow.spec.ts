import { test, expect } from '@playwright/test'
import { injectMockWallet, injectPreviousConnection, mockApiRoutes, DEEP_LINK_REQUEST_ID } from '../helpers/setup'

/**
 * Explorer login through the auth site is the identity handoff: the user connects, the signed
 * identity is posted to `POST /identities`, and the client is opened through the
 * `open?signin=<identityId>` deep link. Headless Chromium cannot launch the client, so a
 * completed handoff deterministically lands on the ContinueInApp retry fallback — which is what
 * these tests assert on.
 */

/** Records whether the identity was posted, deferring to the shared mock to fulfil the call. */
async function trackIdentityPost(page: import('@playwright/test').Page) {
  const posted = { value: false }
  await page.route('**/identities', async (route, request) => {
    if (request.method() === 'POST') {
      posted.value = true
    }
    return route.fallback()
  })
  return posted
}

test.describe('Explorer → MetaMask: existing user — full E2E', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('request page → auto-connect → posts the identity → fires the client deep link', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })
    const posted = await trackIdentityPost(page)

    // Step 1: Explorer opens auth with its correlation id, loginMethod and the deep-link flow
    await page.goto(`/auth/requests/${DEEP_LINK_REQUEST_ID}?loginMethod=METAMASK&flow=deeplink`)

    // Step 2: LoginRouteGuard sees loginMethod=METAMASK → AutoLoginRedirect auto-connects the
    // mock wallet and returns here, where the identity is posted and the deep link fires.
    await expect(page.locator('[data-testid="continue-in-app-try-again-button"]')).toBeVisible({ timeout: 20_000 })
    expect(posted.value).toBe(true)

    // Step 3: Verify connection data persisted for SSO
    const hasConnectionData = await page.evaluate(() => {
      return localStorage.getItem('decentraland-connect-storage-key') !== null
    })
    expect(hasConnectionData).toBe(true)
  })

  test('should never recover a backing auth-server request', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    let recoverCalled = false
    await page.route('**/v2/requests/**', async (route, request) => {
      if (request.method() === 'GET' && !request.url().includes('/outcome')) {
        recoverCalled = true
      }
      return route.fallback()
    })

    await page.goto(`/auth/requests/${DEEP_LINK_REQUEST_ID}?loginMethod=METAMASK&flow=deeplink`)

    await expect(page.locator('[data-testid="continue-in-app-try-again-button"]')).toBeVisible({ timeout: 20_000 })
    expect(recoverCalled).toBe(false)
  })
})

test.describe('Explorer → MetaMask: new user (no profile) — full E2E', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('new user completes the handoff without a setup or quick-setup page', async ({ page }) => {
    // Longest path in the suite (login redirect → connect → profile fetch), so assert the handoff
    // itself rather than the ContinueInApp fallback, which only appears after a further countdown.
    test.slow()
    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })
    const posted = await trackIdentityPost(page)

    await page.goto(`/auth/requests/${DEEP_LINK_REQUEST_ID}?loginMethod=METAMASK&flow=deeplink`)

    await expect.poll(() => posted.value, { timeout: 40_000 }).toBe(true)
    await expect(page.getByText(/Your journey begins here/)).not.toBeVisible()
    await expect(page.getByPlaceholder(/enter your username/i)).not.toBeVisible()
  })
})

test.describe('Explorer → MetaMask: cached wallet', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('cached wallet session + new user → routes through AutoLoginRedirect, not broken RequestPage UI', async ({ context, page }) => {
    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })

    // Simulate a previously connected wallet (e.g. user connected before but never created a profile)
    await injectPreviousConnection(context)

    await page.goto(`/auth/requests/${DEEP_LINK_REQUEST_ID}?loginMethod=METAMASK&flow=deeplink`)

    // RequestPage redirects to /login, which renders AutoLoginRedirect (clean spinner, no broken
    // wearable preview), connects, and returns here to complete the handoff.
    await expect(page.locator('[data-testid="continue-in-app-try-again-button"]')).toBeVisible({ timeout: 40_000 })
  })

  test('cached wallet session + returning user → completes the handoff', async ({ context, page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Simulate a previously connected wallet with existing profile
    await injectPreviousConnection(context)

    await page.goto(`/auth/requests/${DEEP_LINK_REQUEST_ID}?loginMethod=METAMASK&flow=deeplink`)

    await expect(page.locator('[data-testid="continue-in-app-try-again-button"]')).toBeVisible({ timeout: 20_000 })
  })
})
