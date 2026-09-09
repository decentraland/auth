import type { RequestClassification } from '../../classifyRequest'
import { GasEstimateState } from '../../types'

/** The request kinds shown by the unverified view: everything that is not a Decentraland contract call. */
type UnverifiedRequestKind = Exclude<RequestClassification['kind'], 'dcl_transaction' | 'dcl_meta_transaction'>

/** What the wallet will be handed, verbatim, for the Advanced tab. */
type UnverifiedRequestPayload =
  | { kind: 'transaction'; to: string; data: string; value: string }
  | {
      kind: 'typed_data'
      /** The typed data exactly as the request sent it. */
      raw: string
    }
  | {
      kind: 'message'
      /** The bytes the wallet signs. */
      hex: string
      /** The bytes decoded as text, or null when they are not readable text. */
      text: string | null
    }

interface UnverifiedRequestViewProps {
  requestId: string
  kind: UnverifiedRequestKind
  method: string
  /** The contract or recipient the request targets, when it names one. */
  targetAddress?: string | null
  /** True when the target is the connected account (a self-send). */
  targetIsSelf?: boolean
  /** The chain the request executes on, or the one its typed data is bound to. */
  chainId?: number | null
  /** Native value carried by a transaction, as a hex quantity. */
  nativeValue?: string
  /** Transactions only: the wallet-side fee estimate. */
  gas?: GasEstimateState
  /** The user's native balance in wei, shown next to the fee. */
  balance?: bigint
  payload: UnverifiedRequestPayload
  /** Fingerprint of `payload`, folded into the acknowledgment statement. */
  payloadFingerprint: string
  isLoading?: boolean
  /** True when this review replaced one invalidated because the wallet's network changed. */
  reviewRestarted?: boolean
  onDeny: () => void
  onApprove: () => void
}

export type { UnverifiedRequestKind, UnverifiedRequestPayload, UnverifiedRequestViewProps }
