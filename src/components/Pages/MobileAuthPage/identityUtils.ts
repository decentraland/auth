import { createWalletClient, custom } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { localStorageGetIdentity, localStorageStoreIdentity } from '@dcl/single-sign-on-client'
import { Provider } from 'decentraland-connect'

const ONE_MONTH_IN_MINUTES = 60 * 24 * 30

type SignMessageFn = (message: string) => Promise<string>

async function generateIdentityWithSigner(address: string, signMessage: SignMessageFn): Promise<AuthIdentity> {
  const privateKey = generatePrivateKey()
  const ephemeralAccount = privateKeyToAccount(privateKey)

  const payload = {
    address: ephemeralAccount.address,
    publicKey: ephemeralAccount.publicKey,
    privateKey: privateKey
  }

  return Authenticator.initializeAuthChain(address, payload, ONE_MONTH_IN_MINUTES * 3, signMessage)
}

async function generateIdentity(address: string, provider: Provider): Promise<AuthIdentity> {
  const walletClient = createWalletClient({
    chain: mainnet,
    transport: custom(provider)
  })
  const [account] = await walletClient.getAddresses()

  return generateIdentityWithSigner(address, message => walletClient.signMessage({ account, message }))
}

export async function getIdentitySignature(address: string, provider: Provider): Promise<AuthIdentity> {
  const ssoIdentity = localStorageGetIdentity(address)

  if (ssoIdentity) {
    return ssoIdentity
  }

  const identity = await generateIdentity(address, provider)
  localStorageStoreIdentity(address, identity)
  return identity
}
