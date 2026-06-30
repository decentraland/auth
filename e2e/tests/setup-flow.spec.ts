import { test, expect } from '@playwright/test'
import {
  injectFullSession,
  mockApiRoutes,
  mockCatalystDeployRoute,
  mockNewsletterRoute,
  mockReferralRoute
} from '../helpers/setup'

const MARKETPLACE_URL = 'https://decentraland.org/marketplace'
const VALID_REFERRER = '0x1234567890123456789012345678901234567890'

const PAGE_LOAD_TIMEOUT = 15_000

test.describe('SetupPage: /setup onboarding flow', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectFullSession(context)
    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })
  })

  async function gotoFormView(page: import('@playwright/test').Page, search = '') {
    await page.goto(`/auth/setup${search}`)
    await expect(page.getByText('Welcome to Decentraland!')).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT })
    await page.getByTestId('setup-continue-button').click()
    await expect(page.getByText('Complete your Profile')).toBeVisible()
  }

  test('randomize view → continue → form view renders', async ({ page }) => {
    await page.goto('/auth/setup')
    await expect(page.getByText('Welcome to Decentraland!')).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT })
    await expect(page.getByTestId('setup-randomize-button')).toBeVisible()

    await page.getByTestId('setup-continue-button').click()
    await expect(page.getByText('Complete your Profile')).toBeVisible()
    await expect(page.getByPlaceholder(/enter your username/i)).toBeVisible()
  })

  test('submit with empty name → username_empty error shown', async ({ page }) => {
    await gotoFormView(page)

    await page.getByRole('checkbox').check()
    await page.getByTestId('setup-submit-button').click()

    await expect(page.getByText('Please enter your username.')).toBeVisible()
  })

  test('submit with 15-char name → username_max_length error shown', async ({ page }) => {
    await gotoFormView(page)

    await page.getByPlaceholder(/enter your username/i).fill('Abcdefghijklmno') // exactly 15 chars; >= 15 triggers
    await page.getByRole('checkbox').check()
    await page.getByTestId('setup-submit-button').click()

    await expect(page.getByText('Sorry, usernames can have a maximum of 15 characters.')).toBeVisible()
  })

  test('submit with spaces in name → username_no_spaces error shown', async ({ page }) => {
    await gotoFormView(page)

    await page.getByPlaceholder(/enter your username/i).fill('abc def')
    await page.getByRole('checkbox').check()
    await page.getByTestId('setup-submit-button').click()

    await expect(page.getByText('Sorry, spaces are not permitted.')).toBeVisible()
  })

  test('submit with special chars in name → username_no_special_chars error shown', async ({ page }) => {
    await gotoFormView(page)

    await page.getByPlaceholder(/enter your username/i).fill('abc!def')
    await page.getByRole('checkbox').check()
    await page.getByTestId('setup-submit-button').click()

    await expect(page.getByText(/special characters/i)).toBeVisible()
  })

  test('ToS unchecked → submit button disabled even with valid name', async ({ page }) => {
    await gotoFormView(page)

    await page.getByPlaceholder(/enter your username/i).fill('ValidUser')
    await expect(page.getByTestId('setup-submit-button')).toBeDisabled()
  })

  test('valid name + invalid email → email_invalid error shown', async ({ page }) => {
    await gotoFormView(page)

    await page.getByPlaceholder(/enter your username/i).fill('ValidUser')
    await page.getByPlaceholder(/enter your email/i).fill('not-an-email')
    await page.getByRole('checkbox').check()
    await page.getByTestId('setup-submit-button').click()

    await expect(page.getByText('Invalid email, please try again.')).toBeVisible()
  })

  test('happy path: valid form → deploy → redirect', async ({ page }) => {
    await mockCatalystDeployRoute(page)

    await gotoFormView(page, `?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}`)

    await page.getByPlaceholder(/enter your username/i).fill('ValidUser')
    await page.getByRole('checkbox').check()
    await page.getByTestId('setup-submit-button').click()

    // After successful deploy the SetupPage calls redirect(). The redirectTo
    // points off-origin (marketplace), so we just assert we're no longer on /setup.
    await page.waitForURL(url => !url.pathname.endsWith('/setup'), { timeout: 15_000 })
  })

  test('with email + valid form → newsletter subscription POST fires', async ({ page }) => {
    await mockCatalystDeployRoute(page)
    const newsletter = mockNewsletterRoute(page)

    await gotoFormView(page, `?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}`)

    await page.getByPlaceholder(/enter your username/i).fill('ValidUser')
    await page.getByPlaceholder(/enter your email/i).fill('test@example.com')
    await page.getByRole('checkbox').check()
    await page.getByTestId('setup-submit-button').click()

    await page.waitForURL(url => !url.pathname.endsWith('/setup'), { timeout: 15_000 })

    expect(newsletter.posts).toHaveLength(1)
    expect(newsletter.posts[0]).toMatchObject({ email: 'test@example.com', source: 'auth' })
  })

  test('with valid referrer query param → referral POST on init and PATCH on submit', async ({ page }) => {
    await mockCatalystDeployRoute(page)
    const referral = mockReferralRoute(page)

    await gotoFormView(page, `?referrer=${VALID_REFERRER}&redirectTo=${encodeURIComponent(MARKETPLACE_URL)}`)

    await page.getByPlaceholder(/enter your username/i).fill('ValidUser')
    await page.getByRole('checkbox').check()
    await page.getByTestId('setup-submit-button').click()

    await page.waitForURL(url => !url.pathname.endsWith('/setup'), { timeout: 15_000 })

    const methods = referral.requests.map(r => r.method)
    expect(methods).toContain('POST')
    expect(methods).toContain('PATCH')
  })

  test('catalyst deploy returns 500 → deploy error UI is rendered', async ({ page }) => {
    await mockCatalystDeployRoute(page, { status: 500 })

    await gotoFormView(page, `?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}`)

    await page.getByPlaceholder(/enter your username/i).fill('ValidUser')
    await page.getByRole('checkbox').check()
    await page.getByTestId('setup-submit-button').click()

    await expect(page.getByText('An error occurred while creating your account')).toBeVisible({ timeout: 10_000 })
    expect(page.url()).toContain('/setup')
  })
})
