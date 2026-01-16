import { useCallback, useContext, useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { createAuthServerHttpClient } from '../../../shared/auth'
import { isErrorWithName } from '../../../shared/errors'
import { handleError } from '../../../shared/utils/errorHandler'
import { ConnectionOptionType, parseConnectionOptionType } from '../../Connection'
import { ConnectionModal } from '../../ConnectionModal'
import { ConnectionLayoutState } from '../../ConnectionModal/ConnectionLayout.type'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import {
  getIdentitySignature,
  connectToProvider,
  isSocialLogin,
  fromConnectionOptionToProviderType,
  connectToSocialProvider
} from '../LoginPage/utils'
import { MobileAuthSuccess } from './MobileAuthSuccess'
import { MobileProviderSelection } from './MobileProviderSelection'
import styles from './MobileAuthPage.module.css'

type MobileAuthView = 'selection' | 'connecting' | 'success' | 'error'

export const MobileAuthPage = () => {
  const [searchParams] = useSearchParams()
  const { flags, initialized: flagInitialized } = useContext(FeatureFlagsContext)
  const [targetConfig] = useTargetConfig()

  const [view, setView] = useState<MobileAuthView>('selection')
  const [loadingState, setLoadingState] = useState(ConnectionLayoutState.CONNECTING_WALLET)
  const [identityId, setIdentityId] = useState<string | null>(null)
  const [connectionType, setConnectionType] = useState<ConnectionOptionType>()

  const hasInitiated = useRef(false)
  const providerParam = searchParams.get('provider')
  const provider = parseConnectionOptionType(providerParam)

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
          const response = await httpClient.postIdentity(storedIdentity)

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

  // Auto-initiate auth if valid provider param is present
  useEffect(() => {
    if (!flagInitialized || hasInitiated.current) return

    if (provider) {
      hasInitiated.current = true
      initiateAuth(provider)
    }
  }, [provider, flagInitialized, initiateAuth])

  const handleTryAgain = useCallback(() => {
    if (connectionType) {
      setView('selection')
      setLoadingState(ConnectionLayoutState.CONNECTING_WALLET)
      hasInitiated.current = false
      initiateAuth(connectionType)
    } else {
      setView('selection')
    }
  }, [connectionType, initiateAuth])

  const handleCloseConnectionModal = useCallback(() => {
    setView('selection')
    setConnectionType(undefined)
    setLoadingState(ConnectionLayoutState.CONNECTING_WALLET)
    hasInitiated.current = false
  }, [])

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

  // Loading/error modal for connecting states
  return (
    <main className={styles.main}>
      <div className={styles.background} />
      <ConnectionModal
        open={true}
        state={loadingState}
        onClose={handleCloseConnectionModal}
        onTryAgain={handleTryAgain}
        providerType={connectionType ? fromConnectionOptionToProviderType(connectionType) : null}
      />
    </main>
  )
}
