import { useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { validateUrlInstance } from '@dcl/schemas'
import { extractRedirectToFromSearchParameters, locations } from '../shared/locations'
import { authDebug } from '../shared/utils/authDebug'
import { AuthDebugDecision, AuthDebugEvent, AuthDebugStep } from '../shared/utils/authDebug.type'

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

    if (!validateUrlInstance(redirectToURL, { allowLocalhost: true }) || redirectToURL.hostname !== window.location.hostname) {
      redirectToURL = new URL('/auth/invalidRedirection', window.location.origin)
    }

    // Add the targetConfigId to the redirect URL if it exists
    const targetConfigId = search.get('targetConfigId')
    if (targetConfigId && !redirectToURL.searchParams.has('targetConfigId')) {
      redirectToURL.searchParams.append('targetConfigId', targetConfigId)
    }

    // Add the flow to the redirect URL if it exists (for deep link flow)
    const flow = search.get('flow')
    if (flow && !redirectToURL.searchParams.has('flow')) {
      redirectToURL.searchParams.append('flow', flow)
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
    (params?: Record<string, string>, overrideUrl?: string) => {
      let finalUrl = sanitizedRedirectTo

      // Override sanitizedRedirectTo with the provided URL if available
      if (overrideUrl) {
        try {
          const overrideUrlObj = overrideUrl.startsWith('/') ? new URL(overrideUrl, window.location.origin) : new URL(overrideUrl)
          finalUrl = overrideUrlObj.href
        } catch (error) {
          finalUrl = sanitizedRedirectTo
          console.error('Error parsing override URL, using default redirect:', error)
          // Keep using sanitizedRedirectTo if parsing fails
        }
      }

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
        const hasOverrideUrl = !!overrideUrl
        const isUrlValid = validateUrlInstance(finalUrlObj, { allowLocalhost: true })
        const isHostnameValid = hasOverrideUrl || finalUrlObj.hostname === window.location.hostname

        if (!isUrlValid || !isHostnameValid) {
          authDebug({
            event: AuthDebugEvent.REDIRECT_FINAL_URL_INVALID,
            step: AuthDebugStep.AFTER_LOGIN_REDIRECTION,
            decision: AuthDebugDecision.HOME_FALLBACK,
            details: {
              finalUrlHostname: finalUrlObj.hostname,
              isUrlValid,
              isHostnameValid
            }
          })
          console.error('Invalid final URL, redirecting to home')
          window.location.href = locations.home()
          return
        }

        window.location.href = finalUrl
      } catch (error) {
        authDebug({
          event: AuthDebugEvent.REDIRECT_FINAL_URL_INVALID,
          step: AuthDebugStep.AFTER_LOGIN_REDIRECTION,
          decision: AuthDebugDecision.HOME_FALLBACK,
          details: {
            message: error instanceof Error ? error.message : String(error)
          }
        })
        console.error('Final URL validation failed:', error)
        window.location.href = locations.home()
      }
    },
    [sanitizedRedirectTo]
  )

  return { url: sanitizedRedirectTo, redirect }
}
