import { NFTTransferData } from '../types'

export type NFTTransferViewProps = {
  nftData: NFTTransferData
  isLoading: boolean
  onDeny: () => void
  onApprove: () => void
}
