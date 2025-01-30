import { useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { locations } from '../shared/locations'

export const useAfterLoginRedirection = () => {
  const location = useLocation()
  const search = new URLSearchParams(location.search)

  // Extract 'redirectTo' from current search parameters
  let redirectToSearchParam = search.get('redirectTo')
  try {
    const state = search.get('state')
    // Decode the state parameter to get the original 'redirectTo'
    if (state) {
      const stateRedirectToParam = atob(state)
      const parsedRedirectTo = JSON.parse(stateRedirectToParam).customData
      if (parsedRedirectTo) {
        redirectToSearchParam = parsedRedirectTo ?? null
      }
    }
  } catch (_) {
    console.error("Can't decode state parameter")
  }

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
