import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Env } from '@dcl/ui-env'
import { CircularProgress } from 'decentraland-ui2'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { ConnectionType } from '../../../modules/analytics/types'
import { config } from '../../../modules/config'
import { locations } from '../../../shared/locations'
import { handleError } from '../../../shared/utils/errorHandler'
import { AnimatedBackground } from '../../AnimatedBackground'
import { ConnectionOptionType, connectionOptionTitles } from '../../Connection/Connection.types'
import { ConnectionContainer, ConnectionTitle, DecentralandLogo, ProgressContainer } from '../../ConnectionModal/ConnectionLayout.styled'
import { Container, Wrapper } from '../../Pages/CallbackPage/CallbackPage.styled'
import { connectToSocialProvider } from './utils'

type Props = {
  connectionType: ConnectionOptionType
}

export const SocialAutoLoginRedirect = ({ connectionType }: Props) => {
  const { t } = useTranslation()
  const { url: redirectTo } = useAfterLoginRedirection()
  const { trackLoginClick } = useAnalytics()
  const hasStarted = useRef(false)
  const [failed, setFailed] = useState(false)

  const isMagicTest = config.is(Env.DEVELOPMENT)

  const startRedirect = useCallback(async () => {
    try {
      trackLoginClick({
        method: connectionType,
        type: ConnectionType.WEB2
      })

      await connectToSocialProvider(connectionType, isMagicTest, redirectTo)
    } catch (error) {
      handleError(error, 'Error during social auto-login redirect')
      setFailed(true)
    }
  }, [connectionType, isMagicTest, redirectTo, trackLoginClick])

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    startRedirect()
  }, [startRedirect])

  useEffect(() => {
    if (failed) {
      window.location.href = locations.login()
    }
  }, [failed])

  const providerName = connectionOptionTitles[connectionType]

  return (
    <Container>
      <AnimatedBackground variant="absolute" />
      <Wrapper>
        <ConnectionContainer>
          <DecentralandLogo size="huge" />
          <ConnectionTitle>{t('social_auto_login.redirecting_to', { provider: providerName })}</ConnectionTitle>
          <ProgressContainer>
            <CircularProgress color="inherit" />
          </ProgressContainer>
        </ConnectionContainer>
      </Wrapper>
    </Container>
  )
}
