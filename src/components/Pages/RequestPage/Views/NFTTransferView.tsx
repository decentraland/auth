import { Button } from 'decentraland-ui2'
import { Container } from '../Container'
import { NFTTransferViewProps } from './NFTTransferView.types'
import styles from './Views.module.css'

export const NFTTransferView = ({ nftData, isLoading, onDeny, onApprove, requestId }: NFTTransferViewProps) => {
  return (
    <Container canChangeAccount requestId={requestId}>
      <div className={styles.logo}></div>
      <div className={styles.title}>NFT Transfer</div>
      <div className={styles.description}>
        You're about to transfer this NFT to: <b>{nftData.recipientName}</b>
      </div>

      {/* NFT Image and Details */}
      <div
        style={{
          margin: '20px auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '300px'
        }}
      >
        <div
          style={{
            width: '100%',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            marginBottom: '12px'
          }}
        >
          <img
            src={nftData.imageUrl}
            alt={nftData.name || `NFT #${nftData.tokenId}`}
            crossOrigin="anonymous"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block'
            }}
            onError={e => {
              console.error('Failed to load NFT image:', nftData.imageUrl)
              const container = e.currentTarget.parentElement
              if (container) container.style.display = 'none'
            }}
          />
        </div>
        {nftData.name && (
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px', textAlign: 'center' }}>{nftData.name}</div>
        )}
        <div style={{ fontSize: '12px', opacity: 0.7, textAlign: 'center' }}>Token ID: {nftData.tokenId}</div>
      </div>

      <div className={styles.description} style={{ marginTop: '10px' }}>
        Only proceed if you are certain you want to transfer this NFT.
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px', width: '100%', maxWidth: '400px' }}>
        <Button variant="outlined" size="large" disabled={isLoading} onClick={onDeny} fullWidth>
          Deny
        </Button>
        <Button variant="contained" size="large" disabled={isLoading} onClick={onApprove} fullWidth>
          {isLoading ? 'Processing...' : 'Confirm Transfer'}
        </Button>
      </div>
    </Container>
  )
}
