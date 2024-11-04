import { useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { locations } from '../shared/locations'

export const useAfterLoginRedirection = () => {
  const location = useLocation()
  const search = new URLSearchParams(location.search)

  // Extract 'redirectTo' and 'targetConfigId' from current search parameters
  const redirectToSearchParam = search.get('redirectTo')
  const targetConfigId = search.get('targetConfigId')

  // Initialize redirectTo with a default value
  let redirectTo = locations.home()

  // Decode 'redirectTo' if it exists
  if (redirectToSearchParam) {
    try {
      redirectTo = decodeURIComponent(redirectToSearchParam)
    } catch (error) {
      console.error("Can't decode redirectTo parameter")
    }
  }

  let sanitizedRedirectTo = locations.home()

  try {
    let redirectToURL

    // Create a URL object from 'redirectTo'
    if (redirectTo.startsWith('/')) {
      redirectToURL = new URL(redirectTo, window.location.origin)
    } else {
      redirectToURL = new URL(redirectTo)
    }

    // Check if the hostname matches to prevent open redirects
    if (redirectToURL.hostname !== window.location.hostname) {
      redirectToURL = new URL('/auth/invalidRedirection', window.location.origin)
    }

    // Manipulate the search parameters of the redirect URL
    const redirectToURLSearchParams = new URLSearchParams(redirectToURL.search)

    // Include 'targetConfigId' if it exists
    if (targetConfigId) {
      redirectToURLSearchParams.set('targetConfigId', targetConfigId)
    }

    // Update the search parameters of the redirect URL
    redirectToURL.search = redirectToURLSearchParams.toString()

    // Set the sanitized redirect URL
    sanitizedRedirectTo = redirectToURL.href
  } catch (error) {
    console.error("Can't parse redirectTo URL")
    // Optionally, redirect to an error page or the home page
    sanitizedRedirectTo = locations.home()
  }

  // Create the redirect function
  const redirect = useCallback(() => {
    window.location.href = sanitizedRedirectTo
  }, [sanitizedRedirectTo])

  return { url: sanitizedRedirectTo, redirect }
}
