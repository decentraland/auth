import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '@dcl/hooks'
import { muiIcons } from 'decentraland-ui2'
import { useTargetConfig } from '../../../../hooks/targetConfig'
import { LOGIN_REQUEST_ID } from '../../../../shared/locations'
import { Container } from '../Container'
import { launchDeepLink } from '../utils'
import { ActionButton } from './ContinueInApp.styled'
import styles from './Views.module.css'

const ArrowBackIcon = muiIcons.ArrowBack
const LoginIcon = muiIcons.Login

type Props = {
  onContinue: () => void
  requestId: string
  deepLinkUrl: string
  autoStart?: boolean
}

const COUNTDOWN_SECONDS = 5

export const ContinueInApp = ({ onContinue, requestId, deepLinkUrl, autoStart = true }: Props) => {
  const { t } = useTranslation()
  const [targetConfig] = useTargetConfig()
  const [searchParams] = useSearchParams()
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [deepLinkFailed, setDeepLinkFailed] = useState(false)

  const attemptDeepLink = useCallback(async () => {
    const wasLaunched = await launchDeepLink(deepLinkUrl)
    if (wasLaunched) {
      onContinue()
    } else {
      setDeepLinkFailed(true)
    }
  }, [deepLinkUrl, onContinue])

  const handleGoToLogin = useCallback(() => {
    // Remove the flow=deeplink param and redirect to login
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('flow')
    const queryString = newParams.toString()
    const requestUrl = `/auth/requests/${requestId}${queryString ? `?${queryString}` : ''}`
    if (requestId === LOGIN_REQUEST_ID) {
      // The login pseudo request has no traditional flow to fall back to — going back to
      // the request page would just retry the same deep link. Send the user to the login
      // page instead so they can retry, with another method if they want.
      window.location.href = `/auth/login?redirectTo=${encodeURIComponent(requestUrl)}`
      return
    }
    window.location.href = requestUrl
  }, [requestId, searchParams])

  useEffect(() => {
    if (!autoStart) return
    if (deepLinkFailed) return

    // Start countdown
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          // Auto-attempt deep link when countdown reaches 0
          attemptDeepLink()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [attemptDeepLink, autoStart, deepLinkFailed])

  if (deepLinkFailed) {
    return (
      <Container canChangeAccount={false} requestId={requestId}>
        <div className={styles.errorLogo}></div>
        <div className={styles.title}>{t('request_views.continue_in_app.could_not_open', { explorerText: targetConfig.explorerText })}</div>
        <div className={styles.description}>
          {t('request_views.continue_in_app.app_not_launched', { explorerText: targetConfig.explorerText })}
        </div>

        <ActionButton
          variant="contained"
          onClick={handleGoToLogin}
          startIcon={<ArrowBackIcon />}
          data-testid="continue-in-app-go-back-button"
        >
          {t('request_views.continue_in_app.go_back_login')}
        </ActionButton>
      </Container>
    )
  }

  return (
    <Container canChangeAccount={false} requestId={requestId}>
      <div className={styles.logo}></div>
      <div className={styles.title}>{t('request_views.continue_in_app.sign_in_successful')}</div>
      <div className={styles.description}>
        {t('request_views.continue_in_app.redirect_countdown', { explorerText: targetConfig.explorerText, countdown })}
      </div>

      <ActionButton variant="contained" onClick={attemptDeepLink} startIcon={<LoginIcon />} data-testid="continue-in-app-return-button">
        {t('request_views.continue_in_app.return_to', { explorerText: targetConfig.explorerText })}
      </ActionButton>
    </Container>
  )
}
