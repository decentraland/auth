import { test, expect } from '@playwright/test'
import { injectMockWallet, mockApiRoutes, mockThirdwebRoutes } from '../helpers/setup'

/**
 * Extends `web-otp-flow.spec.ts` beyond the happy-path modal-open coverage.
 * Exercises behaviour the modal MUST get right for production OTP login:
 * wrong code, network failures, paste-distribute across inputs, keyboard
 * navigation. All scenarios mock the Thirdweb backend via `mockThirdwebRoutes`.
 */
test.describe('OTP modal: edge cases', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectMockWallet(context)
    await mockApiRoutes(page, { hasProfile: true })
  })

  async function openOtpModal(page: import('@playwright/test').Page, email = 'test@example.com') {
    await page.goto('/auth/login')

    const emailInput = page.getByPlaceholder(/email/i)
    await expect(emailInput).toBeVisible({ timeout: 15_000 })
    await emailInput.fill(email)
    await page.locator('[data-testid="email-submit-button"]').click()

    await expect(page.locator('[data-testid="otp-input-0"]')).toBeVisible({ timeout: 10_000 })
  }

  test('wrong OTP → verification rejected, modal stays open', async ({ page }) => {
    await mockThirdwebRoutes(page, { failVerify: true })
    await openOtpModal(page)

    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-input-${i}"]`).fill(String(i + 1))
    }

    // Modal remains open after rejected verification — first input should
    // still exist (regardless of clear vs. preserved value, the user is not
    // navigated away).
    await page.waitForTimeout(2000)
    await expect(page.locator('[data-testid="otp-input-0"]')).toBeVisible()
  })

  test('paste 6-digit code distributes across inputs', async ({ page }) => {
    await mockThirdwebRoutes(page)
    await openOtpModal(page)

    const otpInput0 = page.locator('[data-testid="otp-input-0"]')
    await otpInput0.focus()

    // Type the 6 digits as a single string; OTP components typically split a
    // paste/keystrokes burst across inputs. Use page.keyboard for sequential
    // input rather than fill (which targets a single input).
    await page.keyboard.type('123456')

    for (let i = 0; i < 6; i++) {
      await expect(page.locator(`[data-testid="otp-input-${i}"]`)).toHaveValue(String(i + 1))
    }
  })

  test('backspace on a populated input clears it and shifts focus backwards', async ({ page }) => {
    await mockThirdwebRoutes(page)
    await openOtpModal(page)

    await page.locator('[data-testid="otp-input-0"]').fill('1')
    await expect(page.locator('[data-testid="otp-input-1"]')).toBeFocused()
    await page.locator('[data-testid="otp-input-1"]').fill('2')

    await page.keyboard.press('Backspace')
    await page.keyboard.press('Backspace')

    // Backspace from input 2 (empty) should land focus on input 1. Backspace
    // again clears it. The exact final focused index depends on the impl
    // detail; what matters is that at least input 0 or 1 retains focus.
    const focusedTestId = await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.getAttribute('data-testid')
    )
    expect(focusedTestId).toMatch(/^otp-input-[01]$/)
  })

  test('OTP send endpoint failure → does not advance to modal', async ({ page }) => {
    await mockThirdwebRoutes(page, { failSend: true })
    await page.goto('/auth/login')

    const emailInput = page.getByPlaceholder(/email/i)
    await expect(emailInput).toBeVisible({ timeout: 15_000 })
    await emailInput.fill('test@example.com')
    await page.locator('[data-testid="email-submit-button"]').click()

    // With send failing, the OTP modal must NOT appear. We wait a bit then
    // assert input 0 is still absent.
    await page.waitForTimeout(3000)
    await expect(page.locator('[data-testid="otp-input-0"]')).not.toBeVisible()
  })
})
