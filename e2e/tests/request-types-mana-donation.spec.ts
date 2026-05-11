import { test, expect } from '@playwright/test'
import { encodeFunctionData, parseUnits } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { captureWalletTransactions, createAuthServerRequest, injectFullSession, pollForOutcome } from '../helpers/setup'

const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  }
] as const

const encodeManaTransfer = (recipient: `0x${string}`, mana: bigint) =>
  encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: 'transfer',
    args: [recipient, mana]
  })

/**
 * RequestPage's `View.WALLET_MANA_INTERACTION` branch for `eth_sendTransaction`
 * payloads whose data decodes as ERC20 `transfer(address,uint256)`.
 *
 * Verifies three layers:
 *   (1) Display — the dapp decodes "5 MANA" and renders the tip confirmation.
 *   (2) Forwarding — clicking Confirm sends the same tx to the wallet.
 *   (3) Outcome — the dapp reports back the tx hash to the auth-server.
 */
test.describe('RequestPage: eth_sendTransaction (MANA transfer)', () => {
  test('ERC20 transfer of MANA → renders, forwards unmangled, reports outcome', async ({ context, page }) => {
    const { address, identity } = await injectFullSession(context)
    const txLog = await captureWalletTransactions(context)

    const recipient = privateKeyToAccount(generatePrivateKey()).address
    const data = encodeManaTransfer(recipient, parseUnits('5', 18))
    const txParams = {
      from: address.toLowerCase(),
      // Truly random `to`; the dapp routes by data selector (ERC20 transfer →
      // 0xa9059cbb), not by contract address, so this still hits the MANA view.
      // Using the real MANA address would push us into the meta-tx path.
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

    // (1) Display — title text contains the decoded MANA amount.
    await expect(page.getByText(/Confirm 5 MANA Tip for/i)).toBeVisible({ timeout: 25_000 })
    await expect(page.locator('[data-testid="transfer-confirm-button"]')).toBeVisible()

    await page.locator('[data-testid="transfer-confirm-button"]').click()

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
