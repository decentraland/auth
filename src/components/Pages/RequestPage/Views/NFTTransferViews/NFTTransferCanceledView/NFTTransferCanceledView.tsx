import { Rarity } from '@dcl/schemas'
import { TransferAlert, TransferAssetImage, TransferProfile, TransferSecondaryText } from '../../../../../Transfer'
import { CenteredContent, ItemName as NFTName, Title } from '../../../../../Transfer/Transfer.styled'
import { NFTTransferContainer } from '../../../Container'
import { ProfileAvatar } from '../../../types'
import { NFTTransferCanceledViewProps } from './NFTTransferCanceledView.types'

export const NFTTransferCanceledView = ({ nftData }: NFTTransferCanceledViewProps) => {
  const recipientAvatar = nftData.recipientProfile?.avatars?.[0]

  return (
    <NFTTransferContainer>
      <CenteredContent>
        <Title>Gift Canceled</Title>

        <TransferSecondaryText>
          Your gift wasn&apos;t delivered to
          <TransferProfile withContainer={false} address={nftData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline />
        </TransferSecondaryText>

        <TransferAssetImage
          src={nftData.imageUrl}
          name={nftData.name || `NFT #${nftData.tokenId}`}
          rarity={nftData.rarity || Rarity.COMMON}
        />

        {nftData.name && <NFTName>{nftData.name}</NFTName>}

        <TransferAlert text="You can close this tab and return to the Decentraland app" />
      </CenteredContent>
    </NFTTransferContainer>
  )
}
