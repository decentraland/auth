/**
 * Checks if the local computer clock is synchronized with the server clock
 * @param serverTimestamp - Server timestamp in milliseconds
 * @param toleranceMinutes - Tolerance in minutes (default: 5)
 * @returns true if clocks are synchronized within tolerance, false otherwise
 */
const isClockSynchronized = (serverTimestamp: number, toleranceMinutes = 5): boolean => {
  const localTimestamp = Date.now()
  const timeDifference = Math.abs(localTimestamp - serverTimestamp)
  const toleranceMs = toleranceMinutes * 60 * 1000 // Convert minutes to milliseconds

  return timeDifference <= toleranceMs
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

export { isClockSynchronized, checkClockSync }
