type EmailLoginResult = {
  email: string
  address: string
  identity?: import('@dcl/crypto').AuthIdentity
}

type EmailLoginModalProps = {
  open: boolean
  email: string
  isTestAuth?: boolean
  onClose: () => void
  onBack: () => void
  onSuccess: (result: EmailLoginResult) => void
}

export type { EmailLoginResult, EmailLoginModalProps }
