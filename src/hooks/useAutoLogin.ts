import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ConnectionOptionType } from '../components/Connection'

/**
 * Login method types that can be passed via URL parameters
 */
export type LoginMethod = 'email' | 'metamask' | 'google' | 'discord' | 'apple' | 'x' | 'fortmatic' | 'coinbase' | 'walletconnect'

const VALID_LOGIN_METHODS: LoginMethod[] = [
  'email',
  'metamask',
  'google',
  'discord',
  'apple',
  'x',
  'fortmatic',
  'coinbase',
  'walletconnect'
]

interface UseAutoLoginOptions {
  /**
   * Whether the component is ready to handle auto-login
   * (e.g., feature flags are initialized)
   */
  isReady: boolean
  /**
   * Callback to trigger connection with a specific option
   */
  onConnect: (connectionType: ConnectionOptionType) => void
}

interface UseAutoLoginResult {
  /**
   * The login method from URL params (if any)
   */
  loginMethod: LoginMethod | null
  /**
   * Whether auto-login was triggered
   */
  autoLoginTriggered: boolean
  /**
   * The resolved connection option type based on URL params
   */
  resolvedConnectionOption: ConnectionOptionType | null
}

/**
 * Maps URL loginMethod parameter to ConnectionOptionType
 */
function mapLoginMethodToConnectionOption(method: LoginMethod): ConnectionOptionType {
  switch (method) {
    case 'email':
      return ConnectionOptionType.EMAIL
    case 'metamask':
      return ConnectionOptionType.METAMASK
    case 'google':
      return ConnectionOptionType.GOOGLE
    case 'discord':
      return ConnectionOptionType.DISCORD
    case 'apple':
      return ConnectionOptionType.APPLE
    case 'x':
      return ConnectionOptionType.X
    case 'fortmatic':
      return ConnectionOptionType.FORTMATIC
    case 'coinbase':
      return ConnectionOptionType.COINBASE
    case 'walletconnect':
      return ConnectionOptionType.WALLET_CONNECT
  }
}

/**
 * Hook to handle automatic login based on URL parameters.
 *
 * URL Parameters:
 * - loginMethod: The login method to auto-trigger
 *
 * Supported login methods:
 * - email: Thirdweb email OTP flow
 * - metamask: MetaMask wallet
 * - google: Google OAuth via Magic
 * - discord: Discord OAuth via Magic
 * - apple: Apple OAuth via Magic
 * - x: Twitter/X OAuth via Magic
 * - fortmatic: Fortmatic wallet
 * - coinbase: Coinbase wallet
 * - walletconnect: WalletConnect
 *
 * Examples:
 * - /auth/login?loginMethod=email → Opens email OTP modal
 * - /auth/login?loginMethod=metamask → Opens MetaMask connection
 * - /auth/login?loginMethod=google&redirectTo=/play → Opens Google OAuth
 */
export const useAutoLogin = ({ isReady, onConnect }: UseAutoLoginOptions): UseAutoLoginResult => {
  const [searchParams] = useSearchParams()
  const autoLoginTriggeredRef = useRef(false)

  // Extract and validate URL parameters
  const loginMethodParam = searchParams.get('loginMethod')?.toLowerCase()
  const loginMethod = VALID_LOGIN_METHODS.includes(loginMethodParam as LoginMethod) ? (loginMethodParam as LoginMethod) : null

  // Resolve the connection option based on loginMethod
  const resolveConnectionOption = useCallback((): ConnectionOptionType | null => {
    if (!loginMethod) return null
    return mapLoginMethodToConnectionOption(loginMethod)
  }, [loginMethod])

  const resolvedConnectionOption = resolveConnectionOption()

  // Auto-trigger login when ready and loginMethod is specified
  useEffect(() => {
    if (!isReady || autoLoginTriggeredRef.current || !resolvedConnectionOption) {
      return
    }

    // Mark as triggered to prevent multiple auto-logins
    autoLoginTriggeredRef.current = true

    // Small delay to ensure UI is ready
    const timeoutId = setTimeout(() => {
      onConnect(resolvedConnectionOption)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [isReady, resolvedConnectionOption, onConnect])

  return {
    loginMethod,
    autoLoginTriggered: autoLoginTriggeredRef.current,
    resolvedConnectionOption
  }
}
