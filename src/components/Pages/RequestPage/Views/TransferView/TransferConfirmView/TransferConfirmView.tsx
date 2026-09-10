import { useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Rarity } from '@dcl/schemas'
import { Checkbox, FormControlLabel, Profile } from 'decentraland-ui2'
import { TransferActionButtons, TransferAssetImage, TransferLayout, TransferLoadingState } from '../../../../../Transfer'
import { CenteredContent, ItemName, Label, Notices, Title, WarningAlert } from '../../../../../Transfer/Transfer.styled'
import { TransferType } from '../../../types'
import type { MANATransferData, NFTTransferData, ProfileAvatar } from '../../../types'
import { PlaceNote, SceneName } from '../TransferTipComponents.styled'
import { TransferConfirmViewProps } from './TransferConfirmView.types'

const TransferConfirmView = (props: TransferConfirmViewProps) => {
  const { t } = useTranslation()
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false)
  const { type, transferData } = props
  const isTip = type === TransferType.TIP
  const recipientAvatar = transferData.recipientProfile?.avatars?.[0]
  // Processing while the approval is being asked of the wallet (an external wallet's own prompt is open)
  // or while the page executes it (a web2 user confirmed their dialog). Not while that dialog is open:
  // onApprove resolves once it is shown, and cancelling it must hand the buttons back.
  const isProcessing = isAwaitingApproval || props.isLoading
  // The notices make way for the processing state, and the group that holds them goes with them: its
  // margin is what closes the distance to the buttons, and there are no buttons then (see Notices).
  const showsGiftingWarning = !isTip && !isProcessing
  const asksCallbackConsent = !isProcessing && (props.callbackAddresses?.length ?? 0) > 0

  const handleApprove = async () => {
    setIsAwaitingApproval(true)
    try {
      await props.onApprove()
    } finally {
      setIsAwaitingApproval(false)
    }
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
            {/* The place is looked up by the recipient address alone (see fetchPlaceByCreatorAddress).
                Nothing ties it to the scene that asked for this payment, and its name and image are
                written by whoever deployed it, so the screen says what the block is worth rather than
                letting its position imply the payment was requested from there. */}
            <PlaceNote data-testid="place-not-verified">{t('transfer.place_not_verified')}</PlaceNote>
          </>
        ) : (
          <>
            {/* Named exactly as a tip's recipient is. A display name is not an identity: only a claimed name
                is unique, and an unclaimed one shown by itself reads the same from any account whose address
                ends in the four characters Profile appends to it — 65,536 of them, which is a vanity address
                away. The address the NFT is actually sent to therefore goes on screen next to the name, with
                a copy button to check it against. */}
            <Profile
              address={transferData.toAddress}
              avatar={recipientAvatar as ProfileAvatar}
              size="huge"
              inline
              showBothNameAndAddress
              shortenAddress
              showCopyButton
              highlightName
            />
            <TransferAssetImage
              src={(transferData as NFTTransferData).imageUrl}
              name={(transferData as NFTTransferData).name || `NFT #${(transferData as NFTTransferData).tokenId}`}
              rarity={(transferData as NFTTransferData).rarity || Rarity.COMMON}
            />
            {(transferData as NFTTransferData).name && <ItemName>{(transferData as NFTTransferData).name}</ItemName>}
          </>
        )}
        {showsGiftingWarning || asksCallbackConsent ? (
          <Notices data-testid="transfer-notices">
            {showsGiftingWarning ? (
              <WarningAlert severity="info" data-testid="gifting-warning">
                {t('transfer.confirm.gifting_warning')}
              </WarningAlert>
            ) : null}
            {asksCallbackConsent ? (
              <>
                <WarningAlert severity="warning" data-testid="callback-code-warning">
                  {t('request.transaction_dialog.callback_code_notice')}
                </WarningAlert>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={props.callbackAcknowledged ?? false}
                      onChange={event => props.onCallbackAcknowledgedChange?.(event.target.checked)}
                    />
                  }
                  label={t('request.transaction_dialog.acknowledge_callback_code')}
                />
              </>
            ) : null}
          </Notices>
        ) : null}
        {isProcessing ? (
          <TransferLoadingState text={t('transfer.confirm.processing_authorization')} />
        ) : (
          <TransferActionButtons
            isLoading={props.isLoading}
            confirmDisabled={props.approveBlocked}
            onCancel={props.onDeny}
            onConfirm={handleApprove}
          />
        )}
      </CenteredContent>
    </TransferLayout>
  )
}

export { TransferConfirmView }
