import { Rarity } from '@dcl/schemas'
import { AssetImage } from 'decentraland-ui2/dist/components/AssetImage'
import { NFTTransferContainer } from '../../../Container'
import { ProfileAvatar } from '../../../types'
import { CenteredContent, Title, RecipientProfileText, NFTImageWrapper, NFTName, InfoAlert } from '../NFTTransferComponents.styled'
import { SecondaryText } from './NFTTransferCanceledView.styled'
import { NFTTransferCanceledViewProps } from './NFTTransferCanceledView.types'

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
