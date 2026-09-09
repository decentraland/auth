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
 * implementation (see FORWARDING_FUNCTIONS), and the nested call the walk follows (`useCredits`).
 */
const NON_FORWARDING_BYTES_FUNCTIONS = new Set([
  'accept',
  'acceptListing',
  'acceptOffer',
  'acceptWithCoupon',
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

/** Where a recorded-only argument name (see NON_CALLED_ARGUMENTS) occurs in the registry, as `Contract.function: path (type)`. */
const RECORDED_ONLY_ARGUMENT_OCCURRENCES = [
  'CollectionManager.createCollection: _creator (address)',
  'CollectionManager.createCollection: _items[].beneficiary (address)',
  'CollectionStore.buy: _itemsToBuy[].beneficiaries (address[])',
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

  it('should find the recorded-only argument names exactly where the sources were read', () => {
    const occurrences = new Set<string>()
    for (const { contract, fn } of functions) {
      const names = NON_CALLED_ARGUMENTS[fn.name]
      if (names) collectRecordedOnlyOccurrences(contract, fn.name, fn.inputs, '', names, occurrences)
    }

    expect([...occurrences].sort()).toEqual(RECORDED_ONLY_ARGUMENT_OCCURRENCES)
  })
})
