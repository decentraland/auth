import { test, expect, Locator } from '@playwright/test'
import { injectMockWallet, mockApiRoutes } from '../helpers/setup'

/**
 * Layout coverage for the branded transfer confirmation when it asks the delayed-code consent: the
 * gifting notice, the callback warning and its checkbox stack without overlapping, and the buttons
 * follow. jsdom lays nothing out, so this is the one place the geometry is actually measured.
 */

const testView = (id: string) => `/auth/testView/${id}`

const boxOf = async (locator: Locator) => {
  await expect(locator).toBeVisible({ timeout: 15_000 })
  const box = await locator.boundingBox()
  expect(box, `${locator} has no box`).not.toBeNull()
  return box as { x: number; y: number; width: number; height: number }
}

// Each element must begin at or below where the previous one ends.
const expectStacked = async (locators: Locator[]) => {
  let previousBottom = -Infinity
  for (const locator of locators) {
    const box = await boxOf(locator)
    expect(box.y, `${locator} starts above the element before it`).toBeGreaterThanOrEqual(previousBottom)
    previousBottom = box.y + box.height
  }
}

test.describe('Branded transfer confirmation asking the delayed-code consent', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectMockWallet(context)
    await mockApiRoutes(page)
  })

  test('should stack the gift notice, the callback warning, its checkbox and the buttons without overlap', async ({ page }) => {
    await page.goto(testView('transferConfirmGiftCallbackConsent'))

    await expectStacked([
      page.getByTestId('gifting-warning'),
      page.getByTestId('callback-code-warning'),
      page.getByRole('checkbox'),
      page.getByTestId('transfer-confirm-button')
    ])
  })

  test('should stack the callback warning, its checkbox and the buttons on a tip as well', async ({ page }) => {
    await page.goto(testView('transferConfirmTipCallbackConsent'))

    await expectStacked([
      page.getByTestId('callback-code-warning'),
      page.getByRole('checkbox'),
      page.getByTestId('transfer-confirm-button')
    ])
  })

  test('should keep Confirm disabled until the callback consent is given', async ({ page }) => {
    await page.goto(testView('transferConfirmGiftCallbackConsent'))

    const confirm = page.getByTestId('transfer-confirm-button')
    await expect(confirm).toBeVisible({ timeout: 15_000 })
    await expect(confirm).toBeDisabled()

    await page.getByRole('checkbox').check()

    await expect(confirm).toBeEnabled()
  })
})
