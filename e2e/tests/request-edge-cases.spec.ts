import { test, expect } from '@playwright/test'
import {
  injectMockWallet,
  mockApiRoutes,
  MOCK_REQUEST_ID
} from '../helpers/setup'
import {
  recoverRequestDifferentSenderResponse,
  recoverRequestExpiredResponse
} from '../fixtures/mock-responses'

// A valid UUID v4 route id — the client's correlation id required by the deep-link handoff.
const DEEP_LINK_REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000'

test.describe('Deep link login handoff (flow=deeplink with a UUID v4 id)', () => {
  /**
   * Opening auth with `?flow=deeplink` and a UUID v4 route id runs the deep-link login handoff
   * WITHOUT a backing auth-server request: the user logs in, the signed identity is posted to the
   * auth server, and the client is opened immediately via the `open?signin=<identityId>` deep
   * link — the same handoff as the standalone mobile flow, without any countdown. The route UUID
   * is forwarded to the client as the deep link's `authRequestId` so it can correlate the login
   * with the instance that requested it. It never recovers a request.
   */

  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('valid UUID: auto-connect → posts identity → fires the deep link without recovering a request', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Track auth-server request recoveries — the deep-link handoff must never trigger one.
    // Registered after mockApiRoutes so it runs first; fallback() defers to it.
    let recoverCalled = false
    await page.route('**/v2/requests/**', async (route, request) => {
      if (request.method() === 'GET' && !request.url().includes('/outcome')) {
        recoverCalled = true
      }
      return route.fallback()
    })

    // Mock the /identities POST endpoint
    let postedIdentity = false
    await page.route('**/identities', async (route, request) => {
      if (request.method() === 'POST') {
        postedIdentity = true
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ identityId: 'test-identity-123' })
        })
      }
      return route.continue()
    })

    await page.goto(`/auth/requests/${DEEP_LINK_REQUEST_ID}?loginMethod=METAMASK&flow=deeplink`)

    // AutoLoginRedirect connects the mock wallet, generates the identity and returns
    // here; the identity is posted and the deep link fires immediately. Headless
    // Chromium cannot launch the client, so the flow deterministically lands on the
    // retry fallback — which proves the immediate attempt ran and that the fallback
    // retries the deep link instead of redirecting back to login.
    await expect(page.locator('[data-testid="continue-in-app-try-again-button"]')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-testid="continue-in-app-go-back-button"]')).not.toBeVisible()

    expect(postedIdentity).toBe(true)
    expect(recoverCalled).toBe(false)
    expect(page.url()).toContain(`/auth/requests/${DEEP_LINK_REQUEST_ID}`)
  })

  test('invalid (non-UUID) id: shows the error view without posting an identity or recovering a request', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    let recoverCalled = false
    await page.route('**/v2/requests/**', async (route, request) => {
      if (request.method() === 'GET' && !request.url().includes('/outcome')) {
        recoverCalled = true
      }
      return route.fallback()
    })

    let postedIdentity = false
    await page.route('**/identities', async (route, request) => {
      if (request.method() === 'POST') postedIdentity = true
      return route.continue()
    })

    // MOCK_REQUEST_ID is not a UUID v4 — a malformed deep-link id is rejected up front.
    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK&flow=deeplink`)

    await expect(page.locator('[data-testid="client-login-error-try-again-button"]')).toBeVisible({ timeout: 20_000 })

    expect(postedIdentity).toBe(false)
    expect(recoverCalled).toBe(false)
  })
})

test.describe('Retired dcl_personal_sign sign-in (unmigrated client)', () => {
  /**
   * The auth site no longer serves the dcl_personal_sign sign-in. A client that still sends it is
   * rejected at recover time, and the user is told to update rather than shown a generic recover
   * error whose "try again" would re-create the same rejected request.
   */

  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('shows the update-your-app view and never signs anything', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Registered after mockApiRoutes so it wins: the recover returns the retired method.
    await page.route('**/v2/requests/**', async (route, request) => {
      if (request.method() === 'GET' && !request.url().includes('/outcome')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            requestId: MOCK_REQUEST_ID,
            expiration: new Date(Date.now() + 600_000).toISOString(),
            method: 'dcl_personal_sign',
            params: ['Sign this message to verify your identity']
          })
        })
      }
      return route.fallback()
    })

    let outcomeSent = false
    await page.route('**/v2/requests/**/outcome', async route => {
      outcomeSent = true
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    await expect(page.locator('[data-testid="outdated-client-error"]')).toBeVisible({ timeout: 20_000 })
    // No retry is offered, and nothing was signed or reported back to the client.
    await expect(page.locator('[data-testid="client-login-error-try-again-button"]')).not.toBeVisible()
    expect(outcomeSent).toBe(false)
  })
})

test.describe('Different account error', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('connected wallet differs from request sender → shows different account error', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Override: auth server returns a request with a different sender
    await page.route('**/v2/requests/**', async (route, request) => {
      if (request.method() === 'GET' && !request.url().includes('/outcome')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(recoverRequestDifferentSenderResponse)
        })
      }
      return route.continue()
    })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    // Should show different account error
    await expect(page.getByText(/different account/i)).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Request expired (timeout)', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('expired request → shows timeout error', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Override: auth server returns expired request
    await page.route('**/v2/requests/**', async (route, request) => {
      if (request.method() === 'GET' && !request.url().includes('/outcome')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(recoverRequestExpiredResponse)
        })
      }
      return route.continue()
    })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    // Should show timeout/expired error
    await expect(page.getByText(/took too long|expired/i)).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Request already fulfilled', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('already consumed request → shows completion view (no re-fetch)', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Override: auth server returns "already been fulfilled" error
    await page.route('**/v2/requests/**', async (route, request) => {
      if (request.method() === 'GET' && !request.url().includes('/outcome')) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'The request has already been fulfilled' })
        })
      }
      return route.continue()
    })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    // RequestFulfilledError → shows completion view
    await expect(page.getByText(/Wallet interaction complete/i)).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Session mismatch: connected wallet type vs loginMethod', () => {
  /**
   * When a user is connected with one provider type (e.g. Magic/social) but
   * arrives with loginMethod=METAMASK (or vice versa), the RequestPage detects
   * the mismatch and redirects to /login where AutoLoginRedirect reconnects
   * with the correct provider.
   *
   * Skipped: requires a real Magic SDK session to restore via tryPreviousConnection().
   * Setting providerType='magic' in localStorage doesn't work because MagicConnector
   * needs the actual SDK to initialize. Covered by useSessionMismatch unit tests.
   */

  test.skip('social session + loginMethod=METAMASK → redirects to login for re-auth', async () => {
    // Not testable in E2E without a real Magic SDK session.
  })
})
