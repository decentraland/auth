import { TransferType } from '../../../types'
import type { MANATransferData, NFTTransferData } from '../../../types'

type BaseProps = {
  isLoading: boolean
  onApprove: () => Promise<void>
  onDeny: () => void
}

export type TransferConfirmViewProps =
  | ({ type: TransferType.TIP; transferData: MANATransferData } & BaseProps)
  | ({ type: TransferType.GIFT; transferData: NFTTransferData } & BaseProps)
