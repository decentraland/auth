export type NFTTransferViewProps = {
  nftData: {
    imageUrl: string
    tokenId: string
    toAddress: string
    contractAddress: string
    name?: string
    description?: string
    recipientName?: string
  }
  isLoading: boolean
  onDeny: () => void
  onApprove: () => void
  requestId: string
}
