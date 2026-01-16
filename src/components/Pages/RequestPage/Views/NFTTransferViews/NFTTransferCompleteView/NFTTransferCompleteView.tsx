import { Rarity } from '@dcl/schemas'
import { Box } from 'decentraland-ui2'
import successAnimation from '../../../../../../assets/animations/successAnimation_Lottie.json'
import { TransferAlert, TransferAssetImage, TransferProfile } from '../../../../../Transfer'
import { CenteredContent, ItemName as NFTName, Title } from '../../../../../Transfer/Transfer.styled'
import { NFTTransferContainer } from '../../../Container'
import { ProfileAvatar } from '../../../types'
import { SuccessAnimation } from './NFTTransferCompleteView.styled'
import { NFTTransferCompleteViewProps } from './NFTTransferCompleteView.types'

export const NFTTransferCompleteView = ({ nftData }: NFTTransferCompleteViewProps) => {
  const recipientAvatar = nftData.recipientProfile?.avatars?.[0]

  return (
    <NFTTransferContainer>
      <CenteredContent>
        <Title>Gift Sent to</Title>

        <TransferProfile address={nftData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline />

        <Box>
          <TransferAssetImage
            src={nftData.imageUrl}
            name={nftData.name || `NFT #${nftData.tokenId}`}
            rarity={nftData.rarity || Rarity.COMMON}
          />
          <SuccessAnimation animationData={successAnimation} loop={true} />
        </Box>

        {nftData.name && <NFTName>{nftData.name}</NFTName>}

        <TransferAlert />
      </CenteredContent>
    </NFTTransferContainer>
  )
}
