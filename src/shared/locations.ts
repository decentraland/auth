import { EthAddress } from '@dcl/schemas'

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
  /**
   * Additional query parameters to append to the login URL.
   * Useful for preserving existing search params (e.g. walletError).
   */
  queryParams?: URLSearchParams | Record<string, string>
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
    const { redirectTo, referrer, loginMethod, queryParams } = options
    const base = buildQueryString({
      redirectTo,
      referrer: referrer ?? undefined,
      loginMethod
    })
    if (queryParams) {
      const extra = queryParams instanceof URLSearchParams ? queryParams : new URLSearchParams(queryParams)
      const baseParams = new URLSearchParams(base.replace(/^\?/, ''))
      extra.forEach((value, key) => baseParams.set(key, value))
      const merged = baseParams.toString()
      return `/login${merged ? `?${merged}` : ''}`
    }
    return `/login${base}`
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
  quickSetup: (redirectTo?: string, referrer?: string | null) =>
    `/quick-setup${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}${
      referrer ? `${redirectTo ? '&' : '?'}referrer=${encodeURIComponent(referrer)}` : ''
    }`,
  mobile: (provider?: string) => `/mobile${provider ? `?provider=${encodeURIComponent(provider)}` : ''}`,
  mobileCallback: () => '/mobile/callback'
}

const extractRedirectToFromSearchParameters = (searchParams: URLSearchParams): string => {
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
  } catch {
    console.error("Can't decode state parameter")
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
  try {
    const state = searchParams.get('state')
    if (state) {
      const stateReferrerParam = atob(state)
      const parsedReferrer = JSON.parse(JSON.parse(stateReferrerParam).customData).referrer
      if (parsedReferrer) {
        referrerSearchParam = parsedReferrer ?? null
      }
    }
  } catch {
    console.error("Can't decode state parameter")
  }

  if (referrerSearchParam && !EthAddress.validate(referrerSearchParam)) {
    return null
  }

  return referrerSearchParam
}

// The `bridgeOnly` query param is a boolean flag the auth site can be opened with.
// It's preserved across logins/callbacks by riding inside `redirectTo`, and when enabled
// it's forwarded onto the client deep link. A bare flag (`?bridgeOnly`) or an explicit
// `?bridgeOnly=true` (case-insensitive) enable it; an explicit non-true value
// (e.g. `?bridgeOnly=false`) or the param being absent leave it disabled.
const BRIDGE_ONLY_PARAM = 'bridgeOnly'

const isBridgeOnlyEnabled = (searchParams: URLSearchParams): boolean => {
  if (!searchParams.has(BRIDGE_ONLY_PARAM)) {
    return false
  }
  const value = (searchParams.get(BRIDGE_ONLY_PARAM) ?? '').toLowerCase()
  return value === '' || value === 'true'
}

// The `authRequestId` query param is an opaque value the auth site can be opened with.
// Like `bridgeOnly`, it rides inside `redirectTo` to survive logins/callbacks and is
// forwarded verbatim onto the client deep link. Returns the raw value, or null when absent.
const AUTH_REQUEST_ID_PARAM = 'authRequestId'

const getAuthRequestId = (searchParams: URLSearchParams): string | null => searchParams.get(AUTH_REQUEST_ID_PARAM)

// Pseudo request id for `/auth/requests/client-login`. It has no backing auth-server
// request: the user just logs in and the signed identity is handed to the client through
// the `open?signin=<identityId>` deep link, mirroring the standalone mobile flow.
const CLIENT_LOGIN_REQUEST_ID = 'client-login'

// Builds the request-page URL preserving the flags that must survive a login round-trip
// (they ride inside `redirectTo`). Shared by RequestPage and the change-account link so
// the preserved params stay in sync across call sites.
const buildRequestPageUrl = (
  requestId: string,
  targetConfigId: string,
  options: { isDeepLinkFlow?: boolean; isBridgeOnly?: boolean; authRequestId?: string | null } = {}
): string => {
  const flowParam = options.isDeepLinkFlow ? '&flow=deeplink' : ''
  const bridgeOnlyParam = options.isBridgeOnly ? '&bridgeOnly=true' : ''
  const authRequestIdParam = options.authRequestId ? `&${AUTH_REQUEST_ID_PARAM}=${encodeURIComponent(options.authRequestId)}` : ''
  return `/auth/requests/${requestId}?targetConfigId=${targetConfigId}${flowParam}${bridgeOnlyParam}${authRequestIdParam}`
}

export type { LoginMethod }
export {
  locations,
  extractRedirectToFromSearchParameters,
  extractReferrerFromSearchParameters,
  isBridgeOnlyEnabled,
  BRIDGE_ONLY_PARAM,
  getAuthRequestId,
  AUTH_REQUEST_ID_PARAM,
  CLIENT_LOGIN_REQUEST_ID,
  buildRequestPageUrl
}
