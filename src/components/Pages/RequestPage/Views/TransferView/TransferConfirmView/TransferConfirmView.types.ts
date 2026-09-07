import { TransferType } from '../../../types'
import type { MANATransferData, NFTTransferData } from '../../../types'

type BaseProps = {
  showPreviewLimitations?: boolean
  targetAddress?: string
  targetChainId?: number
  isLoading: boolean
  onApprove: () => Promise<void>
  onDeny: () => void
}

export type TransferConfirmViewProps =
  | ({ type: TransferType.TIP; transferData: MANATransferData } & BaseProps)
  | ({ type: TransferType.GIFT; transferData: NFTTransferData } & BaseProps)
