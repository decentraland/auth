import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import { isSocialLogin } from '../Pages/LoginPage/utils'
import { ConnectionIcon } from './ConnectionIcon'
import {
  PrimaryContainer,
  PrimaryOption,
  PrimaryOptionWrapper,
  PrimaryButton,
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

  const children = <>{isSocialLogin(option) ? i18n.accessWith(option) : i18n.connectWith(option)}</>
  const isLoading = loadingOption === option

  return (
    <PrimaryContainer data-testid={testId}>
      <PrimaryOptionWrapper>
        <PrimaryOption>
          <PrimaryButton
            data-testid={testId ? `${testId}-${option}-button` : undefined}
            startIcon={!isLoading && <ConnectionIcon type={option} />}
            disabled={!!loadingOption || !!error}
            onClick={() => onConnect(option)}
            isNewUser={isNewUser}
          >
            <PrimaryButtonWrapper isNewUser={isNewUser}>
              {children}
              {isNewUser && <NavigateNextRoundedIcon fontSize="large" />}
            </PrimaryButtonWrapper>
          </PrimaryButton>
        </PrimaryOption>
      </PrimaryOptionWrapper>
    </PrimaryContainer>
  )
}
