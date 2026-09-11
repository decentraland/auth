import { CALLDATA_ALIASES, QUANTITY_REGEX } from '../../../shared/auth'

const describeType = (value: unknown): string => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value)

function getUnsupportedCalldataAlias(txParams: Record<string, unknown> | undefined): string | null {
  if (!txParams) return null
  return CALLDATA_ALIASES.find(key => txParams[key] !== undefined) ?? null
}

/**
 * Normalizes a transaction `value` to the canonical `0x` hex quantity.
 *
 * The recover guard accepts a hex or a decimal string, and the review reads either one numerically,
 * but the wallets do not all agree on a decimal string: thirdweb's in-app signer treats any non-`0x`
 * string as text and signs its UTF-8 bytes, so a decimal `"10000000"` (1e7 wei, about nothing) would
 * go out as `0x3130303030303030` (about 3.5 ETH) while the review showed the tiny amount. Converting
 * once here, and handing the same hex to both the review and the wallet, means what is shown is what
 * is sent.
 */
function toHexQuantity(value: unknown): string {
  if (typeof value !== 'string' || !QUANTITY_REGEX.test(value)) {
    throw new Error(
      `Transaction "value" must be a hex or decimal quantity, received ${describeType(value)}: ${JSON.stringify(value ?? null)}`
    )
  }
  return `0x${BigInt(value).toString(16)}`
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
  const data = source.data ?? '0x'
  if (typeof data !== 'string') {
    throw new Error(`Transaction "data" must be hex-encoded bytes, received ${describeType(data)}: ${JSON.stringify(data)}`)
  }
  // One spelling of the address and the calldata for everything downstream. Hex is case-insensitive, but the
  // relay and the explorers require a lowercase `0x` prefix, and the guard accepts `0X`: left as sent, a
  // `0X…` address would be recognized here and be refused by the relay after the wallet signed. Lowercased
  // once, the fingerprint, the display, the wallet and the relay all see the same bytes the same way.
  return [{ to: to.toLowerCase(), data: data.toLowerCase(), value: toHexQuantity(source.value ?? '0x0') }]
}

export { buildTransactionParams, getUnsupportedCalldataAlias, toHexQuantity }
