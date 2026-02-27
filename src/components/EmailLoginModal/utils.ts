import { sendEmailOTP as thirdwebSendEmailOTP, verifyEmailOTPAndConnect } from '../../shared/thirdweb'

/**
 * Sends an OTP verification code to the user's email using thirdweb
 *
 * @param email - The email address to send the OTP to
 * @throws Error if the email is invalid or the request fails
 *
 * @see https://portal.thirdweb.com/wallets/users
 */
const sendEmailOTP = async (email: string): Promise<void> => {
  await thirdwebSendEmailOTP(email)
}

/**
 * Verifies the OTP and connects the wallet using thirdweb
 *
 * @param email - The email address used for authentication
 * @param otp - The 6-digit OTP code from the email
 * @returns The connected account with wallet address
 * @throws Error if the code is invalid or expired
 *
 * @see https://portal.thirdweb.com/wallets/users
 */
const verifyOTPAndConnect = async (email: string, otp: string) => {
  const account = await verifyEmailOTPAndConnect(email, otp)
  return account
}

export { sendEmailOTP, verifyOTPAndConnect }
