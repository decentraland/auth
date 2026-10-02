/* eslint-disable @typescript-eslint/naming-convention */
const PROTOCOL_PREFIX = /^[a-z][a-z0-9+.-]*:\/\//i
const TRAILING_SLASHES = /\/+$/

type SegmentProxy = {
  /** Origin analytics.js loads its bundle, settings and remote plugins from, instead of Segment's CDN. */
  cdnUrl?: string
  /** Load options that deliver the events to the proxy instead of Segment's ingestion endpoint. */
  loadOptions?: { integrations: { 'Segment.io': { apiHost: string } } }
}

function parseHttpsUrl(name: string, value: string): URL | undefined {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    console.warn(`[Analytics] Ignoring the ${name} "${value}", it is not a valid URL`)
    return undefined
  }

  if (url.protocol !== 'https:') {
    console.warn(`[Analytics] Ignoring the ${name} "${value}", it is not served over https`)
    return undefined
  }

  return url
}

/**
 * Both values come from the build configuration and decide where a third party script is loaded from and where
 * every event is delivered, so a value that is not an https URL is dropped and analytics keeps Segment's own hosts.
 *
 * `apiHost` takes no protocol and no trailing slash, analytics.js prepends the protocol and appends the method path.
 */
function getSegmentProxy(cdnUrl?: string, apiHost?: string): SegmentProxy {
  const proxy: SegmentProxy = {}

  const cdn = cdnUrl ? parseHttpsUrl('cdn url', cdnUrl) : undefined
  if (cdn) {
    proxy.cdnUrl = cdn.origin
  }

  const host = apiHost ? parseHttpsUrl('api host', PROTOCOL_PREFIX.test(apiHost) ? apiHost : `https://${apiHost}`) : undefined
  if (host) {
    proxy.loadOptions = { integrations: { 'Segment.io': { apiHost: `${host.host}${host.pathname}`.replace(TRAILING_SLASHES, '') } } }
  }

  return proxy
}

export type { SegmentProxy }
export { getSegmentProxy }
