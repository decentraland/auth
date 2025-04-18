export const locations = {
  home: () => '/',
  login: (redirectTo?: string) => `/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`,
  setup: (redirectTo?: string) => `/setup${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`
}

export const extractRedirectToFromSearchParameters = (searchParams: URLSearchParams): string => {
  // Extract 'redirectTo' from current search parameters
  let redirectToSearchParam = searchParams.get('redirectTo')
  try {
    const state = searchParams.get('state')
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

  return redirectTo
}
