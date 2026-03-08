import { BaseTransferViewProps } from '../useTransferViewData'

type ConfirmProps = {
  isLoading: boolean
  onApprove: () => Promise<void>
  onDeny: () => void
}

export type TransferConfirmViewProps = BaseTransferViewProps & ConfirmProps
