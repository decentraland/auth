import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { getCurrentConnectionData } from '../../../shared/connection'
import { locations } from '../../../shared/locations'
import styles from './DefaultPage.module.css'

export const DefaultPage = () => {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    getCurrentConnectionData().then(connectionData => {
      if (connectionData) {
        window.location.href = locations.home()
      } else {
        navigate({ pathname: locations.login(), search: location.search })
      }
    })
  }, [getCurrentConnectionData, navigate])

  return (
    <div className={styles.main}>
      <Loader active size="huge" />
    </div>
  )
}
