enum SignInOptionsMode {
  FULL = 'FULL',
  ONE = 'ONE',
  TWO = 'TWO'
}

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

type ConnectionProps = {
  shouldShowGoogleOptionAsPrimary?: boolean
  connectionOptions?: {
    primary: ConnectionOptionType
    secondary?: ConnectionOptionType
    extraOptions?: ConnectionOptionType[]
  }
  className?: string
  loadingOption?: ConnectionOptionType
  isNewUser?: boolean
  signInOptionsMode?: SignInOptionsMode
  isEmailLoading?: boolean
  emailError?: string | null
  onConnect: (wallet: ConnectionOptionType) => unknown
  onEmailSubmit?: (email: string) => void
  onEmailChange?: () => void
}

export { SignInOptionsMode, ConnectionOptionType, connectionOptionTitles }
export type { MetamaskEthereumWindow, ConnectionProps }
