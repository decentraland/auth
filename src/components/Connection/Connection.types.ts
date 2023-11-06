export enum ConnectionOptionType {
  METAMASK = 'metamask',
  DAPPER = 'dapper',
  FORTMATIC = 'fortmatic',
  COINBASE = 'coinbase',
  SAMSUNG = 'samsung-blockchain-wallet',
  WALLET_CONNECT = 'wallet-connect',
  WALLET_LINK = 'wallet-link',
  METAMASK_MOBILE = 'metamask-mobile',
  GOOGLE = 'google',
  APPLE = 'apple',
  DISCORD = 'discord',
  X = 'x'
}

export type ConnectionI18N = {
  title: React.ReactNode
  subtitle: React.ReactNode
  accessWith: (option: ConnectionOptionType) => React.ReactNode
  connectWith: (option: ConnectionOptionType) => React.ReactNode
  moreOptions: React.ReactNode
  socialMessage: (by: React.ReactNode) => React.ReactNode
  web3Message: (learnMore: (element: React.ReactNode) => React.ReactNode) => React.ReactNode
}

export type ConnectionProps = {
  i18n?: ConnectionI18N
  socialOptions?: {
    primary: ConnectionOptionType
    secondary: ConnectionOptionType[]
  }
  web3Options?: {
    primary: ConnectionOptionType
    secondary: ConnectionOptionType[]
  }
  className?: string
  onConnect: (wallet: ConnectionOptionType) => unknown
  onLearnMore: () => unknown
}
