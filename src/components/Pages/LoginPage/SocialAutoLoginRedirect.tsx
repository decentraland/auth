import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { CircularProgress } from 'decentraland-ui2'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { ConnectionType } from '../../../modules/analytics/types'
import { handleError } from '../../../shared/utils/errorHandler'
import { AnimatedBackground } from '../../AnimatedBackground'
import { ConnectionOptionType, connectionOptionTitles } from '../../Connection/Connection.types'
import { ConnectionContainer, ConnectionTitle, DecentralandLogo, ProgressContainer } from '../../ConnectionModal/ConnectionLayout.styled'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { Container, Wrapper } from '../../Pages/CallbackPage/CallbackPage.styled'
import { connectToSocialProvider } from './utils'

type Props = {
  connectionType: ConnectionOptionType
}

export const SocialAutoLoginRedirect = ({ connectionType }: Props) => {
  const { t } = useTranslation()
  const { flags } = useContext(FeatureFlagsContext)
  const { url: redirectTo } = useAfterLoginRedirection()
  const { trackLoginClick } = useAnalytics()
  const hasStarted = useRef(false)
  const [failed, setFailed] = useState(false)

  const startRedirect = useCallback(async () => {
    try {
      trackLoginClick({
        method: connectionType,
        type: ConnectionType.WEB2
      })

      await connectToSocialProvider(connectionType, flags[FeatureFlagsKeys.MAGIC_TEST], redirectTo)
    } catch (error) {
      handleError(error, 'Error during social auto-login redirect')
      setFailed(true)
    }
  }, [connectionType, flags[FeatureFlagsKeys.MAGIC_TEST], redirectTo, trackLoginClick])

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    startRedirect()
  }, [startRedirect])

  // On failure, reload to show the full login page so the user can retry or pick another method
  useEffect(() => {
    if (failed) {
      window.location.reload()
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
