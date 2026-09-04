import { SimulationResponseBody } from './types'

/**
 * Whether a preview that ran shows the user nothing to check: no asset moving into or out of their
 * account and no permission change. Movements between third parties are not shown by the summary, so
 * they do not count as visible either. A reverted preview is judged by its revert, not by this.
 *
 * "Nothing to show" is not "nothing happens". A call can change state the preview does not model — an
 * update operator on LAND, a collection's minters, managers or creator, a name's resolver — so the
 * request page gates such a request behind an acknowledgment, and the summary's note and the views'
 * checkbox wording follow this one rule so they cannot disagree with it.
 */
function hasNoVisibleEffects(result: SimulationResponseBody, userAddress: string): boolean {
  if (result.status === 'reverted') {
    return false
  }
  const user = userAddress.toLowerCase()
  const involvesUser = result.assetChanges.some(change => change.from?.toLowerCase() === user || change.to?.toLowerCase() === user)
  return !involvesUser && result.approvalChanges.length === 0
}

export { hasNoVisibleEffects }
