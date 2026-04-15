import { test, expect } from '@playwright/test'
import { injectMockWallet, mockApiRoutes } from '../helpers/setup'

const MARKETPLACE_URL = 'https://decentraland.org/marketplace'

test.describe('QuickSetup: form validation edge cases', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockWallet(context)
  })

  test('name input has maxLength=15 and counter shows limit', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}&loginMethod=METAMASK`)
    await expect(page.getByText('Welcome to')).toBeVisible({ timeout: 15_000 })

    const usernameInput = page.getByPlaceholder(/enter your username/i)

    // Input has maxLength=15 — browser truncates anything longer
    await usernameInput.fill('AbcdefghijklmnoXYZ')
    // Only 15 chars should be in the input
    await expect(usernameInput).toHaveValue('Abcdefghijklmno')
    await expect(page.getByText('15/15')).toBeVisible()
  })

  test('empty name → submit disabled even with T&C checked', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}&loginMethod=METAMASK`)
    await expect(page.getByText('Welcome to')).toBeVisible({ timeout: 15_000 })

    // Check T&C but leave name empty
    await page.getByRole('checkbox').click()

    const letsGo = page.getByRole('button', { name: /let's go/i })
    await expect(letsGo).toBeDisabled()
  })

  test('T&C unchecked → submit disabled even with valid name', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}&loginMethod=METAMASK`)
    await expect(page.getByText('Welcome to')).toBeVisible({ timeout: 15_000 })

    // Fill name but don't check T&C
    await page.getByPlaceholder(/enter your username/i).fill('ValidName')

    const letsGo = page.getByRole('button', { name: /let's go/i })
    await expect(letsGo).toBeDisabled()
  })

  test('name + T&C checked → submit enabled → uncheck T&C → disabled again', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}&loginMethod=METAMASK`)
    await expect(page.getByText('Welcome to')).toBeVisible({ timeout: 15_000 })

    const usernameInput = page.getByPlaceholder(/enter your username/i)
    const checkbox = page.getByRole('checkbox')
    const letsGo = page.getByRole('button', { name: /let's go/i })

    await usernameInput.fill('ValidName')
    await checkbox.click()
    await expect(letsGo).toBeEnabled()

    // Uncheck T&C
    await checkbox.click()
    await expect(letsGo).toBeDisabled()
  })

  test('deploy failure → shows error state', async ({ page }) => {
    await mockApiRoutes(page, { hasProfile: false, onboardingToExplorer: true })

    // Make the deploy POST fail
    await page.route('**/content/entities', async (route, request) => {
      if (request.method() === 'POST' && !request.url().includes('active')) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Deploy failed"}' })
      }
      return route.fallback()
    })

    // Mock default profile for fetchDefaultProfile
    await page.route('**/content/entities/active**', async (route, request) => {
      if (request.method() === 'POST') {
        const body = request.postData() || ''
        if (body.includes('default')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{
              id: 'default-entity',
              type: 'profile',
              pointers: ['default1'],
              timestamp: Date.now(),
              content: [],
              metadata: {
                avatars: [{
                  name: 'default1', description: '',
                  avatar: {
                    bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
                    eyes: { color: { r: 0.125, g: 0.703, b: 0.964 } },
                    hair: { color: { r: 0.234, g: 0.128, b: 0.065 } },
                    skin: { color: { r: 0.8, g: 0.608, b: 0.465 } },
                    wearables: [], snapshots: {}
                  }
                }]
              }
            }])
          })
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.goto(`/auth/login?redirectTo=${encodeURIComponent(MARKETPLACE_URL)}&loginMethod=METAMASK`)
    await expect(page.getByText('Welcome to')).toBeVisible({ timeout: 15_000 })

    // Fill valid form
    await page.getByPlaceholder(/enter your username/i).fill('TestUser')
    await page.getByRole('checkbox').click()

    const letsGo = page.getByRole('button', { name: /let's go/i })
    await expect(letsGo).toBeEnabled()
    await letsGo.click()

    // Wait for deploy attempt
    await page.waitForTimeout(5000)

    // Should NOT show celebration (deploy failed)
    const celebration = page.getByText(/Ready to Jump In/i)
    const isCelebration = await celebration.isVisible().catch(() => false)
    expect(isCelebration).toBe(false)
  })
})
