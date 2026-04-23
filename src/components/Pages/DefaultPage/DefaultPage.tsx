import { useEffect } from 'react'
import { useTranslation } from '@dcl/hooks'
import { CircularProgress } from 'decentraland-ui2'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { getCurrentConnectionData } from '../../../shared/connection/connection'
import { locations } from '../../../shared/locations'
import styles from './DefaultPage.module.css'

export const DefaultPage = () => {
  const navigate = useNavigateWithSearchParams()
  const { t } = useTranslation()

  useEffect(() => {
    getCurrentConnectionData().then(connectionData => {
      if (connectionData?.identity) {
        window.location.href = locations.home()
      } else {
        navigate(locations.login())
      }
    })
  }, [navigate])

  return (
    <div className={styles.main} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <p style={{ color: 'white', fontSize: '16px', margin: 0 }}>{t('connection_layout.loading_magic')}</p>
      <CircularProgress size={60} />
    </div>
  )
}
