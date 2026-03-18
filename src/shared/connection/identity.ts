import { createWalletClient, custom } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { localStorageGetIdentity, localStorageStoreIdentity } from '@dcl/single-sign-on-client'
import { Provider } from 'decentraland-connect'

const ONE_MONTH_IN_MINUTES = 60 * 24 * 30

type SignMessageFn = (message: string) => Promise<string>

function isValidIdentity(identity: AuthIdentity): boolean {
  const { privateKey, publicKey, address } = identity.ephemeralIdentity
  const hexPattern = /^0x[0-9a-fA-F]+$/
  return (
    hexPattern.test(privateKey) &&
    privateKey.length === 66 &&
    hexPattern.test(publicKey) &&
    publicKey.length === 132 &&
    hexPattern.test(address) &&
    address.length === 42
  )
}

async function generateIdentityWithSigner(address: string, signMessage: SignMessageFn): Promise<AuthIdentity> {
  const privateKey = generatePrivateKey()
  const ephemeralAccount = privateKeyToAccount(privateKey)

  const payload = {
    address: ephemeralAccount.address,
    publicKey: ephemeralAccount.publicKey,
    privateKey: privateKey
  }

  return Authenticator.initializeAuthChain(address, payload, ONE_MONTH_IN_MINUTES, signMessage)
}

async function generateIdentity(address: string, provider: Provider): Promise<AuthIdentity> {
  const walletClient = createWalletClient({
    chain: mainnet,
    transport: custom(provider)
  })
  const [account] = await walletClient.getAddresses()

  if (!account) {
    throw new Error('No account found in wallet provider')
  }

  return generateIdentityWithSigner(address, message => walletClient.signMessage({ account, message }))
}

/**
 * Retrieves a cached identity from localStorage and validates its structure.
 * Returns undefined if no identity is cached or if it is structurally invalid
 * (e.g. double-encoded hex keys).
 */
function getCachedIdentity(address: string): AuthIdentity | undefined {
  const cached = localStorageGetIdentity(address)
  if (!cached || !isValidIdentity(cached)) {
    return undefined
  }
  return cached
}

async function getIdentitySignature(address: string, provider: Provider): Promise<AuthIdentity> {
  const cached = getCachedIdentity(address)
  if (cached) {
    return cached
  }

  const identity = await generateIdentity(address, provider)
  localStorageStoreIdentity(address, identity)
  return identity
}

export { getIdentitySignature, isValidIdentity, getCachedIdentity }
