import { useState } from 'react'
import { Rarity } from '@dcl/schemas'
import { TransferActionButtons, TransferAssetImage, TransferLoadingState, TransferProfile } from '../../../../../Transfer'
import { CenteredContent, ItemName as NFTName, Title, WarningAlert } from '../../../../../Transfer/Transfer.styled'
import { NFTTransferContainer } from '../../../Container'
import { ProfileAvatar } from '../../../types'
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

        <TransferProfile address={nftData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline />

        <TransferAssetImage
          src={nftData.imageUrl}
          name={nftData.name || `NFT #${nftData.tokenId}`}
          rarity={nftData.rarity || Rarity.COMMON}
        />

        {nftData.name && <NFTName>{nftData.name}</NFTName>}

        {!isProcessing && <WarningAlert severity="info">Gifting an item cannot be undone</WarningAlert>}

        {isProcessing ? (
          <TransferLoadingState text="Processing Authorization" />
        ) : (
          <TransferActionButtons isLoading={isLoading} onCancel={onDeny} onConfirm={handleApprove} />
        )}
      </CenteredContent>
    </NFTTransferContainer>
  )
}
