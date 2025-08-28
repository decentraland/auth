import type { PopupProps } from 'semantic-ui-react/dist/commonjs/modules/Popup'
import { ConnectionOptionType } from '../Connection.types'

export type ConnectionIconProps = {
  type: ConnectionOptionType
  className?: string
  info?: string
  showTooltip?: boolean
  testId?: string
  tooltipPosition?: PopupProps['position']
  children?: React.ReactNode
  disabled?: boolean
  loading?: boolean
  onClick: (type: ConnectionOptionType) => void
}
