import { EthAddress } from '@dcl/schemas'
import { extractFromStateParameter } from './utils/stateParameter'

/**
 * Login method types for direct login via URL parameters
 */
type LoginMethod = 'email' | 'metamask' | 'google' | 'discord' | 'apple' | 'x' | 'fortmatic' | 'coinbase' | 'walletconnect'

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

const locations = {
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

const extractRedirectToFromSearchParameters = (searchParams: URLSearchParams): string => {
  // Extract 'redirectTo' from current search parameters
  let redirectToSearchParam = searchParams.get('redirectTo')

  // Try to extract from OAuth state parameter
  const stateRedirectTo = extractFromStateParameter<string>(searchParams, 'redirectTo')
  if (stateRedirectTo) {
    redirectToSearchParam = stateRedirectTo
  }

  // Initialize redirectTo with a default value
  let redirectTo = locations.home()

  // Decode 'redirectTo' if it exists
  if (redirectToSearchParam) {
    try {
      redirectTo = decodeURIComponent(redirectToSearchParam)
    } catch {
      console.error("Can't decode redirectTo parameter")
    }
  }

  return redirectTo
}

const extractReferrerFromSearchParameters = (searchParams: URLSearchParams): string | null => {
  let referrerSearchParam = searchParams.get('referrer')

  // Try to extract from OAuth state parameter
  const stateReferrer = extractFromStateParameter<string>(searchParams, 'referrer')
  if (stateReferrer) {
    referrerSearchParam = stateReferrer
  }

  if (referrerSearchParam && !EthAddress.validate(referrerSearchParam)) {
    return null
  }

  return referrerSearchParam
}

export type { LoginMethod }
export { locations, extractRedirectToFromSearchParameters, extractReferrerFromSearchParameters }
