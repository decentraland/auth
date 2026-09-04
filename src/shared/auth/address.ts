// A 20-byte Ethereum address: `0x` followed by 40 hex characters. Shared by the recover-time guard
// and every request parser so they judge an address the same way and cannot drift on casing — the
// drift that let a `0X`-prefixed signer be misread as signable content. Case-insensitive on the `0x`
// prefix to match how signers are compared (isSigner lowercases both sides), so a `0X` value the
// guard accepts is recognized as an address everywhere.
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/i

export { ADDRESS_REGEX }
