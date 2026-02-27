import { inAppWallet, preAuthenticate } from 'thirdweb/wallets'
import { UserFacingError, isErrorWithMessage } from '../errors'
import { getThirdwebClient } from './client'

// Store the wallet instance for reuse
let walletInstance: ReturnType<typeof inAppWallet> | null = null

/**
 * Gets or creates the in-app wallet instance
 */
export const getInAppWallet = () => {
  if (!walletInstance) {
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
export const sendEmailOTP = async (email: string): Promise<void> => {
  const client = getThirdwebClient()

  await preAuthenticate({
    client,
    strategy: 'email',
    email
  })
}

/**
 * Verifies the OTP code and connects the wallet
 *
 * After the user receives the OTP via email, use this function to:
 * 1. Verify the code with thirdweb
 * 2. Create/access the user's wallet
 * 3. Return the connected account
 *
 * @param email - The email address used for authentication
 * @param verificationCode - The 6-digit OTP code from the email
 * @returns The connected wallet account with address and signing capabilities
 * @throws Error if the code is invalid or expired
 *
 * @example
 * ```typescript
 * const account = await verifyEmailOTPAndConnect('user@example.com', '123456')
 * console.log('Connected as:', account.address)
 * ```
 *
 * @see https://portal.thirdweb.com/wallets/users
 */
export const verifyEmailOTPAndConnect = async (email: string, verificationCode: string) => {
  console.log('[Thirdweb] Verifying OTP for email:', email, 'code:', verificationCode)
  const client = getThirdwebClient()
  const wallet = getInAppWallet()

  try {
    const account = await wallet.connect({
      client,
      strategy: 'email',
      email,
      verificationCode
    })
    console.log('[Thirdweb] OTP verified successfully!', {
      address: account.address,
      hasSignMessage: typeof account.signMessage === 'function'
    })
    return account
  } catch (error) {
    console.error('[Thirdweb] Error verifying OTP:', error)
    if (isErrorWithMessage(error) && /verify|invalid|expired/i.test(error.message)) {
      throw new UserFacingError(error.message)
    }
    throw error
  }
}

/**
 * Gets the current wallet instance (if connected)
 */
export const getConnectedWallet = () => {
  return walletInstance
}

/**
 * Disconnects the current wallet and resets the instance
 */
export const disconnectWallet = async () => {
  if (walletInstance) {
    await walletInstance.disconnect()
    walletInstance = null
  }
}

/**
 * Checks if a wallet is currently connected
 */
export const isWalletConnected = (): boolean => {
  if (!walletInstance) return false

  try {
    const account = walletInstance.getAccount()
    return !!account
  } catch {
    return false
  }
}
