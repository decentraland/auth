import React from 'react'
import { isSocialLogin } from '../Pages/LoginPage/utils'
import {
  PrimaryContainer,
  PrimaryLearnMore,
  PrimaryMagic,
  PrimaryMessage,
  PrimaryOption,
  PrimaryOptionWrapper
} from './ConnectionPrimaryButton.styled'
import { ConnectionOption } from './ConnectionOption'
import { ConnectionOptionType, MetamaskEthereumWindow } from './Connection.types'

export type ConnectionPrimaryButtonI18N = {
  accessWith: (option: ConnectionOptionType) => React.ReactNode
  connectWith: (option: ConnectionOptionType) => React.ReactNode
  socialMessage: (by: React.ReactNode) => React.ReactNode
  web3Message: (learnMore: (element: React.ReactNode) => React.ReactNode) => React.ReactNode
}

export type ConnectionPrimaryButtonProps = {
  option: ConnectionOptionType
  testId?: string
  loadingOption?: ConnectionOptionType
  i18n: ConnectionPrimaryButtonI18N
  onConnect: (wallet: ConnectionOptionType) => unknown
  onLearnMore: (type?: ConnectionOptionType) => unknown
}

export const ConnectionPrimaryButton = ({
  option,
  testId,
  loadingOption,
  i18n,
  onConnect,
  onLearnMore
}: ConnectionPrimaryButtonProps): JSX.Element => {
  const isMetamaskAvailable = (window.ethereum as MetamaskEthereumWindow)?.isMetaMask

  const error =
    !isMetamaskAvailable && option === ConnectionOptionType.METAMASK
      ? 'You need to install the MetaMask Browser Extension to proceed. Please install it and try again.'
      : undefined

  const message = isSocialLogin(option) ? (
    <>
      {i18n.socialMessage(<PrimaryMagic role="img" aria-label="Magic" />)}
      <PrimaryLearnMore role="button" onClick={() => onLearnMore(option)}>
        Learn More
      </PrimaryLearnMore>
    </>
  ) : (
    i18n.web3Message(element => (
      <PrimaryLearnMore role="button" onClick={() => onLearnMore(option)}>
        {element}
      </PrimaryLearnMore>
    ))
  )

  const children = <>{isSocialLogin(option) ? i18n.accessWith(option) : i18n.connectWith(option)}</>

  return (
    <PrimaryContainer data-testid={testId}>
      <PrimaryMessage>{message}</PrimaryMessage>
      <PrimaryOptionWrapper>
        <PrimaryOption>
          <ConnectionOption
            disabled={!!loadingOption || !!error}
            loading={loadingOption === option}
            showTooltip={!!error}
            type={option}
            info={error}
            onClick={onConnect}
            testId={testId}
          >
            {children}
          </ConnectionOption>
        </PrimaryOption>
      </PrimaryOptionWrapper>
    </PrimaryContainer>
  )
}

