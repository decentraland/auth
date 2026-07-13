import { test, expect } from '@playwright/test'
import { injectMockWallet, mockApiRoutes } from '../helpers/setup'

/**
 * End-to-end coverage for the web2 transaction-simulation and signature-preview views.
 *
 * The fully connected web2 flow (Magic/Thirdweb → request page → simulated review) can't be
 * driven in E2E: the social connectors need a real SDK session to restore, so the request page
 * never resolves to a web2 wallet here (see the skipped case in request-edge-cases.spec.ts). That
 * orchestration is covered by RequestPage unit tests.
 *
 * These tests exercise the real components in a real browser through the `/auth/testView/:viewId`
 * gallery (available outside production): rendering, i18n, block-explorer links, the high-risk
 * acknowledgment gate and the raw-payload toggle — the parts jsdom can't fully validate.
 */

const testView = (id: string) => `/auth/testView/${id}`

test.describe('Web2 transaction simulation & signature preview views', () => {
  test.beforeEach(async ({ context, page }) => {
    await injectMockWallet(context)
    await mockApiRoutes(page)
  })

  test.describe('when reviewing a simulated transaction', () => {
    test('should render the asset changes, permissions and gas in a single review screen', async ({ page }) => {
      await page.goto(testView('walletInteractionSimulation'))

      await expect(page.getByText('Review this transaction')).toBeVisible({ timeout: 15_000 })
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

  test.describe('when signing a plain message', () => {
    test('should show the message being signed', async ({ page }) => {
      await page.goto(testView('signatureMessage'))

      await expect(page.getByText('Confirm signature')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/Sign this message to prove you own this wallet/i)).toBeVisible()
    })
  })

  test.describe('when signing typed data', () => {
    test('should show the structured message fields', async ({ page }) => {
      await page.goto(testView('signatureTypedData'))

      await expect(page.getByText('Confirm signature')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/price/i)).toBeVisible()
    })
  })

  test.describe('when signing a meta-transaction', () => {
    test('should show the asset summary and reveal the raw payload on demand', async ({ page }) => {
      await page.goto(testView('signatureMetaTx'))

      await expect(page.getByText('You send')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('signature-raw')).toBeHidden()

      await page.getByText('View raw data').click()

      await expect(page.getByTestId('signature-raw')).toBeVisible()
    })
  })
})
