import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export const useNavigateWithSearchParams = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const enhancedNavigation = useCallback(
    (path: string) => {
      if (!path) {
        throw new Error('Path cannot be empty')
      }

      let urlFromPath: URL
      try {
        urlFromPath = new URL(path, window.location.origin)

        // Additional validation: Check if pathname is valid
        if (!urlFromPath.pathname) {
          throw new Error('Invalid path provided')
        }
      } catch {
        throw new Error('Invalid path provided')
      }

      const pathname = urlFromPath.pathname

      // Extract search parameters from the provided path
      const searchParams = new URLSearchParams(urlFromPath.search)

      // Get 'targetConfigId' from the current location's search parameters
      const currentSearchParams = new URLSearchParams(location.search)
      const targetConfigId = currentSearchParams.get('targetConfigId')

      // If 'targetConfigId' exists, add it to the search parameters
      if (targetConfigId) {
        searchParams.set('targetConfigId', targetConfigId)
      }

      // Convert search parameters back to a string
      const searchString = searchParams.toString()

      // Navigate to the new path with the updated search parameters
      navigate({
        pathname,
        search: searchString ? `?${searchString}` : undefined
      })
    },
    [navigate, location]
  )

  return enhancedNavigation
}
