import { TransferType } from '../../../types'
import type { MANATransferData, NFTTransferData } from '../../../types'

export type TransferCompletedViewProps =
  | { type: TransferType.TIP; transferData: MANATransferData }
  | { type: TransferType.GIFT; transferData: NFTTransferData }
