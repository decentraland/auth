import { test, expect, Locator } from '@playwright/test'
import { injectMockWallet, mockApiRoutes } from '../helpers/setup'

/**
 * Layout and copy coverage for the dedicated credits purchase approval, rendered for real in a browser
 * through `/auth/testView/:viewId`.
 *
 * Two things are measured here rather than in jsdom. The price, the quantity and the recipient have to be
 * on screen together, because a purchase screen that pushed its price below the fold would be asking for
 * an approval to something the user never read; and when the screen asks the delayed-code consent, the
 * notice, its checkbox and the buttons have to stack without overlapping, the same geometry the branded
 * transfer screens are measured for. jsdom lays nothing out, so this is where that is actually checked.
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

test.describe('Credits purchase approval', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectMockWallet(context)
    await mockApiRoutes(page)
  })

  test('should state what is bought, what it costs in credits and where it goes', async ({ page }) => {
    await page.goto(testView('creditsPurchase'))

    await expect(page.getByTestId('credits-purchase-price')).toContainText('7 credits')
    await expect(page.getByTestId('credits-purchase-quantity')).toContainText('1')
    await expect(page.getByTestId('credits-purchase-recipient')).toContainText('0xb0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0')
    await expect(page.getByTestId('credits-purchase-item-name')).toHaveText('UpperHead AHL')
  })

  test('should keep the price and the buttons on one screen, above the fold', async ({ page }) => {
    await page.goto(testView('creditsPurchase'))

    const price = await boxOf(page.getByTestId('credits-purchase-price'))
    const confirm = await boxOf(page.getByTestId('transfer-confirm-button'))
    const viewport = page.viewportSize()

    expect(viewport).not.toBeNull()
    expect(price.y + price.height).toBeLessThanOrEqual(viewport!.height)
    expect(confirm.y + confirm.height).toBeLessThanOrEqual(viewport!.height)
  })

  test('should name the item by its identifiers when the cosmetic details are missing', async ({ page }) => {
    await page.goto(testView('creditsPurchaseWithoutMetadata'))

    await expect(page.getByTestId('credits-purchase-item-identifiers')).toContainText('0xd0e9b1e87f94ecedf15db41ddb95f1825d5e3f3f')
    await expect(page.getByTestId('credits-purchase-price')).toContainText('7 credits')
  })

  test('should show the contracts and the raw amounts once the details are opened', async ({ page }) => {
    await page.goto(testView('creditsPurchase'))

    const details = page.getByTestId('credits-purchase-details')
    await expect(details).toBeVisible({ timeout: 15_000 })
    await details.getByRole('button').first().click()

    await expect(page.getByTestId('credits-purchase-detail-price-usd-wei')).toContainText('700000000000000000')
    await expect(page.getByTestId('credits-purchase-detail-max-credited')).toContainText('MANA')
  })

  test('should stay reachable once the details push the screen past the viewport', async ({ page }) => {
    await page.goto(testView('creditsPurchase'))

    const details = page.getByTestId('credits-purchase-details')
    await expect(details).toBeVisible({ timeout: 15_000 })
    await details.getByRole('button').first().click()

    // Everything the expanded screen holds has to remain reachable: the last fact at the bottom and the
    // title at the top. A centred flex column that cannot scroll would strand one of them.
    const confirm = page.getByTestId('transfer-confirm-button')
    await confirm.scrollIntoViewIfNeeded()
    await expect(confirm).toBeInViewport()
    const title = page.getByTestId('credits-purchase-title')
    await title.scrollIntoViewIfNeeded()
    await expect(title).toBeInViewport()
  })

  test('should stack the callback warning, its checkbox and the buttons without overlap', async ({ page }) => {
    await page.goto(testView('creditsPurchaseCallbackConsent'))

    await expectStacked([
      page.getByTestId('callback-code-warning'),
      page.getByTestId('credits-purchase-callback-acknowledgment'),
      page.getByTestId('transfer-confirm-button')
    ])
  })

  test('should keep Confirm disabled until the callback consent is given', async ({ page }) => {
    await page.goto(testView('creditsPurchaseCallbackConsent'))

    const confirm = page.getByTestId('transfer-confirm-button')
    await expect(confirm).toBeVisible({ timeout: 15_000 })
    await expect(confirm).toBeDisabled()

    await page.getByTestId('credits-purchase-callback-acknowledgment').click()

    await expect(confirm).toBeEnabled()
  })

  test('should say the signature is still being delivered while it is', async ({ page }) => {
    await page.goto(testView('creditsPurchaseSigning'))

    await expect(page.getByTestId('credits-purchase-outcome-title')).toHaveText('Signature created')
    // Not "sent": nothing has been delivered yet, and the screen may not say it has.
    await expect(page.getByTestId('credits-purchase-outcome-description')).not.toContainText('was sent')
  })

  test('should say the signature was delivered rather than that the purchase settled', async ({ page }) => {
    await page.goto(testView('creditsPurchaseSigned'))

    await expect(page.getByTestId('credits-purchase-outcome-title')).toHaveText('Signature sent')
    await expect(page.getByTestId('credits-purchase-outcome-description')).toContainText('was sent back to Decentraland')
    await expect(page.getByTestId('credits-purchase-outcome-description')).not.toContainText('complete')
  })

  test('should say so when the signature exists but never reached the app', async ({ page }) => {
    await page.goto(testView('creditsPurchaseDeliveryFailed'))

    await expect(page.getByTestId('credits-purchase-outcome-title')).toHaveText('Signature not delivered')
    // The screen must not claim a delivery, and must not send the user off to approve a second time.
    await expect(page.getByTestId('credits-purchase-outcome-description')).toContainText("couldn't be reached")
    await expect(page.getByTestId('credits-purchase-outcome-description')).toContainText('check there before approving')
  })

  test('should keep every fact and both buttons on the screen of a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(testView('creditsPurchase'))

    await expect(page.getByTestId('credits-purchase-price')).toContainText('7 credits')

    // Nothing may run off the side. `toBeInViewport` is not enough on its own: it passes on an element that
    // only partly intersects, which is exactly what a button row wider than the screen does.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    const viewport = page.viewportSize()
    for (const testId of ['credits-purchase-title', 'credits-purchase-price', 'credits-purchase-recipient', 'transfer-cancel-button', 'transfer-confirm-button']) {
      const element = page.getByTestId(testId)
      await element.scrollIntoViewIfNeeded()
      const box = await boxOf(element)
      expect(box.x, `${testId} starts off the left edge`).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width, `${testId} runs off the right edge`).toBeLessThanOrEqual(viewport!.width)
    }
  })

  test('should say nothing was signed when the purchase was canceled', async ({ page }) => {
    await page.goto(testView('creditsPurchaseCanceled'))

    await expect(page.getByTestId('credits-purchase-outcome-title')).toHaveText('Purchase canceled')
    await expect(page.getByTestId('credits-purchase-outcome-description')).toContainText('no credits were spent')
  })
})
