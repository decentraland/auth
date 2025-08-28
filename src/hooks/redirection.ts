import { useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { extractRedirectToFromSearchParameters, locations } from '../shared/locations'

export const useAfterLoginRedirection = () => {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const redirectTo = extractRedirectToFromSearchParameters(search)
  let sanitizedRedirectTo = locations.home()

  try {
    let redirectToURL

    // Create a URL object from 'redirectTo'
    if (redirectTo.startsWith('/')) {
      redirectToURL = new URL(redirectTo, window.location.origin)
    } else {
      redirectToURL = new URL(redirectTo)
    }

    // Check if the protocol is safe to prevent XSS attacks
    if (redirectToURL.protocol !== 'http:' && redirectToURL.protocol !== 'https:') {
      redirectToURL = new URL('/auth/invalidRedirection', window.location.origin)
    }
    // Check if the hostname matches to prevent open redirects
    if (redirectToURL.hostname !== window.location.hostname) {
      redirectToURL = new URL('/auth/invalidRedirection', window.location.origin)
    }

    // Add the targetConfigId to the redirect URL if it exists
    const targetConfigId = search.get('targetConfigId')
    if (targetConfigId && !redirectToURL.searchParams.has('targetConfigId')) {
      redirectToURL.searchParams.append('targetConfigId', targetConfigId)
    }

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
