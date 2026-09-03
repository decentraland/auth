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

/** EIP-712 typed-data payload, as parsed from an eth_signTypedData_v4 request. */
type TypedDataPayload = {
  types?: Record<string, Array<{ name: string; type: string }>>
  domain?: Record<string, unknown>
  primaryType?: string
  message?: Record<string, unknown>
}

/** What a non-transaction signature request is asking the user to sign. */
type SignaturePayload = { kind: 'message'; message: string } | { kind: 'typedData'; typedData: TypedDataPayload; raw: string }

/**
 * Whether a MetaTransaction's verifying contract is a recognized Decentraland contract: `pending`
 * while the lookup runs, `confirmed` when it is in the static registry or known to the
 * meta-transaction server as a collection, `unconfirmed` otherwise.
 */
type MetaTransactionContractTrust = 'pending' | 'confirmed' | 'unconfirmed'

/**
 * Why a signature request cannot be checked by Auth: typed data whose primaryType is neither a
 * MetaTransaction nor a known approval type, or a personal_sign message that is not readable text.
 */
type UnverifiableSignatureReason = 'unrecognized_typed_data' | 'opaque_message'

/** Lifecycle of the best-effort transaction simulation shown to web2 users. */
type SimulationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: SimulationResponseBody }
  | { status: 'unavailable' }

export { TransferType }
export type {
  MANATransferData,
  MetaTransactionContractTrust,
  NFTTransferData,
  ProfileAvatar,
  TypedDataPayload,
  SignaturePayload,
  SimulationState,
  UnverifiableSignatureReason
}
