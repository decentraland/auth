import { useTranslation } from '@dcl/hooks'
import { Box, CircularProgress, muiIcons } from 'decentraland-ui2'
import { Container } from '../../Container'
import { ButtonsContainer, NoButton, TimeoutMessage, VerificationCode, YesButton } from '../../RequestPage.styled'
import { ErrorMessageIcon } from '../RecoverError.styled'
import styles from '../Views.module.css'
import { VerifySignInProps } from './VerifySignIn.types'

const CancelIcon = muiIcons.Cancel
const CheckCircleIcon = muiIcons.CheckCircle

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
      <Box className={styles.logo}></Box>
      <Box className={styles.title}>{t('request.verify_sign_in')}</Box>

      {!isDeepLinkFlow && (
        <>
          <Box className={styles.description}>{t('request.verification_match', { explorerText })}</Box>
          {code !== undefined && <VerificationCode>{code}</VerificationCode>}
        </>
      )}

      {isDeepLinkFlow && <Box className={styles.description}>{t('request.deep_link_confirm', { explorerText })}</Box>}

      <ButtonsContainer>
        <NoButton variant="outlined" disabled={isLoading} onClick={onDeny} startIcon={<CancelIcon />} data-testid="verify-sign-in-deny-button">
          {isDeepLinkFlow ? t('common.cancel') : t('request.no_it_doesnt')}
        </NoButton>
        <YesButton
          variant="outlined"
          disabled={isLoading}
          onClick={onApprove}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
          data-testid="verify-sign-in-approve-button"
        >
          {isDeepLinkFlow ? t('request.sign_in') : t('request.yes_same')}
        </YesButton>
      </ButtonsContainer>

      {hasTimedOut && (
        <TimeoutMessage>
          <ErrorMessageIcon fontSize="large" />
          <Box>
            {t('request.timeout_logged_out')}
            <br />
            {t('request.timeout_check_login')}
          </Box>
        </TimeoutMessage>
      )}
    </Container>
  )
}
