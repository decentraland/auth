import { Rarity } from '@dcl/schemas'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ContractName, getContract } from 'decentraland-transactions'
import { decodeKnownContractCall, getKnownDecentralandContract } from '../../../../shared/auth'
import { ManaUsdRate, approximateCredits } from '../creditsPricing'
import { recognizeCreditsPurchase } from '../creditsPurchase'
import type { CreditsPurchaseData } from '../types'
import {
  BUYER,
  POLYGON,
  SELLER,
  buildStoreUseCreditsArgs,
  buildTrade,
  buildUseCreditsArgs,
  encodeUseCredits,
  manaContract
} from './creditsPurchaseVectors'
import type { UseCreditsArgs } from './creditsPurchaseVectors'

/**
 * The purchases the harness renders, read out of real Explorer-shaped payloads rather than written by hand.
 *
 * The screens exist to state what the signature covers, so what they are shown here is the output of the
 * decoder on bytes the Explorer could have sent (see creditsPurchaseVectors): if the recognizer ever stops
 * reading those bytes, this page stops rendering instead of quietly showing a made-up purchase.
 */
function readFixturePurchase(args: UseCreditsArgs): CreditsPurchaseData['purchase'] {
  const creditsManager = getKnownDecentralandContract(getContract(ContractName.CreditsManager, POLYGON).address, POLYGON)
  const call = creditsManager && decodeKnownContractCall(creditsManager, encodeUseCredits(args))
  const recognition =
    creditsManager && call
      ? recognizeCreditsPurchase(creditsManager, call, {
          signerAddress: BUYER,
          chainId: ChainId.MATIC_MAINNET,
          nowSeconds: Date.now() / 1000
        })
      : null
  if (!recognition || recognition.status !== 'recognized') {
    throw new Error('A credits purchase fixture is no longer a payload the decoder recognizes')
  }
  return recognition.purchase
}

// A fixed MANA/USD rate for the harness, which does not read the chain: $0.2696 a MANA, the Amoy feed's answer
// on the day the MANA-priced screens were built. The page reads the live one (see readManaUsdRate).
const FIXTURE_MANA_USD_RATE: ManaUsdRate = { rate: 26960836n, decimals: 8 }

// A MANA-priced purchase is shown with the charge the ledger would hold for it at the harness rate — the
// page shows the real, verified charge — and the rate it was checked at.
function priced(purchase: CreditsPurchaseData['purchase']): CreditsPurchaseData['pricing'] {
  return purchase.price.kind === 'usd_pegged'
    ? { kind: 'exact', credits: purchase.price.credits }
    : {
        kind: 'converted',
        credits: approximateCredits(purchase.price.manaWei, FIXTURE_MANA_USD_RATE),
        manaWei: purchase.price.manaWei,
        rate: FIXTURE_MANA_USD_RATE
      }
}

const metadataFor = (purchase: CreditsPurchaseData['purchase']): CreditsPurchaseData['metadata'] => ({
  imageUrl: `https://peer.decentraland.org/lambdas/collections/contents/urn:decentraland:matic:collections-v2:${purchase.asset.contractAddress}:0/thumbnail`,
  name: 'UpperHead AHL',
  rarity: Rarity.EPIC
})

// Exercise the current marketplace and its ignored external-call deadline in the browser fixtures too.
const purchase = readFixturePurchase(
  buildUseCreditsArgs({
    externalCall: { target: getContract(ContractName.OffChainMarketplaceV3, POLYGON).address, expiresAt: 0n }
  })
)

const creditsPurchaseData: CreditsPurchaseData = { purchase, pricing: priced(purchase), metadata: metadataFor(purchase) }

const creditsPurchaseWithoutMetadata: CreditsPurchaseData = { purchase, pricing: priced(purchase), metadata: null }

// A primary sale: the item minted from its collection through the collection store, priced in MANA.
const primarySalePurchase = readFixturePurchase(buildStoreUseCreditsArgs())
const creditsPrimarySaleData: CreditsPurchaseData = {
  purchase: primarySalePurchase,
  pricing: priced(primarySalePurchase),
  metadata: metadataFor(primarySalePurchase)
}

// A listing on the marketplace priced in plain MANA rather than USD-pegged.
const manaListingPurchase = readFixturePurchase(
  buildUseCreditsArgs({
    trades: [
      buildTrade({
        received: [{ assetType: 1n, contractAddress: manaContract.address, value: 2600000000000000000n, beneficiary: SELLER, extra: '0x' }]
      })
    ]
  })
)
const creditsManaListingData: CreditsPurchaseData = {
  purchase: manaListingPurchase,
  pricing: priced(manaListingPurchase),
  metadata: metadataFor(manaListingPurchase)
}

export { creditsManaListingData, creditsPrimarySaleData, creditsPurchaseData, creditsPurchaseWithoutMetadata }
