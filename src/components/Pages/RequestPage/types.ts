import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { Rarity } from '@dcl/schemas'
import { Profile as ProfileComponent } from 'decentraland-ui2'
import { SimulationResponseBody } from '../../../shared/auth'

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

/** Lifecycle of the best-effort simulation shown for a Decentraland contract call. */
type SimulationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: SimulationResponseBody }
  | { status: 'unavailable' }

/** Lifecycle of the wallet-side fee estimate for a transaction the user pays gas for. */
type GasEstimateState = { status: 'loading' } | { status: 'ready'; cost: bigint } | { status: 'unavailable' }

export { TransferType }
export type { GasEstimateState, PlaceLocation, MANATransferData, NFTTransferData, ProfileAvatar, TypedDataPayload, SimulationState }
