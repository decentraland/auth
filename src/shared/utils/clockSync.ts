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
 * Gets the time difference between local and server clocks
 * @param serverTimestamp - Server timestamp in milliseconds
 * @returns Time difference in minutes (positive if local is ahead, negative if behind)
 */
const getClockDifference = (serverTimestamp: number): number => {
  const localTimestamp = Date.now()
  const timeDifference = localTimestamp - serverTimestamp
  return Math.round(timeDifference / (60 * 1000)) // Convert to minutes
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
    return isClockSynchronized(healthData.timestamp)
  } catch {
    // If we can't check the clock, proceed with normal flow
    return true
  }
}

export { isClockSynchronized, getClockDifference, checkClockSync }
