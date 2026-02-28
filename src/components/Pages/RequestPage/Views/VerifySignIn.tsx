import { CircularProgress, muiIcons } from 'decentraland-ui2'
import { Container } from '../Container'
import { ButtonsContainer, NoButton, TimeoutMessage, VerificationCode, YesButton } from '../RequestPage.styled'
import { ErrorMessageIcon } from './RecoverError.styled'
import styles from './Views.module.css'

const CancelIcon = muiIcons.Cancel
const CheckCircleIcon = muiIcons.CheckCircle

interface VerifySignInProps {
  requestId: string
  code?: string | number
  isLoading?: boolean
  hasTimedOut?: boolean
  explorerText?: string
  isDeepLinkFlow?: boolean
  onDeny: () => void
  onApprove: () => void
}

export const VerifySignIn = ({
  requestId,
  code,
  isLoading = false,
  hasTimedOut = false,
  explorerText = 'Explorer',
  isDeepLinkFlow = false,
  onDeny,
  onApprove
}: VerifySignInProps) => {
  return (
    <Container canChangeAccount requestId={requestId}>
      <div className={styles.logo}></div>
      <div className={styles.title}>Verify Sign In</div>

      {!isDeepLinkFlow && (
        <>
          <div className={styles.description}>
            Does the verification number below match the one in the {explorerText}?
          </div>
          {code !== undefined && <VerificationCode>{code}</VerificationCode>}
        </>
      )}

      {isDeepLinkFlow && (
        <div className={styles.description}>Please confirm you want to sign in to {explorerText}</div>
      )}

      <ButtonsContainer>
        <NoButton variant="outlined" disabled={isLoading} onClick={onDeny} startIcon={<CancelIcon />}>
          {isDeepLinkFlow ? 'Cancel' : "No, it doesn't"}
        </NoButton>
        <YesButton
          variant="outlined"
          disabled={isLoading}
          onClick={onApprove}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
        >
          {isDeepLinkFlow ? 'Sign In' : 'Yes, they are the same'}
        </YesButton>
      </ButtonsContainer>

      {hasTimedOut && (
        <TimeoutMessage>
          <ErrorMessageIcon fontSize="large" />
          <div>
            You might be logged out of your wallet extension.
            <br />
            Please check that you&apos;re logged in and try again.
          </div>
        </TimeoutMessage>
      )}
    </Container>
  )
}
