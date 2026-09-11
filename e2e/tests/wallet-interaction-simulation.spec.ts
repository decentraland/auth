import { test, expect } from '@playwright/test'
import { injectMockWallet, mockApiRoutes } from '../helpers/setup'

/**
 * End-to-end coverage for the request review views: the simulation review of a Decentraland
 * contract call, and the unverified view shown for everything else.
 *
 * The fully connected flow (wallet → request page → review) can't be driven in E2E: the social
 * connectors need a real SDK session to restore, so the request page never resolves to a web2
 * wallet here (see the skipped case in request-edge-cases.spec.ts). That orchestration is covered
 * by RequestPage unit tests.
 *
 * These tests exercise the real components in a real browser through the `/auth/testView/:viewId`
 * gallery (available outside production): rendering, i18n, block-explorer links, the acknowledgment
 * gate, the Advanced tab and the raw-payload toggle — the parts jsdom can't fully validate.
 */

const testView = (id: string) => `/auth/testView/${id}`

test.describe('Web2 transaction simulation & signature preview views', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectMockWallet(context)
    await mockApiRoutes(page)
  })

  test.describe('when reviewing a simulated transaction', () => {
    test('should render the decoded call, asset changes, permissions and gas in a single review screen', async ({ page }) => {
      await page.goto(testView('walletInteractionSimulation'))

      await expect(page.getByText('Review this transaction')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('wallet-interaction-call')).toContainText('Calls executeOrder on Decentraland Marketplace')
      await expect(page.getByText('You send')).toBeVisible()
      await expect(page.getByText('100 MANA')).toBeVisible()
      await expect(page.getByText('You receive')).toBeVisible()
      await expect(page.getByText('Permissions granted')).toBeVisible()
      await expect(page.getByText(/unlimited/i)).toBeVisible()
      await expect(page.getByText('Gas fees are covered by Decentraland.')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Allow' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Deny' })).toBeVisible()
    })

    test('should keep Allow disabled until the high-risk acknowledgment is checked', async ({ page }) => {
      await page.goto(testView('walletInteractionSimulation'))

      const allow = page.getByTestId('transfer-confirm-button')
      await expect(allow).toBeVisible({ timeout: 15_000 })
      await expect(allow).toBeDisabled()

      await page.getByRole('checkbox').check()

      await expect(allow).toBeEnabled()
    })
  })

  // A profile name is free text and the address is what binds it to an account, so the address is the half
  // that must survive a narrow panel. The row clips what overflows it, and a name at the length cap is a
  // single unbreakable box: before this was laid out for, it pushed the address out of the visible area and
  // left the spoofable half standing alone. jsdom lays nothing out, so this is measured here.
  test.describe('when a counterparty carries a long profile name', () => {
    test('should keep the address it belongs to inside the row, however narrow the panel', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 900 })
      await page.goto(testView('simulationSummaryLongName'))

      const addresses = page.getByTestId('counterparty-address')
      await expect(addresses.first()).toBeVisible({ timeout: 15_000 })

      const count = await addresses.count()
      expect(count).toBeGreaterThan(0)
      for (let index = 0; index < count; index++) {
        const address = addresses.nth(index)
        await expect(address).toHaveText(/^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/)
        const box = await address.boundingBox()
        expect(box, 'the address has no box').not.toBeNull()
        // Inside the viewport rather than clipped past the edge of the row that holds it.
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(390)
        expect(box!.width).toBeGreaterThan(0)
      }
    })
  })

  test.describe('when the simulation predicts a revert', () => {
    test('should show the failure warning with the revert reason', async ({ page }) => {
      await page.goto(testView('simulationSummaryReverted'))

      await expect(page.getByText('This transaction is likely to fail')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/exceeds balance/i)).toBeVisible()
    })
  })

  test.describe('when a preview of the transaction is unavailable', () => {
    test('should show a neutral note rather than an error', async ({ page }) => {
      await page.goto(testView('simulationSummaryUnavailable'))

      await expect(page.getByText(/A preview of this transaction isn't available/i)).toBeVisible({ timeout: 15_000 })
    })
  })

  test.describe('when the request is a personal_sign', () => {
    test('should show the message, the signature warnings and the checkbox that gates Allow', async ({ page }) => {
      await page.goto(testView('unverifiedPersonalSign'))

      await expect(page.getByText('Review this signature')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('unverified-message')).toContainText('Welcome to Example Scene!')
      await expect(page.getByText('It could log you in to another site or app as you.')).toBeVisible()

      const allow = page.getByTestId('unverified-approve-button')
      await expect(allow).toBeDisabled()
      await page.getByRole('checkbox').check()
      await expect(allow).toBeEnabled()
    })

    test('should reveal the exact bytes being signed under Advanced', async ({ page }) => {
      await page.goto(testView('unverifiedPersonalSign'))

      await expect(page.getByText('Review this signature')).toBeVisible({ timeout: 15_000 })
      await page.getByRole('tab', { name: 'Advanced' }).click()

      await expect(page.getByTestId('unverified-raw-hex')).toContainText('0x57656c636f6d65')
    })
  })

  test.describe('when the request is typed data Decentraland does not interpret', () => {
    test('should show the JSON verbatim under Advanced instead of a field tree', async ({ page }) => {
      await page.goto(testView('unverifiedTypedData'))

      await expect(page.getByText('Review this signature')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/authorize an off-chain order/i)).toBeVisible()
      await page.getByRole('tab', { name: 'Advanced' }).click()

      await expect(page.getByTestId('unverified-raw-typed-data')).toContainText('"primaryType": "Permit"')
    })
  })

  test.describe('when the request is a MetaTransaction Decentraland cannot vouch for', () => {
    test('should list the meta-transaction warnings and link the contract', async ({ page }) => {
      await page.goto(testView('unverifiedMetaTransaction'))

      await expect(page.getByText('The signature never expires.')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('Anyone who holds the signature can submit it, at any time.')).toBeVisible()
      await expect(page.getByRole('link', { name: '0xabcd…ef01' })).toHaveAttribute('href', /polygonscan\.com\/address\//)
    })
  })

  test.describe('when the request is a transaction to a contract Decentraland does not know', () => {
    test('should show the fee, the warnings and the checkbox that gates Allow', async ({ page }) => {
      await page.goto(testView('unverifiedTransaction'))

      await expect(page.getByText('Review this transaction')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('unverified-fee')).toContainText('0.0042 POL')
      await expect(page.getByText(/can move any assets or permissions/i)).toBeVisible()

      const allow = page.getByTestId('unverified-approve-button')
      await expect(allow).toBeDisabled()
      await page.getByRole('checkbox').check()
      await expect(allow).toBeEnabled()
    })

    test('should reveal the calldata the wallet will send under Advanced', async ({ page }) => {
      await page.goto(testView('unverifiedTransaction'))

      await expect(page.getByText('Review this transaction')).toBeVisible({ timeout: 15_000 })
      await page.getByRole('tab', { name: 'Advanced' }).click()

      await expect(page.getByTestId('unverified-raw-data')).toContainText('0x095ea7b3')
    })
  })

  test.describe('when signing a Decentraland meta-transaction', () => {
    test('should show the asset summary, the decoded call and reveal the raw payload on demand', async ({ page }) => {
      await page.goto(testView('signatureMetaTx'))

      await expect(page.getByText('You send')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('signature-call')).toContainText('Calls transfer on (PoS) Decentraland MANA')
      await expect(page.getByTestId('signature-raw')).toBeHidden()

      await page.getByText('View raw data').click()

      await expect(page.getByTestId('signature-raw')).toBeVisible()
    })
  })
})
