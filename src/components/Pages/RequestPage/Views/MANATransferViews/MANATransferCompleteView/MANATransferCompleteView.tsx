import successAnimation from '../../../../../../assets/animations/successAnimation_Lottie.json'
import { TransferAlert, TransferAssetImage, TransferProfile } from '../../../../../Transfer'
import { CenteredContent, Label } from '../../../../../Transfer/Transfer.styled'
import { NFTTransferContainer } from '../../../Container'
import { ProfileAvatar } from '../../../types'
import { SceneName } from '../MANATransferComponents.styled'
import { Title, SceneImageWrapper, SuccessAnimation } from './MANATransferCompleteView.styled'
import { MANATransferCompleteViewProps } from './MANATransferCompleteView.types'

export const MANATransferCompleteView = ({ manaData }: MANATransferCompleteViewProps) => {
  const recipientAvatar = manaData.recipientProfile?.avatars?.[0]

  return (
    <NFTTransferContainer>
      <CenteredContent>
        <Title>Success! {manaData.manaAmount} MANA tip Sent to</Title>

        <TransferProfile
          address={manaData.toAddress}
          avatar={recipientAvatar as ProfileAvatar}
          inline
          showBothNameAndAddress
          shortenAddress
        />

        <Label>CREATOR OF</Label>

        <SceneImageWrapper>
          <TransferAssetImage src={manaData.sceneImageUrl} alt={manaData.sceneName} />
          <SuccessAnimation animationData={successAnimation} loop={true} />
        </SceneImageWrapper>

        <SceneName>{manaData.sceneName}</SceneName>

        <TransferAlert />
      </CenteredContent>
    </NFTTransferContainer>
  )
}
