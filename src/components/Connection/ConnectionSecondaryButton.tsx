import { ConnectionOption } from './ConnectionOption'
import { SecondaryOptionButton, ShowMoreSecondaryOptions } from './ConnectionSecondaryButton.styled'
import { ConnectionSecondaryButtonProps } from './ConnectionSecondaryButton.types'

export const ConnectionSecondaryButton = ({
  options,
  tooltipDirection = 'top',
  testId,
  loadingOption,
  onConnect
}: ConnectionSecondaryButtonProps): JSX.Element => (
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
