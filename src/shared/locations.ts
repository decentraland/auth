import { EthAddress } from '@dcl/schemas'

export const locations = {
  home: () => '/',
  login: (redirectTo?: string) => `/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`,
  setup: (redirectTo?: string, referrer?: string | null) =>
    `/setup${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}${
      referrer ? `${redirectTo ? '&' : '?'}referrer=${encodeURIComponent(referrer)}` : ''
    }`
}

export const extractRedirectToFromSearchParameters = (searchParams: URLSearchParams): string => {
  // Extract 'redirectTo' from current search parameters
  let redirectToSearchParam = searchParams.get('redirectTo')
  try {
    const state = searchParams.get('state')
    // Decode the state parameter to get the original 'redirectTo'
    if (state) {
      const stateRedirectToParam = atob(state)
      const parsedRedirectTo = JSON.parse(JSON.parse(stateRedirectToParam).customData).redirectTo
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

  return redirectTo
}

export const extractReferrerFromSearchParameters = (searchParams: URLSearchParams): string | null => {
  let referrerSearchParam = searchParams.get('referrer')
  try {
    const state = searchParams.get('state')
    if (state) {
      const stateReferrerParam = atob(state)
      const parsedReferrer = JSON.parse(JSON.parse(stateReferrerParam).customData).referrer
      if (parsedReferrer) {
        referrerSearchParam = parsedReferrer ?? null
      }
    }
  } catch (_) {
    console.error("Can't decode state parameter")
  }

  if (referrerSearchParam && !EthAddress.validate(referrerSearchParam)) {
    return null
  }

  return referrerSearchParam
}
