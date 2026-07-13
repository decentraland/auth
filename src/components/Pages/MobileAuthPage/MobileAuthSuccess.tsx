import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Button, muiIcons } from 'decentraland-ui2'
import logoImg from '../../../assets/images/logo.svg'
import wrongImg from '../../../assets/images/wrong.svg'
import { getSigninDeeplink, launchDeepLink } from '../RequestPage/utils'
import { ActionButton, Background, Description, Icon, Logo, Main, SuccessContainer, Title } from './MobileAuthPage.styled'

const ArrowBackIosNewTwoToneIcon = muiIcons.ArrowBackIosNewTwoTone
const LoginRoundedIcon = muiIcons.LoginRounded
const COUNTDOWN_SECONDS = 3

type Props = {
  identityId: string
  explorerText: string
  onTryAgain: () => void
}

export const MobileAuthSuccess = ({ identityId, explorerText, onTryAgain }: Props) => {
  const { t } = useTranslation()
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [deepLinkFailed, setDeepLinkFailed] = useState(false)

  // Reuse the shared builder so the mobile handoff carries dclenv (on non-production)
  // like the desktop/client-login deep links, instead of a bare signin URL.
  const deepLinkUrl = getSigninDeeplink(undefined, identityId)

  const hasLaunchedRef = useRef(false)

  const attemptDeepLink = useCallback(async () => {
    if (hasLaunchedRef.current) return
    hasLaunchedRef.current = true
    const wasLaunched = await launchDeepLink(deepLinkUrl)
    if (!wasLaunched) {
      // Allow the countdown/retry to re-attempt.
      hasLaunchedRef.current = false
      setDeepLinkFailed(true)
    }
  }, [deepLinkUrl])

  // Tick the countdown down once per second. The updater stays pure — the launch is triggered by
  // the effect below when the countdown reaches zero — so a StrictMode double-invoke of the updater
  // can't fire the deep link twice (mirrors ContinueInApp).
  useEffect(() => {
    if (deepLinkFailed) return

    const interval = setInterval(() => {
      setCountdown(prev => (prev <= 0 ? 0 : prev - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [deepLinkFailed])

  // Launch the deep link once the countdown reaches zero (guarded against double-fire by the ref).
  useEffect(() => {
    if (deepLinkFailed) return
    if (countdown === 0) attemptDeepLink()
  }, [attemptDeepLink, countdown, deepLinkFailed])

  if (deepLinkFailed) {
    return (
      <Main component="main">
        <Background />
        <SuccessContainer>
          <Icon src={wrongImg} alt="Error" />
          <Title>{t('mobile_auth.could_not_open', { explorerText })}</Title>
          <Description>{t('mobile_auth.app_not_launched', { explorerText })}</Description>
          <ActionButton>
            <Button
              variant="contained"
              onClick={onTryAgain}
              startIcon={<ArrowBackIosNewTwoToneIcon fontSize="small" />}
              data-testid="mobile-auth-try-again-button"
            >
              {t('common.try_again')}
            </Button>
          </ActionButton>
        </SuccessContainer>
      </Main>
    )
  }

  return (
    <Main component="main">
      <Background />
      <SuccessContainer>
        <Logo src={logoImg} alt="Decentraland logo" />
        <Title>{t('mobile_auth.sign_in_successful')}</Title>
        <Description>
          {countdown > 0
            ? t('mobile_auth.redirect_countdown', { explorerText, countdown })
            : t('mobile_auth.redirecting', { explorerText })}
        </Description>
        <ActionButton>
          <Button
            variant="contained"
            onClick={attemptDeepLink}
            startIcon={<LoginRoundedIcon fontSize="small" />}
            data-testid="mobile-auth-return-button"
          >
            {t('mobile_auth.return_to', { explorerText })}
          </Button>
        </ActionButton>
      </SuccessContainer>
    </Main>
  )
}
