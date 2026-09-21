import { AbiFunction, AbiParameter } from 'viem'
import {
  FORWARDING_FUNCTIONS,
  KnownContract,
  NON_CALLED_ARGUMENTS,
  NON_CALLING_FUNCTIONS,
  getCollectionContract,
  getStaticContractIndex
} from './decentralandContracts'

// Pins the assumptions the counterparty check makes about the installed registry ABIs, so that a bump of
// decentraland-transactions that adds a hooky transfer, a new payable entry point, a new bytes-taking function
// or a new use of a recorded-only argument name fails here instead of silently widening what the page vouches
// for. Every list below is a decision that was made by reading the contract sources; a failure means a new one
// is due.

/** The plain token functions the walk skips (see NON_CALLING_FUNCTIONS): name and input types. */
const TOKEN_FUNCTION_SIGNATURES = new Set([
  'transfer(address,uint256)',
  'transferFrom(address,address,uint256)',
  'batchTransferFrom(address,address,uint256[])',
  'approve(address,uint256)',
  'setApprovalForAll(address,bool)',
  'increaseAllowance(address,uint256)',
  'decreaseAllowance(address,uint256)'
])

/**
 * Functions that take `bytes` without handing them to another contract as a call: signatures, fingerprints,
 * callback data, a deposit amount, the collection initializer the factory runs on Decentraland's own
 * implementation (see FORWARDING_FUNCTIONS), the nested call the walk follows (`useCredits`), and the coupon
 * payload the coupon manager and the discount coupon only ever `abi.decode` (`applyCoupon`).
 */
const NON_FORWARDING_BYTES_FUNCTIONS = new Set([
  'accept',
  'acceptListing',
  'acceptOffer',
  'acceptWithCoupon',
  'applyCoupon',
  'cancelSignature',
  'createCollection',
  'deposit',
  'getAddress',
  'getTradeId',
  'onERC721Received',
  'placeBid',
  'safeBatchTransferFrom',
  'safeExecuteOrder',
  'safeTransferFrom',
  'useCredits'
])

/**
 * Every place a NON_FORWARDING_BYTES_FUNCTIONS name actually occurs in the installed registry, as
 * `Contract: signature`.
 *
 * The exemption list is keyed by NAME, which is the whole reason this exists: a later ABI that adds an
 * overload of one of those names, or a new deployment that declares one, would inherit an exemption nobody
 * granted it and its `bytes` would stop being treated as a possible forwarded call. Pinning the occurrences
 * turns that into a failure here, where the new row has to be read and justified before it is added.
 */
const BYTES_EXEMPT_OCCURRENCES = [
  'Bid: onERC721Received(address,address,uint256,bytes)',
  'Bid: placeBid(address,uint256,uint256,uint256,bytes)',
  'BidV2: onERC721Received(address,address,uint256,bytes)',
  'BidV2: placeBid(address,uint256,uint256,uint256,bytes)',
  'CollectionDiscountCoupon: applyCoupon(tuple,tuple)',
  'CollectionFactory: createCollection(bytes32,bytes)',
  'CollectionFactory: getAddress(bytes32,address,bytes)',
  'CollectionFactoryV3: createCollection(bytes32,bytes)',
  'CollectionFactoryV3: getAddress(bytes32,address,bytes)',
  'CouponManagerV2: applyCoupon(tuple,tuple,bytes32,address)',
  'CouponManagerV2: cancelSignature(tuple[])',
  'CouponManagerV3: applyCoupon(tuple,tuple,bytes32,address)',
  'CouponManagerV3: cancelSignature(tuple[])',
  'CreditsManager: onERC721Received(address,address,uint256,bytes)',
  'CreditsManager: useCredits(tuple)',
  'DCLRegistrar: onERC721Received(address,address,uint256,bytes)',
  'DCLRegistrar: safeTransferFrom(address,address,uint256,bytes)',
  'ERC721CollectionV2: safeBatchTransferFrom(address,address,uint256[],bytes)',
  'ERC721CollectionV2: safeTransferFrom(address,address,uint256,bytes)',
  'MANAToken: deposit(address,bytes)',
  'Marketplace: safeExecuteOrder(address,uint256,uint256,bytes)',
  'MarketplaceV2: safeExecuteOrder(address,uint256,uint256,bytes)',
  'OffChainMarketplace: accept(tuple[])',
  'OffChainMarketplace: acceptWithCoupon(tuple[],tuple[])',
  'OffChainMarketplace: cancelSignature(tuple[])',
  'OffChainMarketplace: getTradeId(tuple,address)',
  'OffChainMarketplaceV2: accept(tuple[])',
  'OffChainMarketplaceV2: acceptWithCoupon(tuple[],tuple[])',
  'OffChainMarketplaceV2: cancelSignature(tuple[])',
  'OffChainMarketplaceV2: getTradeId(tuple,address)',
  'OffChainMarketplaceV3: accept(tuple[])',
  'OffChainMarketplaceV3: acceptWithCoupon(tuple[],tuple[])',
  'OffChainMarketplaceV3: cancelSignature(tuple[])',
  'OffChainMarketplaceV3: getTradeId(tuple,address)',
  'Rentals: acceptListing(tuple,address,uint256,uint256,bytes32)',
  'Rentals: acceptOffer(tuple)',
  'Rentals: onERC721Received(address,address,uint256,bytes)'
]

/** Where a recorded-only argument name (see NON_CALLED_ARGUMENTS) occurs in the registry, as `Contract.function: path (type)`. */
const RECORDED_ONLY_ARGUMENT_OCCURRENCES = [
  'CollectionManager.createCollection: _creator (address)',
  'CollectionManager.createCollection: _items[].beneficiary (address)',
  'CollectionStore.buy: _itemsToBuy[].beneficiaries (address[])',
  'DCLRegistrar.safeTransferFrom: from (address)',
  'ERC721CollectionV2.safeBatchTransferFrom: _from (address)',
  'ERC721CollectionV2.safeTransferFrom: from (address)',
  'Rentals.acceptListing: _listing.target (address)',
  'Rentals.acceptListing: _operator (address)',
  'Rentals.acceptOffer: _offer.operator (address)',
  'Rentals.setManyLandUpdateOperator: _operators (address[])',
  'Rentals.setUpdateOperator: _operators (address[])'
]

const signatureOf = (fn: AbiFunction) => `${fn.name}(${fn.inputs.map(input => input.type).join(',')})`

const takesBytes = (inputs: readonly AbiParameter[]): boolean =>
  inputs.some(input => input.type === 'bytes' || input.type === 'bytes[]' || ('components' in input && takesBytes(input.components)))

const collectRecordedOnlyOccurrences = (
  contract: string,
  fn: string,
  inputs: readonly AbiParameter[],
  path: string,
  names: ReadonlySet<string>,
  into: Set<string>
) => {
  for (const input of inputs) {
    const inputPath = path ? `${path}.${input.name}` : (input.name ?? '')
    if (input.type.startsWith('address') && names.has(input.name ?? '')) into.add(`${contract}.${fn}: ${inputPath} (${input.type})`)
    if ('components' in input) {
      collectRecordedOnlyOccurrences(contract, fn, input.components, `${inputPath}${input.type.endsWith('[]') ? '[]' : ''}`, names, into)
    }
  }
}

describe('when checking the counterparty rules against the installed registry', () => {
  let contracts: KnownContract[]
  let functions: Array<{ contract: string; fn: AbiFunction }>

  beforeEach(() => {
    const seen = new Set<string>()
    contracts = []
    for (const byAddress of getStaticContractIndex().values()) {
      for (const contract of byAddress.values()) {
        // The ABI text itself is the key: two ABIs of one length are two ABIs.
        const key = `${contract.name}:${JSON.stringify(contract.abi)}`
        if (seen.has(key)) continue
        seen.add(key)
        contracts.push(contract)
      }
    }
    // The collection template has no registry address of its own; every factory collection decodes against it.
    const collection = getCollectionContract('0xfef5c99885c3036e591b6e6db52482891834a5f4', 137)
    if (collection) contracts.push(collection)
    functions = contracts.flatMap(contract =>
      contract.abi.filter((item): item is AbiFunction => item.type === 'function').map(fn => ({ contract: contract.name, fn }))
    )
  })

  it('should find every function named in NON_CALLING_FUNCTIONS declared with a plain token signature only', () => {
    const declared = functions
      .filter(({ fn }) => NON_CALLING_FUNCTIONS.has(fn.name))
      .map(({ contract, fn }) => `${contract}: ${signatureOf(fn)}`)
    const unexpected = declared.filter(entry => !TOKEN_FUNCTION_SIGNATURES.has(entry.split(': ')[1]))

    expect(declared.length).toBeGreaterThan(0)
    expect(unexpected).toEqual([])
  })

  it('should find every payable function refused as a forwarder', () => {
    const payable = functions.filter(({ fn }) => fn.stateMutability === 'payable')
    const unrefused = payable
      .filter(({ fn }) => !FORWARDING_FUNCTIONS.has(fn.name))
      .map(({ contract, fn }) => `${contract}: ${signatureOf(fn)}`)

    expect(payable.length).toBeGreaterThan(0)
    expect(unrefused).toEqual([])
  })

  it('should find every bytes-taking function either refused as a forwarder or listed as a known non-forwarder', () => {
    const undecided = functions
      .filter(({ fn }) => takesBytes(fn.inputs))
      .filter(({ fn }) => !FORWARDING_FUNCTIONS.has(fn.name) && !NON_FORWARDING_BYTES_FUNCTIONS.has(fn.name))
      .map(({ contract, fn }) => `${contract}: ${signatureOf(fn)}`)

    expect(undecided).toEqual([])
  })

  it('should exempt exactly the bytes-taking functions the list was written for, and no later namesake', () => {
    const exempted = functions
      .filter(({ fn }) => takesBytes(fn.inputs) && NON_FORWARDING_BYTES_FUNCTIONS.has(fn.name))
      .map(({ contract, fn }) => `${contract}: ${signatureOf(fn)}`)

    expect([...new Set(exempted)].sort()).toEqual(BYTES_EXEMPT_OCCURRENCES)
  })

  it('should find the recorded-only argument names exactly where the sources were read', () => {
    const occurrences = new Set<string>()
    for (const { contract, fn } of functions) {
      const names = NON_CALLED_ARGUMENTS[fn.name]
      if (names) collectRecordedOnlyOccurrences(contract, fn.name, fn.inputs, '', names, occurrences)
    }

    expect([...occurrences].sort()).toEqual(RECORDED_ONLY_ARGUMENT_OCCURRENCES)
  })
})
