import { isRecord } from '../utils/isRecord'
import { MalformedRequestError } from './errors'
import { RecoverResponse } from './types'

/**
 * The recovered request is the other input this page reads straight out of JSON (see simulationResponse
 * for the preview's). Two of its fields are not description but authorization:
 *
 * - `sender` is what binds the request to the account about to answer it. The comparison that enforces
 *   that used to run only when the field was there, so a request without one was answered by whoever had
 *   the page open.
 * - `expiration` is what stops a request being answerable forever. The comparison ran only when the field
 *   was there and only on a date that parsed, and the timer that shows the timeout screen was skipped when
 *   the date did not parse — so both an absent and an unreadable expiration meant no expiry at all.
 *
 * Neither is safe to read as "unrestricted". auth-server sends both on every request and validates them,
 * but that is its promise to keep, not something the client should be unable to notice the absence of: the
 * checks exist precisely for the case where what arrives is not what was meant. So the fields are required
 * here, at the boundary, and a response missing either is refused rather than reviewed.
 *
 * `method` and `params` are checked by the guards that follow this one (see signMethodGuard); this asserts
 * only what they assume — that the response is an object of the declared shape.
 */

/** A 20-byte hex address, the only form the account comparison can be made against. */
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

/**
 * Upper bound on the strings read here, so a response cannot make the checks themselves expensive. Both
 * fields are fixed-length by definition — an address is 42 characters, an ISO timestamp under 40 — so
 * this is far above anything a conforming server sends.
 */
const MAX_FIELD_LENGTH = 256

const isBoundedString = (value: unknown): value is string => typeof value === 'string' && value.length <= MAX_FIELD_LENGTH

/**
 * Narrows a recover response to the shape the review depends on, throwing {@link MalformedRequestError}
 * for anything else. `reason` names the rule that was broken and is safe to display.
 */
function assertRecoverResponseIsCanonical(body: unknown, requestId: string): asserts body is RecoverResponse {
  const refuse = (reason: string): never => {
    throw new MalformedRequestError(requestId, reason)
  }
  if (!isRecord(body)) {
    return refuse('the response is not an object')
  }
  if (!isBoundedString(body.method)) {
    return refuse('it names no method')
  }
  if (body.params !== undefined && !Array.isArray(body.params)) {
    return refuse('its parameters are not a list')
  }
  if (!isBoundedString(body.sender) || !ADDRESS_PATTERN.test(body.sender)) {
    // Without an address to compare, nothing binds this request to the account that would answer it.
    return refuse('it names no account to be answered by')
  }
  if (!isBoundedString(body.expiration) || Number.isNaN(new Date(body.expiration).getTime())) {
    // Without a readable expiration, the request would never expire and the timeout screen would never show.
    return refuse('it carries no readable expiration')
  }
}

export { assertRecoverResponseIsCanonical }
