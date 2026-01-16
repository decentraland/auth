import { useCallback, useEffect, useState } from 'react'
import ArrowBackIosNewTwoToneIcon from '@mui/icons-material/ArrowBackIosNewTwoTone'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { launchDeepLink } from '../RequestPage/utils'
import { Background, Description, Logo, Main, SuccessContainer, Title } from './MobileAuthPage.styled'

const COUNTDOWN_SECONDS = 5

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
          <Title>Could not open {explorerText}</Title>
          <Description>The application could not be launched. Please make sure {explorerText} is installed and try again.</Description>
          <Button primary onClick={onTryAgain} style={{ marginTop: '24px', paddingLeft: '16px' }}>
            <ArrowBackIosNewTwoToneIcon />
            Try again
          </Button>
        </SuccessContainer>
      </Main>
    )
  }

  return (
    <Main component="main">
      <Background />
      <SuccessContainer>
        <Logo />
        <Title>Sign In Successful</Title>
        <Description>
          {countdown > 0 ? `You will be redirected to ${explorerText} in ${countdown}...` : `Redirecting to ${explorerText}...`}
        </Description>
        <Button primary onClick={attemptDeepLink} style={{ marginTop: '24px', paddingLeft: '16px' }}>
          <LoginRoundedIcon />
          Return to {explorerText}
        </Button>
      </SuccessContainer>
    </Main>
  )
}
