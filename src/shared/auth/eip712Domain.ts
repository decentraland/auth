// The fields EIP-712 defines for a domain, with the types the standard gives them. A Decentraland
// contract hashes its domain with exactly these types, and a wallet asked to derive the struct from the
// domain (when `types.EIP712Domain` is absent) knows these names and no other. Shared by the
// MetaTransaction resolver and the generic typed-data review so the two cannot drift.
const EIP712_DOMAIN_FIELD_TYPES: ReadonlyMap<string, string> = new Map([
  ['name', 'string'],
  ['version', 'string'],
  ['chainId', 'uint256'],
  ['verifyingContract', 'address'],
  ['salt', 'bytes32']
])

export { EIP712_DOMAIN_FIELD_TYPES }
