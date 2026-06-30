import { test, expect } from '@playwright/test'
import { encodeFunctionData } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { captureWalletTransactions, createAuthServerRequest, injectFullSession, pollForOutcome } from '../helpers/setup'

const ERC721_TRANSFER_FROM_ABI = [
  {
    type: 'function',
    name: 'transferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' }
    ],
    outputs: []
  }
] as const

const encodeNftTransferFrom = (from: `0x${string}`, to: `0x${string}`, tokenId: bigint) =>
  encodeFunctionData({
    abi: ERC721_TRANSFER_FROM_ABI,
    functionName: 'transferFrom',
    args: [from, to, tokenId]
  })

/**
 * RequestPage handling for `eth_sendTransaction` whose data decodes as ERC721
 * `transferFrom`. With an arbitrary contract address the on-chain `tokenURI`
 * lookup fails and the page falls back from `View.WALLET_NFT_INTERACTION` to
 * `View.WALLET_INTERACTION` — the test accepts either terminal Allow CTA.
 *
 * Verifies three layers:
 *   (1) Display — interactive view (NFT or generic fallback) renders.
 *   (2) Forwarding — clicking Allow sends the same tx to the wallet.
 *   (3) Outcome — the dapp reports back the tx hash to the auth-server.
 */
test.describe('RequestPage: eth_sendTransaction (NFT transfer)', () => {
  test('ERC721 transferFrom → renders, forwards unmangled, reports outcome', async ({ context, page }) => {
    const { address, identity } = await injectFullSession(context)
    const txLog = await captureWalletTransactions(context)

    const recipient = privateKeyToAccount(generatePrivateKey()).address
    const data = encodeNftTransferFrom(address.toLowerCase() as `0x${string}`, recipient, 1n)
    const txParams = {
      from: address.toLowerCase(),
      to: '0x1111111111111111111111111111111111111111',
      value: '0x0',
      data
    }

    const { requestId } = await createAuthServerRequest({
      identity,
      method: 'eth_sendTransaction',
      params: [txParams]
    })

    await page.goto(`/auth/requests/${requestId}`)

    // (1) Display — accept either NFT-view confirm button OR generic-fallback allow button.
    const allowButton = page.locator(
      '[data-testid="transfer-confirm-button"], [data-testid="wallet-interaction-allow-button"]'
    )
    await expect(allowButton.first()).toBeVisible({ timeout: 25_000 })
    await allowButton.first().click()

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
