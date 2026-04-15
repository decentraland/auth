import { test, expect } from '@playwright/test'
import { injectMockWallet, mockApiRoutes, MOCK_REQUEST_ID } from '../helpers/setup'

test.describe('Error: auth server fails', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('500 on request recovery → page doesn\'t crash, no Login Successful', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Override: auth server returns 500
    await page.route('**/v2/requests/**', async (route, request) => {
      if (request.method() === 'GET') {
        return route.fulfill({ status: 500, body: 'Internal Server Error' })
      }
      return route.continue()
    })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    await page.waitForTimeout(10000)

    // Should NOT show Login Successful
    await expect(page.getByText('Login Successful!')).not.toBeVisible()
    // Should NOT crash (page should still be rendered)
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Error: MetaMask rejection → WalletErrorModal', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('walletError=rejected param shows WalletErrorModal on LoginPage', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Simulate: AutoLoginRedirect redirected here after MM rejection
    await page.goto('/auth/login?walletError=rejected')


    // Should show the wallet error modal (LoginPage is lazy-loaded, may take a moment)
    await expect(page.getByText(/did not confirm/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('clicking TRY AGAIN in modal dismisses it', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto('/auth/login?walletError=rejected')

    await expect(page.getByText(/did not confirm/i)).toBeVisible({ timeout: 15_000 })

    // Click TRY AGAIN
    await page.getByRole('button', { name: /try again/i }).click()

    // Modal should close
    await expect(page.getByText(/did not confirm/i)).not.toBeVisible({ timeout: 3000 })

    // walletError param should be removed from URL
    expect(page.url()).not.toContain('walletError')
  })

  test('clicking X closes the modal', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto('/auth/login?walletError=rejected')

    await expect(page.getByText(/did not confirm/i)).toBeVisible({ timeout: 15_000 })

    // Click the close X button
    await page.getByRole('button', { name: /close/i }).click()

    await expect(page.getByText(/did not confirm/i)).not.toBeVisible({ timeout: 3000 })
  })
})

test.describe('Error: generic login error → LoginErrorPage', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('generic error during auto-login shows Something went wrong page', async ({ context, page }) => {
    // Inject a broken mock provider that throws on eth_requestAccounts
    await context.addInitScript(`
      (function() {
        window.ethereum = {
          isMetaMask: true,
          isConnected: () => true,
          selectedAddress: null,
          chainId: '0x1',
          networkVersion: '1',
          _events: {},
          _metamask: { isUnlocked: () => Promise.resolve(true) },
          on: function() { return this; },
          removeListener: function() { return this; },
          removeAllListeners: function() { return this; },
          addListener: function() { return this; },
          off: function() { return this; },
          once: function() { return this; },
          emit: function() {},
          request: async function({ method }) {
            if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
              throw new Error('Simulated wallet connection error');
            }
            return null;
          },
          enable: async function() { throw new Error('Simulated wallet error'); },
          send: function() {},
          sendAsync: function() {}
        };
      })();
    `)

    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto(
      `/auth/login?redirectTo=${encodeURIComponent(`/auth/requests/${MOCK_REQUEST_ID}`)}&loginMethod=METAMASK`
    )

    // Should show the error page
    await expect(page.getByText('Something went wrong.')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/couldn't sign you in/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
  })
})

test.describe('Error: user denies sign-in', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('clicking "No, it doesn\'t" → denied view, flow stops', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 20_000 })

    // Click "No"
    await page.getByRole('button', { name: /no, it doesn't/i }).click()

    // Should show denied state — NOT Login Successful
    await expect(page.getByText('Login Successful!')).not.toBeVisible()
    await expect(page.getByText(/not match|denied|wasn't you/i)).toBeVisible({ timeout: 5_000 })
  })
})

// FF disabled tests moved to routing-edge-cases.spec.ts
// QuickSetup is now the only setup page regardless of FF state
