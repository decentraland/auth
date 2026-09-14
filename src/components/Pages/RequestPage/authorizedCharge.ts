import { AuthIdentity } from '@dcl/crypto'
import signedFetch from 'decentraland-crypto-fetch'
import { config } from '../../../modules/config'
import { readTextWithCap } from '../../../shared/http'
import { isRecord } from '../../../shared/utils/isRecord'

// The buyer's own authorization is a small JSON object; anything larger is not it.
const MAX_AUTHORIZATION_BYTES = 8 * 1024
// A purchase screen must not wait on the credits service longer than the user will wait for the screen.
const AUTHORIZATION_FETCH_TIMEOUT_MS = 10_000

/**
 * What the buyer's balance is actually debited for this credit, as the credits-server accounts for it.
 *
 * `cents` is the SUM over every line the salt covers, because that is what the settlement takes: the ledger
 * settles by salt and subtracts each line's own `usd_cents`, so a salt carrying several lines debits all of
 * them at once. `lines` says how many, which is what lets the caller refuse to summarize a group as one
 * purchase.
 */
type AuthorizedCharge = { cents: number; lines: number; status: string }

/**
 * The answer to "what does this credit debit". Three-valued on purpose: an unreachable credits-server is
 * not a zero charge and not a matching one, and reading it as either would put a price on screen that
 * nothing stands behind.
 */
type AuthorizedChargeResult = { status: 'found'; charge: AuthorizedCharge } | { status: 'not_found' } | { status: 'unavailable' }

/**
 * Asks the credits-server what the credit in a signed purchase actually charges the buyer.
 *
 * WHY THIS EXISTS. The signed payload proves what the item costs — the trade's USD-pegged price is inside
 * the bytes — but it does not prove what the purchase takes out of the balance. Those are two different
 * numbers held by two different systems: the credits-server signs a credit for a `value` in MANA and
 * separately records an intent, in cents, against the credit's salt, and it takes the cents from whatever
 * the CLIENT said the item was priced at (`usdPriceCents` on POST /credits/authorize, which that service
 * documents as never verified against the item's real price). Settlement then debits the recorded cents
 * when the salt is seen consumed on chain.
 *
 * So a credit authorized for one amount can be spent on a trade priced at another, and nothing in the bytes
 * would show it: the cap covers the cheaper trade, no MANA comes out of the buyer's own wallet, and the
 * purchase is a single credit against a single trade. The screen would say seven credits while seventy left
 * the balance. The salt is the only thing that ties the two together, and it IS in the signed payload — so
 * the charge is read against it here, and the dedicated approval is shown only when the two numbers agree.
 *
 * Signed as the buyer, because the endpoint answers for one account and only that account may ask.
 */
async function fetchAuthorizedCharge(creditSalt: string, identity: AuthIdentity): Promise<AuthorizedChargeResult> {
  const baseUrl = config.get('CREDITS_SERVER_URL')
  if (!baseUrl) {
    return { status: 'unavailable' }
  }
  let response: Response
  try {
    response = await signedFetch(`${baseUrl}/credits/authorize/${encodeURIComponent(creditSalt)}`, {
      method: 'GET',
      identity,
      signal: AbortSignal.timeout(AUTHORIZATION_FETCH_TIMEOUT_MS)
    })
  } catch {
    // Unreachable, timed out, refused: nothing was learned about the charge.
    return { status: 'unavailable' }
  }
  if (response.status === 404) {
    // The service answered, and it knows no such authorization for this buyer. That is a verdict.
    await response.body?.cancel().catch(() => undefined)
    return { status: 'not_found' }
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    return { status: 'unavailable' }
  }
  let text: string
  try {
    text = await readTextWithCap(response, MAX_AUTHORIZATION_BYTES)
  } catch {
    return { status: 'unavailable' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { status: 'unavailable' }
  }
  if (!isRecord(parsed)) {
    return { status: 'unavailable' }
  }
  const cents = parsed.usdCents
  const lines = parsed.lines
  const status = parsed.status
  // Every field is required and must be the shape it claims. A body missing one of them is a service this
  // page does not understand, which is the same as not having asked.
  //
  // `isSafeInteger`, not `isInteger`: the ledger stores cents as a bigint and this endpoint serializes it
  // through JSON, where anything past 2^53 has already been rounded by the time it is parsed. Such a number
  // is still an integer, so `isInteger` would pass it, and it would then be compared as a bigint against a
  // price it no longer exactly represents. No ordinary price comes near that — this is the guard for a
  // number that should never arrive, and the right answer to one is to have learned nothing.
  if (
    typeof cents !== 'number' ||
    !Number.isSafeInteger(cents) ||
    cents < 0 ||
    typeof lines !== 'number' ||
    !Number.isSafeInteger(lines) ||
    lines < 1 ||
    typeof status !== 'string'
  ) {
    return { status: 'unavailable' }
  }
  return { status: 'found', charge: { cents, lines, status } }
}

// What an authorization that has not been spent or released yet is called in the credits ledger.
const PENDING_INTENT_STATUS = 'pending'

/** Why a purchase may not be priced on screen, for analytics and tests. Never shown to the user. */
type ChargeVerdict = 'verified' | 'unavailable' | 'not_found' | 'not_pending' | 'grouped' | 'mismatch'

/**
 * Whether the credits this purchase will actually cost are the credits the payload says the item is worth.
 *
 * Verified, not trusted, and fail-closed in every direction: a service that cannot answer, an authorization
 * that does not exist, one that is no longer pending, one whose salt pays for more lines than the single
 * trade on screen, or one whose cents differ from the trade's price by so much as one, all resolve to
 * something other than `verified`, and the caller then shows the payload rather than a price.
 */
function verifyAuthorizedCharge(result: AuthorizedChargeResult, expectedCents: bigint): ChargeVerdict {
  if (result.status === 'unavailable') return 'unavailable'
  if (result.status === 'not_found') return 'not_found'
  const { charge } = result
  if (charge.status !== PENDING_INTENT_STATUS) return 'not_pending'
  // One signature, one trade, one item on screen. A salt covering several lines settles all of them at
  // once, and this screen has no way to describe the rest.
  if (charge.lines !== 1) return 'grouped'
  return BigInt(charge.cents) === expectedCents ? 'verified' : 'mismatch'
}

export { fetchAuthorizedCharge, verifyAuthorizedCharge }
export type { AuthorizedCharge, AuthorizedChargeResult, ChargeVerdict }
