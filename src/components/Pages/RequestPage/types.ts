import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { Rarity } from '@dcl/schemas'
import { Profile as ProfileComponent } from 'decentraland-ui2'
import type { CreditsPurchase } from './creditsPurchase'

type NFTTransferData = {
  imageUrl: string
  tokenId: string
  toAddress: string
  contractAddress: string
  name: string
  description: string
  rarity: Rarity
  recipientProfile?: Profile
}

/**
 * Where a place is, as opposed to what it calls itself.
 *
 * This is the part of the block a scene cannot make up. A title and an image are written by whoever
 * deployed the scene and neither is unique, so they identify nothing; a Genesis City parcel is held by
 * whoever owns that LAND, and a world is addressed by a NAME that is an NFT. Either way the user can
 * compare what is on screen with where they actually are, which is the check the block exists for.
 */
type PlaceLocation = { kind: 'genesis'; position: string } | { kind: 'world'; name: string }

type MANATransferData = {
  manaAmount: string
  toAddress: string
  recipientProfile?: Profile
  sceneName: string
  sceneImageUrl: string
  /** Where the place is — a Genesis City parcel or a world name. Null when no place was identified. */
  sceneLocation?: PlaceLocation | null
}

/** The cosmetic half of a purchase screen: what the item looks like and is called. */
type PurchasedItemMetadata = { imageUrl: string; name: string; rarity: Rarity }

/**
 * What the dedicated credits approval shows. The purchase is the verified half — every field of it comes
 * out of the bytes the signature covers (see recognizeCreditsPurchase) — and the metadata is the cosmetic
 * half, null when the catalyst could not answer and the item is named by its identifiers instead. Nothing
 * in the metadata can change what is signed, and the screen never lets it stand in for a fact.
 */
type CreditsPurchaseData = {
  purchase: CreditsPurchase
  metadata: PurchasedItemMetadata | null
}

type ProfileAvatar = Parameters<typeof ProfileComponent>[0]['avatar']

enum TransferType {
  TIP = 'tip',
  GIFT = 'gift'
}

/** EIP-712 typed-data payload, as parsed from an eth_signTypedData request. */
type TypedDataPayload = {
  types?: Record<string, Array<{ name: string; type: string }>>
  domain?: Record<string, unknown>
  primaryType?: string
  message?: Record<string, unknown>
}

/** Lifecycle of the wallet-side fee estimate for a transaction the user pays gas for. */
type GasEstimateState = { status: 'loading' } | { status: 'ready'; cost: bigint } | { status: 'unavailable' }

export { TransferType }
export type {
  CreditsPurchaseData,
  GasEstimateState,
  PlaceLocation,
  MANATransferData,
  NFTTransferData,
  ProfileAvatar,
  PurchasedItemMetadata,
  TypedDataPayload
}
