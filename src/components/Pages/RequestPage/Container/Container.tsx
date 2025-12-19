import { ReactNode, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMobileMediaQuery } from 'decentraland-ui/dist/components/Media/Media'
import { connection } from 'decentraland-connect'
import { useNavigateWithSearchParams } from '../../../../hooks/navigation'
import { useTargetConfig } from '../../../../hooks/targetConfig'
import { useCurrentConnectionData } from '../../../../shared/connection/hooks'
import { locations } from '../../../../shared/locations'
import { CustomWearablePreview } from '../../../CustomWearablePreview'
import styles from './Container.module.css'

export const Container = (props: { children: ReactNode; requestId?: string; canChangeAccount?: boolean; hasProfile?: boolean }) => {
  const { children, requestId, canChangeAccount } = props

  const [searchParams] = useSearchParams()
  const [targetConfig, targetConfigId] = useTargetConfig()
  const navigate = useNavigateWithSearchParams()
  const isMobile = useMobileMediaQuery()
  const { account } = useCurrentConnectionData()
  const isDeepLinkFlow = searchParams.get('flow') === 'deeplink'

  const onChangeAccount = useCallback(
    async evt => {
      evt.preventDefault()
      await connection.disconnect()
      const flowParam = isDeepLinkFlow ? '&flow=deeplink' : ''
      navigate(locations.login(`/auth/requests/${requestId ?? ''}?targetConfigId=${targetConfigId}${flowParam}`))
    },
    [requestId, targetConfigId, isDeepLinkFlow]
  )

  return (
    <div>
      <div className={styles.background} />
      <div className={styles.main}>
        <div className={styles.left}>
          {children}
          {canChangeAccount ? (
            <div className={styles.changeAccount}>
              Use another profile?{' '}
              <a href="/auth/login" onClick={onChangeAccount}>
                Return to log in
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
