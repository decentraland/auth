import { useEffect, useState } from 'react'
import Icon from 'semantic-ui-react/dist/commonjs/elements/Icon/Icon'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { useTargetConfig } from '../../../../hooks/targetConfig'
import { Container } from '../Container'
import styles from './Views.module.css'

type Props = {
  onContinue: () => void
  requestId: string
}

const COUNTDOWN_SECONDS = 5

export const ContinueInApp = ({ onContinue, requestId }: Props) => {
  const [targetConfig] = useTargetConfig()
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)

  useEffect(() => {
    // Start countdown
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          // Auto-redirect when countdown reaches 0
          onContinue()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [onContinue])

  return (
    <Container canChangeAccount={false} requestId={requestId}>
      <div className={styles.logo}></div>
      <div className={styles.title}>Sign In Successful</div>
      <div className={styles.description}>
        You will be redirected to {targetConfig.explorerText} in {countdown}...
      </div>

      <Button primary onClick={onContinue} style={{ marginTop: '24px' }}>
        <Icon name="sign in" />
        Return to {targetConfig.explorerText}
      </Button>
    </Container>
  )
}
