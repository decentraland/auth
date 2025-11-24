import { useState } from 'react'
import { Rarity } from '@dcl/schemas'
import { AssetImage } from 'decentraland-ui2/dist/components/AssetImage'
import { NFTTransferContainer } from '../../../Container'
import { ProfileAvatar } from '../../../types'
import {
  CenteredContent,
  Title,
  RecipientProfile,
  RecipientProfileText,
  NFTImageWrapper,
  NFTName,
  WarningAlert
} from '../NFTTransferComponents.styled'
import {
  ButtonsContainer,
  CancelButton,
  ConfirmButton,
  LoadingContainer,
  LoadingText,
  ProgressContainer,
  ProgressTrack,
  ProgressSpinner
} from './NFTTransferView.styled'
import { NFTTransferViewProps } from './NFTTransferView.types'

const CircularProgressWithTrack = () => {
  return (
    <ProgressContainer>
      <ProgressTrack variant="determinate" value={100} size={40} thickness={4} />
      <ProgressSpinner variant="indeterminate" disableShrink size={40} thickness={4} />
    </ProgressContainer>
  )
}

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
          <LoadingContainer>
            <CircularProgressWithTrack />
            <LoadingText>Processing Authorization</LoadingText>
          </LoadingContainer>
        ) : (
          <ButtonsContainer>
            <CancelButton variant="text" size="large" disabled={isLoading} onClick={onDeny} fullWidth>
              CANCEL
            </CancelButton>
            <ConfirmButton variant="contained" size="large" disabled={isLoading} onClick={handleApprove} fullWidth>
              CONFIRM & SEND
            </ConfirmButton>
          </ButtonsContainer>
        )}
      </CenteredContent>
    </NFTTransferContainer>
  )
}
