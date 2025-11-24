import { useState } from 'react'
import { Rarity } from '@dcl/schemas'
import { AssetImage } from 'decentraland-ui2/dist/components/AssetImage'
import { Box, Button, styled, Typography, CircularProgress } from 'decentraland-ui2'
import { NFTTransferContainer } from '../Container'
import { ProfileAvatar } from '../types'
import {
  CenteredContent,
  Title,
  RecipientProfile,
  RecipientProfileText,
  NFTImageWrapper,
  NFTName,
  WarningAlert
} from './NFTTransferComponents'
import { NFTTransferViewProps } from './NFTTransferView.types'

const ButtonsContainer = styled(Box)({
  display: 'flex',
  gap: '16px',
  width: '100%',
  maxWidth: '400px'
})

const CancelButton = styled(Button)({
  borderRadius: '12px',
  background: 'rgba(0, 0, 0, 0.40)',
  color: 'white',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '&:hover': {
    background: 'rgba(0, 0, 0, 0.60)',
    color: 'white !important'
  }
})

const ConfirmButton = styled(Button)({
  borderRadius: '12px'
})

const LoadingContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: '16px',
  marginTop: '24px'
})

const LoadingText = styled(Typography)({
  fontSize: '18px',
  fontWeight: 400,
  fontStyle: 'normal',
  lineHeight: '100%',
  letterSpacing: '0px',
  color: 'white'
})

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
            <CircularProgress size={30} sx={{ color: 'red' }} />
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
