import { TransferAlert, TransferAssetImage, TransferProfile, TransferSecondaryText } from '../../../../../Transfer'
import { CenteredContent, Label, Title } from '../../../../../Transfer/Transfer.styled'
import { NFTTransferContainer } from '../../../Container'
import { ProfileAvatar } from '../../../types'
import { SceneName } from '../MANATransferComponents.styled'
import { MANATransferCanceledViewProps } from './MANATransferCanceledView.types'

export const MANATransferCanceledView = ({ manaData }: MANATransferCanceledViewProps) => {
  const recipientAvatar = manaData.recipientProfile?.avatars?.[0]

  return (
    <NFTTransferContainer>
      <CenteredContent>
        <Title>{manaData.manaAmount} MANA Tip Cancelled</Title>

        <TransferSecondaryText>Your tip wasn&apos;t delivered to</TransferSecondaryText>

        <TransferProfile
          withContainer={false}
          address={manaData.toAddress}
          avatar={recipientAvatar as ProfileAvatar}
          size="huge"
          inline
          showBothNameAndAddress
          shortenAddress
        />

        <Label>CREATOR OF</Label>

        <TransferAssetImage src={manaData.sceneImageUrl} alt={manaData.sceneName} />

        <SceneName>{manaData.sceneName}</SceneName>

        <TransferAlert />
      </CenteredContent>
    </NFTTransferContainer>
  )
}
