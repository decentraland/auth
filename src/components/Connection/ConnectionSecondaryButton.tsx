import { useTranslation } from '@dcl/hooks'
import { shouldDisableMetaMask } from './Connection.utils'
import { ConnectionOption } from './ConnectionOption'
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

  return (
    <ShowMoreSecondaryOptions data-testid={testId}>
      {options.map(option => {
        const isMetamaskDisabled = shouldDisableMetaMask(option)
        const error = isMetamaskDisabled ? t('connection.metamask_not_installed') : undefined

        return (
          <SecondaryOptionButton key={option}>
            <ConnectionOption
              showTooltip
              tooltipPosition={tooltipDirection}
              type={option}
              onClick={onConnect}
              testId={testId}
              loading={loadingOption === option}
              disabled={!!loadingOption || isMetamaskDisabled}
              info={error}
            />
          </SecondaryOptionButton>
        )
      })}
    </ShowMoreSecondaryOptions>
  )
}
