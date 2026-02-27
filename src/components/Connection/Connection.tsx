import { useCallback, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Logo } from 'decentraland-ui2'
import { ConnectionPrimaryButton } from './ConnectionPrimaryButton'
import { ConnectionSecondaryButton } from './ConnectionSecondaryButton'
import { EXTRA_TEST_ID, PRIMARY_TEST_ID, SECONDARY_TEST_ID, SHOW_MORE_BUTTON_TEST_ID } from './constants'
import { EmailInput } from './EmailInput'
import { ConnectionOptionType, ConnectionProps } from './Connection.types'
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
  const { onConnect, onEmailSubmit, connectionOptions, className, loadingOption, isNewUser, isEmailLoading, emailError } = props
  const { t } = useTranslation()

  const hasExtraOptions = connectionOptions?.extraOptions && connectionOptions.extraOptions.length > 0

  const [showMore, setShowMore] = useState(false)
  const handleShowMore = useCallback(() => {
    setShowMore(!showMore)
  }, [showMore])

  // Filter out EMAIL from connection options (it's handled by EmailInput now)
  const filteredPrimary =
    connectionOptions?.primary === ConnectionOptionType.EMAIL ? connectionOptions?.secondary : connectionOptions?.primary
  const filteredSecondary =
    connectionOptions?.primary === ConnectionOptionType.EMAIL
      ? connectionOptions?.extraOptions?.[0]
      : connectionOptions?.secondary === ConnectionOptionType.EMAIL
        ? connectionOptions?.extraOptions?.[0]
        : connectionOptions?.secondary
  const filteredExtraOptions = connectionOptions?.extraOptions?.filter(opt => opt !== ConnectionOptionType.EMAIL)

  return (
    <ConnectionContainer className={className}>
      <DclLogoContainer>
        <Logo size="huge" />
        {isNewUser && <DecentralandText>Decentraland</DecentralandText>}
      </DclLogoContainer>
      <MainContentContainer>
        <Title isNewUser={isNewUser}>{isNewUser ? t('connection.title_new_user') : t('connection.title')}</Title>

        {/* Email Input (primary method) */}
        {onEmailSubmit && <EmailInput onSubmit={onEmailSubmit} isLoading={isEmailLoading} error={emailError} />}

        {/* Divider */}
        {onEmailSubmit && (filteredPrimary || filteredSecondary) && <Divider>{t('connection.or_continue_with')}</Divider>}

        {/* MetaMask button */}
        {filteredPrimary && (
          <ConnectionPrimaryButton
            option={filteredPrimary}
            testId={PRIMARY_TEST_ID}
            loadingOption={loadingOption}
            onConnect={onConnect}
            isNewUser={isNewUser}
          />
        )}

        {/* Google button */}
        {filteredSecondary && (
          <ConnectionPrimaryButton
            option={filteredSecondary}
            testId={SECONDARY_TEST_ID}
            loadingOption={loadingOption}
            onConnect={onConnect}
            isNewUser={isNewUser}
          />
        )}
      </MainContentContainer>

      <ShowMoreContainer>
        {hasExtraOptions && filteredExtraOptions && filteredExtraOptions.length > 0 && (
          <ShowMoreButton data-testid={SHOW_MORE_BUTTON_TEST_ID} variant="text" fullWidth onClick={handleShowMore}>
            {t('connection.more_options')}
            {showMore ? <ChevronUpIcon /> : <ChevronIcon />}
          </ShowMoreButton>
        )}
        {showMore && filteredExtraOptions && filteredExtraOptions.length > 0 && (
          <ConnectionSecondaryButton
            testId={EXTRA_TEST_ID}
            options={filteredExtraOptions}
            onConnect={onConnect}
            tooltipDirection="top"
            loadingOption={loadingOption}
          />
        )}
      </ShowMoreContainer>
    </ConnectionContainer>
  )
}
