import { ConnectionOptionType } from './Connection.types'

type ConnectionPrimaryButtonProps = {
  option: ConnectionOptionType
  testId?: string
  loadingOption?: ConnectionOptionType
  isNewUser?: boolean
  onConnect: (wallet: ConnectionOptionType) => unknown
}

export type { ConnectionPrimaryButtonProps }
