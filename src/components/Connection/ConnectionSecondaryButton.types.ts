import { ConnectionOptionType } from './Connection.types'

export type ConnectionSecondaryButtonProps = {
  options: ConnectionOptionType[]
  tooltipDirection?: 'top' | 'bottom'
  testId?: string
  loadingOption?: ConnectionOptionType
  onConnect: (wallet: ConnectionOptionType) => unknown
}
