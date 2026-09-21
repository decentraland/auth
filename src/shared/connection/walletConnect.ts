/**
 * WalletConnect does not forward every RPC method to the wallet.
 *
 * `@walletconnect/universal-provider` relays a method over the session only when the namespace
 * the wallet *approved* lists it, and silently falls back to a public JSON-RPC node otherwise:
 *
 *   return this.namespace.methods.includes(request.method)
 *     ? await this.client.request(...)   // reaches the wallet
 *     : this.getHttpProvider().request(...)  // a node, which can never sign
 *
 * A node answering `personal_sign` fails without the wallet ever showing a prompt, so the login
 * looks like the user ignored a confirmation that was never displayed. These helpers let us
 * detect that up front and fail with something the user can act on.
 */

const EIP155_NAMESPACE = 'eip155'
const PERSONAL_SIGN_METHOD = 'personal_sign'

type SessionNamespace = { methods?: unknown }
type WalletConnectSession = { namespaces?: Record<string, SessionNamespace> }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

/**
 * Finds the live WalletConnect session on a provider.
 *
 * `decentraland-connect` hands us the provider wrapped by its `ProviderAdapter`, which spreads
 * the original object and therefore drops prototype getters such as `session`. The underlying
 * `signer` (the universal provider) survives as an own property, so it is checked as well.
 */
function getWalletConnectSession(provider: unknown): WalletConnectSession | undefined {
  if (!isRecord(provider)) {
    return undefined
  }

  const candidates = [provider.session, isRecord(provider.signer) ? provider.signer.session : undefined]

  return candidates.find((candidate): candidate is WalletConnectSession => isRecord(candidate) && isRecord(candidate.namespaces))
}

/**
 * Returns the methods the wallet approved for the `eip155` namespace, or undefined when the
 * provider is not a WalletConnect one (or does not expose a readable session).
 *
 * Namespaces may be keyed by namespace (`eip155`) or by chain (`eip155:1`), so every matching
 * key is merged.
 */
function getApprovedEip155Methods(provider: unknown): string[] | undefined {
  const namespaces = getWalletConnectSession(provider)?.namespaces
  if (!namespaces) {
    return undefined
  }

  const methods = Object.entries(namespaces)
    .filter(([key]) => key === EIP155_NAMESPACE || key.startsWith(`${EIP155_NAMESPACE}:`))
    .flatMap(([, namespace]) => (Array.isArray(namespace?.methods) ? namespace.methods : []))
    .filter((method): method is string => typeof method === 'string')

  return methods.length > 0 ? [...new Set(methods)] : undefined
}

/**
 * Whether a `personal_sign` request will actually reach the wallet.
 *
 * Fails open: anything we cannot read positively (a non-WalletConnect provider, an empty method
 * list, a future change in the provider's shape) is treated as supported, so this can only ever
 * reject a session we know cannot sign.
 */
function canRelayPersonalSign(provider: unknown): boolean {
  const methods = getApprovedEip155Methods(provider)
  return methods === undefined || methods.includes(PERSONAL_SIGN_METHOD)
}

/**
 * What `UniversalProvider.request()` throws when it has no session: every call is guarded by
 * `if (!this.session) throw new Error('Please call connect() before request()')`.
 */
const MISSING_SESSION_MESSAGE = 'please call connect() before request()'

function isMissingSessionError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes(MISSING_SESSION_MESSAGE)
}

type RequestingProvider = { request: (args: { method: string }) => Promise<unknown> }

function canRequest(provider: unknown): provider is RequestingProvider {
  return isRecord(provider) && typeof provider.request === 'function'
}

/**
 * Whether a WalletConnect connection can actually be used.
 *
 * The account and the session are persisted separately, so a connection can come back reporting an
 * address while its session is gone. Signing with that provider fails locally, before anything is
 * sent to the wallet, which the user experiences as the page claiming they did not confirm a
 * prompt that was never shown.
 *
 * `eth_chainId` is resolved by the provider itself, so this costs no relay round trip — it only
 * reaches the guard above. Fails open: any other error (and a provider we cannot probe) counts as
 * live, so this can only ever reject a session we know is missing.
 */
async function hasLiveWalletConnectSession(provider: unknown): Promise<boolean> {
  if (!canRequest(provider)) {
    return true
  }

  try {
    await provider.request({ method: 'eth_chainId' })
    return true
  } catch (error) {
    return !isMissingSessionError(error)
  }
}

export { canRelayPersonalSign, getApprovedEip155Methods, hasLiveWalletConnectSession, isMissingSessionError }
