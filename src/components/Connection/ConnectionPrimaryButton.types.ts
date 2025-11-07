import React from 'react'
import { ConnectionOptionType } from './Connection.types'

export type ConnectionPrimaryButtonI18N = {
  accessWith: (option: ConnectionOptionType) => React.ReactNode
  connectWith: (option: ConnectionOptionType) => React.ReactNode
  socialMessage: (by: React.ReactNode) => React.ReactNode
  web3Message: (learnMore: (element: React.ReactNode) => React.ReactNode) => React.ReactNode
}

export type ConnectionPrimaryButtonProps = {
  option: ConnectionOptionType
  testId?: string
  loadingOption?: ConnectionOptionType
  i18n: ConnectionPrimaryButtonI18N
  isNewUser?: boolean
  onConnect: (wallet: ConnectionOptionType) => unknown
}
