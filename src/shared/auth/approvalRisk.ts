import { ApprovalChange } from './types'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/** Whether an address is the zero address, which approvals use to mean "nobody". */
function isZeroAddress(address: string): boolean {
  return address.toLowerCase() === ZERO_ADDRESS
}

/** Whether an amount string, in base units or with decimals applied, is zero. Non-numeric is not. */
function isZeroAmount(amount: string): boolean {
  if (amount.trim() === '') {
    return false
  }
  try {
    return BigInt(amount) === 0n
  } catch {
    // Not an integer string; fall through to a decimal parse.
  }
  const parsed = Number(amount)
  return Number.isFinite(parsed) && parsed === 0
}

/**
 * Whether a simulated approval takes a permission away rather than granting one: ApprovalForAll set
 * to false, any approval to the zero address (how ERC-721 clears a token approval), or an ERC-20
 * allowance of zero. The allowance is judged on the canonical base-unit `rawAmount` whenever the
 * server provides it; the decimals-applied `amount` is a display value that could round a tiny
 * allowance down to zero, so it is consulted only when there is nothing else.
 */
function isApprovalRevocation(approval: ApprovalChange): boolean {
  if (approval.kind === 'approvalForAll') {
    return approval.approved === false
  }
  if (isZeroAddress(approval.spender)) {
    return true
  }
  if (approval.tokenId) {
    return false
  }
  if (approval.rawAmount !== null) {
    return isZeroAmount(approval.rawAmount)
  }
  return approval.amount !== null && isZeroAmount(approval.amount)
}

/**
 * Whether a simulated approval must be acknowledged before approving. Revocations never are.
 * Full-collection access and an unlimited ERC-20 allowance always are, whoever the spender. Any other
 * grant — a limited allowance, even for exactly the balance, or a single token, even one LAND — hands
 * the asset over just as surely, so it is gated unless `isRecognizedSpender` vouches for the spender
 * (a Decentraland contract), for which such approvals are routine.
 *
 * The request page gates the Allow button on this and the summary shows its warning on it, so the
 * checkbox and the icon can never disagree.
 */
function isDangerousApproval(approval: ApprovalChange, isRecognizedSpender: (address: string) => boolean): boolean {
  if (isApprovalRevocation(approval)) {
    return false
  }
  if (approval.kind === 'approvalForAll') {
    return true
  }
  if (!approval.tokenId && approval.isUnlimited) {
    return true
  }
  return !isRecognizedSpender(approval.spender)
}

export { isApprovalRevocation, isDangerousApproval, isZeroAddress }
