import { useLocation } from 'react-router-dom'

const isDecentralandDomain = /decentraland\.(org|zone|today)$/

// TODO: useAfterLoginRedirection

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
      const isLowerEnv = /^decentraland.(zone|today)$/.test(window.location.host)
      if (!isDecentralandDomain.test(redirectToURL.hostname) && !isLowerEnv) {
        return undefined
      }
    }

    return redirectToURL.href
  } catch (error) {
    console.error("Can't parse redirectTo URL")
    return undefined
  }
}
