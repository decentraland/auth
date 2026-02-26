import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import Tooltip from '@mui/material/Tooltip'
import { isSocialLogin } from '../Pages/LoginPage/utils'
import { ConnectionIcon } from './ConnectionIcon'
import {
  PrimaryContainer,
  PrimaryOption,
  PrimaryOptionWrapper,
  PrimaryButton,
  primaryTooltipSlotProps,
  PrimaryButtonWrapper
} from './ConnectionPrimaryButton.styled'
import { ConnectionOptionType, MetamaskEthereumWindow } from './Connection.types'
import { ConnectionPrimaryButtonProps } from './ConnectionPrimaryButton.types'

export const ConnectionPrimaryButton = ({
  option,
  testId,
  loadingOption,
  i18n,
  isNewUser,
  onConnect
}: ConnectionPrimaryButtonProps): JSX.Element => {
  const isMetamaskAvailable = (window.ethereum as MetamaskEthereumWindow)?.isMetaMask
  const error =
    !isMetamaskAvailable && option === ConnectionOptionType.METAMASK
      ? 'You need to install the MetaMask Browser Extension to proceed. Please install it and try again.'
      : undefined

  const isDisabled = !!loadingOption || !!error
  const children = <>{isSocialLogin(option) ? i18n.accessWith(option) : i18n.connectWith(option)}</>

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
              <span style={{ display: 'block', width: '100%' }}>{button}</span>
            </Tooltip>
          ) : (
            button
          )}
        </PrimaryOption>
      </PrimaryOptionWrapper>
    </PrimaryContainer>
  )
}
