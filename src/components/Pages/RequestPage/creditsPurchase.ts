import { ContractName, getContract } from 'decentraland-transactions'
import { ADDRESS_REGEX, DecodedCall, KnownContract, decodeKnownContractCall, getKnownDecentralandContract } from '../../../shared/auth'
import { isRecord } from '../../../shared/utils/isRecord'

/**
 * THE PEG, as the shop and the Explorer spell it: one credit is a fixed 10 US cents, and a USD-pegged
 * marketplace asset is denominated in USD wei (1e18 = $1). A credit is therefore 1e17 of those. The same
 * number lives in the shop web app (`lib/currency.ts` USD_CENTS_PER_CREDIT) and in the Explorer
 * (`CreditsPurchaseService.CENTS_PER_CREDIT`); this is the third copy, and the tests pin it against a
 * real listing whose catalogue price is known.
 */
const USD_WEI_PER_CREDIT = 10n ** 17n

// The marketplace asset types, as the CreditsManager and the off-chain marketplace number them.
const ASSET_TYPE_ERC20 = 1n
const ASSET_TYPE_USD_PEGGED_MANA = 2n
const ASSET_TYPE_ERC721 = 3n
const ASSET_TYPE_COLLECTION_ITEM = 4n

// The off-chain marketplace deployments a resale or a listed item may settle through: the contracts that
// verify a trade signature and move the assets. The CreditsManager's own allowlist also holds the legacy
// marketplace, which takes an entirely different call; that is not this screen's shape.
const PURCHASE_MARKETPLACES: ReadonlySet<string> = new Set([
  ContractName.OffChainMarketplace,
  ContractName.OffChainMarketplaceV2,
  ContractName.OffChainMarketplaceV3
])

// The one `accept` the dedicated screen stands in for. Read off the marketplace ABI rather than written
// down, so it cannot drift from the contract the call is decoded against.
const ACCEPT_FUNCTION = 'accept'

// A primary sale: the collection store mints an item that is still on sale from its collection, at the MANA
// price the creator set. The one call it takes is `buy`.
const STORE_BUY_FUNCTION = 'buy'

// A bytes32 of zeroes: no allowlist root, so the trade is open to whoever accepts it rather than gated by
// a Merkle proof this screen cannot evaluate.
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`

// A 32-byte value as a canonical decode produces it: the credit's salt is one.
const BYTES32_REGEX = /^0x[0-9a-fA-F]{64}$/

/** The soonest of several unix-second deadlines. */
function minimum(...values: readonly bigint[]): bigint {
  return values.reduce((soonest, value) => (value < soonest ? value : soonest))
}

// The trade checks store their timestamps in seconds (the contract compares them with block.timestamp).
// marketplace-server hands them out in milliseconds and the Explorer normalizes before encoding, so what
// is signed is always seconds.
const MILLISECONDS_PER_SECOND = 1000

// At most this many credits may be spent in one purchase. The credits-server signs exactly one ephemeral
// credit per transaction (a longer list is consumed in order and its tail is never reported, see the shop's
// authorizeUsdCreditGroup), and the Explorer sends one. More than one is a shape this screen has not been
// written for.
const MAX_CREDITS_PER_PURCHASE = 1

/** What the item being bought is identified by: a collection item to be minted, or a token being resold. */
type CreditsPurchaseAsset =
  | { kind: 'collection_item'; contractAddress: string; itemId: string }
  | { kind: 'erc721'; contractAddress: string; tokenId: string }

/**
 * What the signed bytes say the item costs, in the unit they were signed in.
 *
 * `usd_pegged` is a price in USD wei, so its credits follow from the peg alone and are exact. `mana` is a
 * price in MANA wei — every primary sale, and any listing priced in MANA — and its credits cannot be read
 * from the bytes at all: they depend on the MANA/USD rate, which is not signed. The page converts it at the
 * live oracle rate and says the number is approximate (see RequestPage and verifyApproximateCharge).
 */
type CreditsPurchasePrice = { kind: 'usd_pegged'; usdWei: bigint; credits: bigint } | { kind: 'mana'; manaWei: bigint }

/** How the purchase settles: accepting a signed trade on the marketplace, or buying from the collection store. */
type CreditsPurchaseVia = 'marketplace' | 'collection_store'

/** A credits purchase, as read out of the bytes the signature covers and nothing else. */
type CreditsPurchase = {
  /** The CreditsManager the signature is bound to. */
  creditsManagerAddress: string
  via: CreditsPurchaseVia
  /** The contract the purchase settles through (an off-chain marketplace, or the collection store). */
  settlementAddress: string
  settlementName: ContractName
  /** What the buyer receives. */
  asset: CreditsPurchaseAsset
  /** The account the asset is delivered to. Always the reviewing signer; see recognizeCreditsPurchase. */
  recipient: string
  /**
   * The account that listed the item, and where its payment goes (the trade's received beneficiary). A
   * primary sale carries neither: the store pays the item's beneficiary as the collection records it, which
   * is not in the signed bytes, so these are null rather than guessed.
   */
  seller: string | null
  paymentBeneficiary: string | null
  /** The token the purchase settles in: the chain's MANA, whatever unit the price is signed in. */
  paymentTokenAddress: string
  price: CreditsPurchasePrice
  /** The MANA the CreditsManager may draw from the credit (a cap, in MANA wei). Not a credits amount. */
  maxCreditedValueWei: bigint
  /**
   * The credit's salt — its id, both on chain and in the credits-server's ledger. This is what ties the
   * signature to the charge the buyer's balance will actually take (see verifyAuthorizedCharge): the trade
   * says what the item costs, and only the salt says what the purchase debits.
   */
  creditSalt: string
  /** Unix seconds after which the trade stops being valid (marketplace purchases only). */
  tradeExpiresAt: bigint | null
  /** Unix seconds after which the credit stops being valid. */
  creditExpiresAt: bigint
  /**
   * The soonest of them, in unix seconds: the whole purchase is void once any of them passes. The page
   * arms the review's expiry on it and checks it again at the moment of signing, so a credit that lapses
   * while the screen is open cannot be signed for (see RequestPage).
   */
  expiresAt: bigint
}

/**
 * Why a CreditsManager request may not be shown as a purchase. Analytics and tests only; the user is never
 * told which one it was, they are shown the raw payload the generic review shows for everything it cannot
 * vouch for.
 */
type CreditsUnsupportedReason =
  | 'not_use_credits'
  | 'malformed_arguments'
  | 'custom_external_call'
  | 'own_wallet_spend'
  | 'credit_count'
  | 'expired'
  | 'not_a_marketplace'
  | 'not_an_accept'
  | 'not_a_store_buy'
  | 'multiple_items'
  | 'multiple_trades'
  | 'gated_trade'
  | 'external_checks'
  | 'multiple_assets'
  | 'asset_type'
  | 'another_recipient'
  | 'price_asset_type'
  | 'payment_token'
  | 'self_payment'
  | 'no_price'

/**
 * What a request to the CreditsManager turned out to be. `unrelated` is every other request; `unsupported`
 * is a credits request whose shape this screen cannot vouch for, and lands on the generic review like any
 * other payload Auth cannot check.
 */
type CreditsRecognition =
  | { status: 'recognized'; purchase: CreditsPurchase }
  | { status: 'unrelated' }
  | { status: 'unsupported'; reason: CreditsUnsupportedReason }

type RecognizeCreditsPurchaseContext = {
  /** The account reviewing the request; the only account a purchase may deliver to. */
  signerAddress: string
  /** The chain the meta-transaction executes on, for resolving the marketplace the trade settles through. */
  chainId: number
  /** Now, in unix seconds. Injected so the expiry checks are testable. */
  nowSeconds: number
}

/** `value` as a lowercased address, or null when it is not one. */
function toAddress(value: unknown): string | null {
  return typeof value === 'string' && ADDRESS_REGEX.test(value) ? value.toLowerCase() : null
}

/** `value` as a bigint, or null. viem decodes every uint as a bigint, so anything else is not from a decode. */
function toBigInt(value: unknown): bigint | null {
  return typeof value === 'bigint' ? value : null
}

/** Whether `value` is the empty `bytes` a canonical decode produces for an absent byte string. */
function isEmptyBytes(value: unknown): boolean {
  return value === '0x'
}

/** Timestamps are signed in seconds; a value large enough to be milliseconds is not one this screen reads. */
function isSeconds(value: bigint): boolean {
  return value < BigInt(Number.MAX_SAFE_INTEGER) / BigInt(MILLISECONDS_PER_SECOND)
}

/**
 * The credits a USD-pegged price costs: the price divided by the peg, rounded up, in integer arithmetic
 * throughout. Rounded up because that is how the whole flow sizes the charge — the Explorer quotes it that
 * way and the credits-server authorizes it that way — so a price that is not a whole number of credits is
 * paid for with the next whole one.
 */
function toCredits(priceUsdWei: bigint): bigint {
  return (priceUsdWei + USD_WEI_PER_CREDIT - 1n) / USD_WEI_PER_CREDIT
}

/** The single element of `value`, or null when it is not an array of exactly one. */
function onlyElement(value: unknown): unknown | null {
  return Array.isArray(value) && value.length === 1 ? value[0] : null
}

/**
 * Reads the one asset of a trade's `sent` list: what the buyer receives. Only a collection item and an
 * ERC-721 token qualify, since they are the only asset types a credits purchase delivers, and the asset
 * must carry no `extra` bytes — the marketplace hands those to the asset's contract, and this screen does
 * not read them.
 */
function readPurchasedAsset(asset: Record<string, unknown>): CreditsPurchaseAsset | null {
  const assetType = toBigInt(asset.assetType)
  const contractAddress = toAddress(asset.contractAddress)
  const value = toBigInt(asset.value)
  if (assetType === null || contractAddress === null || value === null || !isEmptyBytes(asset.extra)) {
    return null
  }
  if (assetType === ASSET_TYPE_COLLECTION_ITEM) {
    return { kind: 'collection_item', contractAddress, itemId: value.toString() }
  }
  if (assetType === ASSET_TYPE_ERC721) {
    return { kind: 'erc721', contractAddress, tokenId: value.toString() }
  }
  return null
}

/** The fields a settlement path contributes to a CreditsPurchase, or why the path does not apply. */
type MarketplacePurchaseRead = Pick<
  CreditsPurchase,
  'asset' | 'recipient' | 'seller' | 'paymentBeneficiary' | 'paymentTokenAddress' | 'price'
> & { tradeExpiresAt: bigint }
type StorePurchaseRead = Pick<CreditsPurchase, 'asset' | 'recipient' | 'paymentTokenAddress' | 'price'>
type ReadFailure = { reason: CreditsUnsupportedReason }

/**
 * Reads the `accept` of a marketplace purchase: exactly one trade, open to anyone, with no external checks,
 * sending exactly one asset to the reviewing signer and receiving exactly one payment in the chain's MANA.
 * The payment is either USD-pegged (its credits follow from the peg) or plain MANA (its credits need the
 * oracle, and the page shows them as approximate).
 */
function readMarketplacePurchase(
  accept: DecodedCall,
  context: RecognizeCreditsPurchaseContext,
  now: bigint
): MarketplacePurchaseRead | ReadFailure {
  const trade = onlyElement(accept.args[0])
  if (trade === null) {
    return { reason: Array.isArray(accept.args[0]) ? 'multiple_trades' : 'malformed_arguments' }
  }
  if (!isRecord(trade)) {
    return { reason: 'malformed_arguments' }
  }
  const seller = toAddress(trade.signer)
  const checks = trade.checks
  if (seller === null || !isRecord(checks)) {
    return { reason: 'malformed_arguments' }
  }

  // An allowlist root gates the trade on a Merkle proof, and an external check staticcalls a contract the
  // request chose. Neither is readable from a purchase summary, so neither may hide behind one.
  if (checks.allowedRoot !== ZERO_BYTES32 || !Array.isArray(checks.allowedProof) || checks.allowedProof.length > 0) {
    return { reason: 'gated_trade' }
  }
  if (!Array.isArray(checks.externalChecks) || checks.externalChecks.length > 0) {
    return { reason: 'external_checks' }
  }

  const tradeExpiresAt = toBigInt(checks.expiration)
  const tradeEffectiveAt = toBigInt(checks.effective)
  const uses = toBigInt(checks.uses)
  if (tradeExpiresAt === null || tradeEffectiveAt === null || uses === null || !isSeconds(tradeExpiresAt)) {
    return { reason: 'malformed_arguments' }
  }
  if (tradeExpiresAt <= now || tradeEffectiveAt > now || uses < 1n) {
    return { reason: 'expired' }
  }

  const sent = onlyElement(trade.sent)
  const received = onlyElement(trade.received)
  if (sent === null || received === null) {
    return { reason: Array.isArray(trade.sent) && Array.isArray(trade.received) ? 'multiple_assets' : 'malformed_arguments' }
  }
  if (!isRecord(sent) || !isRecord(received)) {
    return { reason: 'malformed_arguments' }
  }

  const asset = readPurchasedAsset(sent)
  if (!asset) {
    return { reason: 'asset_type' }
  }
  // Where the item goes. The Explorer encodes the buyer here and nothing else, so anything else is not the
  // purchase this screen describes — and a screen that told the buyer they were getting an item that goes
  // to another account would be the worst thing it could say.
  const recipient = toAddress(sent.beneficiary)
  if (recipient === null || recipient !== context.signerAddress.toLowerCase()) {
    return { reason: 'another_recipient' }
  }

  // The price, in the unit it is signed in: USD wei for a USD-pegged asset, MANA wei for a plain ERC-20.
  // Either way it settles in the chain's MANA — the marketplace converts a USD-pegged price at accept time.
  const priceAssetType = toBigInt(received.assetType)
  if (priceAssetType === null) {
    return { reason: 'malformed_arguments' }
  }
  if (priceAssetType !== ASSET_TYPE_USD_PEGGED_MANA && priceAssetType !== ASSET_TYPE_ERC20) {
    return { reason: 'price_asset_type' }
  }
  const paymentTokenAddress = toAddress(received.contractAddress)
  const requestedPaymentBeneficiary = toAddress(received.beneficiary)
  const amount = toBigInt(received.value)
  if (paymentTokenAddress === null || requestedPaymentBeneficiary === null || amount === null || !isEmptyBytes(received.extra)) {
    return { reason: 'malformed_arguments' }
  }
  // Anything but the chain's MANA in that slot is not the payment this screen names — and for a plain ERC-20
  // price it would also make the MANA/USD conversion meaningless.
  const manaToken = getKnownDecentralandContract(paymentTokenAddress, context.chainId)
  if (!manaToken || manaToken.name !== ContractName.MANAToken) {
    return { reason: 'payment_token' }
  }
  if (amount <= 0n) {
    return { reason: 'no_price' }
  }

  // Marketplace._transferAssets resolves a zero beneficiary on received assets to the trade signer.
  const paymentBeneficiary =
    requestedPaymentBeneficiary === '0x0000000000000000000000000000000000000000' ? seller : requestedPaymentBeneficiary
  // CreditsManager rejects a purchase that changes the buyer's MANA balance (SenderBalanceChanged).
  if (paymentBeneficiary === recipient) {
    return { reason: 'self_payment' }
  }

  return {
    asset,
    recipient,
    seller,
    paymentBeneficiary,
    paymentTokenAddress,
    price:
      priceAssetType === ASSET_TYPE_USD_PEGGED_MANA
        ? { kind: 'usd_pegged', usdWei: amount, credits: toCredits(amount) }
        : { kind: 'mana', manaWei: amount },
    tradeExpiresAt
  }
}

/**
 * Reads the `buy` of a primary sale: exactly one item of exactly one collection, minted to the reviewing
 * signer, at a MANA price. The store charges that price in the chain's MANA and pays the item's beneficiary
 * as its collection records it; the price must match the collection's own, or the store reverts, so the
 * signed number is the number that is charged.
 *
 * Whether the collection is one Decentraland deployed is not decidable from the bytes; the page asks the
 * collection factories before it shows anything (see RequestPage).
 */
function readStorePurchase(buy: DecodedCall, context: RecognizeCreditsPurchaseContext): StorePurchaseRead | ReadFailure {
  const item = onlyElement(buy.args[0])
  if (item === null) {
    return { reason: Array.isArray(buy.args[0]) ? 'multiple_items' : 'malformed_arguments' }
  }
  if (!isRecord(item)) {
    return { reason: 'malformed_arguments' }
  }
  const collection = toAddress(item.collection)
  if (collection === null) {
    return { reason: 'malformed_arguments' }
  }
  const itemId = onlyElement(item.ids)
  const price = onlyElement(item.prices)
  const beneficiary = onlyElement(item.beneficiaries)
  if (itemId === null || price === null || beneficiary === null) {
    return {
      reason:
        Array.isArray(item.ids) && Array.isArray(item.prices) && Array.isArray(item.beneficiaries)
          ? 'multiple_items'
          : 'malformed_arguments'
    }
  }
  const id = toBigInt(itemId)
  const manaWei = toBigInt(price)
  const recipient = toAddress(beneficiary)
  if (id === null || manaWei === null || recipient === null) {
    return { reason: 'malformed_arguments' }
  }
  // Same rule as a marketplace purchase: the item goes to the reviewing signer, or this is not the purchase
  // the screen describes.
  if (recipient !== context.signerAddress.toLowerCase()) {
    return { reason: 'another_recipient' }
  }
  if (manaWei <= 0n) {
    return { reason: 'no_price' }
  }
  // The store only takes the chain's MANA. Named from the registry so the details show the real token.
  let paymentTokenAddress: string
  try {
    paymentTokenAddress = getContract(ContractName.MANAToken, context.chainId).address.toLowerCase()
  } catch {
    return { reason: 'payment_token' }
  }

  return {
    asset: { kind: 'collection_item', contractAddress: collection, itemId: id.toString() },
    recipient,
    paymentTokenAddress,
    price: { kind: 'mana', manaWei }
  }
}

/**
 * Reads a credits purchase out of a decoded `CreditsManager.useCredits` call, or says why it is not one the
 * dedicated screen may stand in for.
 *
 * The caller has already established what makes this readable at all (see classifyTypedData): the typed data
 * is the MetaTransaction struct a Decentraland contract hashes, its domain is exactly the CreditsManager's
 * with this chain's salt, `from` is the reviewing signer, the calldata decodes against the CreditsManager ABI
 * and re-encodes to the same bytes. What is left is the meaning of the call, and every fact this function
 * returns comes out of those bytes:
 *
 * - no custom external-call signature, so the call runs through the CreditsManager's own allowlist rather
 *   than a signature that authorizes an arbitrary target;
 * - nothing is drawn from the buyer's own wallet (`maxUncreditedValue` is zero), so "paid with credits" is
 *   the whole truth;
 * - the external call is one of two things, decoded against the target's own ABI and proven to re-encode
 *   to the same bytes:
 *   - an `accept` of exactly one trade on an off-chain marketplace deployment, with no external checks and
 *     no allowlist root, sending exactly one asset to the reviewing signer and receiving exactly one payment
 *     in the chain's MANA, priced either USD-pegged or in MANA (see readMarketplacePurchase);
 *   - a collection store `buy` of exactly one item, minted to the reviewing signer at a MANA price (see
 *     readStorePurchase).
 *
 * A USD-pegged price is counted in credits from the peg, exactly. A MANA price is returned as MANA: its
 * credits depend on a rate the bytes do not carry, and the page converts and labels them as approximate.
 *
 * Anything else is `unsupported` and goes to the generic review, which shows the payload whole. Nothing here
 * refuses a request: a CreditsManager call that is not this shape is still a request the user may approve
 * after reading it, it just may not be summarized as a purchase.
 */
function recognizeCreditsPurchase(
  contract: KnownContract,
  call: DecodedCall,
  context: RecognizeCreditsPurchaseContext
): CreditsRecognition {
  if (contract.name !== ContractName.CreditsManager) {
    return { status: 'unrelated' }
  }
  const unsupported = (reason: CreditsUnsupportedReason): CreditsRecognition => ({ status: 'unsupported', reason })
  if (call.functionName !== 'useCredits') {
    return unsupported('not_use_credits')
  }

  try {
    const args = call.args[0]
    if (!isRecord(args)) {
      return unsupported('malformed_arguments')
    }

    // A custom external-call signature lets a CreditsManager signer authorize a target that is not on the
    // contract's allowlist at all. Whatever it authorizes, it is not the allowlisted marketplace call this
    // screen describes.
    if (!isEmptyBytes(args.customExternalCallSignature)) {
      return unsupported('custom_external_call')
    }

    // MANA the CreditsManager takes from the buyer's own balance instead of from the credit. A purchase that
    // spends the wallet is not a purchase paid with credits, and must never be summarized as one.
    const maxUncreditedValue = toBigInt(args.maxUncreditedValue)
    if (maxUncreditedValue === null) {
      return unsupported('malformed_arguments')
    }
    if (maxUncreditedValue !== 0n) {
      return unsupported('own_wallet_spend')
    }

    const maxCreditedValue = toBigInt(args.maxCreditedValue)
    if (maxCreditedValue === null) {
      return unsupported('malformed_arguments')
    }

    const credits = args.credits
    const creditsSignatures = args.creditsSignatures
    if (
      !Array.isArray(credits) ||
      !Array.isArray(creditsSignatures) ||
      credits.length !== MAX_CREDITS_PER_PURCHASE ||
      creditsSignatures.length !== credits.length
    ) {
      return unsupported('credit_count')
    }
    const credit = credits[0]
    if (!isRecord(credit)) {
      return unsupported('malformed_arguments')
    }
    const creditExpiresAt = toBigInt(credit.expiresAt)
    const creditSalt = typeof credit.salt === 'string' && BYTES32_REGEX.test(credit.salt) ? credit.salt.toLowerCase() : null
    if (creditExpiresAt === null || !isSeconds(creditExpiresAt) || creditSalt === null) {
      return unsupported('malformed_arguments')
    }

    const externalCall = args.externalCall
    if (!isRecord(externalCall)) {
      return unsupported('malformed_arguments')
    }
    const target = toAddress(externalCall.target)
    if (target === null) {
      return unsupported('malformed_arguments')
    }

    // CreditsManager checks externalCall.expiresAt only on its custom-target path. The marketplace/store
    // paths recognized below ignore that field, so it cannot define their authorization deadline.
    // Only the credit and (for marketplace purchases) trade provide an enforced expiry.
    const now = BigInt(Math.floor(context.nowSeconds))
    if (creditExpiresAt <= now) {
      return unsupported('expired')
    }

    // The contract the purchase settles through, from the registry for this chain. A collection lookup is
    // deliberately not consulted: neither a marketplace nor the store is a factory-deployed collection, and
    // this stays a pure read of the payload.
    const settlement = getKnownDecentralandContract(target, context.chainId)
    if (!settlement) {
      return unsupported('not_a_marketplace')
    }

    // The nested call, decoded against the settlement contract's own ABI and proven canonical the same way
    // the outer call was: `decodeKnownContractCall` re-encodes and compares, so trailing or padded bytes that
    // read as one call and execute as another are refused rather than summarized.
    if (typeof externalCall.selector !== 'string' || typeof externalCall.data !== 'string') {
      return unsupported('malformed_arguments')
    }
    const nested = decodeKnownContractCall(settlement, `${externalCall.selector}${externalCall.data.slice(2)}`)

    const common = {
      creditsManagerAddress: contract.address,
      settlementAddress: settlement.address,
      settlementName: settlement.name,
      maxCreditedValueWei: maxCreditedValue,
      creditSalt,
      creditExpiresAt
    }

    if (PURCHASE_MARKETPLACES.has(settlement.name)) {
      if (!nested || nested.functionName !== ACCEPT_FUNCTION) {
        return unsupported('not_an_accept')
      }
      const read = readMarketplacePurchase(nested, context, now)
      if ('reason' in read) {
        return unsupported(read.reason)
      }
      return {
        status: 'recognized',
        purchase: {
          ...common,
          ...read,
          via: 'marketplace',
          expiresAt: minimum(creditExpiresAt, read.tradeExpiresAt)
        }
      }
    }

    if (settlement.name === ContractName.CollectionStore) {
      if (!nested || nested.functionName !== STORE_BUY_FUNCTION) {
        return unsupported('not_a_store_buy')
      }
      const read = readStorePurchase(nested, context)
      if ('reason' in read) {
        return unsupported(read.reason)
      }
      return {
        status: 'recognized',
        purchase: {
          ...common,
          ...read,
          via: 'collection_store',
          seller: null,
          paymentBeneficiary: null,
          tradeExpiresAt: null,
          expiresAt: creditExpiresAt
        }
      }
    }

    return unsupported('not_a_marketplace')
  } catch {
    // Every read above is defensive, but a decoded argument tree is still data the request wrote. Nothing
    // about it may throw its way past the recognizer into the page.
    return unsupported('malformed_arguments')
  }
}

export {
  ASSET_TYPE_COLLECTION_ITEM,
  ASSET_TYPE_ERC20,
  ASSET_TYPE_ERC721,
  ASSET_TYPE_USD_PEGGED_MANA,
  MILLISECONDS_PER_SECOND,
  USD_WEI_PER_CREDIT,
  recognizeCreditsPurchase,
  toCredits
}
export type {
  CreditsPurchase,
  CreditsPurchaseAsset,
  CreditsPurchasePrice,
  CreditsPurchaseVia,
  CreditsRecognition,
  CreditsUnsupportedReason
}
