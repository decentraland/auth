export interface WalletInteractionProps {
  requestId: string
  isWeb2Wallet?: boolean
  explorerText?: string
  isLoading?: boolean
  onDeny: () => void
  onApprove: () => void
}
