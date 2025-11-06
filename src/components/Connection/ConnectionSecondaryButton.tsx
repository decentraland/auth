import React from 'react'
import { SecondaryOptionButton, ShowMoreSecondaryOptions } from './ConnectionSecondaryButton.styled'
import { ConnectionOption } from './ConnectionOption'
import { ConnectionOptionType } from './Connection.types'

export type ConnectionSecondaryButtonProps = {
  options: ConnectionOptionType[]
  tooltipDirection?: 'top center' | 'bottom center'
  testId?: string
  loadingOption?: ConnectionOptionType
  onConnect: (wallet: ConnectionOptionType) => unknown
}

export const ConnectionSecondaryButton = ({
  options,
  tooltipDirection = 'top center',
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

