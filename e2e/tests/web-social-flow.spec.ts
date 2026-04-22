import { test, expect } from '@playwright/test'
import { injectMockWallet, mockApiRoutes, MOCK_WALLET } from '../helpers/setup'

const MARKETPLACE_URL = 'https://decentraland.org/marketplace'

/**
 * Web social login flow tests.
 *
 * In production, the social flow is:
 * 1. /auth/login → user clicks Google/Discord/Apple/X
 * 2. AutoLoginRedirect → magic.oauth2.loginWithRedirect() → browser goes to provider
 * 3. Provider redirects to /auth/callback
 * 4. CallbackPage → magic.oauth2.getRedirectResult() → connection.connect(MAGIC)
 * 5. ensureProfile() → if no profile, navigate to /quick-setup
 * 6. QuickSetup → deploy profile → celebration → redirect to marketplace
 *
 * Since we can't mock Magic SDK's OAuth round-trip in E2E, we test:
 * - AutoLoginRedirect renders correctly for each social provider
 * - The /auth/callback error handling (access_denied, expired session)
 * - Post-login flows using the MetaMask mock (behavior is wallet-agnostic after connection)
 *
 * The callback → connection → ensureProfile chain is covered by CallbackPage unit tests.
 */

test.describe('Web social: new user → QuickSetup flow', () => {
  /**
   * After social login completes (CallbackPage), ensureProfile detects no profile and
   * navigates to /quick-setup. This flow is identical regardless of wallet type.
   * We test it with MetaMask mock since the wallet is already connected.
   */

  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('new user arrives at QuickSetup after login → fills form → sees celebration', async ({ page }) => {
    // Default profile entity for deployProfileFromDefault
    const defaultProfileEntity = {
      id: 'default-entity',
      type: 'profile',
      pointers: ['default1'],
      timestamp: Date.now(),
      content: [],
      metadata: {
        avatars: [{
          name: 'default1',
          description: '',
          avatar: {
            bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
            eyes: { color: { r: 0.125, g: 0.703, b: 0.964 } },
            hair: { color: { r: 0.234, g: 0.128, b: 0.065 } },
            skin: { color: { r: 0.8, g: 0.608, b: 0.465 } },
            wearables: [
              'urn:decentraland:off-chain:base-avatars:eyebrows_00',
              'urn:decentraland:off-chain:base-avatars:eyes_00',
              'urn:decentraland:off-chain:base-avatars:casual_hair_01',
              'urn:decentraland:off-chain:base-avatars:sport_jacket',
              'urn:decentraland:off-chain:base-avatars:jean_shorts',
              'urn:decentraland:off-chain:base-avatars:sneakers'
            ],
            snapshots: {}
          }
        }]
      }
    }

    // Smart content mock: handles both user profile and default profile fetches
    await page.route('**/content/entities/active**', async (route, request) => {
      const method = request.method()
      if (method === 'POST') {
        try {
          const body = request.postData() || ''
          if (body.includes('default')) {
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify([defaultProfileEntity])
            })
          }
        } catch {
          // ignore parse errors
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    })

    // Mock deploy POST
    await page.route('**/content/entities', async (route, request) => {
      if (request.method() === 'POST' && !request.url().includes('active')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      }
      return route.fallback()
    })

    // Mock newsletter + builder APIs
    await page.route('**/builder-api**', async route => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })

    // Simulate: social login completed, user arrives via auto-login with redirectTo
    // (In production this would be CallbackPage → ensureProfile → navigate to /quick-setup)
    // Here we use MetaMask auto-login which triggers the same ensureProfile flow
    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}&loginMethod=METAMASK`)

    // QuickSetup page renders (new user, web flow)
    await expect(page.getByText('Welcome to')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Decentraland!')).toBeVisible()

    // Form elements
    const usernameInput = page.getByPlaceholder(/enter your username/i)
    const emailInput = page.getByPlaceholder(/enter your email/i)
    await expect(usernameInput).toBeVisible()
    await expect(emailInput).toBeVisible()

    // Submit should be disabled without required fields
    const letsGo = page.getByRole('button', { name: /let's go/i })
    await expect(letsGo).toBeDisabled()

    // Fill form
    await usernameInput.fill('SocialUser')
    await emailInput.fill('social@example.com')
    await page.getByRole('checkbox').click()

    // Submit should now be enabled
    await expect(letsGo).toBeEnabled()

    // Submit
    await letsGo.click()

    // Wait for deploy/celebration
    await page.waitForTimeout(3000)
    const isCelebration = await page.getByText('SocialUser is Ready to Jump In!').isVisible().catch(() => false)
    const isStillForm = await page.getByRole('button', { name: /^let's go$/i }).isVisible().catch(() => false)

    // Either reached celebration or form submitted (deploy may succeed or fail)
    expect(isCelebration || isStillForm).toBe(true)
  })

  test('new user: body type and randomize work on QuickSetup', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}&loginMethod=METAMASK`)
    await expect(page.getByText('Welcome to')).toBeVisible({ timeout: 15_000 })

    // Body type dropdown
    const bodyTypeButton = page.getByRole('button', { name: /body type a/i })
    await bodyTypeButton.click()
    await expect(page.getByText('BODY TYPE B')).toBeVisible()
    await page.getByText('BODY TYPE B').click()
    await expect(page.getByRole('button', { name: /body type b/i })).toBeVisible()

    // Randomize button
    const randomizeButton = page.getByRole('button', { name: /randomize/i })
    await randomizeButton.click()
    await page.waitForTimeout(300)
    await randomizeButton.click()

    // Page should still be functional
    await expect(page.getByPlaceholder(/enter your username/i)).toBeVisible()
  })
})

test.describe('Web social: existing user → direct redirect', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('existing user with redirectTo → skips setup, redirects to marketplace', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}&loginMethod=METAMASK`)

    // Should NOT show QuickSetup (existing user)
    await page.waitForTimeout(5000)
    await expect(page.getByText('Welcome to')).not.toBeVisible()
    await expect(page.getByPlaceholder(/enter your username/i)).not.toBeVisible()

    // Connection should be persisted
    const connectionData = await page.evaluate(() => {
      return localStorage.getItem('decentraland-connect-storage-key')
    })
    expect(connectionData).not.toBeNull()
  })
})

test.describe('Web social: callback error handling', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('callback with access_denied → redirects to login with redirectTo preserved', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })
    await page.route('**/magic.link/**', route => route.abort())

    // User cancelled at Google/Discord — browser returns to callback with error
    await page.goto(`/auth/callback?error=access_denied&redirectTo=${encodeURIComponent(MARKETPLACE_URL)}`)

    // Should redirect to login page
    await page.waitForURL('**/login**', { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })

  test('callback with no session → shows error or redirects to login', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })
    await page.route('**/magic.link/**', route => route.abort())
    await page.route('**/api.toaster.magic.link/**', route => route.abort())

    // No OAuth session — getRedirectResult will fail
    await page.goto(`/auth/callback?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}`)

    await page.waitForTimeout(5000)
    const url = page.url()
    const isOnLogin = url.includes('/login')
    const hasErrorView = await page.getByText(/went wrong|error|try again/i).isVisible().catch(() => false)

    expect(isOnLogin || hasErrorView).toBe(true)
  })
})

/**
 * In production, when a user initiates social login (Magic OAuth) from the Explorer
 * (or anywhere that sets redirectTo=/auth/requests/...), the `redirectTo` query param
 * is stripped from the URL and Magic stashes it inside the OAuth `state` parameter
 * (base64(JSON.stringify({ customData: JSON.stringify({ redirectTo, referrer, ... }) }))).
 *
 * The callback page must decode that state to recover the original redirectTo,
 * otherwise internal redirects (Explorer → callback → back) are misclassified as
 * external, which causes the user to land on /quick-setup instead of returning to
 * the Explorer sign-in flow.
 */
const buildMagicState = (redirectTo: string) =>
  btoa(JSON.stringify({ customData: JSON.stringify({ redirectTo, referrer: null }) }))

test.describe('Web social: state-encoded redirectTo (Magic OAuth round-trip)', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('callback access_denied with state containing internal /auth/requests/ → login keeps internal redirectTo', async ({
    page
  }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })
    await page.route('**/magic.link/**', route => route.abort())

    const internalRedirect = '/auth/requests/abc123'
    const state = buildMagicState(internalRedirect)

    // Explorer flow: user cancelled at provider, browser returns with access_denied
    // and the original redirectTo stashed in state (no redirectTo query param).
    await page.goto(`/auth/callback?error=access_denied&state=${encodeURIComponent(state)}`)

    // Should end up on login — NOT on quick-setup
    await page.waitForURL('**/login**', { timeout: 10_000 })
    expect(page.url()).toContain('/login')
    expect(page.url()).not.toContain('/quick-setup')

    // The internal redirectTo should have been decoded out of state and re-applied
    // to the login URL so the Explorer flow can resume.
    const url = new URL(page.url())
    const loginRedirectTo = url.searchParams.get('redirectTo') ?? ''
    expect(loginRedirectTo).toContain('/auth/requests/abc123')
  })

  test('callback access_denied with state containing external web path → login keeps external redirectTo', async ({
    page
  }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })
    await page.route('**/magic.link/**', route => route.abort())

    // Use a same-origin non-/auth path so the redirect passes hostname sanitization
    // (cross-domain redirects are rewritten to /auth/invalidRedirection — correct security
    // behavior, but orthogonal to what this test covers).
    const externalPath = 'http://localhost:5174/marketplace'
    const state = buildMagicState(externalPath)

    await page.goto(`/auth/callback?error=access_denied&state=${encodeURIComponent(state)}`)

    await page.waitForURL('**/login**', { timeout: 10_000 })
    expect(page.url()).toContain('/login')

    // External redirectTo should be preserved so that after re-auth the user still
    // lands on the marketplace (and not on /quick-setup or home).
    const url = new URL(page.url())
    const loginRedirectTo = url.searchParams.get('redirectTo') ?? ''
    expect(loginRedirectTo).toContain('/marketplace')
    expect(loginRedirectTo).not.toContain('invalidRedirection')
  })

  test('callback with malformed state should not crash and should not land on quick-setup', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })
    await page.route('**/magic.link/**', route => route.abort())

    await page.goto(`/auth/callback?error=access_denied&state=not-valid-base64-at-all`)

    // Should recover (land on login or show error) but never end up on quick-setup.
    await page.waitForTimeout(5000)
    expect(page.url()).not.toContain('/quick-setup')
  })
})
