// Hex-encoded bytes as wallets sign them: a lowercase `0x` prefix and at least one whole byte. Strict on
// the prefix on purpose: viem, MetaMask and the other wallets treat only `0x…` as bytes and sign a `0X…`
// or bare string as the UTF-8 of its characters. The classifier decides once, with this predicate, which
// bytes a personal_sign message is; the review shows those bytes and the wallet is handed those same bytes.
const HEX_BYTES_REGEX = /^0x([0-9a-fA-F]{2})+$/

/** Whether `value` is hex-encoded bytes a wallet signs as bytes (see HEX_BYTES_REGEX). */
function isHexBytes(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && HEX_BYTES_REGEX.test(value)
}

// A 4-byte function selector followed by whole bytes of arguments.
const CALLDATA_REGEX = /^0x[0-9a-fA-F]{8}([0-9a-fA-F]{2})*$/

export { CALLDATA_REGEX, isHexBytes }
