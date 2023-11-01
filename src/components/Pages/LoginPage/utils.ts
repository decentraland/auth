import { ethers } from 'ethers'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { getIdentity, storeIdentity } from '@dcl/single-sign-on-client'
import { Provider } from 'decentraland-connect'
import { ConnectionOptionType } from '../../Connection'

const ONE_MONTH_IN_MINUTES = 60 * 24 * 30

export function toConnectionOptionToProviderType(connectionType: ConnectionOptionType) {
  switch (connectionType) {
    case ConnectionOptionType.DISCORD:
    case ConnectionOptionType.X:
    case ConnectionOptionType.GOOGLE:
    case ConnectionOptionType.APPLE:
      return ProviderType.MAGIC
    case ConnectionOptionType.WALLET_CONNECT:
    case ConnectionOptionType.METAMASK_MOBILE:
      return ProviderType.WALLET_CONNECT_V2
    case ConnectionOptionType.WALLET_LINK:
      return ProviderType.WALLET_LINK
    case ConnectionOptionType.FORTMATIC:
      return ProviderType.FORTMATIC
    case ConnectionOptionType.METAMASK:
    case ConnectionOptionType.DAPPER:
    case ConnectionOptionType.SAMSUNG:
    case ConnectionOptionType.COINBASE:
      return ProviderType.INJECTED
    default:
      throw new Error('Invalid provider')
  }
}

async function generateIdentity(address: string, provider: Provider): Promise<AuthIdentity> {
  // const eth: ethers.BrowserProvider = await getEth()
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
