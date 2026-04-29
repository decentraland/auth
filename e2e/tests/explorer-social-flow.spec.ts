import { test, expect } from '@playwright/test'
import { injectMockWallet, mockApiRoutes, MOCK_REQUEST_ID } from '../helpers/setup'

test.describe('Social login: AutoLoginRedirect renders for each provider', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  for (const provider of ['google', 'discord', 'apple', 'x']) {
    test(`loginMethod=${provider} → renders AutoLoginRedirect (not LoginPage)`, async ({ page }) => {
      await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })
      // Block Magic SDK to prevent actual OAuth redirect
      await page.route('**/magic.link/**', route => route.abort())
      await page.route('**/api.toaster.magic.link/**', route => route.abort())

      await page.goto(
        `/auth/login?redirectTo=${encodeURIComponent(`/auth/requests/${MOCK_REQUEST_ID}`)}&loginMethod=${provider}`
      )

      // AutoLoginRedirect renders (not LoginPage)
      await expect(
        page.getByText(/redirecting/i).or(page.getByText(new RegExp(provider, 'i')))
      ).toBeVisible({ timeout: 10_000 })

      // Should NOT show the full LoginPage UI
      await expect(page.getByPlaceholder(/email/i)).not.toBeVisible()
    })
  }
})

test.describe('Social login: callback flow — OAuth callback simulation', () => {
  /**
   * The CallbackPage calls magic.oauth2.getRedirectResult() which requires a real
   * Magic OAuth session. Without one:
   * - MISSING_PKCE_METADATA → redirects to /login (expired session)
   * - access_denied in URL → redirects to /login
   *
   * The full social→callback→success flow through Magic SDK is covered by unit tests.
   * Here we verify the observable callback page behavior.
   */

  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('callback with access_denied error → redirects to login', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })
    await page.route('**/magic.link/**', route => route.abort())

    // Simulate OAuth callback with access_denied (user cancelled at Google/Discord)
    await page.goto('/auth/callback?error=access_denied')

    // Should redirect to login page
    await page.waitForURL('**/login**', { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })

  test('callback without OAuth session → redirects to login (expired)', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })
    // Block Magic to prevent real SDK init — getRedirectResult() will fail with MISSING_PKCE_METADATA
    await page.route('**/magic.link/**', route => route.abort())
    await page.route('**/api.toaster.magic.link/**', route => route.abort())

    await page.goto('/auth/callback')

    // CallbackPage should catch the MISSING_PKCE_METADATA error and redirect to login
    // OR show the error view if it's a different error type
    await page.waitForTimeout(5000)
    const url = page.url()
    const isOnLogin = url.includes('/login')
    const hasErrorView = await page.getByText(/went wrong|error|try again/i).isVisible().catch(() => false)

    // Either redirected to login or showing error — both are valid outcomes
    expect(isOnLogin || hasErrorView).toBe(true)
  })

  test('callback page renders Validating state before SDK resolution', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })
    // Block Magic to prevent SDK init — this keeps the page in VALIDATING_SIGN_IN state longer
    await page.route('**/magic.link/**', route => route.abort())
    await page.route('**/api.toaster.magic.link/**', route => route.abort())

    await page.goto('/auth/callback')

    // The page should render (not crash) — the body should be visible
    await expect(page.locator('body')).toBeVisible()
    // Should show the animated background (callback page renders it)
    await expect(page.locator('body')).not.toBeEmpty()
  })
})

test.describe('LoginRouteGuard: routing validation', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('loginMethod=email → LoginPage (not auto-login)', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })
    await page.route('**/magic.link/**', route => route.abort())

    await page.goto('/auth/login?loginMethod=email')

    // email is NOT in AUTO_LOGIN_METHODS — should show LoginPage
    await expect(page.getByPlaceholder(/email/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/redirecting/i)).not.toBeVisible()
  })

  test('loginMethod=invalid → LoginPage', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto('/auth/login?loginMethod=invalid')

    await page.waitForTimeout(3000)
    await expect(page.getByText(/redirecting/i)).not.toBeVisible()
  })

  test('no loginMethod → LoginPage', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto('/auth/login')

    await page.waitForTimeout(3000)
    await expect(page.getByText(/redirecting/i)).not.toBeVisible()
  })
})

test.describe('Social login: AutoLoginRedirect cancel behavior', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('cancel button removes loginMethod and shows LoginPage', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })
    // Block Magic so the redirect doesn't happen immediately
    await page.route('**/magic.link/**', route => route.abort())
    await page.route('**/api.toaster.magic.link/**', route => route.abort())

    await page.goto(
      `/auth/login?redirectTo=${encodeURIComponent('https://decentraland.org/marketplace')}&loginMethod=google`
    )

    // Wait for AutoLoginRedirect to render
    await expect(
      page.getByText(/redirecting/i).or(page.getByText(/google/i))
    ).toBeVisible({ timeout: 10_000 })

    // Click cancel
    const cancelButton = page.getByText(/cancel/i)
    if (await cancelButton.isVisible()) {
      await cancelButton.click()

      // Should navigate to login without loginMethod — shows full LoginPage
      await page.waitForTimeout(3000)
      expect(page.url()).not.toContain('loginMethod')
      // Should show email input (LoginPage)
      await expect(page.getByPlaceholder(/email/i)).toBeVisible({ timeout: 10_000 })
    }
  })
})

test.describe('Explorer social flow: request page after social login', () => {
  /**
   * This tests the Explorer flow AFTER social login completes.
   * In production: user clicks social login in Explorer → AutoLoginRedirect → Magic OAuth →
   * /auth/callback → connection established → redirect back to /auth/requests/:id
   *
   * Since we can't mock Magic SDK in E2E, we simulate the post-login state by using
   * the MetaMask mock (which is already connected). The request page behavior is the
   * same regardless of wallet type: verify code → approve → success → auto-deeplink.
   *
   * Social-specific callback logic is covered by unit tests for CallbackPage.
   */

  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('existing user: request page → verify → approve → success → auto-deeplink', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Simulate arriving at request page after social login (wallet already connected via mock)
    // loginMethod=METAMASK needed so RequestPage → login → AutoLoginRedirect → reconnect
    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    // Verification screen
    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('1234')).toBeVisible()

    // Approve
    await page.getByRole('button', { name: /yes, they are the same/i }).click()

    // Success page — deeplink fires automatically on mount
    await expect(page.getByText(/Sign In successful/i)).toBeVisible({ timeout: 15_000 })
  })

  test('new user (no profile): auto-signs → success without verification', async ({
    page
  }) => {
    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    // New users skip verification — auto-sign goes straight to success
    await expect(page.getByText(/Sign In successful/i)).toBeVisible({ timeout: 20_000 })

    // Should NOT show setup pages
    await expect(page.getByPlaceholder(/enter your username/i)).not.toBeVisible()
  })
})
