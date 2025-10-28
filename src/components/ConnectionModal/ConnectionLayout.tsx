import React, { useEffect, useState, useCallback } from 'react'
import { ProviderType } from '@dcl/schemas'
import { Button, CircularProgress } from 'decentraland-ui2'
import {
  ConnectionContainer,
  DecentralandLogo,
  ConnectionTitle,
  ProgressContainer,
  ErrorButtonContainer,
  TextWrapper,
  TroubleSigningInText,
  TroubleSigningInTitle
} from './ConnectionLayout.styled'
import { ConnectionLayoutState, type ConnectionLayoutProps } from './ConnectionLayout.type'

const getConnectionLayoutMessage = (loadingState: ConnectionLayoutState, providerType: ProviderType | null, hasTimedOut: boolean) => {
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
        : hasTimedOut
        ? "You must confirm in your wallet extension to continue. Please make sure you're logged into the extension and try again."
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
  const [hasTimedOut, setHasTimedOut] = useState(false)

  const isLoading =
    state === ConnectionLayoutState.CONNECTING_WALLET ||
    state === ConnectionLayoutState.WAITING_FOR_SIGNATURE ||
    state === ConnectionLayoutState.LOADING_MAGIC ||
    state === ConnectionLayoutState.VALIDATING_SIGN_IN

  const isError = state === ConnectionLayoutState.ERROR || state === ConnectionLayoutState.ERROR_LOCKED_WALLET

  useEffect(() => {
    if (isLoading && !hasTimedOut) {
      const timeoutId = setTimeout(() => {
        setHasTimedOut(true)
      }, 1000)

      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [isLoading, hasTimedOut])

  useEffect(() => {
    if (!isLoading) {
      setHasTimedOut(false)
    }
  }, [isLoading])

  const handleTryAgain = useCallback(() => {
    if (hasTimedOut) {
      setHasTimedOut(false)
    }

    onTryAgain()
  }, [onTryAgain, hasTimedOut, setHasTimedOut])

  return (
    <ConnectionContainer>
      <DecentralandLogo size="huge" />
      {!hasTimedOut && <ConnectionTitle>{getConnectionLayoutMessage(state, providerType, hasTimedOut)}</ConnectionTitle>}
      {hasTimedOut && (
        <TextWrapper>
          <TroubleSigningInTitle>Trouble Signing In?</TroubleSigningInTitle>
          <TroubleSigningInText>
            1. Check if your wallet extension has a pending a sign request—approve it to continue.
          </TroubleSigningInText>
          <TroubleSigningInText>
            2. If you're logged out of your wallet extension, sign in and refresh this page to try again.
          </TroubleSigningInText>
        </TextWrapper>
      )}
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
