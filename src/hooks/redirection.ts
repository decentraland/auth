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
  const redirect = useCallback(
    (params?: Record<string, string>) => {
      let finalUrl = sanitizedRedirectTo

      if (params) {
        try {
          const url = new URL(finalUrl)

          // Add parameters to the URL
          Object.entries(params).forEach(([key, value]) => {
            if (key && value && typeof key === 'string' && typeof value === 'string') {
              url.searchParams.set(key, value)
            }
          })

          finalUrl = url.href
        } catch (error) {
          console.error('Error processing redirect parameters:', error)
          // Fallback to original URL without parameters if there's an error
          finalUrl = sanitizedRedirectTo
        }
      }

      // Final security check - ensure the URL is still safe
      try {
        const finalUrlObj = new URL(finalUrl)

        // Validate protocol (only http and https allowed)
        if (finalUrlObj.protocol !== 'http:' && finalUrlObj.protocol !== 'https:') {
          console.error('Invalid protocol in final URL, redirecting to home')
          window.location.href = locations.home()
          return
        }

        window.location.href = finalUrl
      } catch (error) {
        console.error('Final URL validation failed:', error)
        // Ultimate fallback - redirect to home
        window.location.href = locations.home()
      }
    },
    [sanitizedRedirectTo]
  )

  return { url: sanitizedRedirectTo, redirect }
}
