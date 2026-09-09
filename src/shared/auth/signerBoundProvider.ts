import { ErrorCode, MetaTransactionError, Provider } from 'decentraland-transactions'
import { isRecord } from '../utils/isRecord'

/**
 * Thrown by a signer-bound provider when the wallet names another account than the one that reviewed
 * the request: an account read that returns another account, or a signing request for another one.
 * A `MetaTransactionError` on purpose: decentraland-transactions rethrows those as they are and wraps
 * every other error, so the page can still tell an account switch from a failed relay.
 */
class ReviewedSignerMismatchError extends MetaTransactionError {
  readonly skipReporting = true
  constructor(
    public readonly reviewedSigner: string,
    public readonly activeAccount: string | null
  ) {
    super(
      `The wallet's active account (${activeAccount ?? 'unknown'}) is not the one that reviewed the request (${reviewedSigner})`,
      ErrorCode.UNKNOWN
    )
    // The parent constructor pins the prototype to its own class; restore this one so instanceof can tell them apart.
    Object.setPrototypeOf(this, ReviewedSignerMismatchError.prototype)
    this.name = 'ReviewedSignerMismatchError'
  }
}

type RpcArguments = { method: string; params?: unknown[] }

// The account reads a wallet library makes before signing and submitting for whatever they return.
const ACCOUNT_METHODS: ReadonlySet<string> = new Set(['eth_accounts', 'eth_requestAccounts'])

// Signing methods and the index of the param that names the account they sign for.
const SIGNER_PARAM_INDEX: ReadonlyMap<string, number> = new Map([
  ['eth_signTypedData_v3', 0],
  ['eth_signTypedData_v4', 0],
  ['eth_sign', 0],
  ['personal_sign', 1]
])

/** The JSON-RPC result of a provider response: the `result` of an envelope, or the bare value. */
function unwrapResult(data: unknown): unknown {
  return isRecord(data) && 'result' in data ? data.result : data
}

/**
 * Wraps a wallet provider so that everything it does happens for `signer` and nothing else. An account
 * read that returns another account, a signing request that names another account, or a transaction
 * from another account throws {@link ReviewedSignerMismatchError} instead of proceeding.
 *
 * decentraland-transactions reads the active account again when it relays a transaction and signs and
 * submits for whatever it gets back. A wallet that switched accounts after the page verified the signer
 * would otherwise sign as an account that never saw the request, while the outcome was reported under
 * the one that did. Bound this way, the signer verified at review time is the only one the library can
 * act for, through the signing and the submission steps alike.
 */
function bindProviderToSigner(provider: Provider, signer: string): Provider {
  const expected = signer.toLowerCase()
  const isSigner = (value: unknown): boolean => typeof value === 'string' && value.toLowerCase() === expected
  const mismatch = (value: unknown): ReviewedSignerMismatchError =>
    new ReviewedSignerMismatchError(signer, typeof value === 'string' ? value : null)

  // Forward the way decentraland-transactions itself talks to a provider, so wrapping changes nothing else.
  const forward = (args: RpcArguments): Promise<unknown> => {
    if ('request' in provider && typeof provider.request === 'function') {
      return provider.request(args)
    }
    if (typeof provider.sendAsync === 'function') {
      return provider.sendAsync(args)
    }
    if (typeof provider.send === 'function') {
      return provider.send(args.method, args.params ?? [])
    }
    throw new Error('The provider has no request, sendAsync or send method')
  }

  return {
    request: async (args: RpcArguments): Promise<unknown> => {
      const signerIndex = SIGNER_PARAM_INDEX.get(args.method)
      if (signerIndex !== undefined && !isSigner(args.params?.[signerIndex])) {
        throw mismatch(args.params?.[signerIndex])
      }
      if (args.method === 'eth_sendTransaction') {
        const transaction: unknown = args.params?.[0]
        const from = isRecord(transaction) ? transaction.from : undefined
        if (from !== undefined && !isSigner(from)) {
          throw mismatch(from)
        }
      }
      const data = await forward(args)
      if (ACCOUNT_METHODS.has(args.method)) {
        const accounts = unwrapResult(data)
        const [account] = Array.isArray(accounts) ? accounts : []
        if (!isSigner(account)) {
          throw mismatch(account)
        }
      }
      return data
    }
  }
}

export { ReviewedSignerMismatchError, bindProviderToSigner }
