/**
 * Generates a lightweight device fingerprint based on browser characteristics.
 * This is used as an anti-abuse signal for the referral system — it helps detect
 * users rotating VPNs/proxies while using the same physical device.
 *
 * The fingerprint is a hex-encoded hash of stable browser properties:
 * - Canvas rendering output
 * - WebGL renderer info
 * - Screen dimensions
 * - Timezone
 * - Language and platform
 * - Hardware concurrency and device memory
 *
 * This does NOT use cookies, local storage, or any persistent state.
 * It is computed fresh on each call and sent as a request header.
 */

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('Dcl fingerprint', 2, 15)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('Dcl fingerprint', 4, 17)

    return canvas.toDataURL()
  } catch {
    return ''
  }
}

function getWebGLInfo(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl || !(gl instanceof WebGLRenderingContext)) return ''

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (!debugInfo) return ''

    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string
    return `${vendor}~${renderer}`
  } catch {
    return ''
  }
}

function getScreenInfo(): string {
  try {
    return `${screen.width}x${screen.height}x${screen.colorDepth}x${window.devicePixelRatio}`
  } catch {
    return ''
  }
}

function getBrowserProperties(): string {
  const props = [
    navigator.language,
    navigator.platform,
    navigator.hardwareConcurrency?.toString() ?? '',
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory?.toString() ?? '',
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    new Date().getTimezoneOffset().toString()
  ]
  return props.join('|')
}

/**
 * Generates a device fingerprint string (SHA-256 hex hash).
 * Returns an empty string if fingerprinting fails entirely.
 */
export async function generateDeviceFingerprint(): Promise<string> {
  try {
    const components = [getCanvasFingerprint(), getWebGLInfo(), getScreenInfo(), getBrowserProperties()]

    const raw = components.join('||')
    return await hashString(raw)
  } catch {
    return ''
  }
}
