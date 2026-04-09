import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { Button, CircularProgress } from 'decentraland-ui2'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { config } from '../../../modules/config'
import { createAuthServerHttpClient } from '../../../shared/auth'
import { useCurrentConnectionData } from '../../../shared/connection'
import { locations } from '../../../shared/locations'
import { handleError } from '../../../shared/utils/errorHandler'
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
  const [targetConfig] = useTargetConfig()
  const { account } = useCurrentConnectionData()
  const hasStartedPosting = useRef(false)

  const [identityId, setIdentityId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [deepLinkFailed, setDeepLinkFailed] = useState(false)
  const [error, setError] = useState(false)

  const explorerText = targetConfig.explorerText

  const environment = config.get('ENVIRONMENT').toLowerCase()
  const dclenv = ENVIRONMENT_TO_DCLENV[environment]
  if (!dclenv) {
    console.warn('Unknown ENVIRONMENT value for deep link:', environment, '— defaulting to org')
  }

  // Post the identity to the auth server on mount
  useEffect(() => {
    if (hasStartedPosting.current) return
    hasStartedPosting.current = true

    const postCurrentIdentity = async () => {
      const ethAddress = account?.toLowerCase()
      if (!ethAddress) {
        navigate(locations.login(), { replace: true })
        return
      }

      const identity = localStorageGetIdentity(ethAddress)
      if (!identity) {
        console.warn('No identity found in localStorage for', ethAddress)
        navigate(locations.login(), { replace: true })
        return
      }

      try {
        const httpClient = createAuthServerHttpClient()
        const response = await httpClient.postIdentity(identity, { isMobile: false })
        setIdentityId(response.identityId)
      } catch (err) {
        handleError(err, 'Error posting identity to auth server')
        setError(true)
      }
    }

    postCurrentIdentity()
  }, [account, navigate])

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

  // Countdown and auto-launch deep link after identity is posted
  useEffect(() => {
    if (!identityId || deepLinkFailed) return

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
  }, [identityId, deepLinkFailed, attemptDeepLink])

  if (error) {
    return (
      <Container>
        <AnimatedBackground variant="absolute" />
        <Wrapper>
          <ConnectionContainer>
            <DecentralandLogo size="huge" />
            <ConnectionTitle>{t('mobile_auth.could_not_open', { explorerText })}</ConnectionTitle>
            <ErrorButtonContainer>
              <Button variant="contained" onClick={handleTryAgain} data-testid="open-explorer-try-again-button">
                {t('common.try_again')}
              </Button>
            </ErrorButtonContainer>
          </ConnectionContainer>
        </Wrapper>
      </Container>
    )
  }

  if (!identityId) {
    return (
      <Container>
        <AnimatedBackground variant="absolute" />
        <Wrapper>
          <ConnectionContainer>
            <DecentralandLogo size="huge" />
            <ConnectionTitle>{t('connection_layout.validating_sign_in')}</ConnectionTitle>
            <ProgressContainer>
              <CircularProgress color="inherit" />
            </ProgressContainer>
          </ConnectionContainer>
        </Wrapper>
      </Container>
    )
  }

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
