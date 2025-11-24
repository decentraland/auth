import { Rarity } from '@dcl/schemas'
import { AssetImage } from 'decentraland-ui2/dist/components/AssetImage'
import successAnimation from '../../../../../../assets/animations/successAnimation_Lottie.json'
import { NFTTransferContainer } from '../../../Container'
import { ProfileAvatar } from '../../../types'
import { CenteredContent, Title, RecipientProfile, RecipientProfileText, NFTName, InfoAlert } from '../NFTTransferComponents.styled'
import { NFTImageWrapper, SuccessAnimation } from './NFTTransferCompleteView.styled'
import { NFTTransferCompleteViewProps } from './NFTTransferCompleteView.types'

export const NFTTransferCompleteView = ({ nftData }: NFTTransferCompleteViewProps) => {
  const recipientAvatar = nftData.recipientProfile?.avatars?.[0]

  return (
    <NFTTransferContainer>
      <CenteredContent>
        <Title>Gift Sent to</Title>

        <RecipientProfile>
          <RecipientProfileText address={nftData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline />
        </RecipientProfile>

        <NFTImageWrapper>
          <AssetImage src={nftData.imageUrl} name={nftData.name || `NFT #${nftData.tokenId}`} rarity={nftData.rarity || Rarity.COMMON} />
          <SuccessAnimation animationData={successAnimation} loop={true} />
        </NFTImageWrapper>

        {nftData.name && <NFTName>{nftData.name}</NFTName>}

        <InfoAlert severity="info">You can close this tab and return to the Decentraland app.</InfoAlert>
      </CenteredContent>
    </NFTTransferContainer>
  )
}
