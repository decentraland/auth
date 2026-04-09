import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '@dcl/hooks'
import { Button, CircularProgress } from 'decentraland-ui2'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { config } from '../../../modules/config'
import { locations } from '../../../shared/locations'
import { AnimatedBackground } from '../../AnimatedBackground'
import {
  ConnectionContainer,
  ConnectionTitle,
  DecentralandLogo,
  ErrorButtonContainer,
  ProgressContainer
} from '../../ConnectionModal/ConnectionLayout.styled'
import { launchDeepLink } from '../RequestPage/utils'
import { Container, Wrapper } from './OpenExplorerPage.styled'

const COUNTDOWN_SECONDS = 3

const ENVIRONMENT_TO_DCLENV: Record<string, string> = {
  development: 'zone',
  staging: 'today',
  production: 'org'
}

export const OpenExplorerPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigateWithSearchParams()
  const [searchParams] = useSearchParams()
  const [targetConfig] = useTargetConfig()
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [deepLinkFailed, setDeepLinkFailed] = useState(false)

  const identityId = searchParams.get('identityId')
  const explorerText = targetConfig.explorerText

  const environment = config.get('ENVIRONMENT').toLowerCase()
  const dclenv = ENVIRONMENT_TO_DCLENV[environment]
  if (!dclenv) {
    console.warn('Unknown ENVIRONMENT value for deep link:', environment, '— defaulting to org')
  }
  const deepLinkUrl = identityId ? `decentraland://?dclenv=${dclenv ?? 'org'}&signin=${identityId}` : null

  const attemptDeepLink = useCallback(async () => {
    if (!deepLinkUrl) return
    const wasLaunched = await launchDeepLink(deepLinkUrl)
    if (!wasLaunched) {
      setDeepLinkFailed(true)
    }
  }, [deepLinkUrl])

  const handleTryAgain = useCallback(() => {
    navigate(locations.login(), { replace: true })
  }, [navigate])

  // Redirect to login if no identityId was provided
  useEffect(() => {
    if (!identityId) {
      navigate(locations.login(), { replace: true })
    }
  }, [identityId, navigate])

  // Countdown and auto-launch deep link
  useEffect(() => {
    if (deepLinkFailed || !identityId) return

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          attemptDeepLink()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [deepLinkFailed, attemptDeepLink, identityId])

  if (!identityId) return null

  return (
    <Container>
      <AnimatedBackground variant="absolute" />
      <Wrapper>
        <ConnectionContainer>
          <DecentralandLogo size="huge" />
          {deepLinkFailed ? (
            <>
              <ConnectionTitle>{t('mobile_auth.could_not_open', { explorerText })}</ConnectionTitle>
              <ErrorButtonContainer>
                <Button variant="contained" onClick={handleTryAgain} data-testid="open-explorer-try-again-button">
                  {t('common.try_again')}
                </Button>
              </ErrorButtonContainer>
            </>
          ) : (
            <>
              <ConnectionTitle>
                {countdown > 0
                  ? t('mobile_auth.redirect_countdown', { explorerText, countdown })
                  : t('mobile_auth.redirecting', { explorerText })}
              </ConnectionTitle>
              <ProgressContainer>
                <CircularProgress color="inherit" />
              </ProgressContainer>
              <Button variant="contained" onClick={attemptDeepLink} data-testid="open-explorer-button">
                {t('mobile_auth.return_to', { explorerText })}
              </Button>
            </>
          )}
        </ConnectionContainer>
      </Wrapper>
    </Container>
  )
}
