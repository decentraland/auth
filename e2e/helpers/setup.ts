import { BrowserContext, Page } from '@playwright/test'
import { createMockProviderScript } from '../fixtures/ethereum-provider'
import {
  MOCK_WALLET,
  MOCK_REQUEST_ID,
  recoverRequestResponse,
  recoverRequestNoCodeResponse,
  recoverRequestDifferentSenderResponse,
  recoverRequestExpiredResponse,
  outcomeResponse,
  healthResponse,
  featureFlagsResponse,
  explorerFeatureFlagsResponse,
  emptyProfileResponse,
  existingProfileResponse
} from '../fixtures/mock-responses'

type SetupOptions = {
  /** Whether the user has an existing profile (default: true) */
  hasProfile?: boolean
  /** Whether ONBOARDING_TO_EXPLORER FF is enabled (default: true) */
  onboardingToExplorer?: boolean
  /** Whether the auth-server recover response includes a verification code (default: true) */
  showVerificationCode?: boolean
  /** Whether LOGIN_ON_SETUP FF is enabled (default: false) */
  loginOnSetup?: boolean
}

/**
 * Inject mock MetaMask provider into all pages in the context.
 * Must be called BEFORE navigating to any page.
 */
export async function injectMockWallet(context: BrowserContext) {
  // Inject mock provider before any page loads
  await context.addInitScript(createMockProviderScript(MOCK_WALLET))

  // Expose signing function (returns dummy signature)
  await context.exposeFunction('__e2eSign', async (message: string) => {
    // Return a dummy signature — auth-server is mocked anyway
    return '0x' + 'ab'.repeat(65)
  })
}

/**
 * Set up route interception for all API calls.
 * Intercepts auth-server, feature-flags, and profile endpoints.
 */
export async function mockApiRoutes(page: Page, options: SetupOptions = {}) {
  const { hasProfile = true, onboardingToExplorer = true, showVerificationCode = true, loginOnSetup = false } = options

  // Auth server: recover request
  await page.route('**/v2/requests/**', async (route, request) => {
    const method = request.method()
    const url = request.url()

    if (method === 'GET' && !url.includes('/outcome')) {
      const response = showVerificationCode ? recoverRequestResponse : recoverRequestNoCodeResponse
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    }

    // POST outcome
    if (method === 'POST' && url.includes('/outcome')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(outcomeResponse)
      })
    }

    // POST notify-validation (LOGIN_ON_SETUP)
    if (method === 'POST' && url.includes('/notify')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      })
    }

    return route.continue()
  })

  // Auth server: health (for clock sync)
  await page.route('**/health', async route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ timestamp: Date.now() })
    })
  })

  // Feature flags
  const ffResponse = {
    ...featureFlagsResponse,
    flags: {
      ...featureFlagsResponse.flags,
      'dapps-onboarding-to-explorer': onboardingToExplorer,
      'dapps-login-on-setup': loginOnSetup
    }
  }
  await page.route('**/feature-flags**/dapps.json', async route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ffResponse)
    })
  })

  await page.route('**/feature-flags**/explorer.json', async route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(explorerFeatureFlagsResponse)
    })
  })

  // Profile endpoints (catalyst)
  await page.route('**/content/entities/active**', async route => {
    const profileResponse = hasProfile ? existingProfileResponse : emptyProfileResponse
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'test-entity',
          type: 'profile',
          pointers: [MOCK_WALLET],
          timestamp: Date.now(),
          content: [],
          metadata: profileResponse
        }
      ])
    })
  })

  // Profile lambdas
  await page.route('**/lambdas/profiles/**', async route => {
    const profileResponse = hasProfile ? existingProfileResponse : emptyProfileResponse
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(profileResponse)
    })
  })

  // Profile lambdas (alternate format)
  await page.route('**/lambdas/profile/**', async route => {
    const profileResponse = hasProfile ? existingProfileResponse : emptyProfileResponse
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(profileResponse)
    })
  })

  // Content server entities
  await page.route('**/content/entities**', async route => {
    if (!hasProfile) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    }
    return route.continue()
  })

  // Catch-all for peer/catalyst profile endpoints
  await page.route('**/peer.decentraland.*/**', async route => {
    const url = route.request().url()
    if (url.includes('/content/') || url.includes('/lambdas/')) {
      const profileResponse = hasProfile ? existingProfileResponse : emptyProfileResponse
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(url.includes('entities') && !hasProfile ? [] : profileResponse)
      })
    }
    return route.continue()
  })

  // Block Segment analytics to avoid noise
  await page.route('**/api.segment.io/**', route => route.abort())
  await page.route('**/cdn.segment.com/**', route => route.abort())

  // Block Sentry
  await page.route('**/sentry.io/**', route => route.abort())

  // Block Intercom
  await page.route('**/intercom.io/**', route => route.abort())
  await page.route('**/intercomcdn.com/**', route => route.abort())
}

/**
 * Options controlling mocked Thirdweb SDK behavior.
 */
type ThirdwebMockOptions = {
  /** Address returned by the verify-OTP callback. Defaults to MOCK_WALLET. */
  walletAddress?: string
  /** When true, the verify-OTP endpoint returns 400 (invalid code). Default: false. */
  failVerify?: boolean
  /** When true, the send-OTP endpoint returns 500. Default: false. */
  failSend?: boolean
}

/**
 * Intercept Thirdweb in-app-wallet HTTP traffic so tests never hit the real
 * SDK backend. Covers:
 *   - `POST /api/2024-05-05/login/email`          → send OTP
 *   - `POST /api/2024-05-05/login/email/callback` → verify OTP
 *   - Any other `embedded-wallet.thirdweb.com`, `c.thirdweb.com`,
 *     or `social.thirdweb.com` requests are stubbed to avoid real calls.
 *
 * Must be called BEFORE any action that would trigger a Thirdweb network call.
 */
export async function mockThirdwebRoutes(page: Page, options: ThirdwebMockOptions = {}) {
  const { walletAddress = MOCK_WALLET, failVerify = false, failSend = false } = options

  await page.route('**/embedded-wallet.thirdweb.com/**', async route => {
    const url = route.request().url()
    const method = route.request().method()

    // Send OTP — POST /api/<date>/login/email
    if (method === 'POST' && /\/login\/email(\?|$)/.test(url)) {
      if (failSend) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Failed to send verification code' })
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isNewUser: true })
      })
    }

    // Verify OTP — POST /api/<date>/login/email/callback
    if (method === 'POST' && /\/login\/email\/callback/.test(url)) {
      if (failVerify) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Failed to verify verification code' })
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          storedToken: {
            authDetails: {
              email: 'test@example.com',
              userWalletId: walletAddress,
              walletAddress
            },
            cookieString: 'e2e-mock-cookie',
            developerClientId: 'e2e-mock-client',
            jwtToken: 'e2e-mock-jwt',
            shouldStoreCookieString: true
          },
          walletDetails: {
            walletAddress
          }
        })
      })
    }

    // Any other thirdweb call → stub as success to avoid real network
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}'
    })
  })

  // Thirdweb analytics / telemetry
  await page.route('**/c.thirdweb.com/**', route => route.abort())
  await page.route('**/social.thirdweb.com/**', route => route.abort())
}

/**
 * Inject a previous connection into localStorage so that ConnectionProvider
 * restores the wallet via tryPreviousConnection() on mount — without needing
 * the user to go through the login flow.
 *
 * Must be called AFTER page.goto() (needs a page context for evaluate),
 * but BEFORE the app reads localStorage (i.e. before React mounts).
 * Best used via context.addInitScript().
 */
export function createPreviousConnectionScript(providerType = 'injected', chainId = 1): string {
  const data = JSON.stringify({ providerType, chainId })
  return `localStorage.setItem('decentraland-connect-storage-key', '${data}');`
}

/**
 * Inject previous connection into the browser context so it's available
 * before any page loads. Use this to simulate a returning user who already
 * has a wallet session persisted.
 */
export async function injectPreviousConnection(context: BrowserContext, providerType = 'injected', chainId = 1) {
  await context.addInitScript(createPreviousConnectionScript(providerType, chainId))
}

export { MOCK_WALLET, MOCK_REQUEST_ID }
