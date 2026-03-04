// This enum is kept for potential future use (e.g., multi-step flows)
enum EmailLoginStep {
  ENTER_OTP = 'enter_otp'
}

/**
 * Minimal interface for thirdweb account used for DCL identity generation.
 * We only need address and signMessage capability.
 */
type ThirdwebAccount = {
  address: string
  signMessage: (args: { message: string }) => Promise<`0x${string}`>
}

type EmailLoginResult = {
  email: string
  account: ThirdwebAccount
}

type EmailLoginModalProps = {
  open: boolean
  email: string
  onClose: () => void
  onBack: () => void
  onSuccess: (result: EmailLoginResult) => void
  onError?: (error: string) => void
}

export { EmailLoginStep }
export type { ThirdwebAccount, EmailLoginResult, EmailLoginModalProps }
