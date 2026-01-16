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
  EMAIL = 'email'
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
  [ConnectionOptionType.EMAIL]: 'Email'
}

export type MetamaskEthereumWindow = typeof window.ethereum & { isMetaMask?: boolean }

export type ConnectionI18N = {
  title: React.ReactNode
  titleNewUser: React.ReactNode
  subtitle: React.ReactNode
  accessWith: (option: ConnectionOptionType) => React.ReactNode
  connectWith: (option: ConnectionOptionType) => React.ReactNode
  moreOptions: React.ReactNode
  socialMessage: (by: React.ReactNode) => React.ReactNode
  web3Message: (learnMore: (element: React.ReactNode) => React.ReactNode) => React.ReactNode
}

export type ConnectionProps = {
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

/**
 * Parses a provider string into a ConnectionOptionType enum value.
 * Handles various formats: 'google', 'wallet-connect', 'walletconnect', 'wallet_connect', etc.
 * @returns The corresponding ConnectionOptionType or null if not found.
 */
export const parseConnectionOptionType = (provider: string | null): ConnectionOptionType | null => {
  if (!provider) return null

  const normalized = provider.toLowerCase().trim()

  // Direct match with enum values
  const enumValues = Object.values(ConnectionOptionType) as string[]
  if (enumValues.includes(normalized)) {
    return normalized as ConnectionOptionType
  }

  // Handle aliases and variations (using Map to avoid naming convention issues)
  const aliases = new Map<string, ConnectionOptionType>([
    ['walletconnect', ConnectionOptionType.WALLET_CONNECT],
    ['wallet_connect', ConnectionOptionType.WALLET_CONNECT],
    ['metamaskmobile', ConnectionOptionType.METAMASK_MOBILE],
    ['metamask_mobile', ConnectionOptionType.METAMASK_MOBILE],
    ['walletlink', ConnectionOptionType.WALLET_LINK],
    ['wallet_link', ConnectionOptionType.WALLET_LINK],
    ['twitter', ConnectionOptionType.X],
    ['samsung', ConnectionOptionType.SAMSUNG]
  ])

  return aliases.get(normalized) ?? null
}
