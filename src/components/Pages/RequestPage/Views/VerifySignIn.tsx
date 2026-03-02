import { useTranslation } from '@dcl/hooks'
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
  const { t } = useTranslation()
  return (
    <Container canChangeAccount requestId={requestId}>
      <div className={styles.logo}></div>
      <div className={styles.title}>{t('request.verify_sign_in')}</div>

      {!isDeepLinkFlow && (
        <>
          <div className={styles.description}>{t('request.verification_match', { explorerText })}</div>
          {code !== undefined && <VerificationCode>{code}</VerificationCode>}
        </>
      )}

      {isDeepLinkFlow && <div className={styles.description}>{t('request.deep_link_confirm', { explorerText })}</div>}

      <ButtonsContainer>
        <NoButton variant="outlined" disabled={isLoading} onClick={onDeny} startIcon={<CancelIcon />}>
          {isDeepLinkFlow ? t('common.cancel') : t('request.no_it_doesnt')}
        </NoButton>
        <YesButton
          variant="outlined"
          disabled={isLoading}
          onClick={onApprove}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
        >
          {isDeepLinkFlow ? t('request.sign_in') : t('request.yes_same')}
        </YesButton>
      </ButtonsContainer>

      {hasTimedOut && (
        <TimeoutMessage>
          <ErrorMessageIcon fontSize="large" />
          <div>
            {t('request.timeout_logged_out')}
            <br />
            {t('request.timeout_check_login')}
          </div>
        </TimeoutMessage>
      )}
    </Container>
  )
}
