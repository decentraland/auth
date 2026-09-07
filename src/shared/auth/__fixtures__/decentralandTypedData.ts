import { _TypedDataEncoder } from '@ethersproject/hash'
import { getAddress } from 'viem'

type Field = { name: string; type: string }

/** Generic EIP-712 typed data as the JSON-RPC param carries it, parsed. */
type DappTypedData = {
  primaryType: string
  types: Record<string, Field[]>
  domain: Record<string, unknown>
  message: Record<string, unknown>
}

type SignedByDapp = {
  payload: DappTypedData
  /** Fields whose rendering the payload exercises, addressed by their path in the review, with the value shown. */
  shown: { path: string[]; value: string }[]
}

const DAPP_USER = '0x1234567890abcdef1234567890abcdef12345678'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const MANA_POLYGON = '0xa1c57f48f0deb89f569dfbe6e2b7f46d33606fd4'
const COLLECTION = '0x3c2b9b4bd4f8f9a1c0d2e3f4a5b6c7d8e9f0a1b2'
const LAND = '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d'
const COLLECTION_TOKEN_ID = '210624583337114373395836055367340864637790190801098222508621955073'
const LAND_TOKEN_ID = '3402823669209384634633746074317682114580'

// hexZeroPad(hexlify(chainId), 32): the bytes32 the dApps derive from a chain id, as a domain salt on Polygon
// and, in the rentals dApp, as the domain's chainId itself.
const chainIdBytes32 = (chainId: number): string => `0x${chainId.toString(16).padStart(64, '0')}`

type EthersDomain = Parameters<typeof _TypedDataEncoder.getPayload>[0]

// What ethers v5's JsonRpcSigner._signTypedData puts on the wire for the domain, types and values a dApp
// hands it: EIP712Domain derived from the fields present, only the declared message keys in declared order,
// integers as decimal strings, addresses lowercased, bytes hexlified and booleans kept as booleans.
const signedThroughEthers = (domain: EthersDomain, types: Record<string, Field[]>, value: Record<string, unknown>): DappTypedData =>
  _TypedDataEncoder.getPayload(domain, types, value) as DappTypedData

/* eslint-disable @typescript-eslint/naming-convention */
// decentraland-dapps src/lib/trades.ts, shared by the marketplace and the shop.
const OFFCHAIN_MARKETPLACE_TYPES: Record<string, Field[]> = {
  Trade: [
    { name: 'checks', type: 'Checks' },
    { name: 'sent', type: 'AssetWithoutBeneficiary[]' },
    { name: 'received', type: 'Asset[]' }
  ],
  Asset: [
    { name: 'assetType', type: 'uint256' },
    { name: 'contractAddress', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'extra', type: 'bytes' },
    { name: 'beneficiary', type: 'address' }
  ],
  AssetWithoutBeneficiary: [
    { name: 'assetType', type: 'uint256' },
    { name: 'contractAddress', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'extra', type: 'bytes' }
  ],
  Checks: [
    { name: 'uses', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'effective', type: 'uint256' },
    { name: 'salt', type: 'bytes32' },
    { name: 'contractSignatureIndex', type: 'uint256' },
    { name: 'signerSignatureIndex', type: 'uint256' },
    { name: 'allowedRoot', type: 'bytes32' },
    { name: 'externalChecks', type: 'ExternalCheck[]' }
  ],
  ExternalCheck: [
    { name: 'contractAddress', type: 'address' },
    { name: 'selector', type: 'bytes4' },
    { name: 'value', type: 'bytes' },
    { name: 'required', type: 'bool' }
  ]
}

// marketplace webapp/src/modules/rental/utils.ts
const RENTALS_LISTING_TYPES: Record<string, Field[]> = {
  Listing: [
    { name: 'signer', type: 'address' },
    { name: 'contractAddress', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'indexes', type: 'uint256[3]' },
    { name: 'pricePerDay', type: 'uint256[]' },
    { name: 'maxDays', type: 'uint256[]' },
    { name: 'minDays', type: 'uint256[]' },
    { name: 'target', type: 'address' }
  ]
}

// @snapshot-labs/snapshot.js voteArray2Types: an approval or ranked-choice vote on a proposal with a bytes32 id.
const SNAPSHOT_VOTE_ARRAY_TYPES: Record<string, Field[]> = {
  Vote: [
    { name: 'from', type: 'address' },
    { name: 'space', type: 'string' },
    { name: 'timestamp', type: 'uint64' },
    { name: 'proposal', type: 'bytes32' },
    { name: 'choice', type: 'uint32[]' },
    { name: 'reason', type: 'string' },
    { name: 'app', type: 'string' },
    { name: 'metadata', type: 'string' }
  ]
}

/**
 * The generic typed data Decentraland's own dApps ask a wallet to sign, keyed by what it is. Three go through
 * ethers v5 exactly as the dApps call it; the builder's cheque is the JSON the builder assembles by hand, with a
 * numeric qty and a checksummed verifying contract.
 */
const SIGNED_BY_DAPPS: Record<string, SignedByDapp> = {
  'off-chain marketplace Trade': {
    // decentraland-dapps getTradeSignature: the Polygon marketplace domain and generateTradeValues(trade), a
    // wearable listed for MANA with an ownership check, the beneficiary as the wallet reported it.
    payload: signedThroughEthers(
      {
        name: 'DecentralandMarketplacePolygon',
        version: '1.0.0',
        salt: chainIdBytes32(137),
        verifyingContract: '0xa40b1d129b8906888720686f3a01921ddf37716f'
      },
      OFFCHAIN_MARKETPLACE_TYPES,
      {
        checks: {
          uses: 1,
          expiration: 1767225600,
          effective: 1764547200,
          salt: `0x${'ab'.repeat(32)}`,
          contractSignatureIndex: 0,
          signerSignatureIndex: 0,
          allowedRoot: `0x${'00'.repeat(32)}`,
          externalChecks: [{ contractAddress: COLLECTION, selector: '0x70a08231', value: '0x', required: true }]
        },
        sent: [{ assetType: 3, contractAddress: COLLECTION, value: COLLECTION_TOKEN_ID, extra: '0x' }],
        received: [
          { assetType: 1, contractAddress: MANA_POLYGON, value: '1000000000000000000', extra: '0x', beneficiary: getAddress(DAPP_USER) }
        ]
      }
    ),
    shown: [
      { path: ['checks', 'uses'], value: '1' },
      { path: ['checks', 'externalChecks', '[0]', 'selector'], value: '0x70a08231' },
      { path: ['checks', 'externalChecks', '[0]', 'value'], value: '0x' },
      { path: ['checks', 'externalChecks', '[0]', 'required'], value: 'true' },
      { path: ['sent', '[0]', 'value'], value: COLLECTION_TOKEN_ID },
      { path: ['received', '[0]', 'beneficiary'], value: DAPP_USER }
    ]
  },
  'rentals Listing': {
    // marketplace signListing: the mainnet Rentals domain with its chainId handed over as bytes32, a LAND
    // listed for two rental periods.
    payload: signedThroughEthers(
      { name: 'Rentals', verifyingContract: '0x3a1469499d0be105d4f77045ca403a5f6dc2f3f5', version: '1', chainId: chainIdBytes32(1) },
      RENTALS_LISTING_TYPES,
      {
        signer: DAPP_USER,
        contractAddress: LAND,
        tokenId: LAND_TOKEN_ID,
        expiration: '1767225600',
        indexes: ['0', '3', '1'],
        pricePerDay: ['1000000000000000000', '5000000000000000000'],
        maxDays: ['7', '30'],
        minDays: ['1', '7'],
        target: ZERO_ADDRESS
      }
    ),
    shown: [
      { path: ['tokenId'], value: LAND_TOKEN_ID },
      { path: ['indexes', '[2]'], value: '1' },
      { path: ['pricePerDay', '[1]'], value: '5000000000000000000' },
      { path: ['target'], value: ZERO_ADDRESS }
    ]
  },
  'governance Snapshot vote': {
    // snapshot.js Client712.vote: a domain with neither chainId nor verifying contract, the message as the
    // client completes it (checksummed from, unix timestamp, empty reason, default metadata).
    payload: signedThroughEthers({ name: 'snapshot', version: '0.1.4' }, SNAPSHOT_VOTE_ARRAY_TYPES, {
      from: getAddress(DAPP_USER),
      space: 'snapshot.dcl.eth',
      timestamp: 1767225600,
      proposal: `0x${'cd'.repeat(32)}`,
      choice: [1, 3],
      reason: '',
      app: 'snapshot',
      metadata: '{}'
    }),
    shown: [
      { path: ['from'], value: DAPP_USER },
      { path: ['timestamp'], value: '1767225600' },
      { path: ['choice', '[1]'], value: '3' },
      { path: ['reason'], value: '' },
      { path: ['metadata'], value: '{}' }
    ]
  },
  'builder ConsumeSlots cheque': {
    // builder src/modules/thirdParty/utils.ts getPublishItemsSignature: JSON.stringify of this object.
    payload: {
      domain: {
        name: 'Decentraland Third Party Registry',
        verifyingContract: '0x1C436C1EFb4608dFfDC8bace99d2B03c314f3348',
        version: '1',
        salt: chainIdBytes32(137)
      },
      message: { thirdPartyId: 'urn:decentraland:matic:collections-thirdparty:cryptohats', qty: 10, salt: `0x${'5f'.repeat(32)}` },
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'verifyingContract', type: 'address' },
          { name: 'salt', type: 'bytes32' }
        ],
        ConsumeSlots: [
          { name: 'thirdPartyId', type: 'string' },
          { name: 'qty', type: 'uint256' },
          { name: 'salt', type: 'bytes32' }
        ]
      },
      primaryType: 'ConsumeSlots'
    },
    shown: [
      { path: ['thirdPartyId'], value: 'urn:decentraland:matic:collections-thirdparty:cryptohats' },
      { path: ['qty'], value: '10' },
      { path: ['salt'], value: `0x${'5f'.repeat(32)}` }
    ]
  }
}
/* eslint-enable @typescript-eslint/naming-convention */

export { DAPP_USER, SIGNED_BY_DAPPS }
export type { DappTypedData, SignedByDapp }
