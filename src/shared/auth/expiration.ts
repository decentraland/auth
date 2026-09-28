import { InvalidRequestExpirationError } from './errors'

/** Parse the server's required deadline once, rejecting values that would disable expiry checks. */
function getRequestExpirationTimestamp(expiration: unknown): number {
  if (typeof expiration !== 'string' || expiration.trim() === '') throw new InvalidRequestExpirationError()
  const timestamp = Date.parse(expiration)
  if (!Number.isFinite(timestamp)) throw new InvalidRequestExpirationError()
  return timestamp
}

export { getRequestExpirationTimestamp }
