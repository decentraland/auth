import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '@dcl/hooks'
import { connection } from 'decentraland-connect'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { createAuthServerHttpClient } from '../../../shared/auth'
import { isErrorWithName } from '../../../shared/errors'
import { disconnectWallet, sendEmailOTP } from '../../../shared/thirdweb'
import { handleError } from '../../../shared/utils/errorHandler'
import { createMagicInstance } from '../../../shared/utils/magicSdk'
import { ConnectionOptionType } from '../../Connection'
import { ConnectionLayout } from '../../ConnectionModal/ConnectionLayout'
import { ConnectionLayoutState } from '../../ConnectionModal/ConnectionLayout.type'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { connectToProvider, connectToSocialProvider, fromConnectionOptionToProviderType, isSocialLogin } from '../LoginPage/utils'
import { getIdentitySignature } from './identityUtils'
import { MobileAuthSuccess } from './MobileAuthSuccess'
import { MobileEmailLoginModal } from './MobileEmailLoginModal'
import { EmailLoginResult } from './MobileEmailLoginModal/MobileEmailLoginModal.types'
import { MobileProviderSelection } from './MobileProviderSelection'
import { isTestAuthEmail, sendTestAuthCode } from './testAuth'
import { parseConnectionOptionType } from './utils'
import { Main } from './MobileAuthPage.styled'

type MobileAuthView = 'selection' | 'connecting' | 'success' | 'error'

export const MobileAuthPage = () => {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { flags, initialized: flagInitialized } = useContext(FeatureFlagsContext)
  const [targetConfig] = useTargetConfig()

  const providerParam = searchParams.get('provider')
  const provider = parseConnectionOptionType(providerParam)

  // If provider param is present, start with connecting view and loading state to avoid button flash
  const [view, setView] = useState<MobileAuthView>(provider ? 'connecting' : 'selection')
  const [loadingState, setLoadingState] = useState(provider ? ConnectionLayoutState.LOADING_MAGIC : ConnectionLayoutState.CONNECTING_WALLET)
  const [identityId, setIdentityId] = useState<string | null>(null)
  const [connectionType, setConnectionType] = useState<ConnectionOptionType | undefined>(provider ?? undefined)

  // Email login state
  const [currentEmail, setCurrentEmail] = useState('')
  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [showEmailLoginModal, setShowEmailLoginModal] = useState(false)
  const [isTestAuthSession, setIsTestAuthSession] = useState(false)

  const hasStartedInit = useRef(false)

  const initiateAuth = useCallback(
    async (selectedConnectionType: ConnectionOptionType) => {
      if (!flagInitialized) return

      setConnectionType(selectedConnectionType)

      try {
        if (isSocialLogin(selectedConnectionType)) {
          // OAuth flow - will redirect to provider
          setView('connecting')
          setLoadingState(ConnectionLayoutState.LOADING_MAGIC)
          await connectToSocialProvider(
            selectedConnectionType,
            flags[FeatureFlagsKeys.MAGIC_TEST],
            undefined, // redirectTo not needed for mobile
            true // isMobileFlow
          )
        } else {
          setView('connecting')
          setLoadingState(ConnectionLayoutState.CONNECTING_WALLET)
          const connectionData = await connectToProvider(selectedConnectionType)

          setLoadingState(ConnectionLayoutState.WAITING_FOR_SIGNATURE)
          const identity = await getIdentitySignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)

          setLoadingState(ConnectionLayoutState.VALIDATING_SIGN_IN)

          const httpClient = createAuthServerHttpClient()
          const response = await httpClient.postIdentity(identity, { isMobile: true })

          setIdentityId(response.identityId)
          setView('success')
        }
      } catch (err) {
        handleError(err, 'Error during mobile auth', {
          sentryTags: {
            connectionType: selectedConnectionType,
            isMobileFlow: true
          }
        })

        if (isErrorWithName(err) && err.name === 'ErrorUnlockingWallet') {
          setLoadingState(ConnectionLayoutState.ERROR_LOCKED_WALLET)
        } else {
          setLoadingState(ConnectionLayoutState.ERROR)
        }
        setView('error')
      }
    },
    [flagInitialized]
  )
  // Clear cached sessions and optionally auto-initiate auth in a single sequential flow.
  // This prevents a race condition where clearCachedSessions (magic.user.logout) and
  // initiateAuth (magic.oauth2.loginWithRedirect) could run concurrently, corrupting
  // the Magic iframe state and causing "Magic: user isn't logged in" errors.
  useEffect(() => {
    if (!flagInitialized || hasStartedInit.current) return
    hasStartedInit.current = true

    const initialize = async () => {
      // Step 1: Clear cached sessions
      try {
        const magic = await createMagicInstance(!!flags[FeatureFlagsKeys.MAGIC_TEST])
        if (await magic?.user.isLoggedIn()) {
          await magic?.user.logout()
        }

        localStorage.removeItem('dcl_magic_user_email')

        // Clear any Thirdweb in-app wallet session so each visit starts fresh.
        await disconnectWallet()
        localStorage.removeItem('dcl_thirdweb_user_email')

        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith('single-sign-on-')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
      } catch (err) {
        console.warn('Failed to clear cached sessions:', err)
      }

      // Step 2: Auto-initiate auth if provider param is present
      if (provider) {
        initiateAuth(provider)
      }
    }

    initialize()
  }, [flagInitialized, flags, provider, initiateAuth])

  const handleTryAgain = useCallback(() => {
    if (connectionType) {
      setView('selection')
      setLoadingState(ConnectionLayoutState.CONNECTING_WALLET)
      initiateAuth(connectionType)
    } else {
      setView('selection')
    }
  }, [connectionType, initiateAuth])

  const handleEmailInputChange = useCallback(() => {
    setEmailError(null)
  }, [])

  const handleEmailSubmit = useCallback(
    async (email: string) => {
      setCurrentEmail(email)
      setIsEmailLoading(true)
      setEmailError(null)
      setConnectionType(ConnectionOptionType.EMAIL)

      // Best-effort cleanup of any stale connection from a previous session.
      try {
        await connection.disconnect()
        await disconnectWallet()
      } catch {
        // Keep the flow going even if cleanup fails.
      }

      try {
        // For emails matching the test domain, try the test auth backend first.
        // If the backend rejects the specific email (403), fall back to Thirdweb.
        let useTestAuth = false
        if (isTestAuthEmail(email)) {
          useTestAuth = await sendTestAuthCode(email)
        }
        if (!useTestAuth) {
          await sendEmailOTP(email)
        }
        setIsTestAuthSession(useTestAuth)
        setShowEmailLoginModal(true)
      } catch (error) {
        const errorMessage = handleError(error, 'Error sending verification code', {
          sentryTags: {
            connectionType: ConnectionOptionType.EMAIL,
            isMobileFlow: true
          }
        })
        // Clear connection type so other login options aren't disabled
        setConnectionType(undefined)
        if (errorMessage === 'Failed to fetch' || errorMessage?.toLowerCase().includes('network')) {
          setEmailError(t('login.errors.network_error'))
        } else if (errorMessage?.toLowerCase().includes('invalid email')) {
          setEmailError(t('login.errors.invalid_email'))
        } else {
          setEmailError(errorMessage || t('login.errors.failed_send_code'))
        }
      } finally {
        setIsEmailLoading(false)
      }
    },
    [t]
  )

  const handleEmailLoginDismiss = useCallback(() => {
    setShowEmailLoginModal(false)
    setCurrentEmail('')
    setConnectionType(undefined)
  }, [])

  const handleEmailLoginSuccess = useCallback(async (result: EmailLoginResult) => {
    setShowEmailLoginModal(false)
    setView('connecting')
    setLoadingState(ConnectionLayoutState.WAITING_FOR_SIGNATURE)

    try {
      const address = result.address.toLowerCase()
      let identity

      if (result.identity) {
        // Test auth flow: identity was generated server-side by mobile-bff
        identity = result.identity
      } else {
        // Normal Thirdweb flow: restore the EIP-1193 provider that
        // verifyEmailOTPAndConnect persisted via storeConnectionData(THIRDWEB, MAINNET).
        const connectionData = await connection.tryPreviousConnection()
        identity = await getIdentitySignature(address, connectionData.provider)
      }

      setLoadingState(ConnectionLayoutState.VALIDATING_SIGN_IN)
      const httpClient = createAuthServerHttpClient()
      const response = await httpClient.postIdentity(identity, { isMobile: true })

      setIdentityId(response.identityId)
      setView('success')
    } catch (err) {
      handleError(err, 'Error during mobile email auth', {
        sentryTags: {
          connectionType: ConnectionOptionType.EMAIL,
          isMobileFlow: true
        }
      })

      if (isErrorWithName(err) && err.name === 'ErrorUnlockingWallet') {
        setLoadingState(ConnectionLayoutState.ERROR_LOCKED_WALLET)
      } else {
        setLoadingState(ConnectionLayoutState.ERROR)
      }
      setView('error')
    }
  }, [])

  // Provider selection view
  if (view === 'selection') {
    return (
      <>
        <MobileProviderSelection
          onConnect={initiateAuth}
          loadingOption={connectionType}
          connectionOptions={targetConfig.connectionOptions}
          onEmailSubmit={handleEmailSubmit}
          onEmailChange={handleEmailInputChange}
          isEmailLoading={isEmailLoading}
          emailError={emailError}
        />
        <MobileEmailLoginModal
          open={showEmailLoginModal}
          email={currentEmail}
          isTestAuth={isTestAuthSession}
          onClose={handleEmailLoginDismiss}
          onBack={handleEmailLoginDismiss}
          onSuccess={handleEmailLoginSuccess}
        />
      </>
    )
  }

  // Success view with deep link
  if (view === 'success' && identityId) {
    return <MobileAuthSuccess identityId={identityId} explorerText={targetConfig.explorerText} onTryAgain={handleTryAgain} />
  }

  // Loading/error view - use ConnectionLayout directly for centering
  return (
    <Main component="main">
      <ConnectionLayout
        state={loadingState}
        onTryAgain={handleTryAgain}
        providerType={connectionType ? fromConnectionOptionToProviderType(connectionType) : null}
      />
    </Main>
  )
}
