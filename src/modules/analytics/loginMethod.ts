import { ConnectionOptionType } from '../../components/Connection'

const STORAGE_KEY = 'dcl_auth_last_login_method'

/**
 * How long a remembered method stays valid.
 *
 * A social login leaves this app entirely (OAuth redirect) and comes back on a fresh page load, so the
 * value has to outlive the navigation. An hour is generous for that round trip and short enough that a
 * method left behind by an abandoned attempt cannot be attributed to an unrelated login days later.
 * It also matches the window the warehouse already uses when it back-fills `method` from the preceding
 * click, so both sides agree on what counts as "the same attempt".
 */
const TTL_MS = 60 * 60 * 1000

type StoredMethod = {
  method: string
  at: number
}

/**
 * Record the provider the user just chose, so the success event can name it even when the login
 * completes on a different page load.
 *
 * Called from the click tracking rather than from each login flow: every login starts with a click we
 * already track with `method`, so wiring it here is what makes the guarantee hold for flows nobody
 * remembered to update — including the ones that redirect away.
 *
 * localStorage rather than sessionStorage on purpose: some providers return in a new tab, which starts
 * with an empty sessionStorage and would lose the value. The TTL is what keeps localStorage safe.
 */
function rememberLoginMethod(method?: ConnectionOptionType | string): void {
  if (!method) return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ method, at: Date.now() } satisfies StoredMethod))
  } catch {
    // Private mode or a full quota. Losing the method degrades analytics, never the login.
  }
}

/**
 * The method remembered for the login attempt in flight, or undefined when there is none to trust.
 *
 * Reads once and clears, so a stale value cannot be attributed to a later login that had no click of
 * its own (an auto-login, a restored session). Anything older than the TTL is discarded for the same
 * reason.
 */
function consumeLoginMethod(): string | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined

    localStorage.removeItem(STORAGE_KEY)

    const stored = JSON.parse(raw) as Partial<StoredMethod>
    if (typeof stored?.method !== 'string' || typeof stored?.at !== 'number') return undefined
    if (Date.now() - stored.at > TTL_MS) return undefined

    return stored.method
  } catch {
    return undefined
  }
}

export { consumeLoginMethod, rememberLoginMethod }
