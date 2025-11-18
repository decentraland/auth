import Lottie from 'lottie-react'
import { Rarity } from '@dcl/schemas'
import { AssetImage } from 'decentraland-ui2/dist/components/AssetImage'
import { Box, styled, Typography, Alert, Profile } from 'decentraland-ui2'
import successAnimation from '../../../../assets/animations/successAnimation_Lottie.json'
import { NFTTransferContainer } from '../Container'
import { ProfileAvatar } from '../types'
import { NFTTransferCompleteViewProps } from './NFTTransferCompleteView.types'

const CenteredContent = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  width: '100%',
  maxWidth: '500px'
})

const Title = styled(Typography)({
  fontSize: '36px',
  fontWeight: '600',
  fontStyle: 'normal',
  lineHeight: '100%',
  letterSpacing: '0px',
  textAlign: 'center',
  marginBottom: '24px'
})

const RecipientProfile = styled(Box)({
  marginBottom: '32px'
})

const NFTImageWrapper = styled(Box)({
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

const NFTName = styled(Box)({
  fontSize: '18px',
  fontWeight: 600,
  marginBottom: '24px'
})

const InfoAlert = styled(Alert)({
  width: '100%',
  maxWidth: '400px',
  marginTop: '24px',
  background: '#00000033',
  alignSelf: 'center',
  justifyContent: 'center',
  color: 'white',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '& .MuiAlert-icon': {
    color: 'white'
  }
})

export const NFTTransferCompleteView = ({ nftData }: NFTTransferCompleteViewProps) => {
  const recipientAvatar = nftData.recipientProfile?.avatars?.[0]

  return (
    <NFTTransferContainer>
      <CenteredContent>
        <Title>Gift Sent to</Title>

        <RecipientProfile>
          <Profile address={nftData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="large" inline />
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
