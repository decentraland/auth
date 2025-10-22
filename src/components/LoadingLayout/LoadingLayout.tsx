import React, { useEffect, useState, useCallback } from 'react'
import { ProviderType } from '@dcl/schemas'
import { Button, CircularProgress } from 'decentraland-ui2'
import {
  MainContainer,
  LoadingContainer,
  DecentralandLogo,
  LoadingTitle,
  ProgressContainer,
  ErrorButtonContainer
} from './LoadingLayout.styled'
import { LoadingLayoutState, type LoadingLayoutProps } from './LoadingLayout.type'

const getLoadingLayoutMessage = (loadingState: LoadingLayoutState, providerType: ProviderType | null, hasTimedOut: boolean) => {
  switch (loadingState) {
    case LoadingLayoutState.ERROR: {
      return 'You did not confirm this action in your digital wallet extension. To continue, please try again.'
    }
    case LoadingLayoutState.ERROR_LOCKED_WALLET: {
      return 'Your wallet is currently locked. To continue, please unlock your wallet and try again.'
    }
    case LoadingLayoutState.CONNECTING_WALLET:
    case LoadingLayoutState.WAITING_FOR_SIGNATURE: {
      return providerType === ProviderType.MAGIC || providerType === ProviderType.MAGIC_TEST
        ? 'Almost done! Confirm your request to login Decentraland'
        : hasTimedOut
        ? "Confirm in your digital wallet extension to continue. Please check that you're logged in your wallet extension and try again"
        : 'Confirm in your digital wallet extension to continue.'
    }
    case LoadingLayoutState.VALIDATING_SIGN_IN: {
      return "Just a moment, we're verifying your login credentials..."
    }
    case LoadingLayoutState.LOADING_MAGIC: {
      return 'Redirecting...'
    }
  }
}

const LoadingLayout = React.memo((props: LoadingLayoutProps) => {
  const { onTryAgain, state, providerType } = props
  const [hasTimedOut, setHasTimedOut] = useState(false)

  const isLoading =
    state === LoadingLayoutState.CONNECTING_WALLET ||
    state === LoadingLayoutState.WAITING_FOR_SIGNATURE ||
    state === LoadingLayoutState.LOADING_MAGIC ||
    state === LoadingLayoutState.VALIDATING_SIGN_IN

  const isError = state === LoadingLayoutState.ERROR || state === LoadingLayoutState.ERROR_LOCKED_WALLET || hasTimedOut

  useEffect(() => {
    if (isLoading && !hasTimedOut) {
      const timeoutId = setTimeout(() => {
        setHasTimedOut(true)
      }, 30000) // 30 segundos

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
    <MainContainer>
      <LoadingContainer>
        <DecentralandLogo />
        <LoadingTitle variant="h3">{getLoadingLayoutMessage(state, providerType, hasTimedOut)}</LoadingTitle>
        {isLoading && !hasTimedOut && (
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
      </LoadingContainer>
    </MainContainer>
  )
})

export { LoadingLayout }
