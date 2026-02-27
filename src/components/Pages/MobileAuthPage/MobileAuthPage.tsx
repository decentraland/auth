import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { createAuthServerHttpClient } from '../../../shared/auth'
import { isErrorWithName } from '../../../shared/errors'
import { mirrorSessionStorageWrites } from '../../../shared/mobile'
import { handleError } from '../../../shared/utils/errorHandler'
import { createMagicInstance } from '../../../shared/utils/magicSdk'
import { ConnectionOptionType } from '../../Connection'
import { ConnectionLayout } from '../../ConnectionModal/ConnectionLayout'
import { ConnectionLayoutState } from '../../ConnectionModal/ConnectionLayout.type'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import {
  connectToProvider,
  connectToSocialProvider,
  fromConnectionOptionToProviderType,
  getIdentitySignature,
  isSocialLogin
} from '../LoginPage/utils'
import { MobileAuthSuccess } from './MobileAuthSuccess'
import { MobileProviderSelection } from './MobileProviderSelection'
import { parseConnectionOptionType } from './utils'
import { Main } from './MobileAuthPage.styled'

type MobileAuthView = 'selection' | 'connecting' | 'success' | 'error'

export const MobileAuthPage = () => {
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
          // Guard against Mobile Safari evicting sessionStorage during the OAuth redirect
          mirrorSessionStorageWrites()
          await connectToSocialProvider(
            selectedConnectionType,
            flags[FeatureFlagsKeys.MAGIC_TEST],
            undefined, // redirectTo not needed for mobile
            true // isMobileFlow
          )
        } else {
          // Web3 wallet flow
          setView('connecting')
          setLoadingState(ConnectionLayoutState.CONNECTING_WALLET)
          const connectionData = await connectToProvider(selectedConnectionType)

          setLoadingState(ConnectionLayoutState.WAITING_FOR_SIGNATURE)
          const identity = await getIdentitySignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)

          setLoadingState(ConnectionLayoutState.VALIDATING_SIGN_IN)

          // Get the identity from localStorage (getIdentitySignature stores it there)
          const storedIdentity = localStorageGetIdentity(connectionData.account?.toLowerCase() ?? '') ?? identity

          const httpClient = createAuthServerHttpClient()
          const response = await httpClient.postIdentity(storedIdentity, { isMobile: true })

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

  // Provider selection view
  if (view === 'selection') {
    return (
      <MobileProviderSelection onConnect={initiateAuth} loadingOption={connectionType} connectionOptions={targetConfig.connectionOptions} />
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
