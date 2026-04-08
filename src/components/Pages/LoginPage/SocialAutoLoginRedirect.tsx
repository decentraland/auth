import { useCallback, useContext, useEffect, useRef } from 'react'
import { useTranslation } from '@dcl/hooks'
import { CircularProgress } from 'decentraland-ui2'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { ConnectionType } from '../../../modules/analytics/types'
import { AnimatedBackground } from '../../AnimatedBackground'
import { ConnectionOptionType, connectionOptionTitles } from '../../Connection/Connection.types'
import { ConnectionContainer, ConnectionTitle, DecentralandLogo, ProgressContainer } from '../../ConnectionModal/ConnectionLayout.styled'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
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

  const startRedirect = useCallback(async () => {
    trackLoginClick({
      method: connectionType,
      type: ConnectionType.WEB2
    })

    await connectToSocialProvider(connectionType, flags[FeatureFlagsKeys.MAGIC_TEST], redirectTo)
  }, [connectionType, flags[FeatureFlagsKeys.MAGIC_TEST], redirectTo, trackLoginClick])

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    startRedirect()
  }, [startRedirect])

  const providerName = connectionOptionTitles[connectionType]

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <AnimatedBackground variant="absolute" />
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', position: 'relative' }}>
        <ConnectionContainer>
          <DecentralandLogo size="huge" />
          <ConnectionTitle>{t('social_auto_login.redirecting_to', { provider: providerName })}</ConnectionTitle>
          <ProgressContainer>
            <CircularProgress color="inherit" />
          </ProgressContainer>
        </ConnectionContainer>
      </div>
    </div>
  )
}
