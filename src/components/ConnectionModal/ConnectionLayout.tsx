// eslint-disable-next-line @typescript-eslint/naming-convention
import * as React from 'react'
import { useCallback } from 'react'
import { useTranslation } from '@dcl/hooks'
import { ProviderType } from '@dcl/schemas'
import { Button, CircularProgress } from 'decentraland-ui2'
import { type ConnectionLayoutProps, ConnectionLayoutState } from './ConnectionLayout.type'
import { ConnectionContainer, ConnectionTitle, DecentralandLogo, ErrorButtonContainer, ProgressContainer } from './ConnectionLayout.styled'

const getConnectionLayoutMessage = (
  loadingState: ConnectionLayoutState,
  providerType: ProviderType | null,
  t: (key: string) => string
) => {
  switch (loadingState) {
    case ConnectionLayoutState.ERROR: {
      return t('connection_layout.error')
    }
    case ConnectionLayoutState.ERROR_LOCKED_WALLET: {
      return t('connection_layout.error_locked_wallet')
    }
    case ConnectionLayoutState.CONNECTING_WALLET:
    case ConnectionLayoutState.WAITING_FOR_SIGNATURE: {
      return providerType === ProviderType.MAGIC || providerType === ProviderType.MAGIC_TEST
        ? t('connection_layout.waiting_for_signature_magic')
        : t('connection_layout.waiting_for_signature')
    }
    case ConnectionLayoutState.VALIDATING_SIGN_IN: {
      return t('connection_layout.validating_sign_in')
    }
    case ConnectionLayoutState.LOADING_MAGIC: {
      return t('connection_layout.loading_magic')
    }
  }
}

const ConnectionLayout = React.memo((props: ConnectionLayoutProps) => {
  const { onTryAgain, state, providerType } = props
  const { t } = useTranslation()

  const isLoading =
    state === ConnectionLayoutState.CONNECTING_WALLET ||
    state === ConnectionLayoutState.WAITING_FOR_SIGNATURE ||
    state === ConnectionLayoutState.LOADING_MAGIC ||
    state === ConnectionLayoutState.VALIDATING_SIGN_IN

  const isError = state === ConnectionLayoutState.ERROR || state === ConnectionLayoutState.ERROR_LOCKED_WALLET

  const handleTryAgain = useCallback(() => {
    onTryAgain()
  }, [onTryAgain])

  return (
    <ConnectionContainer>
      <DecentralandLogo size="huge" />
      <ConnectionTitle>{getConnectionLayoutMessage(state, providerType, t)}</ConnectionTitle>
      {isLoading && (
        <ProgressContainer>
          <CircularProgress color="inherit" />
        </ProgressContainer>
      )}
      {isError && (
        <ErrorButtonContainer>
          <Button variant="contained" onClick={handleTryAgain}>
            {t('common.try_again')}
          </Button>
        </ErrorButtonContainer>
      )}
    </ConnectionContainer>
  )
})

export { ConnectionLayout }
