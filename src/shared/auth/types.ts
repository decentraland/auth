type RecoverResponse = {
  sender: string
  expiration: string
  method: string
  code?: string
  error?: string
  params?: unknown[]
}

type OutcomeResponse = {
  error?: string
}

type IdentityResponse = {
  identityId: string
  expiration: Date
}

type OutcomeError = { code: number; message: string }

type ValidationResponse = {
  error?: string
}

/** Body sent to the auth-server `POST /simulations` endpoint. */
type SimulationRequestBody = {
  chainId: number
  from: string
  to: string
  /** 0x-prefixed calldata. Defaults to '0x' server-side when omitted. */
  data?: string
  /** Wei as a decimal or 0x-hex string. Defaults to '0' server-side when omitted. */
  value?: string
}

/** A single asset movement produced by simulating a transaction. */
type AssetChange = {
  type: 'transfer' | 'mint' | 'burn'
  standard: 'native' | 'erc20' | 'erc721' | 'erc1155' | 'unknown'
  from: string | null
  to: string | null
  /** Human-readable amount (decimals applied); null when decimals are unknown. */
  amount: string | null
  /** Amount in base units. */
  rawAmount: string | null
  tokenId: string | null
  contractAddress: string | null
  symbol: string | null
  name: string | null
  decimals: number | null
  logoUrl: string | null
  dollarValue: string | null
}

/** A token approval / permission granted by simulating a transaction. */
type ApprovalChange = {
  kind: 'approval' | 'approvalForAll'
  standard: 'erc20' | 'erc721' | 'unknown'
  owner: string
  spender: string
  /** ERC20 allowance (human-readable); null otherwise. */
  amount: string | null
  rawAmount: string | null
  /** True when the granted allowance is effectively unlimited. */
  isUnlimited: boolean
  tokenId: string | null
  /** ApprovalForAll flag (false = revoke); null for single approvals. */
  approved: boolean | null
  contractAddress: string
  symbol: string | null
  name: string | null
}

/** Normalized response from `POST /simulations`. */
type SimulationResponseBody = {
  status: 'success' | 'reverted'
  /** Revert reason, present when status is 'reverted'. */
  error?: string
  assetChanges: AssetChange[]
  approvalChanges: ApprovalChange[]
}

export type {
  RecoverResponse,
  OutcomeResponse,
  IdentityResponse,
  OutcomeError,
  ValidationResponse,
  SimulationRequestBody,
  SimulationResponseBody,
  AssetChange,
  ApprovalChange
}
