import { useLocation } from 'react-router-dom'

export const useAfterLoginRedirection = () => {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const redirectToSearchParam = search.get('redirectTo')
  const redirectTo = redirectToSearchParam ? decodeURIComponent(redirectToSearchParam) : null

  if (redirectTo === null) {
    return undefined
  }

  try {
    let redirectToURL: URL

    if (redirectTo.startsWith('/')) {
      redirectToURL = new URL(redirectTo, window.location.origin)
    } else {
      redirectToURL = new URL(redirectTo)
    }

    if (redirectToURL.hostname !== window.location.hostname) {
      return undefined
    }

    return redirectToURL.href
  } catch (error) {
    console.error("Can't parse redirectTo URL")
    return undefined
  }
}
