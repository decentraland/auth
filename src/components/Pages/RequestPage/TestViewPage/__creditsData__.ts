import { Rarity } from '@dcl/schemas'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ContractName, getContract } from 'decentraland-transactions'
import { decodeKnownContractCall, getKnownDecentralandContract } from '../../../../shared/auth'
import { recognizeCreditsPurchase } from '../creditsPurchase'
import type { CreditsPurchaseData } from '../types'
import { BUYER, POLYGON, buildUseCreditsArgs, encodeUseCredits } from './creditsPurchaseVectors'

/**
 * The purchase the harness renders, read out of a real Explorer-shaped payload rather than written by hand.
 *
 * The screens exist to state what the signature covers, so what they are shown here is the output of the
 * decoder on bytes the Explorer could have sent (see creditsPurchaseVectors): if the recognizer ever stops
 * reading those bytes, this page stops rendering instead of quietly showing a made-up purchase.
 */
function readFixturePurchase(): CreditsPurchaseData['purchase'] {
  const creditsManager = getKnownDecentralandContract(getContract(ContractName.CreditsManager, POLYGON).address, POLYGON)
  const call = creditsManager && decodeKnownContractCall(creditsManager, encodeUseCredits(buildUseCreditsArgs()))
  const recognition =
    creditsManager && call
      ? recognizeCreditsPurchase(creditsManager, call, {
          signerAddress: BUYER,
          chainId: ChainId.MATIC_MAINNET,
          nowSeconds: Date.now() / 1000
        })
      : null
  if (!recognition || recognition.status !== 'recognized') {
    throw new Error('The credits purchase fixture is no longer a payload the decoder recognizes')
  }
  return recognition.purchase
}

const purchase = readFixturePurchase()

const creditsPurchaseData: CreditsPurchaseData = {
  purchase,
  metadata: {
    imageUrl: `https://peer.decentraland.org/lambdas/collections/contents/urn:decentraland:matic:collections-v2:${purchase.asset.contractAddress}:0/thumbnail`,
    name: 'UpperHead AHL',
    rarity: Rarity.EPIC
  }
}

const creditsPurchaseWithoutMetadata: CreditsPurchaseData = { purchase, metadata: null }

export { creditsPurchaseData, creditsPurchaseWithoutMetadata }
