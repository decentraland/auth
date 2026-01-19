import { EthAddress } from '@dcl/schemas'

/**
 * Login method types for direct login via URL parameters
 */
export type LoginMethod = 'email' | 'metamask' | 'google' | 'discord' | 'apple' | 'x' | 'fortmatic' | 'coinbase' | 'walletconnect'

/**
 * Options for the login location
 */
interface LoginOptions {
  redirectTo?: string
  referrer?: string | null
  /**
   * Login method: 'email' for thirdweb email OTP
   */
  loginMethod?: LoginMethod
}

const buildQueryString = (params: Record<string, string | undefined | null>): string => {
  const entries = Object.entries(params).filter(([, value]) => value != null && value !== '')
  if (entries.length === 0) return ''

  const queryString = entries.map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`).join('&')

  return `?${queryString}`
}

export const locations = {
  home: () => '/',

  /**
   * Generate login URL with optional auto-login parameters
   *
   * Examples:
   * - locations.login() → /login
   * - locations.login({ loginMethod: 'email' }) → /login?loginMethod=email (auto-triggers email OTP)
   * - locations.login({ redirectTo: '/play', loginMethod: 'email' }) → /login?redirectTo=%2Fplay&loginMethod=email
   */
  login: (options?: LoginOptions | string, legacyReferrer?: string | null) => {
    // Support legacy signature: login(redirectTo?: string, referrer?: string | null)
    if (typeof options === 'string' || options === undefined) {
      const redirectTo = options
      const referrer = legacyReferrer
      return `/login${buildQueryString({ redirectTo, referrer: referrer ?? undefined })}`
    }

    // New signature: login(options: LoginOptions)
    const { redirectTo, referrer, loginMethod } = options
    return `/login${buildQueryString({
      redirectTo,
      referrer: referrer ?? undefined,
      loginMethod
    })}`
  },

  /**
   * Generate direct email OTP login URL
   * Shorthand for login({ loginMethod: 'email', ...options })
   */
  loginWithEmail: (redirectTo?: string, referrer?: string | null) =>
    `/login${buildQueryString({
      redirectTo,
      referrer: referrer ?? undefined,
      loginMethod: 'email'
    })}`,

  setup: (redirectTo?: string, referrer?: string | null) =>
    `/setup${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}${
      referrer ? `${redirectTo ? '&' : '?'}referrer=${encodeURIComponent(referrer)}` : ''
    }`,
  avatarSetup: (redirectTo?: string, referrer?: string | null) =>
    `/avatar-setup${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}${
      referrer ? `${redirectTo ? '&' : '?'}referrer=${encodeURIComponent(referrer)}` : ''
    }`,
  mobile: (provider?: string) => `/mobile${provider ? `?provider=${encodeURIComponent(provider)}` : ''}`,
  mobileCallback: () => '/mobile/callback'
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
