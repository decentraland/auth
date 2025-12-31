import { ConnectionOptionType } from '../Connection.types'

// We define tooltip positions locally to avoid depending on `semantic-ui-react` types.
// Rationale: `semantic-ui-react` uses `findDOMNode` internally and triggers React 18 deprecation warnings in dev.
export type TooltipPosition =
  | 'top left'
  | 'top center'
  | 'top right'
  | 'bottom left'
  | 'bottom center'
  | 'bottom right'
  | 'left top'
  | 'left center'
  | 'left bottom'
  | 'right top'
  | 'right center'
  | 'right bottom'

export type ConnectionIconProps = {
  type: ConnectionOptionType
  className?: string
  info?: string
  showTooltip?: boolean
  testId?: string
  tooltipPosition?: TooltipPosition
  children?: React.ReactNode
  disabled?: boolean
  loading?: boolean
  onClick: (type: ConnectionOptionType) => void
}
