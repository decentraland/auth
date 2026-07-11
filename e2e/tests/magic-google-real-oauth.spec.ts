import { test, expect } from '@playwright/test'

/**
 * Real Magic + Google OAuth E2E.
 *
 * Unlike `web-social-flow.spec.ts` which mocks the Magic SDK, this spec drives
 * the actual Google login form and consent screen. Catches the failures that
 * mocks can't: popup blockers, redirect URI mismatches, consent screen layout
 * changes, third-party-cookie regressions.
 *
 * REQUIREMENTS to run (auto-skipped otherwise):
 *   - E2E_GOOGLE_EMAIL    — test Google account email
 *   - E2E_GOOGLE_PASSWORD — test Google account password
 *
 * RECOMMENDED extras:
 *   - Run with `--headed` for first execution so a captured `storageState`
 *     can replay Google's "remember this device" cookies on subsequent runs.
 *   - Wire as a nightly CI job — Google's bot detection occasionally trips
 *     CAPTCHA, so this should NOT gate main-line PR merges.
 *
 * See e2e/README.md for env-var wiring and known caveats.
 */
const E2E_GOOGLE_EMAIL = process.env.E2E_GOOGLE_EMAIL
const E2E_GOOGLE_PASSWORD = process.env.E2E_GOOGLE_PASSWORD

test.describe('Real Magic + Google OAuth (nightly)', () => {
  test.skip(
    !E2E_GOOGLE_EMAIL || !E2E_GOOGLE_PASSWORD,
    'Set E2E_GOOGLE_EMAIL + E2E_GOOGLE_PASSWORD to run this spec (see e2e/README.md).'
  )

  test('Continue with Google → Google login → consent → returns to /auth/callback → identity established', async ({
    page,
    context
  }) => {
    test.setTimeout(120_000)

    await page.goto('/auth/login')

    // 1. Click the Google CTA. The dapp delegates to Magic SDK which redirects
    //    to https://accounts.google.com/...
    await page.getByRole('button', { name: /continue with google/i }).click()
    await page.waitForURL(/accounts\.google\.com/, { timeout: 30_000 })

    // 2. Google login: email step.
    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeVisible({ timeout: 15_000 })
    await emailInput.fill(E2E_GOOGLE_EMAIL as string)
    await page.getByRole('button', { name: /^next$/i }).first().click()

    // 3. Password step.
    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible({ timeout: 15_000 })
    await passwordInput.fill(E2E_GOOGLE_PASSWORD as string)
    await page.getByRole('button', { name: /^next$/i }).first().click()

    // 4. Consent screen may or may not appear depending on prior grant. Click
    //    Continue/Allow if present, otherwise fall through.
    const consentButton = page.getByRole('button', { name: /^(continue|allow)$/i }).first()
    await consentButton.click({ timeout: 10_000 }).catch(() => undefined)

    // 5. Back on the dapp at /auth/callback.
    await page.waitForURL(/\/auth\/callback/, { timeout: 30_000 })

    // 6. New user → routed to setup (/quick-setup or /setup). Existing user →
    //    away from /auth entirely.
    await page.waitForURL(url => !url.pathname.startsWith('/auth/callback'), { timeout: 30_000 })
    expect(page.url()).not.toContain('/auth/callback')

    // 7. Persist Google's "remember this device" cookies so subsequent runs
    //    skip the password step.
    if (process.env.E2E_PERSIST_STORAGE_STATE) {
      await context.storageState({ path: 'e2e/.storage/google-session.json' })
    }
  })
})
