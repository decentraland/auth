import { SimulationResponseBody } from './types'

/**
 * A stable fingerprint of what a preview showed the user: its outcome, the asset movements and the
 * approvals. The acknowledgment views fold it into the statement the user ticks, so a tick given to
 * one preview cannot stay valid for a different one — for instance when the same request is
 * simulated again while the page stays mounted. Empty when there is no preview to fingerprint.
 */
function getPreviewFingerprint(result: SimulationResponseBody | undefined): string {
  if (!result) {
    return ''
  }
  return JSON.stringify([result.status, result.assetChanges, result.approvalChanges])
}

export { getPreviewFingerprint }
