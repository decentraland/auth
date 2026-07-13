import { useCallback, useRef } from 'react'
import { createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'
import type { Provider } from 'decentraland-connect'
import { ExpiredRequestError, IpValidationError, RecoverResponse, RequestFulfilledError, createAuthServerWsClient } from '../shared/auth'
import { isErrorWithMessage } from '../shared/errors'
import { handleError } from '../shared/utils/errorHandler'

interface SignRequestErrorHandlers {
  onExpiredRequest?: () => void
  onRecoverError?: (error: string) => void
  onSigningError?: (error: string) => void
  onIpValidationError?: (error: string) => void
  onSuccess?: () => void
  onConnectionModalOpen?: () => void
  onConnectionModalClose?: () => void
}

/* TODO: move this hook into @dcl/hooks */
export const useSignRequest = (redirect: () => void, errorHandlers?: SignRequestErrorHandlers) => {
  const authServerClient = useRef(createAuthServerWsClient())

  const signRequest = useCallback(
    async (provider: Provider, requestId: string, account: string) => {
      let request: RecoverResponse | null = null
      try {
        request = await authServerClient.current.recover(requestId, account)

        if (request.method !== 'dcl_personal_sign') {
          redirect()
          return
        }
      } catch (e) {
        if (e instanceof RequestFulfilledError) {
          // Request was already consumed successfully (e.g. a second tab or an auto-login race
          // signed it first). Treat it as success so the caller proceeds instead of hanging on a
          // spinner — mirror the normal success path (onSuccess, else redirect).
          if (errorHandlers?.onSuccess) {
            errorHandlers.onSuccess()
          } else {
            redirect()
          }
          return
        } else if (e instanceof ExpiredRequestError) {
          if (errorHandlers?.onExpiredRequest) {
            errorHandlers.onExpiredRequest()
          } else {
            console.error('Request expired')
          }
        } else if (e instanceof IpValidationError) {
          const errorMessage = handleError(e, 'IP validation failed')
          if (errorHandlers?.onIpValidationError) {
            errorHandlers.onIpValidationError(errorMessage)
          } else if (errorHandlers?.onRecoverError) {
            errorHandlers.onRecoverError(errorMessage)
          }
        } else {
          // Don't call handleError here — wsClient.recover() already reported to Sentry
          const errorMessage = isErrorWithMessage(e) ? e.message : 'Unknown error'
          if (errorHandlers?.onRecoverError) {
            errorHandlers.onRecoverError(errorMessage)
          }
        }
        return
      }

      let signature: string | null = null
      try {
        if (!provider.isMagic && errorHandlers?.onConnectionModalOpen) {
          errorHandlers.onConnectionModalOpen()
        }

        const walletClient = createWalletClient({
          chain: mainnet,
          transport: custom(provider)
        })
        // Sign with the connected `account` (the same address recover validated and the outcome is
        // sent for), not getAddresses()[0]. If the wallet's active account changed after connect,
        // signing with the wallet's current first address would produce a signature from a
        // different key that the server would reject with an opaque error; using `account` makes
        // the wallet sign for the expected key (or throw, surfacing a real signing error).
        signature = await walletClient.signMessage({ account: account as `0x${string}`, message: request.params?.[0] as string })

        if (errorHandlers?.onConnectionModalClose) {
          errorHandlers.onConnectionModalClose()
        }

        await authServerClient.current.sendSuccessfulOutcome(requestId, account, signature)

        if (errorHandlers?.onSuccess) {
          errorHandlers.onSuccess()
        } else {
          redirect()
        }
      } catch (e) {
        if (errorHandlers?.onConnectionModalClose) {
          errorHandlers.onConnectionModalClose()
        }

        if (e instanceof RequestFulfilledError) {
          // The outcome was rejected as already fulfilled — a second tab or an auto-login race
          // signed it first. It succeeded, so proceed as success instead of reporting an expected
          // state as a signing error (mirrors the recover-phase handling above).
          if (errorHandlers?.onSuccess) {
            errorHandlers.onSuccess()
          } else {
            redirect()
          }
        } else if (e instanceof ExpiredRequestError) {
          if (errorHandlers?.onExpiredRequest) {
            errorHandlers.onExpiredRequest()
          } else {
            console.error('Request expired during signing')
          }
        } else {
          const errorMessage = handleError(e, 'Error signing request')
          if (errorHandlers?.onSigningError) {
            errorHandlers.onSigningError(errorMessage)
          }
        }
      }
    },
    [redirect, errorHandlers]
  )

  return { signRequest, authServerClient }
}
