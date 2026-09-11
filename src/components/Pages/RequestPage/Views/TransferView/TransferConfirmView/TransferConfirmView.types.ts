import { TransferType } from '../../../types'
import type { MANATransferData, NFTTransferData } from '../../../types'

type BaseProps = {
  isLoading: boolean
  /**
   * True while the review behind this screen may not be acted on: the page decides it in one place and
   * both the generic and the branded screens render it (see isReviewActionable in RequestPage).
   */
  approveBlocked?: boolean
  /** Chain the transfer executes on, for the recipient's block-explorer link. */
  chainId?: number
  /** Called addresses that had no code when the review checked them. */
  callbackAddresses?: string[]
  callbackAcknowledged?: boolean
  onCallbackAcknowledgedChange?: (checked: boolean) => void
  onApprove: () => Promise<void>
  onDeny: () => void
}

export type TransferConfirmViewProps =
  | ({ type: TransferType.TIP; transferData: MANATransferData } & BaseProps)
  | ({ type: TransferType.GIFT; transferData: NFTTransferData } & BaseProps)
