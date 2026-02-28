import { Button, CircularProgress } from 'decentraland-ui2'
import { Container } from '../Container'
import { ButtonsContainer } from '../RequestPage.styled'
import styles from './Views.module.css'

interface WalletInteractionProps {
  requestId: string
  title?: string
  isLoading?: boolean
  onDeny: () => void
  onApprove: () => void
}

export const WalletInteraction = ({
  requestId,
  title = 'The Explorer wants to interact with your wallet',
  isLoading = false,
  onDeny,
  onApprove
}: WalletInteractionProps) => {
  return (
    <Container canChangeAccount requestId={requestId}>
      <div className={styles.logo}></div>
      <div className={styles.title}>{title}</div>
      <div className={styles.description}>Only proceed if you are aware of all transaction details and trust this scene.</div>
      <ButtonsContainer>
        <Button variant="outlined" disabled={isLoading} onClick={onDeny}>
          Deny
        </Button>
        <Button variant="contained" disabled={isLoading} onClick={onApprove}>
          {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Allow'}
        </Button>
      </ButtonsContainer>
    </Container>
  )
}
