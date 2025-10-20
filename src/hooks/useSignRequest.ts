import { useCallback, useRef } from 'react'
import { BrowserProvider } from 'ethers'
import type { Provider } from 'decentraland-connect'
import { createAuthServerWsClient, ExpiredRequestError, IpValidationError, RecoverResponse } from '../shared/auth'
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
        if (e instanceof ExpiredRequestError) {
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
          const errorMessage = handleError(e, 'Error recovering request')
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

        const browserProvider = new BrowserProvider(provider)
        const signer = await browserProvider.getSigner()
        signature = await signer.signMessage(request.params?.[0])

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

        if (e instanceof ExpiredRequestError) {
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
