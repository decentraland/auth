import { useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Rarity } from '@dcl/schemas'
import { Profile } from 'decentraland-ui2'
import { TransferActionButtons, TransferAssetImage, TransferLayout, TransferLoadingState } from '../../../../../Transfer'
import { CenteredContent, ItemName, Label, Title, WarningAlert } from '../../../../../Transfer/Transfer.styled'
import { TransferType } from '../../../types'
import type { MANATransferData, NFTTransferData, ProfileAvatar } from '../../../types'
import { SceneName } from '../TransferTipComponents.styled'
import { TransferConfirmViewProps } from './TransferConfirmView.types'

const TransferConfirmView = (props: TransferConfirmViewProps) => {
  const { t } = useTranslation()
  const [isProcessing, setIsProcessing] = useState(false)
  const { type, transferData } = props
  const isTip = type === TransferType.TIP
  const recipientAvatar = transferData.recipientProfile?.avatars?.[0]

  const handleApprove = async () => {
    setIsProcessing(true)
    await props.onApprove()
  }

  return (
    <TransferLayout>
      <CenteredContent>
        <Title>
          {isTip ? (
            <>
              {isProcessing
                ? t('transfer.confirm.sending_tip', { manaAmount: (transferData as MANATransferData).manaAmount })
                : t('transfer.confirm.confirm_tip', { manaAmount: (transferData as MANATransferData).manaAmount })}
            </>
          ) : (
            <>{isProcessing ? t('transfer.confirm.sending_gift') : t('transfer.confirm.confirm_gift')}</>
          )}
        </Title>
        {isTip ? (
          <>
            <Profile
              address={transferData.toAddress}
              avatar={recipientAvatar as ProfileAvatar}
              size="large"
              inline
              showBothNameAndAddress
              shortenAddress
              showCopyButton
              highlightName
            />
            <Label>{t('transfer.confirm.creator_of')}</Label>
            <TransferAssetImage src={(transferData as MANATransferData).sceneImageUrl} alt={(transferData as MANATransferData).sceneName} />
            <SceneName>{(transferData as MANATransferData).sceneName}</SceneName>
          </>
        ) : (
          <>
            <Profile address={transferData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline />
            <TransferAssetImage
              src={(transferData as NFTTransferData).imageUrl}
              name={(transferData as NFTTransferData).name || `NFT #${(transferData as NFTTransferData).tokenId}`}
              rarity={(transferData as NFTTransferData).rarity || Rarity.COMMON}
            />
            {(transferData as NFTTransferData).name && <ItemName>{(transferData as NFTTransferData).name}</ItemName>}
            {!isProcessing && <WarningAlert severity="info">{t('transfer.confirm.gifting_warning')}</WarningAlert>}
          </>
        )}
        {isProcessing ? (
          <TransferLoadingState text={t('transfer.confirm.processing_authorization')} />
        ) : (
          <TransferActionButtons isLoading={props.isLoading} onCancel={props.onDeny} onConfirm={handleApprove} />
        )}
      </CenteredContent>
    </TransferLayout>
  )
}

export { TransferConfirmView }
