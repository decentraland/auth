/**
 * Checks if the local computer clock is synchronized with the server clock
 * @param serverTimestamp - Server timestamp in milliseconds
 * @param toleranceMinutes - Tolerance in minutes (default: 5)
 * @returns true if clocks are synchronized within tolerance, false otherwise
 */
export const isClockSynchronized = (serverTimestamp: number, toleranceMinutes = 5): boolean => {
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
export const getClockDifference = (serverTimestamp: number): number => {
  const localTimestamp = Date.now()
  const timeDifference = localTimestamp - serverTimestamp
  return Math.round(timeDifference / (60 * 1000)) // Convert to minutes
}

/**
 * Checks if an error is a clock synchronization error from the auth server.
 * These errors occur when the signed request timestamp is rejected by the server:
 * - "the request is not recent enough" (local clock is behind)
 * - "the request is too far in the future" (local clock is ahead)
 *
 * @param error - The error to check
 * @returns true if the error is a clock sync error, false otherwise
 */
export const isClockSyncError = (error: unknown): boolean => {
  let message = ''

  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message)
  }

  if (!message) {
    return false
  }

  return /the request is not recent enough|the request is too far in the future/i.test(message)
}
