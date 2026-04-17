import { test, expect } from '@playwright/test'
import { injectMockWallet, mockApiRoutes, MOCK_WALLET } from '../helpers/setup'

test.describe('Web → Email OTP login flow', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('should show email input on LoginPage', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.goto('/auth/login')

    // LoginPage should render with email input (lazy loaded)
    await expect(page.getByPlaceholder(/email/i)).toBeVisible({ timeout: 15_000 })
  })

  test('should open OTP modal after entering email', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Mock Thirdweb's sendEmailOTP — intercept the API call
    await page.route('**/embedded-wallet/**', async route => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await page.route('**/in-app-wallet/**', async route => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await page.route('**/thirdweb.com/**', async route => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    await page.goto('/auth/login')

    // Wait for the login page to load
    const emailInput = page.getByPlaceholder(/email/i)
    await expect(emailInput).toBeVisible({ timeout: 15_000 })

    // Enter email
    await emailInput.fill('test@example.com')

    // Click the NEXT/submit button for email
    const submitButton = page.locator('[data-testid="email-submit-button"]')
    await expect(submitButton).toBeVisible({ timeout: 5000 })
    await submitButton.click()

    // OTP modal should appear (or at least the email was submitted)
    // The Thirdweb SDK call might fail in test, but we verify the flow triggers
    await page.waitForTimeout(3000)

    // OTP modal should appear after email submission
    const otpInput = page.locator('[data-testid="otp-input-0"]')
    await expect(otpInput).toBeVisible({ timeout: 10_000 })

    // OTP modal rendered — verify all 6 inputs
    for (let i = 0; i < 6; i++) {
      await expect(page.locator(`[data-testid="otp-input-${i}"]`)).toBeVisible()
    }
  })

  test('OTP modal: should accept digit input and auto-focus next', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Mock all Thirdweb calls
    await page.route('**/embedded-wallet/**', route => route.fulfill({ status: 200, body: '{}' }))
    await page.route('**/in-app-wallet/**', route => route.fulfill({ status: 200, body: '{}' }))
    await page.route('**/thirdweb.com/**', route => route.fulfill({ status: 200, body: '{}' }))

    await page.goto('/auth/login')

    const emailInput = page.getByPlaceholder(/email/i)
    await expect(emailInput).toBeVisible({ timeout: 15_000 })
    await emailInput.fill('test@example.com')

    // Submit email
    const submitButton2 = page.locator('[data-testid="email-submit-button"]')
    await expect(submitButton2).toBeVisible({ timeout: 5000 })
    await submitButton2.click()

    // Wait for OTP modal
    const otpInput0 = page.locator('[data-testid="otp-input-0"]')
    await expect(otpInput0).toBeVisible({ timeout: 10_000 })

    // Type digits — each should auto-focus the next
    await otpInput0.fill('1')
    await expect(page.locator('[data-testid="otp-input-1"]')).toBeFocused()

    // Verify paste works
    await otpInput0.focus()
    await page.keyboard.press('Control+A')
    // Type all 6 digits
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="otp-input-${i}"]`).fill(String(i + 1))
    }

    // All inputs should have values
    for (let i = 0; i < 6; i++) {
      await expect(page.locator(`[data-testid="otp-input-${i}"]`)).toHaveValue(String(i + 1))
    }
  })

  test('OTP modal: back button should close modal', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.route('**/embedded-wallet/**', route => route.fulfill({ status: 200, body: '{}' }))
    await page.route('**/in-app-wallet/**', route => route.fulfill({ status: 200, body: '{}' }))
    await page.route('**/thirdweb.com/**', route => route.fulfill({ status: 200, body: '{}' }))

    await page.goto('/auth/login')

    const emailInput = page.getByPlaceholder(/email/i)
    await expect(emailInput).toBeVisible({ timeout: 15_000 })
    await emailInput.fill('test@example.com')

    const submitButton2 = page.locator('[data-testid="email-submit-button"]')
    await expect(submitButton2).toBeVisible({ timeout: 5000 })
    await submitButton2.click()

    const otpInput0 = page.locator('[data-testid="otp-input-0"]')
    await expect(otpInput0).toBeVisible({ timeout: 10_000 })

    // Click back button
    const backButton = page.locator('[data-testid="email-login-back-button"]')
    await expect(backButton).toBeVisible()
    await backButton.click()

    // OTP modal should close
    await expect(otpInput0).not.toBeVisible({ timeout: 3000 })
  })

  test('OTP modal: close button should dismiss modal', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    await page.route('**/embedded-wallet/**', route => route.fulfill({ status: 200, body: '{}' }))
    await page.route('**/in-app-wallet/**', route => route.fulfill({ status: 200, body: '{}' }))
    await page.route('**/thirdweb.com/**', route => route.fulfill({ status: 200, body: '{}' }))

    await page.goto('/auth/login')

    const emailInput = page.getByPlaceholder(/email/i)
    await expect(emailInput).toBeVisible({ timeout: 15_000 })
    await emailInput.fill('test@example.com')

    const submitButton2 = page.locator('[data-testid="email-submit-button"]')
    await expect(submitButton2).toBeVisible({ timeout: 5000 })
    await submitButton2.click()

    const otpInput0 = page.locator('[data-testid="otp-input-0"]')
    await expect(otpInput0).toBeVisible({ timeout: 10_000 })

    const closeButton = page.locator('[data-testid="email-login-close-button"]')
    await expect(closeButton).toBeVisible()
    await closeButton.click()

    await expect(otpInput0).not.toBeVisible({ timeout: 3000 })
  })

  test('email loginMethod=email should render LoginPage (not AutoLoginRedirect)', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: true, onboardingToExplorer: true })

    // Email is NOT in AUTO_LOGIN_METHODS — should show full LoginPage
    await page.goto('/auth/login?loginMethod=email')

    // Should see the email input (LoginPage), not "Redirecting..." (AutoLoginRedirect)
    await page.waitForTimeout(3000)
    await expect(page.getByText(/redirecting/i)).not.toBeVisible()
    await expect(page.getByPlaceholder(/email/i)).toBeVisible({ timeout: 10_000 })
  })
})
