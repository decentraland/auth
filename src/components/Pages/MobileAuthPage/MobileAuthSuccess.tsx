import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Button, muiIcons } from 'decentraland-ui2'
import logoImg from '../../../assets/images/logo.svg'
import wrongImg from '../../../assets/images/wrong.svg'
import { launchDeepLink } from '../RequestPage/utils'
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

  const deepLinkUrl = `decentraland://open?signin=${identityId}`

  const attemptDeepLink = useCallback(async () => {
    const wasLaunched = await launchDeepLink(deepLinkUrl)
    if (!wasLaunched) {
      setDeepLinkFailed(true)
    }
  }, [deepLinkUrl])

  // Countdown and auto-launch deep link
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

  if (deepLinkFailed) {
    return (
      <Main component="main">
        <Background />
        <SuccessContainer>
          <Icon src={wrongImg} alt="Error" />
          <Title>{t('mobile_auth.could_not_open', { explorerText })}</Title>
          <Description>{t('mobile_auth.app_not_launched', { explorerText })}</Description>
          <ActionButton>
            <Button variant="contained" onClick={onTryAgain} startIcon={<ArrowBackIosNewTwoToneIcon fontSize="small" />}>
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
          <Button variant="contained" onClick={attemptDeepLink} startIcon={<LoginRoundedIcon fontSize="small" />}>
            {t('mobile_auth.return_to', { explorerText })}
          </Button>
        </ActionButton>
      </SuccessContainer>
    </Main>
  )
}
