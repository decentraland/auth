import { useTranslation } from '@dcl/hooks'
import { ConnectionOption } from './ConnectionOption'
import { ConnectionOptionType, MetamaskEthereumWindow } from './Connection.types'
import { ConnectionSecondaryButtonProps } from './ConnectionSecondaryButton.types'
import { SecondaryOptionButton, ShowMoreSecondaryOptions } from './ConnectionSecondaryButton.styled'

export const ConnectionSecondaryButton = ({
  options,
  tooltipDirection = 'top',
  testId,
  loadingOption,
  onConnect
}: ConnectionSecondaryButtonProps): JSX.Element => {
  const { t } = useTranslation()
  const isMetamaskAvailable = (window.ethereum as MetamaskEthereumWindow)?.isMetaMask

  return (
    <ShowMoreSecondaryOptions data-testid={testId}>
      {options.map(option => {
        const isMetamask = option === ConnectionOptionType.METAMASK
        const shouldDisableMetamask = isMetamask && !isMetamaskAvailable
        const error = shouldDisableMetamask ? t('connection.metamask_not_installed') : undefined

        return (
          <SecondaryOptionButton key={option}>
            <ConnectionOption
              showTooltip
              tooltipPosition={tooltipDirection}
              type={option}
              onClick={onConnect}
              testId={testId}
              loading={loadingOption === option}
              disabled={!!loadingOption || shouldDisableMetamask}
              info={error}
            />
          </SecondaryOptionButton>
        )
      })}
    </ShowMoreSecondaryOptions>
  )
}
