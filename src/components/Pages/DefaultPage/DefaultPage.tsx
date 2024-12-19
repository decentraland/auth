import { useEffect } from 'react'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { getCurrentConnectionData } from '../../../shared/connection'
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
      <Loader active size="huge" />
    </div>
  )
}
