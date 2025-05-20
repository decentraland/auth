import type { OAuthProvider } from '@magic-ext/oauth2'
import { ethers } from 'ethers'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { localStorageGetIdentity, localStorageStoreIdentity } from '@dcl/single-sign-on-client'
import { connection, getConfiguration, ConnectionResponse, Provider } from 'decentraland-connect'
import { ConnectionOptionType } from '../../Connection'

const ONE_MONTH_IN_MINUTES = 60 * 24 * 30

export function fromConnectionOptionToProviderType(connectionType: ConnectionOptionType, isTesting?: boolean) {
  switch (connectionType) {
    case ConnectionOptionType.DISCORD:
    case ConnectionOptionType.X:
    case ConnectionOptionType.GOOGLE:
    case ConnectionOptionType.APPLE:
      return isTesting ? ProviderType.MAGIC_TEST : ProviderType.MAGIC
    case ConnectionOptionType.WALLET_CONNECT:
    case ConnectionOptionType.METAMASK_MOBILE:
      return ProviderType.WALLET_CONNECT_V2
    case ConnectionOptionType.COINBASE:
    case ConnectionOptionType.WALLET_LINK:
      return ProviderType.WALLET_LINK
    case ConnectionOptionType.FORTMATIC:
      return ProviderType.FORTMATIC
    case ConnectionOptionType.METAMASK:
    case ConnectionOptionType.DAPPER:
    case ConnectionOptionType.SAMSUNG:
      return ProviderType.INJECTED
    default:
      throw new Error('Invalid provider')
  }
}

async function generateIdentity(address: string, provider: Provider): Promise<AuthIdentity> {
  const browserProvider = new ethers.BrowserProvider(provider)
  const account = ethers.Wallet.createRandom()

  const payload = {
    address: account.address.toString(),
    publicKey: ethers.hexlify(account.publicKey),
    privateKey: ethers.hexlify(account.privateKey)
  }

  const signer = await browserProvider.getSigner()

  return Authenticator.initializeAuthChain(address, payload, ONE_MONTH_IN_MINUTES, message => signer.signMessage(message))
}

export async function connectToSocialProvider(
  connectionOption: ConnectionOptionType,
  isTesting?: boolean,
  redirectTo?: string
): Promise<void> {
  const MAGIC_KEY = isTesting ? getConfiguration().magic_test.apiKey : getConfiguration().magic.apiKey
  const providerType = fromConnectionOptionToProviderType(connectionOption, isTesting)
  if (ProviderType.MAGIC === providerType || ProviderType.MAGIC_TEST === providerType) {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { Magic } = await import('magic-sdk')
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { OAuthExtension } = await import('@magic-ext/oauth2')
    const magic = new Magic(MAGIC_KEY, {
      extensions: [new OAuthExtension()]
    })

    const url = new URL(window.location.href)
    const referrer = url.searchParams.get('referrer')
    url.pathname = '/auth/callback'
    url.search = ''

    await magic?.oauth2.loginWithRedirect({
      provider: connectionOption === ConnectionOptionType.X ? 'twitter' : (connectionOption as OAuthProvider),
      redirectURI: url.href,
      customData: JSON.stringify({ redirectTo, referrer })
    })
  }
}

export async function connectToProvider(connectionOption: ConnectionOptionType): Promise<ConnectionResponse> {
  const providerType = fromConnectionOptionToProviderType(connectionOption)

  let connectionData: ConnectionResponse
  try {
    connectionData = await connection.connect(providerType)
  } catch (error) {
    console.error('Error connecting to provider', error)
    throw error
  }

  if (!connectionData.account || !connectionData.provider) {
    throw new Error('Could not get provider')
  }

  return connectionData
}

export function isSocialLogin(connectionType: ConnectionOptionType): boolean {
  const SOCIAL_LOGIN_TYPES = [ConnectionOptionType.APPLE, ConnectionOptionType.GOOGLE, ConnectionOptionType.X, ConnectionOptionType.DISCORD]
  return SOCIAL_LOGIN_TYPES.includes(connectionType)
}

export async function getIdentitySignature(address: string, provider: Provider): Promise<AuthIdentity> {
  let identity: AuthIdentity

  const ssoIdentity = localStorageGetIdentity(address)

  if (!ssoIdentity) {
    identity = await generateIdentity(address, provider)
    localStorageStoreIdentity(address, identity)
  } else {
    identity = ssoIdentity
  }

  return identity
}

export function isMobile() {
  const userAgent = navigator.userAgent
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
}
