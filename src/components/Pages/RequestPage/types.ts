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

type MANATransferData = {
  manaAmount: string
  toAddress: string
  recipientProfile?: Profile
  sceneName: string
  sceneImageUrl: string
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
export type { GasEstimateState, MANATransferData, NFTTransferData, ProfileAvatar, TypedDataPayload, SimulationState }
