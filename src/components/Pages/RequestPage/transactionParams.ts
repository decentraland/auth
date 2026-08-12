const describeType = (value: unknown): string => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value)

/**
 * Reads the destination address out of an `eth_sendTransaction` request's params.
 *
 * Deliberately throws instead of coercing. This feeds the transaction-approval flow, so params
 * that do not arrive in the expected shape must stop the approval rather than be reconstructed
 * from whatever the caller sent.
 *
 * The two failure modes are reported separately because they point at different culprits: a first
 * param that is not an object means the caller serialised its payload, while a well-formed object
 * without a `to` means the request itself is incomplete. Conflating them produced a message that
 * blamed a missing contract address while printing a payload that visibly contained one.
 */
export function getTransactionToAddress(params: unknown[] | undefined): string {
  const [txParams] = params ?? []

  if (txParams === null || typeof txParams !== 'object' || Array.isArray(txParams)) {
    throw new Error(`Transaction parameters must be an object, received ${describeType(txParams)}: ${JSON.stringify(txParams ?? null)}`)
  }

  const toAddress = (txParams as Record<string, unknown>).to

  if (typeof toAddress !== 'string' || toAddress.length === 0) {
    throw new Error(`Transaction parameters are missing a "to" address: ${JSON.stringify(txParams)}`)
  }

  return toAddress
}
