enum ConnectionOptionType {
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
  EMAIL = 'email'
}

const connectionOptionTitles: { [key in ConnectionOptionType]: string } = {
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
  [ConnectionOptionType.EMAIL]: 'Email'
}

type MetamaskEthereumWindow = typeof window.ethereum & { isMetaMask?: boolean }

type ConnectionI18N = {
  title: React.ReactNode
  titleNewUser: React.ReactNode
  subtitle: React.ReactNode
  accessWith: (option: ConnectionOptionType) => React.ReactNode
  connectWith: (option: ConnectionOptionType) => React.ReactNode
  moreOptions: React.ReactNode
  socialMessage: (by: React.ReactNode) => React.ReactNode
  web3Message: (learnMore: (element: React.ReactNode) => React.ReactNode) => React.ReactNode
}

type ConnectionProps = {
  i18n?: ConnectionI18N
  connectionOptions?: {
    primary: ConnectionOptionType
    secondary?: ConnectionOptionType
    extraOptions?: ConnectionOptionType[]
  }
  className?: string
  loadingOption?: ConnectionOptionType
  isNewUser?: boolean
  isEmailLoading?: boolean
  emailError?: string | null
  onConnect: (wallet: ConnectionOptionType) => unknown
  onEmailSubmit?: (email: string) => void
}

export { ConnectionOptionType, connectionOptionTitles }
export type { MetamaskEthereumWindow, ConnectionI18N, ConnectionProps }
