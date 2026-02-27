import { ThirdwebClient, createThirdwebClient } from 'thirdweb'
import { getConfiguration } from 'decentraland-connect'

let thirdwebClient: ThirdwebClient | null = null

/**
 * Creates or returns the singleton thirdweb client instance
 *
 * This client is used for all thirdweb wallet operations including:
 * - Email OTP authentication
 * - Social logins (Google, Apple, Discord, etc.)
 * - Wallet connections
 *
 * @see https://portal.thirdweb.com/wallets/users
 */
const getThirdwebClient = (): ThirdwebClient => {
  if (!thirdwebClient) {
    // const clientId = config.get('THIRDWEB_CLIENT_ID')
    const clientId = getConfiguration().thirdweb?.clientId

    if (!clientId) {
      throw new Error('THIRDWEB_CLIENT_ID is not configured')
    }

    thirdwebClient = createThirdwebClient({
      clientId
    })
  }

  return thirdwebClient
}

/**
 * Resets the thirdweb client (useful for testing)
 */
const resetThirdwebClient = (): void => {
  thirdwebClient = null
}

export { getThirdwebClient, resetThirdwebClient }
