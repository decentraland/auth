import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { connection } from 'decentraland-connect'
import styles from './DefaultPage.module.css'

export const DefaultPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const checkIfConnected = useCallback(async () => {
    try {
      const connectionDetails = await connection.tryPreviousConnection()
      return Boolean(connectionDetails.account && connectionDetails.provider)
    } catch (error) {
      return false
    }
  }, [])

  useEffect(() => {
    checkIfConnected().then(isConnected => {
      if (isConnected) {
        window.location.href = '/'
      } else {
        navigate({ pathname: '/login', search: location.search })
      }
    })
  }, [checkIfConnected, navigate])

  return (
    <div className={styles.main}>
      <Loader active size="huge" />
    </div>
  )
}
