import { useLocation } from 'react-router-dom'

const isDecentralandDomain = /decentraland\.(org|zone|today)$/

export const useAfterLoginRedirection = () => {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const redirectToSearchParam = search.get('redirectTo')
  if (redirectToSearchParam === null) return undefined
  try {
    const redirectToURL = new URL(redirectToSearchParam)
    if (isDecentralandDomain.test(redirectToURL.hostname)) {
      return redirectToURL.href
    }
  } catch (error) {
    console.error("Can't parse redirectTo URL")
    return undefined
  }
}
