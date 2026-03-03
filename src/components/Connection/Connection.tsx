import { useCallback, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Logo } from 'decentraland-ui2'
import { useWalletOptions } from '../../hooks/useWalletOptions'
import { ConnectionPrimaryButton } from './ConnectionPrimaryButton'
import { ConnectionSecondaryButton } from './ConnectionSecondaryButton'
import { EXTRA_TEST_ID, PRIMARY_TEST_ID, SECONDARY_TEST_ID, SHOW_MORE_BUTTON_TEST_ID } from './constants'
import { EmailInput } from './EmailInput'
import { ConnectionProps } from './Connection.types'
import {
  ChevronIcon,
  ChevronUpIcon,
  ConnectionContainer,
  DclLogoContainer,
  DecentralandText,
  Divider,
  MainContentContainer,
  ShowMoreButton,
  ShowMoreContainer,
  Title
} from './Connection.styled'

export const Connection = (props: ConnectionProps): JSX.Element => {
  const {
    onConnect,
    onEmailSubmit,
    onEmailChange,
    connectionOptions,
    className,
    loadingOption,
    isNewUser,
    isOnlyEmailOption = false,
    isSignInWithTwoOptions = false,
    isEmailLoading,
    emailError
  } = props
  const { t } = useTranslation()

  const hasExtraOptions = connectionOptions?.extraOptions && connectionOptions.extraOptions.length > 0

  const [showMore, setShowMore] = useState(false)
  const handleShowMore = useCallback(() => {
    setShowMore(!showMore)
  }, [showMore])

  const { firstWalletOption, secondWalletOption, remainingWalletOptions } = useWalletOptions({
    connectionOptions,
    isOnlyEmailOption,
    isSignInWithTwoOptions
  })

  return (
    <ConnectionContainer className={className}>
      <DclLogoContainer>
        <Logo size="huge" />
        {isNewUser && <DecentralandText>Decentraland</DecentralandText>}
      </DclLogoContainer>
      <MainContentContainer>
        <Title isNewUser={isNewUser}>{isNewUser ? t('connection.title_new_user') : t('connection.title')}</Title>

        {/* Email Input (primary method - shown only if handlers provided) */}
        {onEmailSubmit && onEmailChange && (
          <EmailInput onSubmit={onEmailSubmit} onEmailChange={onEmailChange} isLoading={isEmailLoading} error={emailError} />
        )}

        {/* Divider */}
        {(firstWalletOption || secondWalletOption) && onEmailSubmit && onEmailChange && (
          <Divider>{t('connection.or_continue_with')}</Divider>
        )}

        {/* First wallet button (e.g., MetaMask) */}
        {firstWalletOption && (
          <ConnectionPrimaryButton
            option={firstWalletOption}
            testId={PRIMARY_TEST_ID}
            loadingOption={loadingOption}
            onConnect={onConnect}
            isNewUser={isNewUser}
          />
        )}

        {/* Second wallet button (e.g., Google) */}
        {secondWalletOption && (
          <ConnectionPrimaryButton
            option={secondWalletOption}
            testId={SECONDARY_TEST_ID}
            loadingOption={loadingOption}
            onConnect={onConnect}
            isNewUser={isNewUser}
          />
        )}
      </MainContentContainer>

      <ShowMoreContainer>
        {hasExtraOptions && remainingWalletOptions && remainingWalletOptions.length > 0 && (
          <ShowMoreButton data-testid={SHOW_MORE_BUTTON_TEST_ID} variant="text" fullWidth onClick={handleShowMore}>
            {t('connection.more_options')}
            {showMore ? <ChevronUpIcon /> : <ChevronIcon />}
          </ShowMoreButton>
        )}
        {showMore && remainingWalletOptions && remainingWalletOptions.length > 0 && (
          <ConnectionSecondaryButton
            testId={EXTRA_TEST_ID}
            options={remainingWalletOptions}
            onConnect={onConnect}
            tooltipDirection="top"
            loadingOption={loadingOption}
          />
        )}
      </ShowMoreContainer>
    </ConnectionContainer>
  )
}
