import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import LoginIcon from '@mui/icons-material/Login'
import { Button } from 'decentraland-ui2'
import { useTargetConfig } from '../../../../hooks/targetConfig'
import { Container } from '../Container'
import { launchDeepLink } from '../utils'
import styles from './Views.module.css'

type Props = {
  onContinue: () => void
  requestId: string
  deepLinkUrl: string
  autoStart?: boolean
}

const COUNTDOWN_SECONDS = 5

export const ContinueInApp = ({ onContinue, requestId, deepLinkUrl, autoStart = true }: Props) => {
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
    const loginUrl = `/auth/requests/${requestId}${queryString ? `?${queryString}` : ''}`
    window.location.href = loginUrl
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
        <div className={styles.title}>Could not open {targetConfig.explorerText}</div>
        <div className={styles.description}>
          The application could not be launched. Please make sure {targetConfig.explorerText} is installed and try again.
        </div>

        <Button variant="contained" onClick={handleGoToLogin} startIcon={<ArrowBackIcon />} sx={{ marginTop: '24px' }}>
          Go back to login
        </Button>
      </Container>
    )
  }

  return (
    <Container canChangeAccount={false} requestId={requestId}>
      <div className={styles.logo}></div>
      <div className={styles.title}>Sign In Successful</div>
      <div className={styles.description}>
        You will be redirected to {targetConfig.explorerText} in {countdown}...
      </div>

      <Button variant="contained" onClick={attemptDeepLink} startIcon={<LoginIcon />} sx={{ marginTop: '24px' }}>
        Return to {targetConfig.explorerText}
      </Button>
    </Container>
  )
}
