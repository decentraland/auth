import { ReactNode, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '@dcl/hooks'
import { connection } from 'decentraland-connect'
import { useMobileMediaQuery } from 'decentraland-ui2'
import { useNavigateWithSearchParams } from '../../../../hooks/navigation'
import { useTargetConfig } from '../../../../hooks/targetConfig'
import { useCurrentConnectionData } from '../../../../shared/connection'
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

  const onChangeAccount = useCallback(
    async (evt: React.MouseEvent<HTMLAnchorElement>) => {
      evt.preventDefault()
      await connection.disconnect()
      const flowParam = isDeepLinkFlow ? '&flow=deeplink' : ''
      // Don't preserve loginMethod — the user explicitly wants to choose a different method
      const redirectToUrl = `/auth/requests/${requestId ?? ''}?targetConfigId=${targetConfigId}${flowParam}`
      navigate(`/login?redirectTo=${encodeURIComponent(redirectToUrl)}`)
    },
    [requestId, targetConfigId, isDeepLinkFlow]
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
        {targetConfig.showWearablePreview && account && !isMobile && (
          <div className={styles.right}>{<CustomWearablePreview profile={account} />}</div>
        )}
      </div>
    </div>
  )
}
