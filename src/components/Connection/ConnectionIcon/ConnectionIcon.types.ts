import type { PopupProps } from 'semantic-ui-react/dist/commonjs/modules/Popup'
import { ConnectionOptionType } from '../Connection.types'

export type ConnectionIconProps = {
  type: ConnectionOptionType
  className?: string
  showTooltip?: boolean
  tooltipPosition?: PopupProps['position']
}
