import { useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { locations } from '../shared/locations'

export const useAfterLoginRedirection = () => {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const redirectToSearchParam = search.get('redirectTo')
  const redirectTo = redirectToSearchParam ? decodeURIComponent(redirectToSearchParam) : locations.home()

  let sanitizedRedirectTo: string = locations.home()

  try {
    let redirectToURL: URL

    if (redirectTo.startsWith('/')) {
      redirectToURL = new URL(redirectTo, window.location.origin)
    } else {
      redirectToURL = new URL(redirectTo)
    }

    if (redirectToURL.hostname !== window.location.hostname) {
      redirectToURL = new URL('/auth/invalidRedirection', window.location.origin)
    }

    sanitizedRedirectTo = redirectToURL.href
  } catch (error) {
    console.error("Can't parse redirectTo URL")
  }

  const redirect = useCallback(() => {
    window.location.href = sanitizedRedirectTo
  }, [sanitizedRedirectTo])

  return { url: sanitizedRedirectTo, redirect }
}
