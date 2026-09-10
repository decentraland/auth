import { SimulationResponseBody } from './types'

/**
 * A stable fingerprint of what a preview showed the user: its outcome, the asset movements, the approvals,
 * the net dollar change and the events. The acknowledgment views fold it into the statement the user ticks,
 * so a tick given to one preview cannot stay valid for a different one — for instance when the same request
 * is simulated again while the page stays mounted. Empty when there is no preview to fingerprint.
 *
 * Everything the review renders or judges is covered, not only the movements: the summary shows the net
 * dollar line and the events list, and the branded views decide what they may stand in for from the events
 * and the truncation flag. A tick that survived a change to any of those would be a tick given to a screen
 * the user never saw.
 */
function getPreviewFingerprint(result: SimulationResponseBody | undefined): string {
  if (!result) {
    return ''
  }
  return JSON.stringify([
    result.status,
    result.error ?? null,
    result.assetChanges,
    result.approvalChanges,
    result.balanceChanges ?? [],
    result.events ?? [],
    result.eventsTruncated ?? null
  ])
}

export { getPreviewFingerprint }
