// eslint-disable-next-line @typescript-eslint/naming-convention
import Tooltip from '@mui/material/Tooltip'
import { useTranslation } from '@dcl/hooks'
import { muiIcons } from 'decentraland-ui2'
import { shouldDisableMetaMask } from './Connection.utils'
import { ConnectionIcon } from './ConnectionIcon'
import { connectionOptionTitles } from './Connection.types'
import { ConnectionPrimaryButtonProps } from './ConnectionPrimaryButton.types'
import {
  PrimaryButton,
  PrimaryButtonWrapper,
  PrimaryContainer,
  PrimaryOption,
  PrimaryOptionWrapper,
  TooltipWrapper,
  primaryTooltipSlotProps
} from './ConnectionPrimaryButton.styled'

const NavigateNextRoundedIcon = muiIcons.NavigateNextRounded

export const ConnectionPrimaryButton = ({
  option,
  testId,
  loadingOption,
  isNewUser,
  onConnect
}: ConnectionPrimaryButtonProps): JSX.Element => {
  const { t } = useTranslation()
  const isMetamaskDisabled = shouldDisableMetaMask(option)
  const error = isMetamaskDisabled ? t('connection.metamask_not_installed') : undefined

  const isDisabled = !!loadingOption || !!error
  const children = <>{t('connection.continue_with', { provider: connectionOptionTitles[option] })}</>

  const button = (
    <PrimaryButton
      data-testid={testId ? `${testId}-${option}-button` : undefined}
      startIcon={<ConnectionIcon type={option} />}
      disabled={isDisabled}
      onClick={() => onConnect(option)}
      isNewUser={isNewUser}
    >
      <PrimaryButtonWrapper isNewUser={isNewUser}>
        {children}
        {isNewUser && <NavigateNextRoundedIcon fontSize="large" />}
      </PrimaryButtonWrapper>
    </PrimaryButton>
  )

  return (
    <PrimaryContainer data-testid={testId}>
      <PrimaryOptionWrapper>
        <PrimaryOption>
          {error ? (
            <Tooltip title={error} arrow placement="top" slotProps={primaryTooltipSlotProps}>
              <TooltipWrapper>{button}</TooltipWrapper>
            </Tooltip>
          ) : (
            button
          )}
        </PrimaryOption>
      </PrimaryOptionWrapper>
    </PrimaryContainer>
  )
}
