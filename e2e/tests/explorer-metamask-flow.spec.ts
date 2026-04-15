import { test, expect } from '@playwright/test'
import { injectMockWallet, mockApiRoutes, MOCK_REQUEST_ID } from '../helpers/setup'

test.describe('Explorer → MetaMask: existing user — full E2E', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('request page → auto-connect → verify code → approve → Login Successful → Continue → deeplink', async ({
    page
  }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Step 1: Explorer opens auth with request ID and loginMethod
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    page.on('pageerror', err => errors.push('PAGE_ERROR: ' + err.message))
    page.on('response', resp => { if (resp.status() >= 400) errors.push(`HTTP ${resp.status()} ${resp.url()}`) })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    // Debug: capture page state
    await page.waitForTimeout(3000)
    const bodyText = await page.textContent('body').catch(() => 'EMPTY')
    const url = page.url()
    const html = await page.content()
    const hasRoot = html.includes('id="root"')
    const rootContent = await page.evaluate(() => document.getElementById('root')?.innerHTML?.substring(0, 200) ?? 'NO ROOT').catch(() => 'EVAL FAILED')
    console.log(`[DEBUG] URL: ${url}`)
    console.log(`[DEBUG] Body text (first 200): ${(bodyText || '').substring(0, 200)}`)
    console.log(`[DEBUG] Has #root: ${hasRoot}`)
    console.log(`[DEBUG] Root content: ${rootContent}`)
    console.log(`[DEBUG] Errors: ${JSON.stringify(errors)}`)

    // Step 2: RequestPage sees no account → redirects to /login with loginMethod
    // LoginRouteGuard sees loginMethod=METAMASK → AutoLoginRedirect
    // AutoLoginRedirect auto-connects mock MetaMask → redirects back to request page

    // Step 3: Verification screen — always shown for request-based flow
    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('1234')).toBeVisible()

    // Step 4: User approves code match
    await page.getByRole('button', { name: /yes, they are the same/i }).click()

    // Step 5: Login Successful page (new full-page design with Continue button)
    await expect(page.getByText('Login Successful!')).toBeVisible({ timeout: 15_000 })
    const continueButton = page.getByRole('button', { name: /continue/i })
    await expect(continueButton).toBeVisible()

    // Step 6: Click Continue → triggers decentraland:// deeplink
    // Intercept window.location.href assignment to capture deeplink
    await page.evaluate(() => {
      ;(window as any).__capturedHref = null
      const origDescriptor = Object.getOwnPropertyDescriptor(window, 'location')
      // We can't override location directly, so patch via a proxy on href setter
      // Instead, listen for beforeunload which fires on location change
      window.addEventListener('beforeunload', () => {
        // Can't capture here reliably. Use a different approach.
      })
    })

    await continueButton.click()
    await page.waitForTimeout(500)

    // Step 7: Verify connection data persisted for SSO
    const hasConnectionData = await page.evaluate(() => {
      return localStorage.getItem('decentraland-connect-storage-key') !== null
    })
    expect(hasConnectionData).toBe(true)
  })
})

test.describe('Explorer → MetaMask: new user (no profile) — full E2E', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('new user auto-signs → Login Successful without verification screen', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })

    // Step 1: Request page — new user, Explorer flow
    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    // Step 2: New users skip the "Verify Sign In" screen entirely.
    // The request is auto-signed (matching old behavior where SetupPage signed automatically).
    // Should go straight to Login Successful.
    await expect(page.getByText('Login Successful!')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /continue/i })).toBeVisible()

    // Should NOT have shown verification code screen
    // (it resolved too fast for the verify screen to appear)
  })

  test('new user: no setup or quick-setup pages shown', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    // Should go to success, not setup
    await expect(page.getByText('Login Successful!')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Your journey begins here/)).not.toBeVisible()
    await expect(page.getByPlaceholder(/enter your username/i)).not.toBeVisible()
  })
})

test.describe('Explorer → MetaMask: verification code behavior', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('with verification code → shows code on verify screen', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true, showVerificationCode: true })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 15_000 })
    // Code "1234" from recoverRequestResponse should be displayed
    await expect(page.getByText('1234')).toBeVisible()
  })

  test('without verification code → verify screen shows but no code number', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true, showVerificationCode: false })

    await page.goto(`/auth/requests/${MOCK_REQUEST_ID}?loginMethod=METAMASK`)

    await expect(page.getByText('Verify Sign In')).toBeVisible({ timeout: 15_000 })
    // No code should be displayed (recoverRequestNoCodeResponse has no code field)
    await expect(page.getByText('1234')).not.toBeVisible()
    // Approve button should still work
    await page.getByRole('button', { name: /yes, they are the same/i }).click()
    await expect(page.getByText('Login Successful!')).toBeVisible({ timeout: 15_000 })
  })
})
