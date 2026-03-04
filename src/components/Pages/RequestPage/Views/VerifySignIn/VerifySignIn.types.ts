export interface VerifySignInProps {
  requestId: string
  code?: string | number
  isLoading?: boolean
  hasTimedOut?: boolean
  explorerText?: string
  isDeepLinkFlow?: boolean
  onDeny: () => void
  onApprove: () => void
}
