import React, { useEffect, useCallback } from 'react'
import { ProviderType } from '@dcl/schemas'
import { Button, CircularProgress } from 'decentraland-ui2'
import { ConnectionContainer, DecentralandLogo, ConnectionTitle, ProgressContainer, ErrorButtonContainer } from './ConnectionLayout.styled'
import { ConnectionLayoutState, type ConnectionLayoutProps } from './ConnectionLayout.type'

const getConnectionLayoutMessage = (loadingState: ConnectionLayoutState, providerType: ProviderType | null) => {
  switch (loadingState) {
    case ConnectionLayoutState.ERROR: {
      return 'You did not confirm this action in your digital wallet extension. To continue, please try again.'
    }
    case ConnectionLayoutState.ERROR_LOCKED_WALLET: {
      return 'Your wallet is currently locked. To continue, please unlock your wallet and try again.'
    }
    case ConnectionLayoutState.CONNECTING_WALLET:
    case ConnectionLayoutState.WAITING_FOR_SIGNATURE: {
      return providerType === ProviderType.MAGIC || providerType === ProviderType.MAGIC_TEST
        ? 'Almost done! Confirm your request to login Decentraland'
        : 'Confirm in your digital wallet extension to continue.'
    }
    case ConnectionLayoutState.VALIDATING_SIGN_IN: {
      return "Just a moment, we're verifying your login credentials..."
    }
    case ConnectionLayoutState.LOADING_MAGIC: {
      return 'Redirecting...'
    }
  }
}

const ConnectionLayout = React.memo((props: ConnectionLayoutProps) => {
  const { onTryAgain, state, providerType } = props

  const isLoading =
    state === ConnectionLayoutState.CONNECTING_WALLET ||
    state === ConnectionLayoutState.WAITING_FOR_SIGNATURE ||
    state === ConnectionLayoutState.LOADING_MAGIC ||
    state === ConnectionLayoutState.VALIDATING_SIGN_IN

  const isError = state === ConnectionLayoutState.ERROR || state === ConnectionLayoutState.ERROR_LOCKED_WALLET

  useEffect(() => {
    if (isLoading) {
      setTimeout(() => {
        onTryAgain()
      }, 30000)
    }
  }, [isLoading, onTryAgain])

  const handleTryAgain = useCallback(() => {
    onTryAgain()
  }, [onTryAgain])

  return (
    <ConnectionContainer>
      <DecentralandLogo size="huge" />
      <ConnectionTitle>{getConnectionLayoutMessage(state, providerType)}</ConnectionTitle>
      {isLoading && (
        <ProgressContainer>
          <CircularProgress color="inherit" />
        </ProgressContainer>
      )}
      {isError && (
        <ErrorButtonContainer>
          <Button variant="contained" onClick={handleTryAgain}>
            Try again
          </Button>
        </ErrorButtonContainer>
      )}
    </ConnectionContainer>
  )
})

export { ConnectionLayout }
