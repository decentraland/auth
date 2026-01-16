export enum EmailLoginStep {
  ENTER_OTP = 'enter_otp',
  VERIFYING = 'verifying',
  ERROR = 'error'
}

/**
 * Minimal interface for thirdweb account used for DCL identity generation.
 * We only need address and signMessage capability.
 */
export type ThirdwebAccount = {
  address: string
  signMessage: (args: { message: string }) => Promise<`0x${string}`>
}

export type EmailLoginResult = {
  email: string
  account: ThirdwebAccount
}

export type EmailLoginModalProps = {
  open: boolean
  email: string
  onClose: () => void
  onBack: () => void
  onSuccess: (result: EmailLoginResult) => void
  onError?: (error: string) => void
}
