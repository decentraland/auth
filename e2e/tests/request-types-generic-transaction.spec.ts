import { test, expect } from '@playwright/test'
import { captureWalletTransactions, createAuthServerRequest, injectFullSession, pollForOutcome } from '../helpers/setup'

/**
 * RequestPage's fallback `View.WALLET_INTERACTION` for `eth_sendTransaction`
 * requests whose data decodes as neither an ERC20 transfer (MANA) nor an
 * ERC721 transferFrom (NFT). The safety-net path — any new dapp-initiated
 * transaction lands here when the dapp can't classify it more specifically.
 *
 * Verifies three layers of correctness:
 *   (1) Display — interactive view (Deny/Allow) renders.
 *   (2) Forwarding — the tx the dapp hands to the wallet on Allow is byte-equal
 *       to the tx params we originally POSTed to the auth-server.
 *   (3) Outcome — the dapp reports the (stubbed) tx hash back to the auth-server
 *       under the connected wallet's address.
 */
test.describe('RequestPage: eth_sendTransaction (generic fallback)', () => {
  test('arbitrary tx data → renders, forwards unmangled, reports outcome', async ({ context, page }) => {
    const { address, identity } = await injectFullSession(context)
    const txLog = await captureWalletTransactions(context)

    const txParams = {
      from: address.toLowerCase(),
      to: '0x1111111111111111111111111111111111111111',
      value: '0x0',
      data: '0xdeadbeefcafebabe'
    }

    const { requestId } = await createAuthServerRequest({
      identity,
      method: 'eth_sendTransaction',
      params: [txParams]
    })

    await page.goto(`/auth/requests/${requestId}`)

    // (1) Display
    await expect(page.locator('[data-testid="wallet-interaction-allow-button"]').first()).toBeVisible({
      timeout: 25_000
    })

    // User approval
    await page.locator('[data-testid="wallet-interaction-allow-button"]').first().click()

    // (2) Forwarding
    await expect.poll(() => txLog.length, { timeout: 15_000 }).toBeGreaterThan(0)
    expect(txLog[0].method).toBe('eth_sendTransaction')
    expect(txLog[0].params[0]).toMatchObject(txParams)

    // (3) Outcome
    const outcome = await pollForOutcome(requestId)
    expect(outcome.sender.toLowerCase()).toBe(address.toLowerCase())
    expect(outcome.result).toMatch(/^0x[a-f0-9]{64}$/)
  })
})
