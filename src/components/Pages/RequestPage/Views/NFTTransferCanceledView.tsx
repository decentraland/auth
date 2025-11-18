import { Rarity } from '@dcl/schemas'
import { AssetImage } from 'decentraland-ui2/dist/components/AssetImage'
import { Box, styled, AvatarFace, Typography, Alert } from 'decentraland-ui2'
import { NFTTransferContainer } from '../Container'
import { formatRecipientName } from '../utils'
import { NFTTransferCanceledViewProps } from './NFTTransferCanceledView.types'

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

const SecondaryText = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  marginBottom: '32px',
  fontSize: '18px',
  flexWrap: 'wrap'
})

const RecipientInfo = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
})

const RecipientName = styled(Box)({
  fontSize: '18px',
  fontWeight: 600
})

const NFTImageWrapper = styled(Box)({
  width: '260px',
  height: '260px',
  marginBottom: '16px',
  borderRadius: '16px',
  overflow: 'hidden'
})

const NFTName = styled(Box)({
  fontSize: '18px',
  fontWeight: 600,
  marginBottom: '24px'
})

// eslint-disable-next-line @typescript-eslint/naming-convention
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

export const NFTTransferCanceledView = ({ nftData }: NFTTransferCanceledViewProps) => {
  const recipientAvatar = nftData.recipientProfile?.avatars?.[0]
  const recipientName = formatRecipientName(nftData.recipientProfile, nftData.toAddress)

  return (
    <NFTTransferContainer>
      <CenteredContent>
        <Title>Gift Canceled</Title>

        <SecondaryText>
          Your gift wasn&apos;t delivered to
          <RecipientInfo>
            {recipientAvatar && (
              <AvatarFace size="small" avatar={recipientAvatar as unknown as Parameters<typeof AvatarFace>[0]['avatar']} />
            )}
            <RecipientName>{recipientName}</RecipientName>
          </RecipientInfo>
        </SecondaryText>

        <NFTImageWrapper>
          <AssetImage src={nftData.imageUrl} name={nftData.name || `NFT #${nftData.tokenId}`} rarity={nftData.rarity || Rarity.COMMON} />
        </NFTImageWrapper>

        {nftData.name && <NFTName>{nftData.name}</NFTName>}

        <InfoAlert severity="info">You can close this tab and return to the Decentraland app</InfoAlert>
      </CenteredContent>
    </NFTTransferContainer>
  )
}
