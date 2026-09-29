import { toCredits } from './creditsPurchase'

/** A MANA/USD rate as the aggregator reports it: USD per MANA, scaled by 10^decimals. */
type ManaUsdRate = { rate: bigint; decimals: number }

/**
 * How far the charge on the ledger may sit from this page's own conversion of the signed MANA price, in
 * basis points, before the page stops vouching for it.
 *
 * The charge was quoted by the client seconds earlier at the same feed this page reads, so the two only
 * differ by how far MANA moved in between. 2% is the headroom the credits-server itself adds to the MANA cap
 * for exactly that movement (`USD_CREDIT_BUFFER_BPS`): a charge further away than that is not a fresh quote
 * of this item, it is a different number — the case the check exists for is a credit authorized for one
 * price and spent on an item worth another.
 */
const APPROXIMATE_CHARGE_TOLERANCE_BPS = 200n
const BPS = 10_000n

// One credit is ten US cents; the ledger accounts in cents.
const CENTS_PER_CREDIT = 10n

/** The USD value of `manaWei` at `rate`, in USD wei (1e18 = $1). Truncated, like every other reader of the feed. */
function manaWeiToUsdWei(manaWei: bigint, { rate, decimals }: ManaUsdRate): bigint {
  return (manaWei * rate) / 10n ** BigInt(decimals)
}

/**
 * The credits a MANA price comes to at `rate`, rounded up to a whole credit — the same number the shop
 * shows and the credits-server charges for it at that rate: the client quotes the price rounded up to the
 * cent, and the server rounds that up to the credit, which is one rounding up from USD wei to the credit.
 */
function approximateCredits(manaWei: bigint, rate: ManaUsdRate): bigint {
  return toCredits(manaWeiToUsdWei(manaWei, rate))
}

/**
 * The range of charges, in cents, that are the same MANA price quoted a moment earlier: the price converted
 * at `rate` moved down and up by the tolerance, each rounded to a whole credit the way the charge is.
 */
function approximateChargeBounds(manaWei: bigint, rate: ManaUsdRate): { minCents: bigint; maxCents: bigint } {
  const usdWei = manaWeiToUsdWei(manaWei, rate)
  const low = (usdWei * (BPS - APPROXIMATE_CHARGE_TOLERANCE_BPS)) / BPS
  const high = (usdWei * (BPS + APPROXIMATE_CHARGE_TOLERANCE_BPS) + BPS - 1n) / BPS
  return { minCents: toCredits(low) * CENTS_PER_CREDIT, maxCents: toCredits(high) * CENTS_PER_CREDIT }
}

export { APPROXIMATE_CHARGE_TOLERANCE_BPS, CENTS_PER_CREDIT, approximateChargeBounds, approximateCredits, manaWeiToUsdWei }
export type { ManaUsdRate }
