import successAnimation from '../../../../../../assets/animations/successAnimation_Lottie.json'
import { NFTTransferContainer } from '../../../Container'
import { ProfileAvatar } from '../../../types'
import {
  CenteredContent,
  RecipientProfile,
  RecipientProfileText,
  CreatorLabel,
  SceneName,
  InfoAlert
} from '../MANATransferComponents.styled'
import { Title, SceneImageWrapper, SceneImageContainer, SuccessAnimation } from './MANATransferCompleteView.styled'
import { MANATransferCompleteViewProps } from './MANATransferCompleteView.types'

export const MANATransferCompleteView = ({ manaData }: MANATransferCompleteViewProps) => {
  const recipientAvatar = manaData.recipientProfile?.avatars?.[0]

  return (
    <NFTTransferContainer>
      <CenteredContent>
        <Title>Success! {manaData.manaAmount} MANA tip Sent to</Title>

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
          <SceneImageContainer>
            <img src={manaData.sceneImageUrl} alt={manaData.sceneName} />
          </SceneImageContainer>
          <SuccessAnimation animationData={successAnimation} loop={true} />
        </SceneImageWrapper>

        <SceneName>{manaData.sceneName}</SceneName>

        <InfoAlert severity="info">You can close this tab and return to the Decentraland app.</InfoAlert>
      </CenteredContent>
    </NFTTransferContainer>
  )
}
