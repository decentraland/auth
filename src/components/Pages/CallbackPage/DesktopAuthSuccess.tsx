import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Button, CircularProgress } from 'decentraland-ui2'
import { config } from '../../../modules/config'
import { AnimatedBackground } from '../../AnimatedBackground'
import {
  ConnectionContainer,
  ConnectionTitle,
  DecentralandLogo,
  ErrorButtonContainer,
  ProgressContainer
} from '../../ConnectionModal/ConnectionLayout.styled'
import { launchDeepLink } from '../RequestPage/utils'
import { Container, Wrapper } from './CallbackPage.styled'

const COUNTDOWN_SECONDS = 3

const ENVIRONMENT_TO_DCLENV: Record<string, string> = {
  development: 'zone',
  staging: 'today',
  production: 'org'
}

type Props = {
  identityId: string
  explorerText: string
  onTryAgain: () => void
}

export const DesktopAuthSuccess = ({ identityId, explorerText, onTryAgain }: Props) => {
  const { t } = useTranslation()
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [deepLinkFailed, setDeepLinkFailed] = useState(false)

  const environment = config.get('ENVIRONMENT').toLowerCase()
  const dclenv = ENVIRONMENT_TO_DCLENV[environment] ?? 'org'
  const deepLinkUrl = `decentraland://?dclenv=${dclenv}&signin=${identityId}`

  const attemptDeepLink = useCallback(async () => {
    const wasLaunched = await launchDeepLink(deepLinkUrl)
    if (!wasLaunched) {
      setDeepLinkFailed(true)
    }
  }, [deepLinkUrl])

  useEffect(() => {
    if (deepLinkFailed) return

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
  }, [deepLinkFailed, attemptDeepLink])

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
                <Button variant="contained" onClick={onTryAgain} data-testid="desktop-auth-try-again-button">
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
              <Button variant="contained" onClick={attemptDeepLink} data-testid="desktop-auth-open-explorer-button">
                {t('mobile_auth.return_to', { explorerText })}
              </Button>
            </>
          )}
        </ConnectionContainer>
      </Wrapper>
    </Container>
  )
}
