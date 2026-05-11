import { BrowserContext, Page } from '@playwright/test'
import { Authenticator, AuthIdentity } from '@dcl/crypto'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
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
  existingProfileResponse,
  defaultProfileEntityResponse
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

const ONE_MONTH_IN_MINUTES = 60 * 24 * 30

/**
 * Pre-populate everything the app needs to consider the user already logged in:
 * mock Ethereum provider bound to a fresh address, decentraland-connect storage
 * (so `tryPreviousConnection` finds the provider), and a structurally-valid
 * AuthIdentity in the SSO storage. The ephemeral private key is real, so
 * `Authenticator.signPayload` can produce valid signatures for deploys.
 *
 * Returns the generated wallet address so the caller can wire mocks that
 * depend on it.
 */
export async function injectFullSession(
  context: BrowserContext,
  options: { providerType?: string; chainId?: number } = {}
): Promise<{ address: string; identity: AuthIdentity }> {
  const { providerType = 'injected', chainId = 1 } = options

  const userPk = generatePrivateKey()
  const userAccount = privateKeyToAccount(userPk)
  const ephemeralPk = generatePrivateKey()
  const ephemeralAccount = privateKeyToAccount(ephemeralPk)

  const identity = await Authenticator.initializeAuthChain(
    userAccount.address,
    {
      address: ephemeralAccount.address,
      publicKey: ephemeralAccount.publicKey,
      privateKey: ephemeralPk
    },
    ONE_MONTH_IN_MINUTES,
    async message => userAccount.signMessage({ message })
  )

  await context.addInitScript(createMockProviderScript(userAccount.address))

  await context.exposeFunction('__e2eSign', async (message: string) => {
    return userAccount.signMessage({ message })
  })

  await context.addInitScript(
    ({ providerType, chainId }) => {
      localStorage.setItem('decentraland-connect-storage-key', JSON.stringify({ providerType, chainId }))
    },
    { providerType, chainId }
  )

  await context.addInitScript(
    ({ key, identity }) => {
      localStorage.setItem(key, JSON.stringify(identity))
    },
    { key: `single-sign-on-${userAccount.address.toLowerCase()}`, identity }
  )

  return { address: userAccount.address, identity }
}

/**
 * Auth-server URL for the dev environment (decentraland.zone). Requests created
 * here are visible to the auth dapp deployed at https://decentraland.zone/auth.
 */
export const DEV_AUTH_SERVER_URL = 'https://auth-api.decentraland.zone'

/**
 * Create a real auth-server request and return its `requestId`. The request
 * lives on the real auth-server (no mocking) so the auth dapp's RequestPage
 * can recover it normally over HTTP.
 *
 * For `dcl_personal_sign` the auth-server allows anonymous creation. For
 * `eth_sendTransaction` it requires an `authChain` in the body — pass the
 * `identity` returned by `injectFullSession` and the helper extracts the
 * SIGNER + ECDSA_EPHEMERAL links the server expects.
 */
export async function createAuthServerRequest(
  options: {
    method: string
    params: unknown[]
    identity?: AuthIdentity
    authServerUrl?: string
  }
): Promise<{ requestId: string; code?: number; expiration: string }> {
  const { method, params, identity, authServerUrl = DEV_AUTH_SERVER_URL } = options
  const body: Record<string, unknown> = { method, params }

  if (identity) {
    // The auth-server expects the first two links of the auth chain
    // (SIGNER + ECDSA_EPHEMERAL) in the request body — not the full
    // signPayload chain.
    body.authChain = identity.authChain
  }

  const response = await fetch(`${authServerUrl}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const respBody = await response.text()
    throw new Error(`auth-server POST /requests ${response.status}: ${respBody}`)
  }

  return response.json() as Promise<{ requestId: string; code?: number; expiration: string }>
}

/**
 * Mock the Catalyst content endpoints used by `SetupPage`'s deploy flow:
 *   - POST /content/entities/active with a `default<N>` pointer →
 *     returns a fake default profile entity so `fetchEntitiesByPointers` resolves.
 *   - POST /content/entities (deploy) → returns 200 (or `status`) after `delayMs`.
 *
 * Call this AFTER `mockApiRoutes`. Playwright matches the most-recently-added
 * route first, so this override wins for the deploy POST.
 */
export async function mockCatalystDeployRoute(
  page: Page,
  options: { status?: number; delayMs?: number } = {}
) {
  const { status = 200, delayMs = 0 } = options

  await page.route('**/content/entities/active**', async (route, request) => {
    if (request.method() === 'POST') {
      const body = request.postData() ?? ''
      if (/default\d+/.test(body)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([defaultProfileEntityResponse])
        })
      }
    }
    return route.fallback()
  })

  await page.route('**/content/entities', async (route, request) => {
    if (request.method() === 'POST' && !request.url().includes('active')) {
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
      if (status >= 200 && status < 300) {
        return route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({ creationTimestamp: Date.now() })
        })
      }
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Deployment failed' })
      })
    }
    return route.fallback()
  })
}

/**
 * Mock the newsletter subscription endpoint (POST {BUILDER_SERVER_URL}/v1/newsletter)
 * used by `SetupPage`. Captures POSTed bodies so tests can assert on them.
 */
export function mockNewsletterRoute(page: Page, options: { status?: number } = {}): {
  posts: Array<{ email?: string; source?: string }>
} {
  const { status = 200 } = options
  const posts: Array<{ email?: string; source?: string }> = []

  page.route('**/v1/newsletter', async (route, request) => {
    if (request.method() === 'POST') {
      try {
        posts.push(JSON.parse(request.postData() ?? '{}'))
      } catch {
        posts.push({})
      }
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: status >= 200 && status < 300 ? '{"ok":true}' : '{"error":"newsletter failure"}'
      })
    }
    return route.fallback()
  })

  return { posts }
}

/**
 * Mock the referral tracking endpoint (POST/PATCH {REFERRAL_SERVER_URL}/referral-progress)
 * used by `useTrackReferral`. Captures requests so tests can assert on method + body.
 */
export function mockReferralRoute(page: Page, options: { status?: number } = {}): {
  requests: Array<{ method: string; body: { referrer?: string } | null }>
} {
  const { status = 200 } = options
  const requests: Array<{ method: string; body: { referrer?: string } | null }> = []

  page.route('**/referral-progress', async (route, request) => {
    const method = request.method()
    if (method === 'POST' || method === 'PATCH') {
      let body: { referrer?: string } | null = null
      try {
        const raw = request.postData()
        body = raw ? JSON.parse(raw) : null
      } catch {
        body = null
      }
      requests.push({ method, body })
      return route.fulfill({
        status,
        contentType: 'application/json',
        body: status >= 200 && status < 300 ? '{"ok":true}' : '{"error":"referral failure"}'
      })
    }
    return route.fallback()
  })

  return { requests }
}

/**
 * A single wallet write the mock provider observed (eth_sendTransaction or
 * eth_sendRawTransaction). The `params[0]` shape mirrors what the dapp's
 * walletClient forwarded — same fields a real wallet would have received.
 */
export type CapturedWalletTx = { method: 'eth_sendTransaction' | 'eth_sendRawTransaction'; params: unknown[]; ts: number }

/**
 * Hook the mock Ethereum provider so every `eth_sendTransaction` /
 * `eth_sendRawTransaction` submission lands in a Node-side journal. Returned
 * array is mutated as the dapp makes calls, so tests can assert on it after
 * clicking Approve.
 *
 * Must be called BEFORE `page.goto`, so the exposed function is registered
 * before any user code runs.
 */
export async function captureWalletTransactions(context: BrowserContext): Promise<CapturedWalletTx[]> {
  const log: CapturedWalletTx[] = []
  await context.exposeFunction('__e2eRecordTx', (method: string, params: unknown[]) => {
    log.push({ method: method as CapturedWalletTx['method'], params, ts: Date.now() })
  })
  return log
}

/**
 * Poll the real auth-server's outcome endpoint (`GET /requests/{requestId}`)
 * until the dapp submits the signed result (signature or tx hash).
 *
 * The endpoint returns 204 No Content while the request is pending; once the
 * outcome is POSTed by the dapp it switches to 200 with `{ sender, result }`.
 * Distinct from the dapp's `/v2/requests/{id}` recover endpoint, which returns
 * the unfulfilled request payload.
 */
export async function pollForOutcome(
  requestId: string,
  options: { timeoutMs?: number; intervalMs?: number; authServerUrl?: string } = {}
): Promise<{ sender: string; result: unknown }> {
  const { timeoutMs = 15_000, intervalMs = 500, authServerUrl = DEV_AUTH_SERVER_URL } = options
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const response = await fetch(`${authServerUrl}/requests/${requestId}`)
    if (response.status === 204) {
      await new Promise(r => setTimeout(r, intervalMs))
      continue
    }
    if (!response.ok) {
      throw new Error(`auth-server GET /requests/${requestId} ${response.status}: ${await response.text()}`)
    }
    return response.json() as Promise<{ sender: string; result: unknown }>
  }
  throw new Error(`pollForOutcome timed out after ${timeoutMs}ms for ${requestId}`)
}

export { MOCK_WALLET, MOCK_REQUEST_ID }
