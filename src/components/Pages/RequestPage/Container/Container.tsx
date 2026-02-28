import { ReactNode, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '@dcl/hooks'
import { connection } from 'decentraland-connect'
import { useMobileMediaQuery } from 'decentraland-ui2'
import { useNavigateWithSearchParams } from '../../../../hooks/navigation'
import { useTargetConfig } from '../../../../hooks/targetConfig'
import { useCurrentConnectionData } from '../../../../shared/connection/hooks'
import { AnimatedBackground } from '../../../AnimatedBackground'
import { CustomWearablePreview } from '../../../CustomWearablePreview'
import styles from './Container.module.css'

export const Container = (props: { children: ReactNode; requestId?: string; canChangeAccount?: boolean; hasProfile?: boolean }) => {
  const { children, requestId, canChangeAccount } = props
  const { t } = useTranslation()

  const [searchParams] = useSearchParams()
  const [targetConfig, targetConfigId] = useTargetConfig()
  const navigate = useNavigateWithSearchParams()
  const isMobile = useMobileMediaQuery()
  const { account } = useCurrentConnectionData()
  const isDeepLinkFlow = searchParams.get('flow') === 'deeplink'

  // Preserve loginMethod from current URL for auto-login functionality
  const loginMethodParam = searchParams.get('loginMethod')

  const onChangeAccount = useCallback(
    async (evt: React.MouseEvent<HTMLAnchorElement>) => {
      evt.preventDefault()
      await connection.disconnect()
      const flowParam = isDeepLinkFlow ? '&flow=deeplink' : ''
      const redirectToUrl = `/auth/requests/${requestId ?? ''}?targetConfigId=${targetConfigId}${flowParam}`
      const loginMethodQuery = loginMethodParam ? `&loginMethod=${encodeURIComponent(loginMethodParam)}` : ''
      navigate(`/login?redirectTo=${encodeURIComponent(redirectToUrl)}${loginMethodQuery}`)
    },
    [requestId, targetConfigId, isDeepLinkFlow, loginMethodParam]
  )

  return (
    <div>
      <AnimatedBackground />
      <div className={styles.main}>
        <div className={styles.left}>
          {children}
          {canChangeAccount ? (
            <div className={styles.changeAccount}>
              {t('request_views.container.use_another_profile')}{' '}
              <a href="/auth/login" onClick={onChangeAccount}>
                {t('request_views.container.return_to_login')}
              </a>
            </div>
          ) : null}
        </div>
        {/* This assumes that the user has a profile */}
        {targetConfig.showWearablePreview && account && !isMobile && (
          <div className={styles.right}>{<CustomWearablePreview profile={account} />}</div>
        )}
      </div>
    </div>
  )
}
