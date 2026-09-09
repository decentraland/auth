/**
 * The only form of a third-party URL the page will hand to an image tag or fetch: an absolute `https:`
 * URL that parses. Anything else (another scheme, a relative path, garbage) is dropped, and the caller
 * shows its placeholder instead. Content a scene, a token or a place author controls never picks the
 * scheme or a plain-http host on the auth origin.
 */
function getHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  try {
    const url = new URL(value)
    // No embedded credentials either: the browser would send them from the auth origin.
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

export { getHttpsUrl }
