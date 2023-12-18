import { useLocation } from 'react-router-dom'

export const useAfterLoginRedirection = () => {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const redirectToSearchParam = search.get('redirectTo')

  if (redirectToSearchParam === null) {
    return undefined
  }

  try {
    let redirectToURL: URL

    if (redirectToSearchParam.startsWith('/')) {
      redirectToURL = new URL(redirectToSearchParam, window.location.origin)
    } else {
      redirectToURL = new URL(redirectToSearchParam)
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
