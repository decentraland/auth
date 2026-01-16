import { useCallback, useEffect, useState } from 'react'
import Icon from 'semantic-ui-react/dist/commonjs/elements/Icon/Icon'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { launchDeepLink } from '../RequestPage/utils'
import styles from './MobileAuthPage.module.css'

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
      <main className={styles.main}>
        <div className={styles.background} />
        <div className={styles.successContainer}>
          <div className={styles.title}>Could not open {explorerText}</div>
          <div className={styles.description}>
            The application could not be launched. Please make sure {explorerText} is installed and try again.
          </div>
          <Button primary onClick={onTryAgain} style={{ marginTop: '24px', paddingLeft: '16px' }}>
            <Icon name="arrow left" />
            Try again
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.main}>
      <div className={styles.background} />
      <div className={styles.successContainer}>
        <div className={styles.logo}></div>
        <div className={styles.title}>Sign In Successful</div>
        <div className={styles.description}>
          {countdown > 0 ? `You will be redirected to ${explorerText} in ${countdown}...` : `Redirecting to ${explorerText}...`}
        </div>
        <Button primary onClick={attemptDeepLink} style={{ marginTop: '24px', paddingLeft: '16px' }}>
          <Icon name="sign in" />
          Return to {explorerText}
        </Button>
      </div>
    </main>
  )
}
