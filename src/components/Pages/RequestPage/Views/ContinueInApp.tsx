import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '@dcl/hooks'
import { muiIcons } from 'decentraland-ui2'
import { useTargetConfig } from '../../../../hooks/targetConfig'
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
  // When true (client-login flow) the deep link opens the client after a successful login
  // rather than approving a request. There is no traditional request flow to fall back to,
  // so failure offers a plain retry instead of go-back-to-login, and — since this is the
  // first screen the user sees (no VerifySignIn precedes it) — it offers the change-account
  // link like the classic request views do.
  isClientLogin?: boolean
}

const COUNTDOWN_SECONDS = 5

export const ContinueInApp = ({ onContinue, requestId, deepLinkUrl, autoStart = true, isClientLogin = false }: Props) => {
  const { t } = useTranslation()
  const [targetConfig] = useTargetConfig()
  const [searchParams] = useSearchParams()
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [deepLinkFailed, setDeepLinkFailed] = useState(false)
  // The client-login view stays mounted after a successful launch (there is nothing to
  // navigate to), so track the launch to swap the copy to "redirecting" and keep the
  // countdown effect from starting a new interval.
  const [hasLaunched, setHasLaunched] = useState(false)
  // Set synchronously before the async launch to drop any overlapping call: the manual
  // "Return to <Explorer>" button and the countdown's zero-tick can both fire while a
  // launch is still in flight (hasLaunched only flips once it resolves), which would open
  // the client and call onContinue twice.
  const isLaunchingRef = useRef(false)

  const attemptDeepLink = useCallback(async () => {
    if (isLaunchingRef.current) return
    isLaunchingRef.current = true
    try {
      const wasLaunched = await launchDeepLink(deepLinkUrl)
      if (wasLaunched) {
        setHasLaunched(true)
        onContinue()
      } else {
        setDeepLinkFailed(true)
      }
    } finally {
      isLaunchingRef.current = false
    }
  }, [deepLinkUrl, onContinue])

  const handleGoToLogin = useCallback(() => {
    // Remove the flow=deeplink param and redirect to login
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('flow')
    const queryString = newParams.toString()
    const loginUrl = `/auth/requests/${requestId}${queryString ? `?${queryString}` : ''}`
    window.location.href = loginUrl
  }, [requestId, searchParams])

  // Restart the countdown so it re-attempts the deep link after the same delay.
  const handleRetry = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS)
    setDeepLinkFailed(false)
  }, [])

  // Tick the countdown down once per second. The updater stays pure — the launch is
  // triggered by the effect below when the countdown reaches zero — so a StrictMode
  // double-invoke of the updater can't fire the deep link twice.
  useEffect(() => {
    if (!autoStart || deepLinkFailed || hasLaunched) return

    const interval = setInterval(() => {
      setCountdown(prev => (prev <= 0 ? 0 : prev - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [autoStart, deepLinkFailed, hasLaunched])

  // Open the client automatically once the countdown reaches zero.
  useEffect(() => {
    if (!autoStart || deepLinkFailed || hasLaunched) return
    if (countdown === 0) attemptDeepLink()
  }, [attemptDeepLink, autoStart, countdown, deepLinkFailed, hasLaunched])

  if (deepLinkFailed) {
    return (
      <Container canChangeAccount={isClientLogin} requestId={requestId}>
        <div className={styles.errorLogo}></div>
        <div className={styles.title}>{t('request_views.continue_in_app.could_not_open', { explorerText: targetConfig.explorerText })}</div>
        <div className={styles.description}>
          {t('request_views.continue_in_app.app_not_launched', { explorerText: targetConfig.explorerText })}
        </div>

        {isClientLogin ? (
          <ActionButton variant="contained" onClick={handleRetry} startIcon={<LoginIcon />} data-testid="continue-in-app-try-again-button">
            {t('common.try_again')}
          </ActionButton>
        ) : (
          <ActionButton
            variant="contained"
            onClick={handleGoToLogin}
            startIcon={<ArrowBackIcon />}
            data-testid="continue-in-app-go-back-button"
          >
            {t('request_views.continue_in_app.go_back_login')}
          </ActionButton>
        )}
      </Container>
    )
  }

  return (
    <Container canChangeAccount={isClientLogin} requestId={requestId}>
      <div className={styles.logo}></div>
      <div className={styles.title}>{t('request_views.continue_in_app.sign_in_successful')}</div>
      <div className={styles.description}>
        {hasLaunched
          ? t('request_views.continue_in_app.redirecting', { explorerText: targetConfig.explorerText })
          : t('request_views.continue_in_app.redirect_countdown', { explorerText: targetConfig.explorerText, countdown })}
      </div>

      <ActionButton variant="contained" onClick={attemptDeepLink} startIcon={<LoginIcon />} data-testid="continue-in-app-return-button">
        {t('request_views.continue_in_app.return_to', { explorerText: targetConfig.explorerText })}
      </ActionButton>
    </Container>
  )
}
