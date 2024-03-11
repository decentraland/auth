import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

export const useNavigateWithSearchParams = () => {
  const navigate = useNavigate()
  const enhancedNavigation = useCallback(
    (path: string) => {
      const urlFromPath = new URL(path, window.location.origin)
      const search = urlFromPath.search
      if (search) {
        navigate({ pathname: path, search: search })
      } else {
        navigate(path)
      }
    },
    [navigate]
  )

  return enhancedNavigation
}
