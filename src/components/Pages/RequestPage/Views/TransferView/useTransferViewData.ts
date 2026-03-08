import { TransferType } from '../../types'
import type { MANATransferData, NFTTransferData, ProfileAvatar } from '../../types'

type TransferViewData =
  | {
      type: TransferType.TIP
      transferData: MANATransferData
    }
  | {
      type: TransferType.GIFT
      transferData: NFTTransferData
    }

export type BaseTransferViewProps = TransferViewData

export const useTransferViewData = (props: TransferViewData) => {
  const { type, transferData } = props
  const isTip = type === TransferType.TIP
  const recipientAvatar = transferData.recipientProfile?.avatars?.[0] as ProfileAvatar | undefined
  const tipData = isTip ? (transferData as MANATransferData) : undefined
  const giftData = !isTip ? (transferData as NFTTransferData) : undefined

  return { isTip, recipientAvatar, tipData, giftData, transferData }
}
