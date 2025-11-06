import React, { useCallback, useState } from 'react'
import { Logo } from 'decentraland-ui2'
import { isSocialLogin } from '../Pages/LoginPage/utils'
import {
  ChevronIcon,
  ChevronUpIcon,
  ConnectionContainer,
  DclLogoContainer,
  PrimaryContainer,
  PrimaryLearnMore,
  PrimaryMagic,
  PrimaryMessage,
  PrimaryOption,
  PrimaryOptionWrapper,
  SecondaryOptionButton,
  ShowMoreButton,
  ShowMoreContainer,
  ShowMoreSecondaryOptions,
  Title
} from './ConnectionNew.styled'
import { ConnectionOption } from './ConnectionOption'
import { EXTRA_TEST_ID, PRIMARY_TEST_ID, SECONDARY_TEST_ID, SHOW_MORE_BUTTON_TEST_ID } from './constants'
import { ConnectionOptionType, ConnectionProps, MetamaskEthereumWindow, connectionOptionTitles } from './Connection.types'

const Primary = ({
  message,
  children,
  option,
  testId,
  loadingOption,
  error,
  onConnect
}: {
  message: React.ReactNode
  children: React.ReactChild
  option: ConnectionOptionType
  loadingOption?: ConnectionOptionType
  error?: string
  testId?: string
  onConnect: (wallet: ConnectionOptionType) => unknown
}) => (
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

const Secondary = ({
  options,
  tooltipDirection,
  testId,
  loadingOption,
  onConnect
}: {
  options: ConnectionOptionType[]
  tooltipDirection: 'top center' | 'bottom center'
  testId?: string
  loadingOption?: ConnectionOptionType
  onConnect: (wallet: ConnectionOptionType) => unknown
}) => (
  <ShowMoreSecondaryOptions data-testid={testId}>
    {options.map(option => (
      <SecondaryOptionButton key={option}>
        <ConnectionOption
          showTooltip
          tooltipPosition={tooltipDirection}
          type={option}
          onClick={onConnect}
          testId={testId}
          loading={loadingOption === option}
          disabled={!!loadingOption}
        />
      </SecondaryOptionButton>
    ))}
  </ShowMoreSecondaryOptions>
)

const defaultProps = {
  i18n: {
    title: 'Sign In to Decentraland',
    accessWith: (option: ConnectionOptionType) => `Continue with ${connectionOptionTitles[option]}`,
    connectWith: (option: ConnectionOptionType) => `Continue with ${connectionOptionTitles[option]}`,
    moreOptions: 'More Options',
    socialMessage: (element: React.ReactNode) => <>Access secured by {element}</>,
    web3Message: (learnMore: (value: React.ReactNode) => React.ReactNode) => <>Have a digital wallet? {learnMore('Learn More')}</>
  }
}

export const ConnectionNew = (props: ConnectionProps): JSX.Element => {
  const { i18n = defaultProps.i18n, onConnect, onLearnMore, connectionOptions, className, loadingOption, isNewUser } = props

  const hasExtraOptions = connectionOptions?.extraOptions && connectionOptions.extraOptions.length > 0

  const [showMore, setShowMore] = useState(hasExtraOptions && !isNewUser)
  const handleShowMore = useCallback(() => {
    setShowMore(!showMore)
  }, [showMore])

  const isMetamaskAvailable = (window.ethereum as MetamaskEthereumWindow)?.isMetaMask

  const renderPrimary = (option: ConnectionOptionType, testId: string) => (
    <Primary
      onConnect={onConnect}
      testId={testId}
      option={option}
      loadingOption={loadingOption}
      error={
        !isMetamaskAvailable && option === ConnectionOptionType.METAMASK
          ? 'You need to install the MetaMask Browser Extension to proceed. Please install it and try again.'
          : undefined
      }
      message={
        isSocialLogin(option) ? (
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
      }
    >
      <>{isSocialLogin(option) ? i18n.accessWith(option) : i18n.connectWith(option)}</>
    </Primary>
  )

  return (
    <ConnectionContainer className={className}>
      <DclLogoContainer>
        <Logo size="large" />
      </DclLogoContainer>
      <div>
        <Title>{i18n.title}</Title>
        {connectionOptions && renderPrimary(connectionOptions.primary, PRIMARY_TEST_ID)}
        {connectionOptions?.secondary && renderPrimary(connectionOptions.secondary, SECONDARY_TEST_ID)}
      </div>

      <ShowMoreContainer>
        {hasExtraOptions && (
          <ShowMoreButton data-testid={SHOW_MORE_BUTTON_TEST_ID} variant="text" fullWidth onClick={handleShowMore}>
            {i18n.moreOptions}
            {showMore ? <ChevronUpIcon /> : <ChevronIcon />}
          </ShowMoreButton>
        )}
        {showMore && hasExtraOptions && connectionOptions.extraOptions && (
          <Secondary
            testId={EXTRA_TEST_ID}
            options={connectionOptions.extraOptions}
            onConnect={onConnect}
            tooltipDirection="top center"
            loadingOption={loadingOption}
          />
        )}
      </ShowMoreContainer>
    </ConnectionContainer>
  )
}
