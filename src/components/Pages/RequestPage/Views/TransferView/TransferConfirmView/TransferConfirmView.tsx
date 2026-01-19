import { useState } from 'react'
import { Rarity } from '@dcl/schemas'
import { Profile } from 'decentraland-ui2'
import { TransferActionButtons, TransferAssetImage, TransferLayout, TransferLoadingState } from '../../../../../Transfer'
import { CenteredContent, ItemName, Label, Title, WarningAlert } from '../../../../../Transfer/Transfer.styled'
import { TransferType } from '../../../types'
import type { ProfileAvatar } from '../../../types'
import { SceneName } from '../TransferTipComponents.styled'
import { TransferConfirmViewProps } from './TransferConfirmView.types'

const TransferConfirmView = (props: TransferConfirmViewProps) => {
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
              {isProcessing ? 'Sending' : 'Confirm'} {transferData.manaAmount} Tip for
            </>
          ) : (
            <>{isProcessing ? 'Sending Gift to' : 'Confirm Gift for'}</>
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
            />

            <Label>CREATOR OF</Label>

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

            {!isProcessing && <WarningAlert severity="info">Gifting an item cannot be undone.</WarningAlert>}
          </>
        )}

        {isProcessing ? (
          <TransferLoadingState text="Processing Authorization" />
        ) : (
          <TransferActionButtons isLoading={props.isLoading} onCancel={props.onDeny} onConfirm={handleApprove} />
        )}
      </CenteredContent>
    </TransferLayout>
  )
}

export { TransferConfirmView }
