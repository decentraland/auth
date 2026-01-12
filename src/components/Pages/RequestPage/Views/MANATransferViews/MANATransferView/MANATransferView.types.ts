import { MANATransferData } from '../../../types'

export type MANATransferViewProps = {
  manaData: MANATransferData
  isLoading: boolean
  onDeny: () => void
  onApprove: () => void
}
