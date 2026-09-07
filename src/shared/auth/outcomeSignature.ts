import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { OutcomeError } from './types'

type OutcomeToSign = { sender: string; result?: unknown; error?: OutcomeError; expiresAt: number }

/** Wire format shared with auth-server. Sort JSON object keys; retain array order and string case. */
function canonicalJson(value: unknown, depth = 0): string {
  if (depth > 64) throw new Error('Outcome is too deeply nested')
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item, depth + 1)).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key], depth + 1)}`)
      .join(',')}}`
  }
  const json = JSON.stringify(value)
  if (json === undefined) throw new Error('Outcome must be JSON serializable')
  return json
}

/** Domain-separated signature over the request id and every transmitted outcome field. */
function getOutcomeSignaturePayload(requestId: string, outcome: OutcomeToSign): string {
  return `decentraland-auth-outcome-v1\n${canonicalJson({ requestId, ...outcome })}`
}

class OutcomeIdentityError extends Error {
  constructor() {
    super('A valid identity for the approving account is required to report this request. Please log in again.')
  }
}

/** Fail before wallet execution if no matching, unexpired delegated identity is available. */
function assertOutcomeIdentity(identity: AuthIdentity | undefined, sender: string): asserts identity is AuthIdentity {
  if (
    !identity ||
    !Number.isFinite(new Date(identity.expiration).getTime()) ||
    new Date(identity.expiration).getTime() <= Date.now() ||
    Authenticator.ownerAddress(identity.authChain).toLowerCase() !== sender.toLowerCase()
  )
    throw new OutcomeIdentityError()
}

/** Signs using the existing ephemeral key; never asks the wallet to sign or sends private keys. */
function signOutcome(
  identity: AuthIdentity | undefined,
  requestId: string,
  sender: string,
  answer: { result: unknown } | { error: OutcomeError }
) {
  assertOutcomeIdentity(identity, sender)
  // Normalize exactly as the HTTP JSON encoder will, before deriving the signed payload.
  const outcome = JSON.parse(JSON.stringify({ sender, ...answer, expiresAt: Date.now() + 60_000 })) as OutcomeToSign
  if (!('result' in outcome) && !('error' in outcome)) throw new Error('Outcome is missing its result or error')
  return { ...outcome, authChain: Authenticator.signPayload(identity, getOutcomeSignaturePayload(requestId, outcome)) }
}

export { getOutcomeSignaturePayload, OutcomeIdentityError, assertOutcomeIdentity, signOutcome }
export type { OutcomeToSign }
