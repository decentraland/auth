import { ConnectionOptionType } from './Connection.types'

export type ConnectionSecondaryButtonProps = {
  options: ConnectionOptionType[]
  tooltipDirection?: 'top center' | 'bottom center'
  testId?: string
  loadingOption?: ConnectionOptionType
  onConnect: (wallet: ConnectionOptionType) => unknown
}
