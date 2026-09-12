import { ErrorCode, MetaTransactionError, Provider } from 'decentraland-transactions'
import { isErrorWithMessage, isUserRejectedTransaction } from '../errors'
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

/** Stops relay preparation once the review that authorized it is no longer valid. */
class ReviewedRequestInvalidatedError extends MetaTransactionError {
  readonly skipReporting = true

  constructor() {
    super('The request review is no longer valid', ErrorCode.UNKNOWN)
    Object.setPrototypeOf(this, ReviewedRequestInvalidatedError.prototype)
    this.name = 'ReviewedRequestInvalidatedError'
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
 * The optional synchronous `beforeSigning` hook may refuse a review invalidated during the library's
 * asynchronous preparation, immediately before any signing or transaction request reaches the wallet.
 */
function bindProviderToSigner(provider: Provider, signer: string, beforeSigning?: () => void): Provider {
  const expected = signer.toLowerCase()
  const isSigner = (value: unknown): boolean => typeof value === 'string' && value.toLowerCase() === expected
  const mismatch = (value: unknown): ReviewedSignerMismatchError =>
    new ReviewedSignerMismatchError(signer, typeof value === 'string' ? value : null)

  // Every provider the page connects exposes EIP-1193 `request` (decentraland-connect adapts the legacy
  // shapes). Anything else is refused loudly rather than forwarded through a path this binding does not read.
  if (!('request' in provider) || typeof provider.request !== 'function') {
    throw new Error('The provider has no EIP-1193 request method')
  }
  const forward = (args: RpcArguments): Promise<unknown> =>
    (provider as { request: (args: RpcArguments) => Promise<unknown> }).request(args)

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
      // The relay performs asynchronous RPC reads before asking for a signature. Revalidate consent at
      // the actual wallet boundary, synchronously with forwarding, rather than when those reads began.
      if (signerIndex !== undefined || args.method === 'eth_sendTransaction') beforeSigning?.()
      let data: unknown
      try {
        data = await forward(args)
      } catch (error) {
        // The relay library preserves its own errors but replaces other error codes with "unknown".
        // Preserve wallet cancellation before that boundary, independently of the wallet's wording.
        if (isUserRejectedTransaction(error)) {
          throw new MetaTransactionError(isErrorWithMessage(error) ? error.message : 'User rejected the request.', ErrorCode.USER_DENIED)
        }
        throw error
      }
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

export { ReviewedRequestInvalidatedError, ReviewedSignerMismatchError, bindProviderToSigner }
