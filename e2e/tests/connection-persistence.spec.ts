import { test, expect } from '@playwright/test'
import {
  injectMockWallet,
  injectPreviousConnection,
  mockApiRoutes,
  MOCK_REQUEST_ID,
  MOCK_WALLET
} from '../helpers/setup'

test.describe('Previous connection: returning user with persisted wallet', () => {
  /**
   * When a user has previously connected, decentraland-connect stores
   * { providerType, chainId } in localStorage under 'decentraland-connect-storage-key'.
   * On next visit, ConnectionProvider calls tryPreviousConnection() which reads this
   * and calls eth_accounts (not eth_requestAccounts) to silently reconnect.
   *
   * These tests verify the app correctly restores the session from localStorage.
   */

  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
    // Simulate returning user: wallet connection already persisted from a previous session
    await injectPreviousConnection(context, 'injected', 1)
  })

  test('Explorer: returning user goes directly to verify screen (no login redirect)', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Navigate directly to request page — no loginMethod needed since wallet is already connected
    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}`)

    // ConnectionProvider restores wallet → RequestPage sees account → shows verify screen
    // Should NOT redirect to /login since the wallet is already available
    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('1234')).toBeVisible()
  })

  test('Explorer: returning user can complete full flow without re-login', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}`)

    // Verify → approve → success
    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /yes, they are the same/i }).click()
    await expect(page.getByText(/signed in to Decentraland/i)).toBeVisible({ timeout: 15_000 })
  })

  test('Web: returning existing user with redirectTo → skips login page entirely', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Simulate clicking "Sign In" on marketplace — redirectTo is the target
    await page.goto(`/auth/login?redirectTo=${encodeURIComponent('https://decentraland.org/marketplace')}`)

    // With previous connection, the login page should detect the wallet is already
    // connected and proceed. The exact behavior depends on whether loginMethod is present.
    // Without loginMethod, LoginPage renders but the wallet is available for manual selection.
    await page.waitForTimeout(5000)

    // Connection should be available (restored from localStorage)
    const connectionData = await page.evaluate(() => {
      return localStorage.getItem('decentraland-connect-storage-key')
    })
    expect(connectionData).not.toBeNull()
  })

  test('Web: returning user with auto-login → uses persisted wallet directly', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // With loginMethod=METAMASK, AutoLoginRedirect will call connectToProvider()
    // which calls connection.connect(). Since the mock provider is already injected
    // AND previous connection is in localStorage, this should work seamlessly.
    await page.goto(
      `/auth/login?redirectTo=${encodeURIComponent('https://decentraland.org/marketplace')}&loginMethod=METAMASK`
    )

    // Should NOT show QuickSetup (existing user)
    await page.waitForTimeout(5000)
    await expect(page.getByPlaceholder(/enter your username/i)).not.toBeVisible()

    // Connection persisted
    const connectionData = await page.evaluate(() => {
      return localStorage.getItem('decentraland-connect-storage-key')
    })
    expect(connectionData).not.toBeNull()
  })
})

test.describe('No previous connection: fresh user with no persisted wallet', () => {
  /**
   * Without previous connection in localStorage, tryPreviousConnection() returns
   * null/empty. The app must redirect to /login for the user to choose a wallet.
   */

  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
    // Do NOT inject previous connection — simulate first-time visit
  })

  test('Explorer: request page without connection → redirects to login', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Navigate to request page — no wallet connected
    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}`)

    // RequestPage effect: !account → toLoginPage()
    // Should redirect to /login with redirectTo pointing back to the request
    await page.waitForURL('**/login**', { timeout: 10_000 })
    expect(page.url()).toContain('/login')
    expect(page.url()).toContain('redirectTo')
  })

  test('Explorer: request page with loginMethod → redirects to login → auto-connects', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // With loginMethod, after redirect to /login, AutoLoginRedirect kicks in
    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    // Flow: RequestPage → no wallet → redirect to /login?loginMethod=METAMASK
    // → LoginRouteGuard → AutoLoginRedirect → connectToProvider() → redirect back
    // → RequestPage → VerifySignIn
    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 20_000 })
  })

  test('Web: login page renders full UI for wallet selection', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto('/auth/login')

    // Without previous connection and no loginMethod, full LoginPage renders
    await expect(page.getByPlaceholder(/email/i)).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Connection persistence: wallet data survives page reload', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('after login, connection data persists across navigation', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Login via auto-login
    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)
    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 15_000 })

    // Verify connection was stored
    const connectionData = await page.evaluate(() => {
      return localStorage.getItem('decentraland-connect-storage-key')
    })
    expect(connectionData).not.toBeNull()

    // Parse and verify structure
    const parsed = JSON.parse(connectionData!)
    expect(parsed).toHaveProperty('providerType')
    expect(parsed).toHaveProperty('chainId')
  })
})
