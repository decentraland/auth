import { test, expect } from '@playwright/test'
import { createAuthServerRequest, injectFullSession, mockApiRoutes, pollForOutcome } from '../helpers/setup'

/**
 * Exercises RequestPage rendering for `dcl_personal_sign` requests against the
 * real auth-server (no /v2/requests/** mock). Each test creates a fresh request
 * via POST https://auth-api.decentraland.zone/requests and navigates the dapp
 * deployed at decentraland.zone/auth to /auth/requests/{requestId}.
 *
 * Two distinct paths:
 *   - `skipSetup=true` (Explorer flow, no redirectTo) + new user → auto-sign
 *     transitions directly to VERIFY_SIGN_IN_COMPLETE. We additionally poll
 *     the auth-server's outcome endpoint to confirm the signature was reported
 *     under the connected wallet.
 *   - `skipSetup=false` (returning user) → shows VERIFY_SIGN_IN with the
 *     auth-server verification code visible.
 *
 * The forwarding layer used in the eth_sendTransaction specs doesn't apply
 * here — personal_sign signatures go through `__e2eSign` (already verified by
 * the auth-server's outcome check below).
 */
test.describe('RequestPage: dcl_personal_sign (arbitrary message)', () => {
  test.beforeEach(async ({ context }) => {
    await injectFullSession(context)
  })

  test('Explorer flow (no redirectTo) + new user → auto-signs, reports signature outcome', async ({ page }) => {
    const { requestId } = await createAuthServerRequest({
      method: 'dcl_personal_sign',
      params: ['Please sign this dapp-specific message to authorise action.']
    })

    await page.goto(`/auth/requests/${requestId}`)

    // (1) Display
    await expect(page.getByRole('heading', { name: /sign in successful/i })).toBeVisible({ timeout: 25_000 })

    // (3) Outcome — the auto-sign path also reports back to the auth-server.
    // Result is the EIP-191 signature (130 hex chars after 0x).
    const outcome = await pollForOutcome(requestId)
    expect(outcome.sender).toBeTruthy()
    expect(outcome.result).toMatch(/^0x[a-f0-9]{130}$/)
  })

  test('Explorer flow + returning user → verification code from auth-server is rendered', async ({ page }) => {
    // Mock the Catalyst profile lookup so the dapp treats this random wallet as a
    // returning user — that's the branch that routes to the verification screen
    // (skipSetup=true + profile exists → VERIFY_SIGN_IN). Profile mocking is fine;
    // the auth-server calls (/v2/requests/**) are left to hit the real backend
    // via the route.continue() override below.
    await mockApiRoutes(page, { hasProfile: true })
    await page.route('**/v2/requests/**', route => route.continue())

    const { requestId, code } = await createAuthServerRequest({
      method: 'dcl_personal_sign',
      params: ['Sign in to acme dapp']
    })

    expect(code).toBeDefined()

    await page.goto(`/auth/requests/${requestId}`)

    // The auth-server returns a numeric code; the dapp's verification screen
    // surfaces it so the user can match it against what their original app shows.
    await expect(page.getByText(String(code))).toBeVisible({ timeout: 25_000 })
  })
})
