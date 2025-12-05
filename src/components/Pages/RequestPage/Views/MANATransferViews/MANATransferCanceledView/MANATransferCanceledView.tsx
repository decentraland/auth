import { NFTTransferContainer } from '../../../Container'
import { ProfileAvatar } from '../../../types'
import { CenteredContent, Title, RecipientProfileText, CreatorLabel, SceneImageWrapper, SceneName, InfoAlert } from '../MANATransferComponents.styled'
import { SecondaryText } from './MANATransferCanceledView.styled'
import { MANATransferCanceledViewProps } from './MANATransferCanceledView.types'

export const MANATransferCanceledView = ({ manaData }: MANATransferCanceledViewProps) => {
  const recipientAvatar = manaData.recipientProfile?.avatars?.[0]

  return (
    <NFTTransferContainer>
      <CenteredContent>
        <Title>{manaData.manaAmount} tip cancelled</Title>

        <SecondaryText>
          Your tip wasn&apos;t delivered to
          <RecipientProfileText address={manaData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline />
        </SecondaryText>

        <CreatorLabel>creator of</CreatorLabel>

        <SceneImageWrapper>
          <img src={manaData.sceneImageUrl} alt={manaData.sceneName} />
        </SceneImageWrapper>

        <SceneName>{manaData.sceneName}</SceneName>

        <InfoAlert severity="info">You can close this tab and return to the Decentraland app</InfoAlert>
      </CenteredContent>
    </NFTTransferContainer>
  )
}

