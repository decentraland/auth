import { useState } from 'react'
import { NFTTransferContainer } from '../../../Container'
import { ProfileAvatar } from '../../../types'
import { LoadingState, ActionButtons } from '../../SharedTransferComponents'
import {
  CenteredContent,
  Title,
  RecipientProfile,
  RecipientProfileText,
  CreatorLabel,
  SceneImageWrapper,
  SceneName
} from '../MANATransferComponents.styled'
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

        <RecipientProfile>
          <RecipientProfileText
            address={manaData.toAddress}
            avatar={recipientAvatar as ProfileAvatar}
            size="huge"
            inline
            showBothNameAndAddress
            shortenAddress
          />
        </RecipientProfile>

        <CreatorLabel>CREATOR OF</CreatorLabel>

        <SceneImageWrapper>
          <img src={manaData.sceneImageUrl} alt={manaData.sceneName} />
        </SceneImageWrapper>

        <SceneName>{manaData.sceneName}</SceneName>

        {isProcessing ? (
          <LoadingState text="Processing Authorization" />
        ) : (
          <ActionButtons isLoading={isLoading} onCancel={onDeny} onConfirm={handleApprove} />
        )}
      </CenteredContent>
    </NFTTransferContainer>
  )
}
