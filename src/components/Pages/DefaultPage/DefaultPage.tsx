import { useEffect } from 'react'
import { CircularProgress } from 'decentraland-ui2'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { getCurrentConnectionData } from '../../../shared/connection/connection'
import { locations } from '../../../shared/locations'
import styles from './DefaultPage.module.css'

export const DefaultPage = () => {
  const navigate = useNavigateWithSearchParams()

  useEffect(() => {
    getCurrentConnectionData().then(connectionData => {
      if (connectionData) {
        window.location.href = locations.home()
      } else {
        navigate(locations.login())
      }
    })
  }, [getCurrentConnectionData, navigate])

  return (
    <div className={styles.main}>
      <CircularProgress size={60} />
    </div>
  )
}
