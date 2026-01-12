import { useState } from 'react'
import { Rarity } from '@dcl/schemas'
import { AssetImage } from 'decentraland-ui2/dist/components/AssetImage'
import { NFTTransferContainer } from '../../../Container'
import { ProfileAvatar } from '../../../types'
import { LoadingState, ActionButtons } from '../../SharedTransferComponents'
import {
  CenteredContent,
  Title,
  RecipientProfile,
  RecipientProfileText,
  NFTImageWrapper,
  NFTName,
  WarningAlert
} from '../NFTTransferComponents.styled'
import { NFTTransferViewProps } from './NFTTransferView.types'

export const NFTTransferView = ({ nftData, isLoading, onDeny, onApprove }: NFTTransferViewProps) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const recipientAvatar = nftData.recipientProfile?.avatars?.[0]

  const handleApprove = async () => {
    setIsProcessing(true)
    await onApprove()
  }

  return (
    <NFTTransferContainer>
      <CenteredContent>
        <Title>{isProcessing ? 'Sending Gift to' : 'Confirm Gift for'}</Title>

        <RecipientProfile>
          <RecipientProfileText address={nftData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline />
        </RecipientProfile>

        <NFTImageWrapper>
          <AssetImage src={nftData.imageUrl} name={nftData.name || `NFT #${nftData.tokenId}`} rarity={nftData.rarity || Rarity.COMMON} />
        </NFTImageWrapper>

        {nftData.name && <NFTName>{nftData.name}</NFTName>}

        {!isProcessing && <WarningAlert severity="info">Gifting an item cannot be undone</WarningAlert>}

        {isProcessing ? (
          <LoadingState text="Processing Authorization" />
        ) : (
          <ActionButtons isLoading={isLoading} onCancel={onDeny} onConfirm={handleApprove} />
        )}
      </CenteredContent>
    </NFTTransferContainer>
  )
}
