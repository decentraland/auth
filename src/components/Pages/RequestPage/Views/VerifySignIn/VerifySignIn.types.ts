export interface VerifySignInProps {
  requestId: string
  code?: string | number
  isLoading?: boolean
  hasTimedOut?: boolean
  explorerText?: string
  onDeny: () => void
  onApprove: () => void
}
