import { test, expect } from '@playwright/test'
import { injectMockWallet, mockApiRoutes } from '../helpers/setup'

/**
 * End-to-end coverage for the generic request review: every request that is not a tip or a gift, whatever it
 * targets, is shown as one sentence, the whole payload the wallet will receive, and one acknowledgment.
 *
 * The fully connected flow (wallet → request page → review) can't be driven in E2E: the social
 * connectors need a real SDK session to restore, so the request page never resolves to a web2
 * wallet here. That orchestration is covered by RequestPage unit tests.
 *
 * These tests exercise the real component in a real browser through the `/auth/testView/:viewId`
 * gallery (available outside production): rendering, i18n, the scrollable payload and the
 * acknowledgment gate — the parts jsdom can't fully validate.
 */

const testView = (id: string) => `/auth/testView/${id}`

const TITLE = 'Wallet action requested'
const STATEMENT = 'A scene or app wants to use your wallet. Check what will be sent before you allow it.'

test.describe('Generic request review', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectMockWallet(context)
    await mockApiRoutes(page)
  })

  test.describe('when the request is a transaction', () => {
    test('should show the title, the statement, what a malicious transaction could do, the whole transaction and the checkbox that gates Allow', async ({
      page
    }) => {
      await page.goto(testView('actionTransaction'))

      await expect(page.getByTestId('action-title')).toHaveText(TITLE, { timeout: 15_000 })
      await expect(page.getByTestId('action-statement')).toHaveText(STATEMENT)
      // The warning sits right above the consent, as the last thing read before ticking.
      const warnings = page.getByTestId('action-warnings')
      const warningsBelowPayload = await page.evaluate(() => {
        const warnings = document.querySelector('[data-testid="action-warnings"]')
        const payload = document.querySelector('[data-testid="action-payload"]')
        const consent = document.querySelector('[data-testid="action-consent"]')
        if (!warnings || !payload || !consent) return false
        return payload.getBoundingClientRect().bottom <= warnings.getBoundingClientRect().top && warnings.getBoundingClientRect().bottom <= consent.getBoundingClientRect().top
      })
      expect(warningsBelowPayload).toBe(true)
      await expect(warnings).toContainText('If this request is malicious, it could:')
      await expect(warnings).toContainText('Move, sell or destroy any tokens, NFTs, LAND or names your wallet holds.')
      await expect(warnings).toContainText("Once sent, it can't be undone.")
      const payload = page.getByTestId('action-payload')
      await expect(payload).toContainText('To: 0x1234567890abcdef1234567890abcdef12345678')
      await expect(payload).toContainText('Value: 0x0 (0 POL)')
      await expect(payload).toContainText('Data: 0xae7b0333')
      await expect(payload).toContainText('Chain: 137')

      const allow = page.getByTestId('action-approve-button')
      await expect(allow).toBeDisabled()
      await page.getByRole('checkbox').check()
      await expect(allow).toBeEnabled()
      await expect(page.getByTestId('action-deny-button')).toBeEnabled()
    })

    test('should read a plain value transfer as an amount of the chain currency', async ({ page }) => {
      await page.goto(testView('actionNativeTransfer'))

      await expect(page.getByTestId('action-payload')).toContainText('Value: 0x6f05b59d3b20000 (0.5 POL)', { timeout: 15_000 })
    })
  })

  test.describe('when Decentraland relays the transaction and covers the gas', () => {
    test('should word the block as the action performed and say the wallet will ask for a signature', async ({ page }) => {
      await page.goto(testView('actionRelayedTransaction'))

      await expect(page.getByText('This is exactly the action that will be performed:')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('This is exactly what will be sent to your wallet:')).toBeHidden()
      await expect(page.getByTestId('action-relayed-note')).toContainText('Your wallet will ask you to sign this action')
      await expect(page.getByTestId('action-relayed-note')).toContainText('covers the gas')
      await expect(page.getByTestId('action-payload')).toContainText('To: 0x1234567890abcdef1234567890abcdef12345678')
    })
  })

  test.describe('when the request is typed data', () => {
    test('should show the JSON the wallet will read, whole, in a box of fixed height that scrolls', async ({ page }) => {
      await page.goto(testView('actionTypedData'))

      const payload = page.getByTestId('action-payload')
      await expect(payload).toContainText('"primaryType": "Permit"', { timeout: 15_000 })
      // The box, not the page, is what grows with the payload.
      const box = await payload.boundingBox()
      expect(box?.height).toBe(320)
      const scrolls = await payload.evaluate(node => node.scrollHeight > node.clientHeight)
      expect(scrolls).toBe(true)
      await expect(payload).toContainText('"verifyingContract"')
    })

    test('should keep the checkbox and Allow disabled until the box has been scrolled to its end', async ({ page }) => {
      await page.goto(testView('actionTypedData'))

      const payload = page.getByTestId('action-payload')
      await expect(payload).toBeVisible({ timeout: 15_000 })
      const checkbox = page.getByRole('checkbox')
      const allow = page.getByTestId('action-approve-button')
      await expect(checkbox).toBeDisabled()
      await expect(allow).toBeDisabled()
      await expect(page.getByTestId('action-scroll-hint')).toBeVisible()

      // Halfway is not the end.
      await payload.evaluate(node => {
        node.scrollTop = node.scrollHeight / 2
      })
      await expect(checkbox).toBeDisabled()

      await payload.evaluate(node => {
        node.scrollTop = node.scrollHeight
      })
      await expect(checkbox).toBeEnabled()
      await expect(page.getByTestId('action-scroll-hint')).toBeHidden()
      await expect(allow).toBeDisabled()
      await checkbox.check()
      await expect(allow).toBeEnabled()

      // Going back up to re-read a line does not take the consent away: the box was read through once.
      await payload.evaluate(node => {
        node.scrollTop = 0
      })
      await expect(checkbox).toBeEnabled()
      await expect(checkbox).toBeChecked()
      await expect(allow).toBeEnabled()
      await expect(page.getByTestId('action-scroll-hint')).toBeHidden()
    })

    test('should name the signing method, so v3 and v4 are told apart for identical JSON', async ({ page }) => {
      await page.goto(testView('actionTypedData'))
      await expect(page.getByTestId('action-method')).toContainText('eth_signTypedData_v4', { timeout: 15_000 })
      const v4Payload = await page.getByTestId('action-payload').textContent()

      await page.goto(testView('actionTypedDataV3'))
      await expect(page.getByTestId('action-method')).toContainText('eth_signTypedData_v3', { timeout: 15_000 })
      // Same bytes, different wallet operation, and the screen says which.
      expect(await page.getByTestId('action-payload').textContent()).toBe(v4Payload)
    })

    test('should show a Decentraland meta-transaction the same way and warn that a signature never expires', async ({ page }) => {
      await page.goto(testView('actionMetaTransaction'))

      await expect(page.getByTestId('action-statement')).toHaveText(STATEMENT, { timeout: 15_000 })
      await expect(page.getByTestId('action-payload')).toContainText('"primaryType": "MetaTransaction"')
      await expect(page.getByTestId('action-warnings')).toContainText("a signature doesn't expire")
    })
  })

  // Phones draw no scrollbar and have little height to spare, so the box is measured there: it must fit the
  // screen's width, be shorter than on desktop, and still leave the checkbox and the buttons reachable.
  test.describe('when the review is opened on a phone', () => {
    test('should fit the box to the screen and keep the checkbox and the buttons reachable below it', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 740 })
      await page.goto(testView('actionTypedData'))

      const payload = page.getByTestId('action-payload')
      await expect(payload).toBeVisible({ timeout: 15_000 })
      const box = await payload.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBe(240)
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(390)
      // The page itself never scrolls sideways.
      const overflowsSideways = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      expect(overflowsSideways).toBe(false)

      await payload.evaluate(node => {
        node.scrollTop = node.scrollHeight
      })
      const checkbox = page.getByRole('checkbox')
      await expect(checkbox).toBeEnabled()
      await checkbox.check()
      const allow = page.getByTestId('action-approve-button')
      await allow.scrollIntoViewIfNeeded()
      await expect(allow).toBeVisible()
      await expect(allow).toBeEnabled()
    })
  })

  test.describe('when the request is a personal_sign', () => {
    test('should show the message text and warn that it could log the user in elsewhere', async ({ page }) => {
      await page.goto(testView('actionPersonalSign'))

      await expect(page.getByTestId('action-method')).toContainText('personal_sign', { timeout: 15_000 })

      await expect(page.getByTestId('action-payload')).toContainText('Welcome to Example Scene!', { timeout: 15_000 })
      await expect(page.getByTestId('action-warnings')).toContainText('Log you in to another site or app as you.')
    })

    test('should show the bytes when they are not readable text', async ({ page }) => {
      await page.goto(testView('actionPersonalSignUnreadable'))

      await expect(page.getByTestId('action-payload')).toContainText(`0x${'9f'.repeat(32)}`, { timeout: 15_000 })
    })
  })
})
