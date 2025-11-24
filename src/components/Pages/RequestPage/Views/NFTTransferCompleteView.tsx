import Lottie from 'lottie-react'
import { Rarity } from '@dcl/schemas'
import { AssetImage } from 'decentraland-ui2/dist/components/AssetImage'
import { styled } from 'decentraland-ui2'
import successAnimation from '../../../../assets/animations/successAnimation_Lottie.json'
import { NFTTransferContainer } from '../Container'
import { ProfileAvatar } from '../types'
import { CenteredContent, Title, RecipientProfile, RecipientProfileText, NFTName, InfoAlert } from './NFTTransferComponents'
import { NFTTransferCompleteViewProps } from './NFTTransferCompleteView.types'

const NFTImageWrapper = styled('div')({
  width: '260px',
  height: '260px',
  marginBottom: '16px',
  borderRadius: '16px',
  overflow: 'visible',
  position: 'relative'
})

// eslint-disable-next-line @typescript-eslint/naming-convention
const SuccessAnimation = styled(Lottie)({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '400px',
  height: '400px',
  pointerEvents: 'none',
  zIndex: 10
})

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

        <InfoAlert severity="info">You can close this tab and return to the Decentraland app</InfoAlert>
      </CenteredContent>
    </NFTTransferContainer>
  )
}
