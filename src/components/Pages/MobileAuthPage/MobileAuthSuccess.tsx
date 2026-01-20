import { useCallback, useEffect, useState } from 'react'
import ArrowBackIosNewTwoToneIcon from '@mui/icons-material/ArrowBackIosNewTwoTone'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import logoImg from '../../../assets/images/logo.svg'
import wrongImg from '../../../assets/images/wrong.svg'
import { launchDeepLink } from '../RequestPage/utils'
import { ActionButton, Background, Description, Icon, Logo, Main, SuccessContainer, Title } from './MobileAuthPage.styled'

const COUNTDOWN_SECONDS = 3

type Props = {
  identityId: string
  explorerText: string
  onTryAgain: () => void
}

export const MobileAuthSuccess = ({ identityId, explorerText, onTryAgain }: Props) => {
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
          <Title>Could not open {explorerText}</Title>
          <Description>The application could not be launched. Please make sure {explorerText} is installed and try again.</Description>
          <ActionButton>
            <Button primary onClick={onTryAgain}>
              <ArrowBackIosNewTwoToneIcon fontSize="small" />
              Try again
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
        <Title>Sign In Successful</Title>
        <Description>
          {countdown > 0 ? (
            <>
              You will be redirected to
              <br />
              {explorerText} in {countdown}...
            </>
          ) : (
            `Redirecting to ${explorerText}...`
          )}
        </Description>
        <ActionButton>
          <Button primary onClick={attemptDeepLink}>
            <LoginRoundedIcon fontSize="small" />
            Return to {explorerText}
          </Button>
        </ActionButton>
      </SuccessContainer>
    </Main>
  )
}
