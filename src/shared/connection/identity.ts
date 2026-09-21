import { createWalletClient, custom, getAddress } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { localStorageGetIdentity, localStorageStoreIdentity } from '@dcl/single-sign-on-client'
import { Provider } from 'decentraland-connect'
import { WalletSignatureUnsupportedError } from '../errors'
import { canRelayPersonalSign } from './walletConnect'

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

async function generateIdentityWithSigner(
  address: string,
  signMessage: SignMessageFn,
  expirationInMinutes: number = ONE_MONTH_IN_MINUTES
): Promise<AuthIdentity> {
  const privateKey = generatePrivateKey()
  const ephemeralAccount = privateKeyToAccount(privateKey)

  const payload = {
    address: ephemeralAccount.address,
    publicKey: ephemeralAccount.publicKey,
    privateKey: privateKey
  }

  return Authenticator.initializeAuthChain(address, payload, expirationInMinutes, signMessage)
}

async function generateIdentity(
  address: string,
  provider: Provider,
  expirationInMinutes: number = ONE_MONTH_IN_MINUTES
): Promise<AuthIdentity> {
  if (!canRelayPersonalSign(provider)) {
    throw new WalletSignatureUnsupportedError()
  }

  const walletClient = createWalletClient({
    chain: mainnet,
    transport: custom(provider)
  })

  // Sign with the account the connection was established with instead of re-reading it from
  // `eth_accounts`. That call is not a round trip to the wallet on WalletConnect: the universal
  // provider answers it from the approved session and filters the accounts by the chain it is
  // currently on, so it comes back empty whenever the two disagree — aborting the login before
  // the wallet is ever asked to sign. It is also the address the auth chain is built with, so
  // signing with anything else would produce an identity that fails validation.
  // `getAddress` both validates the shape and normalizes the casing. Callers pass the connected
  // account in whatever casing they hold it — the mobile flows lowercase it first — while providers
  // report it checksummed, and this keeps the value on the wire the one the provider itself gave
  // us instead of making each wallet's casing tolerance part of whether login works. A malformed
  // address fails here, with viem naming it, rather than as an opaque RPC error later. The auth
  // chain still gets the address exactly as it was passed in.
  const signerAccount = getAddress(address)

  return generateIdentityWithSigner(address, message => walletClient.signMessage({ account: signerAccount, message }), expirationInMinutes)
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

// Always generates a fresh ephemeral and overwrites any existing identity in SSO storage.
// Rotating the ephemeral on every sign-in is the only signal cross-domain consumers
// (e.g. dapps reading SSO storage) have to detect "the user just re-signed in with this
// wallet". Short-circuiting on a cached identity makes that detection impossible because
// storage looks identical before and after.
async function getIdentitySignature(
  address: string,
  provider: Provider,
  expirationInMinutes: number = ONE_MONTH_IN_MINUTES
): Promise<AuthIdentity> {
  const identity = await generateIdentity(address, provider, expirationInMinutes)
  localStorageStoreIdentity(address, identity)
  return identity
}

export { getIdentitySignature, isValidIdentity, getCachedIdentity, ONE_MONTH_IN_MINUTES }
