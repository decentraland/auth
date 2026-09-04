import { CALLDATA_ALIASES } from '../../../shared/auth'

const describeType = (value: unknown): string => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value)

function getUnsupportedCalldataAlias(txParams: Record<string, unknown> | undefined): string | null {
  if (!txParams) return null
  return CALLDATA_ALIASES.find(key => txParams[key] !== undefined) ?? null
}

function buildTransactionParams(params: unknown[] | undefined): [Record<string, unknown>] {
  const [txParams] = params ?? []
  if (txParams === null || typeof txParams !== 'object' || Array.isArray(txParams)) {
    throw new Error(`Transaction parameters must be an object, received ${describeType(txParams)}: ${JSON.stringify(txParams ?? null)}`)
  }
  const source = txParams as Record<string, unknown>
  const alias = getUnsupportedCalldataAlias(source)
  if (alias) {
    throw new Error(`Transaction parameter "${alias}" is not supported; calldata must be provided in "data"`)
  }
  const to = source.to
  if (typeof to !== 'string' || to.length === 0) {
    throw new Error(`Transaction parameters are missing a "to" address: ${JSON.stringify(source)}`)
  }
  return [{ to, data: source.data ?? '0x', value: source.value ?? '0x0' }]
}

export { buildTransactionParams, getUnsupportedCalldataAlias }
