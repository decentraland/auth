import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { connection } from 'decentraland-connect'

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
        navigate('/user')
      } else {
        navigate({ pathname: '/login', search: location.search })
      }
    })
  }, [checkIfConnected, navigate])

  return <Loader active size="huge" />
}
