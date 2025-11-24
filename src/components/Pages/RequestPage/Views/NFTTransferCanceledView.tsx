import { Rarity } from '@dcl/schemas'
import { AssetImage } from 'decentraland-ui2/dist/components/AssetImage'
import { Box, styled } from 'decentraland-ui2'
import { NFTTransferContainer } from '../Container'
import { ProfileAvatar } from '../types'
import { CenteredContent, Title, RecipientProfileText, NFTImageWrapper, NFTName, InfoAlert } from './NFTTransferComponents'
import { NFTTransferCanceledViewProps } from './NFTTransferCanceledView.types'

const SecondaryText = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  marginBottom: '32px',
  fontSize: '18px',
  flexWrap: 'wrap'
})

export const NFTTransferCanceledView = ({ nftData }: NFTTransferCanceledViewProps) => {
  const recipientAvatar = nftData.recipientProfile?.avatars?.[0]

  return (
    <NFTTransferContainer>
      <CenteredContent>
        <Title>Gift Canceled</Title>

        <SecondaryText>
          Your gift wasn&apos;t delivered to
          <RecipientProfileText address={nftData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline />
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
