import { useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Rarity } from '@dcl/schemas'
import { Profile } from 'decentraland-ui2'
import { TransferActionButtons, TransferAssetImage, TransferLayout, TransferLoadingState } from '../../../../../Transfer'
import { CenteredContent, ItemName, Label, Title, WarningAlert } from '../../../../../Transfer/Transfer.styled'
import { SceneName } from '../TransferTipComponents.styled'
import { useTransferViewData } from '../useTransferViewData'
import { TransferConfirmViewProps } from './TransferConfirmView.types'

const TransferConfirmView = (props: TransferConfirmViewProps) => {
  const { t } = useTranslation()
  const [isProcessing, setIsProcessing] = useState(false)
  const { isTip, recipientAvatar, tipData, giftData, transferData } = useTransferViewData(props)

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
                ? t('transfer.confirm.sending_tip', { manaAmount: tipData!.manaAmount })
                : t('transfer.confirm.confirm_tip', { manaAmount: tipData!.manaAmount })}
            </>
          ) : (
            <>{isProcessing ? t('transfer.confirm.sending_gift') : t('transfer.confirm.confirm_gift')}</>
          )}
        </Title>
        {isTip ? (
          <>
            <Profile
              address={transferData.toAddress}
              avatar={recipientAvatar}
              size="large"
              inline
              showBothNameAndAddress
              shortenAddress
              showCopyButton
              highlightName
            />
            <Label>{t('transfer.confirm.creator_of')}</Label>
            <TransferAssetImage src={tipData!.sceneImageUrl} alt={tipData!.sceneName} />
            <SceneName>{tipData!.sceneName}</SceneName>
          </>
        ) : (
          <>
            <Profile address={transferData.toAddress} avatar={recipientAvatar} size="huge" inline />
            <TransferAssetImage
              src={giftData!.imageUrl}
              name={giftData!.name || `NFT #${giftData!.tokenId}`}
              rarity={giftData!.rarity || Rarity.COMMON}
            />
            {giftData!.name && <ItemName>{giftData!.name}</ItemName>}
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
