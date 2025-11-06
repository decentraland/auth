import React, { useCallback, useState } from 'react'
import { Logo, Typography } from 'decentraland-ui2'
import {
  ChevronIcon,
  ChevronUpIcon,
  ConnectionContainer,
  DclLogoContainer,
  ShowMoreButton,
  ShowMoreContainer,
  Title
} from './ConnectionNew.styled'
import { ConnectionPrimaryButton } from './ConnectionPrimaryButton'
import { ConnectionSecondaryButton } from './ConnectionSecondaryButton'
import { EXTRA_TEST_ID, PRIMARY_TEST_ID, SECONDARY_TEST_ID, SHOW_MORE_BUTTON_TEST_ID } from './constants'
import { ConnectionOptionType, ConnectionProps, connectionOptionTitles } from './Connection.types'

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

  return (
    <ConnectionContainer className={className}>
      <DclLogoContainer>
        <Logo size="large" />
        {isNewUser && (
          <Typography sx={{ fontFamily: 'DecentralandHero' }} variant="h3">
            Decentraland
          </Typography>
        )}
      </DclLogoContainer>
      <div>
        <Title>{i18n.title}</Title>
        {connectionOptions && (
          <ConnectionPrimaryButton
            option={connectionOptions.primary}
            testId={PRIMARY_TEST_ID}
            loadingOption={loadingOption}
            i18n={{
              accessWith: i18n.accessWith,
              connectWith: i18n.connectWith,
              socialMessage: i18n.socialMessage,
              web3Message: i18n.web3Message
            }}
            onConnect={onConnect}
            onLearnMore={onLearnMore}
            isNewUser={isNewUser}
          />
        )}
        {connectionOptions?.secondary && (
          <ConnectionPrimaryButton
            option={connectionOptions.secondary}
            testId={SECONDARY_TEST_ID}
            loadingOption={loadingOption}
            i18n={{
              accessWith: i18n.accessWith,
              connectWith: i18n.connectWith,
              socialMessage: i18n.socialMessage,
              web3Message: i18n.web3Message
            }}
            onConnect={onConnect}
            onLearnMore={onLearnMore}
            isNewUser={isNewUser}
          />
        )}
      </div>

      <ShowMoreContainer>
        {hasExtraOptions && (
          <ShowMoreButton data-testid={SHOW_MORE_BUTTON_TEST_ID} variant="text" fullWidth onClick={handleShowMore}>
            {i18n.moreOptions}
            {showMore ? <ChevronUpIcon /> : <ChevronIcon />}
          </ShowMoreButton>
        )}
        {showMore && hasExtraOptions && connectionOptions.extraOptions && (
          <ConnectionSecondaryButton
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
