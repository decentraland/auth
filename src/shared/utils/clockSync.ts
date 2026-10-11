/**
 * How far the local clock may lag behind the server's. Signed fetches (ADR-44) carry the local
 * `Date.now()` as their timestamp and the auth server rejects one whose timestamp is more than 60s
 * in its past, so a clock further behind than that fails every signed request (`POST /identities`
 * answers "Expired signature"). Half the window leaves the other half for the request's latency.
 */
const MAX_CLOCK_BEHIND_MS = 30 * 1000

/**
 * How far the local clock may run ahead of the server's. A timestamp in the future is not rejected
 * by the signed-fetch check, so this keeps the tolerance the check has always had.
 */
const MAX_CLOCK_AHEAD_MS = 5 * 60 * 1000

/**
 * Checks if the local computer clock is synchronized with the server clock.
 * The tolerance is asymmetric: a clock that is behind breaks signed requests long before one that
 * is ahead does (see MAX_CLOCK_BEHIND_MS).
 * @param serverTimestamp - Server timestamp in milliseconds
 * @returns true if the local clock is within tolerance of the server's, false otherwise
 */
const isClockSynchronized = (serverTimestamp: number): boolean => {
  const drift = Date.now() - serverTimestamp // negative when the local clock is behind

  return drift >= -MAX_CLOCK_BEHIND_MS && drift <= MAX_CLOCK_AHEAD_MS
}

/**
 * Checks clock synchronization against the auth server.
 * Returns true if the clock is in sync (or if the check fails — best-effort).
 */
async function checkClockSync(): Promise<boolean> {
  try {
    // Lazy import to avoid circular dependency with auth httpClient
    const { createAuthServerHttpClient } = await import('../auth')
    const httpClient = createAuthServerHttpClient()
    const healthData = await httpClient.checkHealth()
    // A malformed/absent timestamp must fail OPEN (proceed), consistent with a network error
    // below. Otherwise isClockSynchronized(undefined) computes NaN, NaN <= tolerance is false,
    // and a user with a perfectly fine clock would be wrongly forced through the clock-sync gate.
    if (typeof healthData?.timestamp !== 'number') {
      return true
    }
    return isClockSynchronized(healthData.timestamp)
  } catch {
    // If we can't check the clock, proceed with normal flow
    return true
  }
}

export { isClockSynchronized, checkClockSync, MAX_CLOCK_AHEAD_MS, MAX_CLOCK_BEHIND_MS }
