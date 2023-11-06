import { ethers } from 'ethers'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { getIdentity, storeIdentity } from '@dcl/single-sign-on-client'
import { connection, ConnectionResponse, Provider } from 'decentraland-connect'
import { config } from '../../../modules/config'
import { ConnectionOptionType } from '../../Connection'

const ONE_MONTH_IN_MINUTES = 60 * 24 * 30

const MAGIC_KEY = config.get('MAGIC_KEY')

export function fromConnectionOptionToProviderType(connectionType: ConnectionOptionType) {
  switch (connectionType) {
    case ConnectionOptionType.DISCORD:
    case ConnectionOptionType.X:
    case ConnectionOptionType.GOOGLE:
    case ConnectionOptionType.APPLE:
      return ProviderType.MAGIC
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

export async function connectToProvider(connectionOption: ConnectionOptionType): Promise<ConnectionResponse> {
  const providerType = fromConnectionOptionToProviderType(connectionOption)
  if (ProviderType.MAGIC === providerType) {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { Magic } = await import('magic-sdk')
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { OAuthExtension } = await import('@magic-ext/oauth')
    const magic = new Magic(MAGIC_KEY, {
      extensions: [new OAuthExtension()]
    })

    const url = new URL(window.location.href)
    url.pathname = '/callback'

    await magic.oauth.loginWithRedirect({
      provider: connectionOption,
      redirectURI: url.href
    })
  }
  const connectionData = await connection.connect(providerType as any)
  if (!connectionData.account || !connectionData.provider) {
    throw new Error('Could not get provider')
  }

  return connectionData
}

export async function getSignature(address: string, provider: Provider): Promise<AuthIdentity> {
  let identity: AuthIdentity

  const ssoIdentity: AuthIdentity | null = (await getIdentity(address)) && null

  if (!ssoIdentity) {
    identity = await generateIdentity(address, provider)
    await storeIdentity(address, identity)
  } else {
    identity = ssoIdentity
  }

  return identity
}
