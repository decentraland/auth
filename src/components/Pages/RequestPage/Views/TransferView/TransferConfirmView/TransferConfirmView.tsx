import { useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Rarity } from '@dcl/schemas'
import { Checkbox, FormControlLabel, Profile } from 'decentraland-ui2'
import { getProfileDisplayName } from '../../../../../../shared/profile'
import { TransferActionButtons, TransferAssetImage, TransferLayout, TransferLoadingState } from '../../../../../Transfer'
import { CenteredContent, ItemName, Label, Title, WarningAlert } from '../../../../../Transfer/Transfer.styled'
import { TransferType } from '../../../types'
import type { MANATransferData, NFTTransferData, ProfileAvatar } from '../../../types'
import { KnownContractNotice } from '../../KnownContractNotice'
import { SceneName } from '../TransferTipComponents.styled'
import { TransferConfirmViewProps } from './TransferConfirmView.types'

const shortenAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`

const TransferConfirmView = (props: TransferConfirmViewProps) => {
  const { t } = useTranslation()
  const [isProcessing, setIsProcessing] = useState(false)
  // A gift cannot be undone and this view has been the target of spoofing, so the sender confirms the
  // item and the recipient by name before the button unlocks. A tip is small and frequent: it is spelled
  // out in a sentence, and a checkbox on every one would soon be ticked without reading.
  const [isGiftAcknowledged, setIsGiftAcknowledged] = useState(false)
  const { type, transferData } = props
  const isTip = type === TransferType.TIP
  const recipientAvatar = transferData.recipientProfile?.avatars?.[0]
  const recipient = getProfileDisplayName(transferData.recipientProfile, transferData.toAddress) ?? shortenAddress(transferData.toAddress)
  const item = isTip ? '' : (transferData as NFTTransferData).name || `NFT #${(transferData as NFTTransferData).tokenId}`

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
        <KnownContractNotice address={props.targetAddress} chainId={props.targetChainId} />
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
            {!isProcessing ? (
              <WarningAlert severity="info" data-testid="tip-warning">
                {t('transfer.confirm.tip_warning', { manaAmount: (transferData as MANATransferData).manaAmount, recipient })}
              </WarningAlert>
            ) : null}
          </>
        ) : (
          <>
            <Profile address={transferData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline />
            <TransferAssetImage
              src={(transferData as NFTTransferData).imageUrl}
              name={item}
              rarity={(transferData as NFTTransferData).rarity || Rarity.COMMON}
            />
            {(transferData as NFTTransferData).name && <ItemName>{(transferData as NFTTransferData).name}</ItemName>}
            {!isProcessing && <WarningAlert severity="info">{t('transfer.confirm.gifting_warning')}</WarningAlert>}
            {!isProcessing ? (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isGiftAcknowledged}
                    onChange={event => setIsGiftAcknowledged(event.target.checked)}
                    data-testid="gift-acknowledgment"
                  />
                }
                label={t('transfer.confirm.acknowledge_gift', { item, recipient })}
              />
            ) : null}
          </>
        )}
        {!isProcessing && props.showPreviewLimitations ? (
          <WarningAlert severity="info">{t('request.transaction_dialog.preview_limitations')}</WarningAlert>
        ) : null}
        {isProcessing ? (
          <TransferLoadingState text={t('transfer.confirm.processing_authorization')} />
        ) : (
          <TransferActionButtons
            isLoading={props.isLoading}
            confirmDisabled={!isTip && !isGiftAcknowledged}
            onCancel={props.onDeny}
            onConfirm={handleApprove}
          />
        )}
      </CenteredContent>
    </TransferLayout>
  )
}

export { TransferConfirmView }
