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
  X = 'x',
  FACEBOOK = 'facebook'
}

export const connectionOptionTitles: { [key in ConnectionOptionType]: string } = {
  [ConnectionOptionType.METAMASK]: 'MetaMask',
  [ConnectionOptionType.DAPPER]: 'Dapper',
  [ConnectionOptionType.FORTMATIC]: 'Fortmatic',
  [ConnectionOptionType.COINBASE]: 'Coinbase',
  [ConnectionOptionType.SAMSUNG]: 'Samsung Blockchain Wallet',
  [ConnectionOptionType.WALLET_CONNECT]: 'WalletConnect',
  [ConnectionOptionType.WALLET_LINK]: 'WalletLink',
  [ConnectionOptionType.METAMASK_MOBILE]: 'MetaMask Mobile',
  [ConnectionOptionType.GOOGLE]: 'Google',
  [ConnectionOptionType.APPLE]: 'Apple',
  [ConnectionOptionType.DISCORD]: 'Discord',
  [ConnectionOptionType.X]: 'X',
  [ConnectionOptionType.FACEBOOK]: 'Facebook'
}

export type MetamaskEthereumWindow = typeof window.ethereum & { isMetaMask?: boolean }

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
  loadingOption?: ConnectionOptionType
  onConnect: (wallet: ConnectionOptionType) => unknown
  onLearnMore: (type?: ConnectionOptionType) => unknown
}
