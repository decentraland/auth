import type { OAuthProvider } from '@magic-ext/oauth2'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { Env } from '@dcl/ui-env'
import { ConnectionResponse, WalletConnectV2Connector, connection, getConfiguration } from 'decentraland-connect'
import { config } from '../../../modules/config'
import { extractReferrerFromSearchParameters } from '../../../shared/locations'
import { ConnectionOptionType, SignInOptionsMode } from '../../Connection'
import { FeatureFlagsKeys, SignInPrimaryOptionVariant } from '../../FeatureFlagsProvider/FeatureFlagsProvider.types'
import type { FeatureFlagsVariants } from '../../FeatureFlagsProvider/FeatureFlagsProvider.types'

function fromConnectionOptionToProviderType(connectionType: ConnectionOptionType, isTesting?: boolean): ProviderType {
  switch (connectionType) {
    case ConnectionOptionType.DISCORD:
    case ConnectionOptionType.X:
    case ConnectionOptionType.GOOGLE:
    case ConnectionOptionType.APPLE:
      return isTesting ? ProviderType.MAGIC_TEST : ProviderType.MAGIC
    case ConnectionOptionType.WALLET_CONNECT:
    case ConnectionOptionType.METAMASK_MOBILE:
      return ProviderType.WALLET_CONNECT_V2
    case ConnectionOptionType.COINBASE:
    case ConnectionOptionType.WALLET_LINK:
      return ProviderType.WALLET_LINK
    case ConnectionOptionType.FORTMATIC:
      return ProviderType.FORTMATIC
    case ConnectionOptionType.METAMASK:
    case ConnectionOptionType.DAPPER:
    case ConnectionOptionType.SAMSUNG:
      return ProviderType.INJECTED
    case ConnectionOptionType.EMAIL:
      return ProviderType.THIRDWEB
    default:
      throw new Error('Invalid provider')
  }
}

async function connectToSocialProvider(
  connectionOption: ConnectionOptionType,
  isTesting?: boolean,
  redirectTo?: string,
  isMobileFlow?: boolean
): Promise<void> {
  const MAGIC_KEY = isTesting ? getConfiguration().magic_test.apiKey : getConfiguration().magic.apiKey
  const providerType = fromConnectionOptionToProviderType(connectionOption, isTesting)

  if (ProviderType.MAGIC === providerType || ProviderType.MAGIC_TEST === providerType) {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { Magic } = await import('magic-sdk')
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { OAuthExtension } = await import('@magic-ext/oauth2')
    const magic = new Magic(MAGIC_KEY, {
      extensions: [new OAuthExtension()]
    })
    // Clear existing session before starting new OAuth flow (mirrors MobileAuthPage fix)
    const isLoggedIn = await magic.user.isLoggedIn()
    if (isLoggedIn) {
      await magic.user.logout()
      await connection.disconnect()
    }

    // Clear BOTH stored emails unconditionally so a previous Thirdweb/OTP user's email can't leak
    // into this account's setup prefill/newsletter/attribution via getStoredEmail. A stale
    // dcl_thirdweb_user_email can be present even with no Magic session, so this must not be gated
    // on isLoggedIn. Matches the wallet-login and mobile-init cleanup.
    localStorage.removeItem('dcl_magic_user_email')
    localStorage.removeItem('dcl_thirdweb_user_email')

    const url = new URL(window.location.href)
    const search = new URLSearchParams(window.location.search)
    const referrer = extractReferrerFromSearchParameters(search)
    url.pathname = '/auth/callback'
    url.search = ''

    const oauthProvider = connectionOption === ConnectionOptionType.X ? 'twitter' : (connectionOption as OAuthProvider)

    await magic?.oauth2.loginWithRedirect({
      provider: oauthProvider,
      redirectURI: url.href,
      customData: JSON.stringify({
        redirectTo,
        referrer,
        isMobileFlow,
        ...(isMobileFlow && {
          mobileUserId: search.get('u') ?? undefined,
          mobileSessionId: search.get('s') ?? undefined,
          // Read back by MobileCallbackPage via getConnectionOptionFromState() so analytics know
          // which OAuth provider (Google/Apple/Discord/X) the mobile user picked.
          connectionOption
        })
      }),
      ...(isMobileFlow && { loginHint: '' }) // Force account picker on mobile
    })
  }
}

function requiresInjectedProvider(connectionOption: ConnectionOptionType): boolean {
  return fromConnectionOptionToProviderType(connectionOption) === ProviderType.INJECTED
}

// Coalesces concurrent connect attempts for the SAME provider (double-click, racing retry) behind a
// single in-flight promise, so a repeated click can't spawn a second overlapping connect for that
// provider. A different provider is allowed to supersede (a genuine "user switched wallet" action);
// cross-provider concurrency isn't serialized here and is instead prevented at the UI layer, where
// the wallet-selection modal is modal (the user can't pick another wallet while one is pending).
let inFlightConnect: { providerType: ProviderType; promise: Promise<ConnectionResponse> } | null = null

async function connectToProvider(connectionOption: ConnectionOptionType): Promise<ConnectionResponse> {
  const providerType = fromConnectionOptionToProviderType(connectionOption)

  if (providerType === ProviderType.INJECTED && !window.ethereum) {
    throw new Error('No wallet extension detected. Please install MetaMask or another Ethereum wallet.')
  }

  // Reuse an in-flight connect for the same provider instead of starting a second, overlapping one.
  if (inFlightConnect && inFlightConnect.providerType === providerType) {
    return inFlightConnect.promise
  }

  const promise = (async () => {
    if (providerType === ProviderType.WALLET_CONNECT_V2) {
      // Clear WalletConnect v1's leftover deep-link choice, which can pin the mobile wallet chooser.
      localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE')

      // Force a fresh pairing on every explicit WalletConnect click. decentraland-connect's
      // `activate()` reuses a restored session whenever it is still alive and, on that branch, never
      // opens the AppKit modal — so clicking WalletConnect would silently reconnect the previously
      // paired wallet and give a user who wants to sign in with a *different* wallet no way to
      // choose one. Clearing the session here is what guarantees `activate()` takes its
      // "not connected" branch and prompts.
      //
      // This is not redundant with the library's own stale-session handling: that only clears a
      // session it can prove is dead, whereas an explicit click must re-prompt even when the
      // session is perfectly alive. It also only runs on a user-initiated connect — automatic
      // restores go through `connection.tryPreviousConnection()` and never reach this function, so
      // the session reuse the handoff depends on is untouched.
      WalletConnectV2Connector.clearStorage()
    }

    const connectionData = await connection.connect(providerType)
    if (!connectionData.account || !connectionData.provider) {
      throw new Error('Could not get provider')
    }
    return connectionData
  })()

  inFlightConnect = { providerType, promise }
  try {
    return await promise
  } catch (error) {
    console.error('Error connecting to provider', error)
    throw error
  } finally {
    // Only clear if this call still owns the slot (a different-provider connect may have replaced it).
    if (inFlightConnect?.promise === promise) {
      inFlightConnect = null
    }
  }
}

function isSocialLogin(connectionType: ConnectionOptionType): boolean {
  const SOCIAL_LOGIN_TYPES = [ConnectionOptionType.APPLE, ConnectionOptionType.GOOGLE, ConnectionOptionType.X, ConnectionOptionType.DISCORD]
  return SOCIAL_LOGIN_TYPES.includes(connectionType)
}

function isEmailLogin(connectionType: ConnectionOptionType): boolean {
  return connectionType === ConnectionOptionType.EMAIL
}

// iPadOS 13+ Safari reports a desktop "Macintosh" UA by default, so the classic UA regexes miss
// iPads. Detect that case via touch support (a real Mac reports maxTouchPoints 0).
function isIpadOnDesktopUserAgent(userAgent: string): boolean {
  return /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1
}

function isMobile() {
  const userAgent = navigator.userAgent
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || isIpadOnDesktopUserAgent(userAgent)
}

function isIos() {
  const userAgent = navigator.userAgent
  return /iPhone|iPad|iPod/i.test(userAgent) || isIpadOnDesktopUserAgent(userAgent)
}

/**
 * Determines the sign-in options mode based on feature flag variants.
 * - FULL: Show all wallet options (default/legacy behavior when variant doesn't exist or is not enabled)
 * - ONE: Show email + one wallet option (MetaMask if available)
 * - TWO: Show email + two wallet options (Google + MetaMask if available)
 */
function getSignInOptionsMode(variants: Partial<FeatureFlagsVariants>): SignInOptionsMode {
  const variant = variants[FeatureFlagsKeys.SIGN_IN_PRIMARY_OPTION]

  // If variant doesn't exist, use full mode (legacy behavior)
  if (!variant) {
    return SignInOptionsMode.FULL
  }

  // If variant is TWO_OPTIONS, use two options mode
  if (variant.name === SignInPrimaryOptionVariant.TWO_OPTIONS) {
    return SignInOptionsMode.TWO
  }

  // Otherwise, use one option mode (ONE_OPTION or any other value)
  return SignInOptionsMode.ONE
}

/**
 * Resolves whether to use Magic Test mode.
 * Uses feature flag when available, falls back to environment check.
 * This ensures all components (AutoLoginRedirect, CallbackPage, LoginPage)
 * resolve to the same value regardless of when feature flags load.
 */
function isMagicTestMode(flagValue?: boolean): boolean {
  return flagValue ?? config.is(Env.DEVELOPMENT)
}

export {
  fromConnectionOptionToProviderType,
  connectToSocialProvider,
  connectToProvider,
  requiresInjectedProvider,
  isSocialLogin,
  isEmailLogin,
  isMobile,
  isIos,
  getSignInOptionsMode,
  isMagicTestMode
}
