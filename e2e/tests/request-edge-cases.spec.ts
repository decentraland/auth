import { test, expect } from '@playwright/test'
import {
  injectMockWallet,
  mockApiRoutes,
  MOCK_REQUEST_ID
} from '../helpers/setup'
import {
  recoverRequestDifferentSenderResponse,
  recoverRequestExpiredResponse,
  recoverRequestResponse
} from '../fixtures/mock-responses'

test.describe('Deep link flow (flow=deeplink)', () => {
  /**
   * The deep link flow is used when Explorer opens auth with ?flow=deeplink.
   * Instead of sending the outcome to auth-server, it posts the identity
   * and shows ContinueInApp view with auto-redirect countdown.
   */

  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('deeplink flow: verify screen shows different text (no code, "Confirm" language)', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK&flow=deeplink`)

    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 15_000 })

    // Deep link flow hides the verification code and shows different text
    // Should NOT show the code number
    await expect(page.getByText('1234')).not.toBeVisible()

    // Buttons should use deep link language
    // "Sign In" instead of "Yes, they are the same"
    await expect(page.locator('[data-testid="verify-sign-in-approve-button"]')).toBeVisible()
    // "Cancel" instead of "No, it doesn't"
    await expect(page.locator('[data-testid="verify-sign-in-deny-button"]')).toBeVisible()
  })

  test('deeplink flow: approve → posts identity → shows ContinueInApp with countdown', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Mock the /identities POST endpoint for deep link flow
    await page.route('**/identities', async (route, request) => {
      if (request.method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ identityId: 'test-identity-123' })
        })
      }
      return route.continue()
    })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK&flow=deeplink`)

    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 15_000 })

    // Approve
    await page.locator('[data-testid="verify-sign-in-approve-button"]').click()

    // Should show ContinueInApp view (not SignInCompletePage)
    await expect(page.getByText(/Sign In Successful/i)).toBeVisible({ timeout: 15_000 })

    // Should show countdown or return button
    const returnButton = page.locator('[data-testid="continue-in-app-return-button"]')
    await expect(returnButton).toBeVisible({ timeout: 10_000 })
  })

  test('deeplink flow: deny → shows denied view', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK&flow=deeplink`)

    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 15_000 })

    // Click deny (Cancel in deeplink flow)
    await page.locator('[data-testid="verify-sign-in-deny-button"]').click()

    // Should show denied state
    await expect(page.getByText(/not match|not taken by you/i)).toBeVisible({ timeout: 5_000 })
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
    await expect(page.getByText('Login Successful!')).toBeVisible({ timeout: 15_000 })
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
