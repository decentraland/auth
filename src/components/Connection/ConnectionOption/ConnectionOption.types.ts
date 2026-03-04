import type { TooltipProps } from 'decentraland-ui2'
import { ConnectionOptionType } from '../Connection.types'

export type ConnectionIconProps = {
  type: ConnectionOptionType
  className?: string
  info?: string
  showTooltip?: boolean
  testId?: string
  tooltipPosition?: TooltipProps['placement']
  children?: React.ReactNode
  disabled?: boolean
  loading?: boolean
  onClick: (type: ConnectionOptionType) => void
}
