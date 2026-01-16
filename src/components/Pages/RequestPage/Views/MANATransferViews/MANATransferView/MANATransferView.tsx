import { useState } from 'react'
import { TransferActionButtons, TransferAssetImage, TransferLoadingState, TransferProfile } from '../../../../../Transfer'
import { CenteredContent, Label, Title } from '../../../../../Transfer/Transfer.styled'
import { NFTTransferContainer } from '../../../Container'
import { ProfileAvatar } from '../../../types'
import { SceneName } from '../MANATransferComponents.styled'
import { MANATransferViewProps } from './MANATransferView.types'

export const MANATransferView = ({ manaData, isLoading, onDeny, onApprove }: MANATransferViewProps) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const recipientAvatar = manaData.recipientProfile?.avatars?.[0]

  const handleApprove = async () => {
    setIsProcessing(true)
    await onApprove()
  }

  return (
    <NFTTransferContainer>
      <CenteredContent>
        <Title>
          {isProcessing ? 'Sending' : 'Confirm'} {manaData.manaAmount} Tip for
        </Title>

        <TransferProfile
          address={manaData.toAddress}
          avatar={recipientAvatar as ProfileAvatar}
          size="large"
          inline
          showBothNameAndAddress
          shortenAddress
        />

        <Label>CREATOR OF</Label>

        <TransferAssetImage src={manaData.sceneImageUrl} alt={manaData.sceneName} />

        <SceneName>{manaData.sceneName}</SceneName>

        {isProcessing ? (
          <TransferLoadingState text="Processing Authorization" />
        ) : (
          <TransferActionButtons isLoading={isLoading} onCancel={onDeny} onConfirm={handleApprove} />
        )}
      </CenteredContent>
    </NFTTransferContainer>
  )
}
