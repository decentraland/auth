import { isRecord } from '../utils/isRecord'
import { ApprovalChange, AssetChange, BalanceChange, SimulationEvent, SimulationResponseBody } from './types'

/**
 * The preview DTO is the one input to this page that is neither the request (checked by the recover guards
 * and the classifier) nor third-party text (shown through formatUntrustedLabel). It arrives as JSON over
 * the network and is read straight into the review: the summary dereferences its rows, the approval gate
 * judges them, and the branded views decide whether they may stand in for the generic summary.
 *
 * So it is checked here rather than cast. The contract with auth-server is kept by hand — `types.ts` in
 * both repos, matched field by field — and a shape it does not honour must degrade to "details
 * unavailable" behind an acknowledgment, the way an outage does, instead of reaching a consumer that
 * assumes the field is there. A row of `{}` would otherwise pass the summary's own guards and only fail
 * inside the approval gate, mid-render, after the review had already been shown as ready.
 *
 * Every field the consumers dereference is checked for its declared type; fields declared nullable must be
 * present and null rather than absent, since that is what the server sends.
 */

/**
 * Upper bound on the entries of any collection in a preview. The server refuses a response past its own
 * bound rather than truncating one, and reports at most 1024 movements or permissions, so a valid answer is
 * always under this. It exists because "the server bounds it" is a promise the review should not have to
 * take on trust: a server that broke that promise would otherwise hand the summary an unbounded list to
 * render. Past it the body is refused like any other one that does not honour the DTO, which the review
 * shows as "details unavailable" — never silently as a prefix, since a prefix of the effects is not a
 * preview.
 */
const MAX_COLLECTION_ENTRIES = 1024

const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string'
const isNumberOrNull = (value: unknown): value is number | null => value === null || typeof value === 'number'

const ASSET_TYPES: ReadonlySet<string> = new Set(['transfer', 'mint', 'burn'])
const ASSET_STANDARDS: ReadonlySet<string> = new Set(['native', 'erc20', 'erc721', 'erc1155', 'unknown'])
const APPROVAL_KINDS: ReadonlySet<string> = new Set(['approval', 'approvalForAll'])
const APPROVAL_STANDARDS: ReadonlySet<string> = new Set(['erc20', 'erc721', 'unknown'])

function isAssetChange(value: unknown): value is AssetChange {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    ASSET_TYPES.has(value.type) &&
    typeof value.standard === 'string' &&
    ASSET_STANDARDS.has(value.standard) &&
    isStringOrNull(value.from) &&
    isStringOrNull(value.to) &&
    isStringOrNull(value.amount) &&
    isStringOrNull(value.rawAmount) &&
    isStringOrNull(value.tokenId) &&
    isStringOrNull(value.contractAddress) &&
    isStringOrNull(value.symbol) &&
    isStringOrNull(value.name) &&
    isNumberOrNull(value.decimals) &&
    isStringOrNull(value.logoUrl) &&
    isStringOrNull(value.dollarValue)
  )
}

function isApprovalChange(value: unknown): value is ApprovalChange {
  return (
    isRecord(value) &&
    typeof value.kind === 'string' &&
    APPROVAL_KINDS.has(value.kind) &&
    typeof value.standard === 'string' &&
    APPROVAL_STANDARDS.has(value.standard) &&
    typeof value.owner === 'string' &&
    typeof value.spender === 'string' &&
    typeof value.contractAddress === 'string' &&
    typeof value.isUnlimited === 'boolean' &&
    (value.approved === null || typeof value.approved === 'boolean') &&
    isStringOrNull(value.amount) &&
    isStringOrNull(value.rawAmount) &&
    isStringOrNull(value.tokenId) &&
    isStringOrNull(value.symbol) &&
    isStringOrNull(value.name)
  )
}

function isBalanceChange(value: unknown): value is BalanceChange {
  return isRecord(value) && typeof value.address === 'string' && isStringOrNull(value.dollarValue)
}

function isSimulationEvent(value: unknown): value is SimulationEvent {
  return isRecord(value) && typeof value.address === 'string' && isStringOrNull(value.name)
}

/**
 * The parsed preview, or null when the body is not one. Callers turn null into the same
 * SimulationUnavailableError a network failure produces, so an unreadable answer and an absent one lead to
 * the same review.
 */
function parseSimulationResponse(value: unknown): SimulationResponseBody | null {
  if (!isRecord(value)) {
    return null
  }
  if (value.status !== 'success' && value.status !== 'reverted') {
    return null
  }
  // Only present on a revert, and only shown there.
  if (value.error !== undefined && typeof value.error !== 'string') {
    return null
  }
  const isBoundedArray = (collection: unknown, isEntry: (entry: unknown) => boolean): boolean =>
    Array.isArray(collection) && collection.length <= MAX_COLLECTION_ENTRIES && collection.every(isEntry)
  if (
    !isBoundedArray(value.assetChanges, isAssetChange) ||
    !isBoundedArray(value.approvalChanges, isApprovalChange) ||
    !isBoundedArray(value.balanceChanges, isBalanceChange) ||
    !isBoundedArray(value.events, isSimulationEvent)
  ) {
    return null
  }
  return value as SimulationResponseBody
}

export { parseSimulationResponse }
