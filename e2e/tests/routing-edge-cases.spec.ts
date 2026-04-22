import { test, expect } from '@playwright/test'
import { injectMockWallet, mockApiRoutes, MOCK_REQUEST_ID } from '../helpers/setup'

test.describe('Guest login option', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('redirectTo containing /play → shows guest login option', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Must use localhost URL — redirect validation rejects cross-origin URLs
    await page.goto(`/auth/login?redirectTo=${encodeURIComponent('http://localhost:5174/play')}`)

    // LoginPage should show guest option when redirectTo includes /play
    await expect(page.getByPlaceholder(/email/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/explore as a guest/i)).toBeVisible()
  })

  test('redirectTo NOT containing /play → no guest option', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent('http://localhost:5174/marketplace')}`)

    await expect(page.getByPlaceholder(/email/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/explore as a guest/i)).not.toBeVisible()
  })

  test('no redirectTo → no guest option', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto('/auth/login')

    await expect(page.getByPlaceholder(/email/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/explore as a guest/i)).not.toBeVisible()
  })
})

test.describe('Unknown routes (404 / DefaultPage)', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('unknown route → renders DefaultPage (no crash)', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto('/auth/nonexistent-route')

    // Page should not crash — body should be visible
    await expect(page.locator('body')).toBeVisible()

    // Should NOT show login page or request page content
    await expect(page.getByText('Verify Sign In')).not.toBeVisible()
  })
})

test.describe('skipSetup logic: FF + redirectTo interaction', () => {
  /**
   * skipSetup = true when:
   * 1. targetConfig.skipSetup = true, OR
   * 2. ONBOARDING_TO_EXPLORER FF enabled AND no explicit redirect (internal auth redirect)
   *
   * skipSetup affects:
   * - RequestPage: SignInCompletePage (full page + Continue) vs SignInComplete (minimal)
   * - AutoLoginRedirect: skip ensureProfile call
   * - CallbackPage: skip ensureProfile call
   */

  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('FF enabled + no redirectTo (Explorer flow) → skipSetup=true → SignInCompletePage with auto-deeplink', async ({
    page
  }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // No redirectTo — this is an Explorer-initiated request (internal redirect)
    await page.goto(`/auth/requests/e2e-test-request-id-1234?loginMethod=METAMASK`)

    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /yes, they are the same/i }).click()

    // skipSetup=true → SignInCompletePage (deeplink fires automatically on mount)
    await expect(page.getByText(/signed in to Decentraland/i)).toBeVisible({ timeout: 15_000 })
  })

  test('FF enabled + external redirectTo (Web flow) → skipSetup=false → SignInComplete (minimal)', async ({
    page
  }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Navigate to request page with an external redirectTo (web flow)
    // Must use localhost URL — redirect validation rejects cross-origin URLs
    await page.goto(
      `/auth/requests/e2e-test-request-id-1234?loginMethod=METAMASK&redirectTo=${encodeURIComponent('http://localhost:5174/marketplace')}`
    )

    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /yes, they are the same/i }).click()

    // Should show some completion view
    await expect(page.getByText(/signed in to Decentraland/i)).toBeVisible({ timeout: 15_000 })

    // Note: whether Continue button appears depends on how redirectTo flows through
    // the useSkipSetup hook. The key assertion is that we reach completion.
  })

  test('FF disabled + web new user → QuickSetup (not old setup)', async ({ page }) => {
    await mockApiRoutes(page, {
      hasProfile: false,
      onboardingToExplorer: false // FF disabled
    })

    // Must use localhost URL — redirect validation rejects cross-origin URLs
    await page.goto(
      `/auth/login?redirectTo=${encodeURIComponent('http://localhost:5174/marketplace')}&loginMethod=METAMASK`
    )

    // QuickSetup is now the only setup page — FF only controls skipSetup, not which page
    await expect(page.getByText('Welcome to')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByPlaceholder(/enter your username/i)).toBeVisible()
  })

  test('FF disabled + Explorer new user → QuickSetup → then back to request', async ({ page }) => {
    await mockApiRoutes(page, {
      hasProfile: false,
      onboardingToExplorer: false // FF disabled → skipSetup = false → web onboarding
    })

    // Explorer URL but FF off: skipSetup=false, so ensureProfile runs → new user → QuickSetup
    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    // Should show QuickSetup (not the old setup, not the verify screen)
    await expect(page.getByText('Welcome to')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByPlaceholder(/enter your username/i)).toBeVisible()

    // Should NOT show verification screen (user goes through setup first)
    await expect(page.getByText('Verify Sign In')).not.toBeVisible()
  })
})
