/**
 * Extracts a field from the OAuth state parameter's customData.
 * The state parameter is base64-encoded JSON with a customData field that is also JSON-encoded.
 */
const extractFromStateParameter = <T>(searchParams: URLSearchParams, field: string): T | null => {
  try {
    const state = searchParams.get('state')
    if (!state) return null

    const decoded = JSON.parse(atob(state))
    const customData = JSON.parse(decoded.customData)
    return customData[field] ?? null
  } catch {
    console.error("Can't decode state parameter")
    return null
  }
}

/**
 * Extracts multiple fields from the OAuth state parameter's customData.
 */
const extractMultipleFromStateParameter = <T extends Record<string, unknown>>(
  searchParams: URLSearchParams,
  fields: string[]
): Partial<T> => {
  try {
    const state = searchParams.get('state')
    if (!state) return {}

    const decoded = JSON.parse(atob(state))
    const customData = JSON.parse(decoded.customData)

    const result: Record<string, unknown> = {}
    for (const field of fields) {
      if (customData[field] !== undefined) {
        result[field] = customData[field]
      }
    }
    return result as Partial<T>
  } catch {
    console.error("Can't decode state parameter")
    return {}
  }
}

export { extractFromStateParameter, extractMultipleFromStateParameter }
