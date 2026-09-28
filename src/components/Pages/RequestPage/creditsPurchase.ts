import { ContractName } from 'decentraland-transactions'
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

// The off-chain marketplace deployments a purchase may settle through: the contracts that verify a trade
// signature and move the assets. The CreditsManager's own allowlist also holds the legacy marketplace and
// the collection store, which take entirely different calls; those are not this screen's shape.
const PURCHASE_MARKETPLACES: ReadonlySet<string> = new Set([ContractName.OffChainMarketplace, ContractName.OffChainMarketplaceV2])

// The one `accept` the dedicated screen stands in for. Read off the marketplace ABI rather than written
// down, so it cannot drift from the contract the call is decoded against.
const ACCEPT_FUNCTION = 'accept'

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

/** A credits purchase, as read out of the bytes the signature covers and nothing else. */
type CreditsPurchase = {
  /** The CreditsManager the signature is bound to. */
  creditsManagerAddress: string
  /** The off-chain marketplace the purchase settles through, and its registry name. */
  marketplaceAddress: string
  marketplaceName: ContractName
  /** What the buyer receives. */
  asset: CreditsPurchaseAsset
  /** The account the asset is delivered to. Always the reviewing signer; see recognizeCreditsPurchase. */
  recipient: string
  /** The account that listed the item and receives the payment. */
  seller: string
  /** Where the payment goes (the trade's received beneficiary). */
  paymentBeneficiary: string
  /** The token the trade settles in (the chain's MANA), and the USD-pegged price in USD wei. */
  paymentTokenAddress: string
  priceUsdWei: bigint
  /**
   * What the purchase costs in credits: the USD-pegged price divided by the peg, rounded up, in BigInt.
   * Derived from the signed price and the peg alone — never from a label the caller supplied.
   */
  credits: bigint
  /** The MANA the CreditsManager may draw from the credit (a cap, in MANA wei). Not a credits amount. */
  maxCreditedValueWei: bigint
  /**
   * The credit's salt — its id, both on chain and in the credits-server's ledger. This is what ties the
   * signature to the charge the buyer's balance will actually take (see verifyAuthorizedCharge): the trade
   * says what the item costs, and only the salt says what the purchase debits.
   */
  creditSalt: string
  /** Unix seconds after which the external call, and the trade, stop being valid. */
  externalCallExpiresAt: bigint
  tradeExpiresAt: bigint
  creditExpiresAt: bigint
  /**
   * The soonest of the three, in unix seconds: the whole purchase is void once any of them passes. The page
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
  | 'multiple_trades'
  | 'gated_trade'
  | 'external_checks'
  | 'multiple_assets'
  | 'asset_type'
  | 'another_recipient'
  | 'price_asset_type'
  | 'payment_token'
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
 * - the external call is an `accept` of exactly one trade on an off-chain marketplace deployment, decoded
 *   against that marketplace's own ABI and proven to re-encode to the same bytes;
 * - the trade has no external checks and no allowlist root, so nothing is staticcalled and no proof decides
 *   whether it applies;
 * - it sends exactly one asset, to the reviewing signer, and receives exactly one USD-pegged payment in the
 *   chain's MANA, whose amount is the price the credits are counted from.
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
    const externalCallExpiresAt = toBigInt(externalCall.expiresAt)
    const target = toAddress(externalCall.target)
    if (externalCallExpiresAt === null || !isSeconds(externalCallExpiresAt) || target === null) {
      return unsupported('malformed_arguments')
    }

    // An expired credit or external call cannot execute, so a screen that summarized it as a purchase would
    // be describing something that will not happen.
    const now = BigInt(Math.floor(context.nowSeconds))
    if (creditExpiresAt <= now || externalCallExpiresAt <= now) {
      return unsupported('expired')
    }

    // The contract the trade settles through, from the registry for this chain. A collection lookup is
    // deliberately not consulted: a marketplace is never a factory-deployed collection, and this stays a
    // pure read of the payload.
    const marketplace = getKnownDecentralandContract(target, context.chainId)
    if (!marketplace || !PURCHASE_MARKETPLACES.has(marketplace.name)) {
      return unsupported('not_a_marketplace')
    }

    // The nested call, decoded against the marketplace's own ABI and proven canonical the same way the outer
    // call was: `decodeKnownContractCall` re-encodes and compares, so trailing or padded bytes that read as
    // one call and execute as another are refused rather than summarized.
    if (typeof externalCall.selector !== 'string' || typeof externalCall.data !== 'string') {
      return unsupported('malformed_arguments')
    }
    const accept = decodeKnownContractCall(marketplace, `${externalCall.selector}${externalCall.data.slice(2)}`)
    if (!accept || accept.functionName !== ACCEPT_FUNCTION) {
      return unsupported('not_an_accept')
    }

    const trade = onlyElement(accept.args[0])
    if (trade === null) {
      return Array.isArray(accept.args[0]) ? unsupported('multiple_trades') : unsupported('malformed_arguments')
    }
    if (!isRecord(trade)) {
      return unsupported('malformed_arguments')
    }
    const seller = toAddress(trade.signer)
    const checks = trade.checks
    if (seller === null || !isRecord(checks)) {
      return unsupported('malformed_arguments')
    }

    // An allowlist root gates the trade on a Merkle proof, and an external check staticcalls a contract the
    // request chose. Neither is readable from a purchase summary, so neither may hide behind one.
    if (checks.allowedRoot !== ZERO_BYTES32 || !Array.isArray(checks.allowedProof) || checks.allowedProof.length > 0) {
      return unsupported('gated_trade')
    }
    if (!Array.isArray(checks.externalChecks) || checks.externalChecks.length > 0) {
      return unsupported('external_checks')
    }

    const tradeExpiresAt = toBigInt(checks.expiration)
    const tradeEffectiveAt = toBigInt(checks.effective)
    const uses = toBigInt(checks.uses)
    if (tradeExpiresAt === null || tradeEffectiveAt === null || uses === null || !isSeconds(tradeExpiresAt)) {
      return unsupported('malformed_arguments')
    }
    if (tradeExpiresAt <= now || tradeEffectiveAt > now || uses < 1n) {
      return unsupported('expired')
    }

    const sent = onlyElement(trade.sent)
    const received = onlyElement(trade.received)
    if (sent === null || received === null) {
      return Array.isArray(trade.sent) && Array.isArray(trade.received)
        ? unsupported('multiple_assets')
        : unsupported('malformed_arguments')
    }
    if (!isRecord(sent) || !isRecord(received)) {
      return unsupported('malformed_arguments')
    }

    const asset = readPurchasedAsset(sent)
    if (!asset) {
      return unsupported('asset_type')
    }
    // Where the item goes. The Explorer encodes the buyer here and nothing else, so anything else is not the
    // purchase this screen describes — and a screen that told the buyer they were getting an item that goes
    // to another account would be the worst thing it could say.
    const recipient = toAddress(sent.beneficiary)
    if (recipient === null || recipient !== context.signerAddress.toLowerCase()) {
      return unsupported('another_recipient')
    }

    // The price. Only a USD-pegged asset carries one this screen can count credits from: a plain ERC-20 MANA
    // price is a number of MANA, and turning it into credits needs the MANA/USD oracle the marketplace reads
    // at settlement — a rate that is not in the signed bytes.
    const priceAssetType = toBigInt(received.assetType)
    if (priceAssetType === null) {
      return unsupported('malformed_arguments')
    }
    if (priceAssetType !== ASSET_TYPE_USD_PEGGED_MANA) {
      return unsupported(priceAssetType === ASSET_TYPE_ERC20 ? 'price_asset_type' : 'malformed_arguments')
    }
    const paymentTokenAddress = toAddress(received.contractAddress)
    const paymentBeneficiary = toAddress(received.beneficiary)
    const priceUsdWei = toBigInt(received.value)
    if (paymentTokenAddress === null || paymentBeneficiary === null || priceUsdWei === null || !isEmptyBytes(received.extra)) {
      return unsupported('malformed_arguments')
    }
    // A USD-pegged asset settles in the chain's MANA; the marketplace converts at accept time. Anything else
    // in that slot is not the payment this screen names.
    const manaToken = getKnownDecentralandContract(paymentTokenAddress, context.chainId)
    if (!manaToken || manaToken.name !== ContractName.MANAToken) {
      return unsupported('payment_token')
    }
    if (priceUsdWei <= 0n) {
      return unsupported('no_price')
    }

    return {
      status: 'recognized',
      purchase: {
        creditsManagerAddress: contract.address,
        marketplaceAddress: marketplace.address,
        marketplaceName: marketplace.name,
        asset,
        recipient,
        seller,
        paymentBeneficiary,
        paymentTokenAddress,
        priceUsdWei,
        credits: toCredits(priceUsdWei),
        maxCreditedValueWei: maxCreditedValue,
        creditSalt,
        externalCallExpiresAt,
        tradeExpiresAt,
        creditExpiresAt,
        expiresAt: minimum(creditExpiresAt, externalCallExpiresAt, tradeExpiresAt)
      }
    }
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
export type { CreditsPurchase, CreditsPurchaseAsset, CreditsRecognition, CreditsUnsupportedReason }
