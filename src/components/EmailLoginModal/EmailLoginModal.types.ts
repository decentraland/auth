// This enum is kept for potential future use (e.g., multi-step flows)
enum EmailLoginStep {
  ENTER_OTP = 'enter_otp'
}

type EmailLoginResult = {
  email: string
  address: string
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
export type { EmailLoginResult, EmailLoginModalProps }
