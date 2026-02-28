import { useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Rarity } from '@dcl/schemas'
import { Profile } from 'decentraland-ui2'
import { TransferActionButtons, TransferAssetImage, TransferLayout, TransferLoadingState } from '../../../../../Transfer'
import { CenteredContent, ItemName, Label, Title, WarningAlert } from '../../../../../Transfer/Transfer.styled'
import { TransferType } from '../../../types'
import type { ProfileAvatar } from '../../../types'
import { SceneName } from '../TransferTipComponents.styled'
import { TransferConfirmViewProps } from './TransferConfirmView.types'

const TransferConfirmView = (props: TransferConfirmViewProps) => {
  const { t } = useTranslation()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleApprove = async () => {
    setIsProcessing(true)
    await props.onApprove()
  }

  const { type, transferData } = props
  const isTip = type === TransferType.TIP
  const recipientAvatar = transferData.recipientProfile?.avatars?.[0]

  return (
    <TransferLayout>
      <CenteredContent>
        <Title>
          {isTip ? (
            <>
              {isProcessing
                ? t('transfer.confirm.sending_tip', { manaAmount: transferData.manaAmount })
                : t('transfer.confirm.confirm_tip', { manaAmount: transferData.manaAmount })}
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

            <TransferAssetImage src={transferData.sceneImageUrl} alt={transferData.sceneName} />

            <SceneName>{transferData.sceneName}</SceneName>
          </>
        ) : (
          <>
            <Profile address={transferData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline />

            <TransferAssetImage
              src={transferData.imageUrl}
              name={transferData.name || `NFT #${transferData.tokenId}`}
              rarity={transferData.rarity || Rarity.COMMON}
            />

            {transferData.name && <ItemName>{transferData.name}</ItemName>}

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
