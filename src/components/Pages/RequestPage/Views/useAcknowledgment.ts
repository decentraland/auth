import { useCallback, useState } from 'react'

/**
 * The acknowledgment checkbox of a review, bound to a statement: the request, the payload and every
 * notice shown alongside it, folded into one string by the page. A tick is given to that statement
 * only. When any part of it changes (another request, a re-review that found another callback, a
 * different reason), the tick no longer counts and the view asks again.
 *
 * Derived, never synced: `acknowledged` is computed from the stored statement on every render. An
 * effect that cleared a stale tick would do so one render late, and for that one commit the Allow
 * button would be enabled against a statement the user never acknowledged.
 */
function useAcknowledgment(statement: string): { acknowledged: boolean; setAcknowledged: (checked: boolean) => void } {
  const [acknowledgedStatement, setAcknowledgedStatement] = useState<string | null>(null)
  const acknowledged = acknowledgedStatement === statement
  const setAcknowledged = useCallback((checked: boolean) => setAcknowledgedStatement(checked ? statement : null), [statement])
  return { acknowledged, setAcknowledged }
}

export { useAcknowledgment }
