import { EthAddress } from '@dcl/schemas'

/**
 * Decodes the base64 OAuth `state` query param and returns its parsed `customData` object, or null
 * if the state is missing/malformed. The social-login redirect encodes state as
 * `btoa(JSON.stringify({ customData: JSON.stringify({ redirectTo, referrer, ... }) }))`, so
 * recovering a field requires a base64 decode plus two JSON parses. Centralized here so the
 * redirectTo/referrer extractors and the redirection hook decode it the same way.
 */
const parseStateCustomData = (state: string | null | undefined): Record<string, unknown> | null => {
  if (!state) {
    return null
  }
  try {
    const decoded = JSON.parse(atob(state))
    const customData = JSON.parse(decoded.customData)
    return typeof customData === 'object' && customData !== null ? customData : null
  } catch {
    return null
  }
}

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
  // The OAuth round-trip carries the original redirectTo inside the `state` param's customData.
  const parsedRedirectTo = parseStateCustomData(searchParams.get('state'))?.redirectTo
  if (typeof parsedRedirectTo === 'string' && parsedRedirectTo) {
    redirectToSearchParam = parsedRedirectTo
  }

  // Initialize redirectTo with a default value
  let redirectTo = locations.home()

  // Use the value as-is: URLSearchParams.get already percent-decoded it once, and the value pulled
  // from the OAuth state's customData is a raw (already-decoded) string too. A second
  // decodeURIComponent here would double-decode — corrupting nested percent-encoded values in the
  // target (e.g. realm=foo%2Fbar → foo/bar) and throwing on a literal '%' (e.g. "50% off"),
  // silently falling back to home. Downstream hostname validation still guards the final URL.
  if (redirectToSearchParam) {
    redirectTo = redirectToSearchParam
  }

  return redirectTo
}

const extractReferrerFromSearchParameters = (searchParams: URLSearchParams): string | null => {
  let referrerSearchParam = searchParams.get('referrer')
  const parsedReferrer = parseStateCustomData(searchParams.get('state'))?.referrer
  if (typeof parsedReferrer === 'string' && parsedReferrer) {
    referrerSearchParam = parsedReferrer
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

// The `flow` query param opts the request page into the deep-link login handoff: instead of
// fulfilling a backing auth-server request, the user logs in and the signed identity is handed to
// the client through the `open?signin=<identityId>` deep link, mirroring the standalone mobile
// flow. Enabled by `?flow=deeplink`, compared case-insensitively.
const FLOW_PARAM = 'flow'
const DEEP_LINK_FLOW_VALUE = 'deeplink'

const isDeepLinkFlowEnabled = (searchParams: URLSearchParams): boolean =>
  (searchParams.get(FLOW_PARAM) ?? '').toLowerCase() === DEEP_LINK_FLOW_VALUE

// A canonical RFC 4122 version-4 UUID (case-insensitive). The deep-link handoff requires its
// request id to be one: it is the client-generated id that correlates the login with the instance
// that requested it, and it is forwarded to the client as the deep link's `authRequestId`.
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isValidUuidV4 = (value: string): boolean => UUID_V4_REGEX.test(value)

// Builds the request-page URL preserving the flags that must survive a login round-trip
// (they ride inside `redirectTo`). Shared by RequestPage and the change-account link so
// the preserved params stay in sync across call sites.
const buildRequestPageUrl = (
  requestId: string,
  targetConfigId: string,
  options: { isDeepLinkFlow?: boolean; isBridgeOnly?: boolean; authRequestId?: string | null } = {}
): string => {
  const flowParam = options.isDeepLinkFlow ? `&${FLOW_PARAM}=${DEEP_LINK_FLOW_VALUE}` : ''
  const bridgeOnlyParam = options.isBridgeOnly ? `&${BRIDGE_ONLY_PARAM}=true` : ''
  const authRequestIdParam = options.authRequestId ? `&${AUTH_REQUEST_ID_PARAM}=${encodeURIComponent(options.authRequestId)}` : ''
  return `/auth/requests/${requestId}?targetConfigId=${targetConfigId}${flowParam}${bridgeOnlyParam}${authRequestIdParam}`
}

export type { LoginMethod }
export {
  locations,
  parseStateCustomData,
  extractRedirectToFromSearchParameters,
  extractReferrerFromSearchParameters,
  isBridgeOnlyEnabled,
  BRIDGE_ONLY_PARAM,
  getAuthRequestId,
  AUTH_REQUEST_ID_PARAM,
  isDeepLinkFlowEnabled,
  isValidUuidV4,
  buildRequestPageUrl
}
