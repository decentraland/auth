import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { connection } from 'decentraland-connect'
import { getThirdwebClient } from './client'

// Store the wallet instance for reuse
let walletInstance: Awaited<ReturnType<typeof import('thirdweb/wallets').inAppWallet>> | null = null

/**
 * Gets or creates the in-app wallet instance
 */
const getInAppWallet = async () => {
  if (!walletInstance) {
    const { inAppWallet } = await import('thirdweb/wallets')
    walletInstance = inAppWallet()
  }
  return walletInstance
}

/**
 * Sends an OTP code to the specified email address
 *
 * Uses thirdweb's preAuthenticate to send a verification code.
 * The user will receive a 6-digit code at their email address.
 *
 * @param email - The email address to send the OTP to
 * @throws Error if the email is invalid or the request fails
 *
 * @example
 * ```typescript
 * await sendEmailOTP('user@example.com')
 * // User receives email with code
 * ```
 *
 * @see https://portal.thirdweb.com/wallets/users
 */
const sendEmailOTP = async (email: string): Promise<void> => {
  const client = await getThirdwebClient()
  const { preAuthenticate } = await import('thirdweb/wallets')

  await preAuthenticate({
    client,
    strategy: 'email',
    email
  })
}

/**
 * Verifies the OTP code, connects the thirdweb wallet, and records the
 * connection so that `tryPreviousConnection` can restore it later.
 *
 * @param email - The email address used for authentication
 * @param verificationCode - The 6-digit OTP code from the email
 * @returns The wallet address of the authenticated user
 * @throws Error if the code is invalid or expired
 *
 * @see https://portal.thirdweb.com/wallets/users
 */
const verifyEmailOTPAndConnect = async (email: string, verificationCode: string): Promise<string> => {
  console.log('[Thirdweb] Verifying OTP for email:', email, 'code:', verificationCode)
  const client = await getThirdwebClient()
  const wallet = await getInAppWallet()

  let address: string
  try {
    const account = await wallet.connect({
      client,
      strategy: 'email',
      email,
      verificationCode
    })
    address = account.address
    console.log('[Thirdweb] OTP verified successfully!', {
      address: account.address,
      hasSignMessage: typeof account.signMessage === 'function'
    })
  } catch (error) {
    console.error('[Thirdweb] Error verifying OTP:', error)
    // Thirdweb throws this error when the user enters an incorrect or expired OTP code.
    // This is expected user behavior, so we skip Sentry reporting to reduce noise.
    if (error instanceof Error && error.message === 'Failed to verify verification code') {
      ;(error as Error & { skipReporting: boolean }).skipReporting = true
    }
    throw error
  }

  // Record the Thirdweb connection so tryPreviousConnection can restore it later.
  // The thirdweb session is persisted in browser localStorage keyed by clientId,
  // so when tryPreviousConnection calls ThirdwebConnector.activate(), autoConnect
  // finds the session authenticated above and returns an EIP-1193 provider.
  connection.storeConnectionData(ProviderType.THIRDWEB, ChainId.ETHEREUM_MAINNET)

  return address
}

/**
 * Gets the current wallet instance (if connected)
 */
const getConnectedWallet = () => {
  return walletInstance
}

/**
 * Disconnects the current wallet and resets the instance
 */
const disconnectWallet = async () => {
  if (walletInstance) {
    await walletInstance.disconnect()
    walletInstance = null
  }
}

/**
 * Checks if a wallet is currently connected
 */
const isWalletConnected = (): boolean => {
  if (!walletInstance) return false

  try {
    const account = walletInstance.getAccount()
    return !!account
  } catch {
    return false
  }
}

export { getInAppWallet, sendEmailOTP, verifyEmailOTPAndConnect, getConnectedWallet, disconnectWallet, isWalletConnected }
