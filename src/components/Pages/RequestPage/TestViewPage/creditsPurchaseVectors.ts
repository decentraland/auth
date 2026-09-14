/* eslint-disable @typescript-eslint/naming-convention -- EIP-712 type names (EIP712Domain, MetaTransaction) are fixed by the standard and the contracts */
import { AbiFunction, encodeAbiParameters, encodeFunctionData, pad, stringToHex, toFunctionSelector } from 'viem'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ContractName, getContract } from 'decentraland-transactions'
import { getMetaTransactionSalt } from '../../../../shared/auth'

/**
 * Explorer-compatible credits-purchase payloads, built from the same contract ABIs the request is decoded
 * against.
 *
 * These are not hand-written hex. The Explorer encodes `useCredits(accept([trade]))` through its own ABI
 * strings (CreditsTradeEncoder) and wraps it in the Decentraland meta-transaction; everything here goes
 * through `decentraland-transactions`' registry ABIs instead, and `creditsPurchase.spec.ts` asserts that for
 * the Explorer's own golden-vector inputs the two produce byte-identical calldata (see
 * EXPLORER_GOLDEN_USE_CREDITS). So a payload built here is a payload the Explorer could have sent, and a
 * decoder that reads one reads the other.
 *
 * The happy-path listing is a real one, read from the production marketplace: trade
 * f660f9ce-982e-49d9-a903-05304bbbdd0d, whose catalogue price is 7 credits — which is what the decoder must
 * derive from its signed USD-pegged amount and nothing else.
 */

const POLYGON = ChainId.MATIC_MAINNET as number

const creditsManagerContract = getContract(ContractName.CreditsManager, POLYGON)
const marketplaceContract = getContract(ContractName.OffChainMarketplaceV2, POLYGON)
const manaContract = getContract(ContractName.MANAToken, POLYGON)

const useCreditsFunction = (creditsManagerContract.abi as unknown as AbiFunction[]).find(
  item => item.type === 'function' && item.name === 'useCredits'
) as AbiFunction
const acceptFunction = (marketplaceContract.abi as unknown as AbiFunction[]).find(
  item => item.type === 'function' && item.name === 'accept'
) as AbiFunction

const ACCEPT_SELECTOR = toFunctionSelector(acceptFunction)

const ZERO_BYTES32 = pad('0x', { size: 32 })

type ExternalCheck = { contractAddress: string; selector: string; value: string; required: boolean }
type TradeAsset = { assetType: bigint; contractAddress: string; value: bigint; beneficiary: string; extra: string }
type Trade = {
  signer: string
  signature: string
  checks: {
    uses: bigint
    expiration: bigint
    effective: bigint
    salt: string
    contractSignatureIndex: bigint
    signerSignatureIndex: bigint
    allowedRoot: string
    allowedProof: readonly string[]
    externalChecks: readonly ExternalCheck[]
  }
  sent: readonly TradeAsset[]
  received: readonly TradeAsset[]
}
type UseCreditsArgs = {
  credits: ReadonlyArray<{ value: bigint; expiresAt: bigint; salt: string }>
  creditsSignatures: readonly string[]
  externalCall: { target: string; selector: string; data: string; expiresAt: bigint; salt: string }
  customExternalCallSignature: string
  maxUncreditedValue: bigint
  maxCreditedValue: bigint
}

/** `accept([trade])` as the (selector, data) pair the `externalCall` struct carries. */
function encodeAccept(trades: readonly Trade[]): string {
  return encodeAbiParameters(acceptFunction.inputs, [trades] as never)
}

/** The `useCredits` calldata the meta-transaction signs. */
function encodeUseCredits(args: UseCreditsArgs): string {
  return encodeFunctionData({ abi: [useCreditsFunction], functionName: 'useCredits', args: [args] as never })
}

/**
 * The eth_signTypedData_v4 payload the Explorer sends: the Decentraland meta-transaction, with the chain id
 * in the domain `salt` as a bytes32 rather than in `chainId`, and the nonce as a decimal string.
 */
function buildMetaTransactionTypedData({
  calldata,
  from,
  nonce = 0n,
  chainId = POLYGON,
  verifyingContract = creditsManagerContract.address,
  domainName = creditsManagerContract.name,
  domainVersion = creditsManagerContract.version
}: {
  calldata: string
  from: string
  nonce?: bigint
  chainId?: number
  verifyingContract?: string
  domainName?: string
  domainVersion?: string
}): string {
  return JSON.stringify({
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'verifyingContract', type: 'address' },
        { name: 'salt', type: 'bytes32' }
      ],
      MetaTransaction: [
        { name: 'nonce', type: 'uint256' },
        { name: 'from', type: 'address' },
        { name: 'functionData', type: 'bytes' }
      ]
    },
    domain: { name: domainName, version: domainVersion, verifyingContract, salt: getMetaTransactionSalt(chainId) },
    primaryType: 'MetaTransaction',
    message: { nonce: nonce.toString(), from, functionData: calldata }
  })
}

// --- The real listing -------------------------------------------------------------------------------
// marketplace-api.decentraland.org/v1/trades/f660f9ce-982e-49d9-a903-05304bbbdd0d, read on 2026-09-14.
// Its catalogue entry ("UpperHead AHL", collection 0xd0e9…3f3f, item 0) is priced at 7 credits, and its
// received asset is 700000000000000000 USD wei — the two numbers this feature has to agree on.

const BUYER = '0xb0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0'
const SELLER = '0x5e11e50000000000000000000000000000005e11'
const COLLECTION = '0xd0e9b1e87f94ecedf15db41ddb95f1825d5e3f3f'
const REAL_LISTING_PRICE_USD_WEI = 700000000000000000n
const REAL_LISTING_CREDITS = 7n
const REAL_LISTING_ITEM_ID = '0'

// Far enough ahead that the fixtures stay valid without a clock stub; the specs that exercise expiry
// override them explicitly.
const FAR_FUTURE = 4102444800n // 2100-01-01

function buildTradeChecks(overrides: Partial<Trade['checks']> = {}): Trade['checks'] {
  return {
    uses: 1n,
    expiration: FAR_FUTURE,
    effective: 0n,
    salt: '0x21e5efd942075840e820ae8083aa66e2cc80a100f550f52f6d4d803d46a0af42',
    contractSignatureIndex: 0n,
    signerSignatureIndex: 0n,
    allowedRoot: ZERO_BYTES32,
    allowedProof: [],
    externalChecks: [],
    ...overrides
  }
}

function buildTrade({ checks, buyer = BUYER, ...overrides }: Partial<Trade> & { buyer?: string } = {}): Trade {
  return {
    signer: SELLER,
    signature: `0x${'ab'.repeat(65)}`,
    sent: [{ assetType: 4n, contractAddress: COLLECTION, value: BigInt(REAL_LISTING_ITEM_ID), beneficiary: buyer, extra: '0x' }],
    received: [
      { assetType: 2n, contractAddress: manaContract.address, value: REAL_LISTING_PRICE_USD_WEI, beneficiary: SELLER, extra: '0x' }
    ],
    ...overrides,
    checks: buildTradeChecks(checks)
  }
}

function buildUseCreditsArgs({
  trades,
  buyer = BUYER,
  target = marketplaceContract.address,
  selector = ACCEPT_SELECTOR,
  externalCall,
  ...overrides
}: Partial<Omit<UseCreditsArgs, 'externalCall'>> & {
  trades?: readonly Trade[]
  buyer?: string
  target?: string
  selector?: string
  externalCall?: Partial<UseCreditsArgs['externalCall']>
} = {}): UseCreditsArgs {
  return {
    credits: [{ value: 1000000000000000000n, expiresAt: FAR_FUTURE, salt: pad(stringToHex('intent-1'), { size: 32, dir: 'left' }) }],
    creditsSignatures: [`0x${'cd'.repeat(65)}`],
    customExternalCallSignature: '0x',
    maxUncreditedValue: 0n,
    maxCreditedValue: 1000000000000000000n,
    ...overrides,
    externalCall: {
      target,
      selector,
      data: encodeAccept(trades ?? [buildTrade({ buyer })]),
      expiresAt: FAR_FUTURE,
      salt: `0x${'ef'.repeat(32)}`,
      ...externalCall
    }
  }
}

/** A complete Explorer-shaped credits purchase request: the calldata and the typed data around it. */
function buildCreditsPurchaseRequest({
  args,
  from = BUYER,
  ...typedDataOverrides
}: {
  args?: UseCreditsArgs
  from?: string
  nonce?: bigint
  chainId?: number
  verifyingContract?: string
  domainName?: string
  domainVersion?: string
} = {}): { calldata: string; typedData: string; from: string } {
  const calldata = encodeUseCredits(args ?? buildUseCreditsArgs({ buyer: from }))
  return { calldata, typedData: buildMetaTransactionTypedData({ calldata, from, ...typedDataOverrides }), from }
}

// --- The Explorer's own golden vector ---------------------------------------------------------------
// Inputs and expected bytes copied from the Explorer's CreditsTradeEncoderShould (which generated them
// with the shop web app's ethers reference implementation). Re-encoding them here and comparing is what
// proves the ABIs this module uses are the ones the Explorer signs.

const EXPLORER_GOLDEN_BUYER = '0x99995f38fc9d786eab5c3a1b1c4e6ae5f4e99999'

const EXPLORER_GOLDEN_ARGS: UseCreditsArgs = {
  credits: [{ value: 6000000000000000000n, expiresAt: 1767225600n, salt: pad(stringToHex('intent-abc-123'), { size: 32, dir: 'left' }) }],
  creditsSignatures: [`0x${'b'.repeat(130)}`],
  externalCall: {
    target: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    selector: ACCEPT_SELECTOR,
    data: encodeAccept([
      {
        signer: '0x24e5f44999c151f08609f8e27b2238c773c4d020',
        signature: `0x${'a'.repeat(130)}`,
        checks: {
          uses: 1n,
          // The Explorer normalizes the server's milliseconds to the seconds the contract compares.
          expiration: 1893456000n,
          effective: 1735689600n,
          salt: pad('0x1234', { size: 32 }),
          contractSignatureIndex: 0n,
          signerSignatureIndex: 0n,
          allowedRoot: ZERO_BYTES32,
          allowedProof: [],
          externalChecks: [
            { contractAddress: '0x1111111111111111111111111111111111111111', selector: '0xdeadbeef', value: '0x', required: true }
          ]
        },
        sent: [
          {
            assetType: 4n,
            contractAddress: '0x2222222222222222222222222222222222222222',
            value: 3n,
            beneficiary: EXPLORER_GOLDEN_BUYER,
            extra: '0x'
          }
        ],
        received: [
          {
            assetType: 2n,
            contractAddress: '0x3333333333333333333333333333333333333333',
            value: 2510000000000000000n,
            beneficiary: '0x4444444444444444444444444444444444444444',
            extra: '0x'
          }
        ]
      }
    ]),
    expiresAt: 1800000000n,
    salt: `0x${'cd'.repeat(32)}`
  },
  customExternalCallSignature: '0x',
  maxUncreditedValue: 1000000000000000000n,
  maxCreditedValue: 7000000000000000000n
}

/**
 * The exact `useCredits` calldata the Explorer's own golden-vector test expects for EXPLORER_GOLDEN_ARGS,
 * copied from CreditsTradeEncoderShould. Encoding the same inputs through the registry ABI must reproduce
 * it byte for byte; anything else means this module, and therefore the decoder, is reading a different
 * wire format than the Explorer writes.
 */
const EXPLORER_GOLDEN_USE_CREDITS =
  '0x' +
  '1863572d0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000' +
  '00000000000000c000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000' +
  '000000000000000000000200000000000000000000000000000000000000000000000000000000000000086000000000000000000000000000000000' +
  '00000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000006124fee993bc0000000000000000000000000000' +
  '000000000000000000000000000000000000000100000000000000000000000000000000000000000000000053444835ec5800000000000000000000' +
  '00000000000000000000000000000000000000006955b900000000000000000000000000000000000000696e74656e742d6162632d31323300000000' +
  '000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020' +
  '0000000000000000000000000000000000000000000000000000000000000041bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' +
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0000000000000000000000000000000000000000000000' +
  '0000000000000000000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee961a547e00000000000000000000000000000000' +
  '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000' +
  '0000000000000000000000006b49d200cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd000000000000000000000000' +
  '00000000000000000000000000000000000005a000000000000000000000000000000000000000000000000000000000000000200000000000000000' +
  '000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000' +
  '000000000000000024e5f44999c151f08609f8e27b2238c773c4d02000000000000000000000000000000000000000000000000000000000000000a0' +
  '000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000' +
  '000003400000000000000000000000000000000000000000000000000000000000000440000000000000000000000000000000000000000000000000' +
  '0000000000000041aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
  'aaaaaaaaaaaaaaaaaaaaaaaaaa0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
  '000000000000000000000000000000010000000000000000000000000000000000000000000000000000000070dbd880000000000000000000000000' +
  '000000000000000000000000000000006774858000000000000000000000000000000000000000000000000000000000000012340000000000000000' +
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000120' +
  '000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000' +
  '000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000' +
  '00000000000000200000000000000000000000001111111111111111111111111111111111111111deadbeef00000000000000000000000000000000' +
  '000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000' +
  '000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
  '000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000' +
  '000000000000000000000000000000000000000000000004000000000000000000000000222222222222222222222222222222222222222200000000' +
  '0000000000000000000000000000000000000000000000000000000300000000000000000000000099995f38fc9d786eab5c3a1b1c4e6ae5f4e99999' +
  '00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000' +
  '000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000' +
  '000000000000002000000000000000000000000000000000000000000000000000000000000000020000000000000000000000003333333333333333' +
  '33333333333333333333333300000000000000000000000000000000000000000000000022d54fb3923b000000000000000000000000000044444444' +
  '4444444444444444444444444444444400000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000' +
  '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'

export {
  ACCEPT_SELECTOR,
  BUYER,
  COLLECTION,
  EXPLORER_GOLDEN_ARGS,
  EXPLORER_GOLDEN_BUYER,
  EXPLORER_GOLDEN_USE_CREDITS,
  FAR_FUTURE,
  POLYGON,
  REAL_LISTING_CREDITS,
  REAL_LISTING_ITEM_ID,
  REAL_LISTING_PRICE_USD_WEI,
  SELLER,
  ZERO_BYTES32,
  buildCreditsPurchaseRequest,
  buildMetaTransactionTypedData,
  buildTrade,
  buildUseCreditsArgs,
  creditsManagerContract,
  encodeAccept,
  encodeUseCredits,
  manaContract,
  marketplaceContract
}
export type { ExternalCheck, Trade, TradeAsset, UseCreditsArgs }
