/** Whether `value` is a plain object (not null, not an array), so its keys can be read. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export { isRecord }
