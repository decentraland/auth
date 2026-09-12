// Query strings and fragments can carry an OAuth response, a nested return URL, or identifying
// information. Telemetry needs the route, not those values. Do not decode or log them while scrubbing.
function sanitizeTelemetryUrl(value: string): string {
  return value.split(/[?#]/, 1)[0]
}

const URL_IN_TEXT = /(?:https?:\/\/|\/)[^\s"'<>\\]+/gi
const PRIVATE_URL_FIELDS = new Set([
  'search',
  'query_string',
  'queryString',
  'hash',
  'http.query',
  'http.fragment',
  'url.query',
  'url.fragment'
])

/** Scrub URL-bearing telemetry, including SDK-added request context, spans and navigation breadcrumbs. */
function sanitizeTelemetryData<T>(value: T): T {
  const seen = new WeakSet<object>()
  const scrub = (entry: unknown, depth: number): unknown => {
    if (typeof entry === 'string') return entry.replace(URL_IN_TEXT, sanitizeTelemetryUrl)
    if (entry === null || typeof entry !== 'object') return entry
    if (depth > 30 || seen.has(entry)) return '[Filtered]'
    // SDK events are JSON objects; preserve other values (such as Date) for their normal serializer.
    if (!Array.isArray(entry) && Object.getPrototypeOf(entry) !== Object.prototype && Object.getPrototypeOf(entry) !== null) return entry
    seen.add(entry)
    const result = Array.isArray(entry)
      ? entry.map(child => scrub(child, depth + 1))
      : Object.fromEntries(
          Object.entries(entry).map(([key, child]) => [key, PRIVATE_URL_FIELDS.has(key) ? '[Filtered]' : scrub(child, depth + 1)])
        )
    seen.delete(entry)
    return result
  }
  return scrub(value, 0) as T
}

/** Callback documents contain authorization responses before the OAuth SDK consumes the URL. */
function isOauthCallbackPath(pathname: string): boolean {
  try {
    return /^\/auth\/(?:mobile\/)?callback\/?$/i.test(decodeURIComponent(pathname))
  } catch {
    // A malformed path is not a document we need a recording of.
    return true
  }
}

export { sanitizeTelemetryData, sanitizeTelemetryUrl, isOauthCallbackPath }
