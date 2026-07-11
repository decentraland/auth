import { test, expect } from '@playwright/test'
import { injectMockWallet, mockApiRoutes } from '../helpers/setup'

const MARKETPLACE_URL = 'https://decentraland.org/marketplace'

/**
 * Locks in the production-default routing when `dapps-onboarding-to-explorer = true`.
 *
 * The existing suite implicitly exercises this flag (most specs pass it true),
 * but no test asserts the *URL* the user lands on after MetaMask login. These
 * tests catch silent routing regressions where, say, a refactor sends new
 * users back to `/auth/setup` or `/auth/avatar-setup` instead of `/quick-setup`.
 *
 * Today's routing with onboardingToExplorer=true (per src/hooks/useSetupNavigation.ts):
 *   - new user → /auth/quick-setup
 *   - existing user → redirect off-origin to redirectTo
 */
test.describe('Feature flag: dapps-onboarding-to-explorer = true (production default)', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('MetaMask new user → lands on /auth/quick-setup', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}&loginMethod=METAMASK`)

    await expect(page.getByPlaceholder(/enter your username/i)).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/\/auth\/quick-setup/)
  })

  test('MetaMask existing user → skips setup, navigates away from /auth', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}&loginMethod=METAMASK`)

    // Existing user → no QuickSetup form. URL leaves /auth because redirectTo is off-origin.
    await page.waitForURL(
      url => !url.pathname.startsWith('/auth/login') && !url.pathname.startsWith('/auth/quick-setup'),
      { timeout: 15_000 }
    )
    await expect(page.getByPlaceholder(/enter your username/i)).not.toBeVisible()
  })
})
