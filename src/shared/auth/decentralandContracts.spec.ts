import { encodeFunctionData, getAddress } from 'viem'
import { ContractData, ContractName, getContract } from 'decentraland-transactions'
import {
  ContractResolution,
  DecodedCall,
  KnownContract,
  decodeKnownContractCall,
  getKnownDecentralandContract,
  getMetaTransactionCalldataField,
  getMetaTransactionSalt,
  getStaticContractIndex,
  resolveKnownDecentralandContract
} from './decentralandContracts'

const POLYGON = 137
const ETHEREUM = 1
const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
const RECIPIENT = '0x1234567890abcdef1234567890abcdef12345678'
const COLLECTION_ADDRESS = '0xFEF5c99885c3036e591b6e6dB52482891834A5f4'

describe('when building the static contract index', () => {
  let index: Map<number, Map<string, KnownContract>>
  let mana: ContractData

  beforeEach(() => {
    index = getStaticContractIndex()
    mana = getContract(ContractName.MANAToken, POLYGON)
  })

  it('should index the Polygon MANA token by its lowercased address', () => {
    expect(index.get(POLYGON)?.get(mana.address.toLowerCase())).toEqual(
      expect.objectContaining({ name: ContractName.MANAToken, chainId: POLYGON, domainName: mana.name, domainVersion: mana.version })
    )
  })

  it('should skip the ABI templates that have no address', () => {
    expect(index.get(POLYGON)?.has('')).toBe(false)
  })

  it('should not index the same address twice within a chain', () => {
    for (const byAddress of index.values()) {
      expect(new Set([...byAddress.keys()]).size).toBe(byAddress.size)
    }
  })

  it('should hand out a copy of the registry ABI rather than the live one', () => {
    const known = index.get(POLYGON)?.get(mana.address.toLowerCase())
    expect(known?.abi).not.toBe(mana.abi)
    expect(known?.abi).toEqual(mana.abi)
  })
})

describe('when looking up a known contract', () => {
  let result: KnownContract | null

  describe('and the address is deployed on the given chain, in another casing', () => {
    beforeEach(() => {
      result = getKnownDecentralandContract(getAddress(getContract(ContractName.MANAToken, POLYGON).address), POLYGON)
    })

    it('should return the contract with its meta-transaction support', () => {
      expect(result).toEqual(
        expect.objectContaining({ name: ContractName.MANAToken, supportsMetaTransactions: true, calldataField: 'functionSignature' })
      )
    })
  })

  describe('and the address is a Decentraland contract on another chain only', () => {
    beforeEach(() => {
      result = getKnownDecentralandContract(getContract(ContractName.MANAToken, ETHEREUM).address, POLYGON)
    })

    it('should return null', () => {
      expect(result).toBeNull()
    })
  })

  describe('and the chain is not one the simulator supports', () => {
    beforeEach(() => {
      result = getKnownDecentralandContract(getContract(ContractName.MANAToken, POLYGON).address, 56)
    })

    it('should return null', () => {
      expect(result).toBeNull()
    })
  })

  describe('and the address is not a Decentraland contract', () => {
    beforeEach(() => {
      result = getKnownDecentralandContract(RECIPIENT, POLYGON)
    })

    it('should return null', () => {
      expect(result).toBeNull()
    })
  })
})

describe('when reading the meta-transaction support of an ABI', () => {
  let contract: KnownContract

  describe('and the contract executes the legacy functionSignature struct', () => {
    beforeEach(() => {
      contract = getKnownDecentralandContract(getContract(ContractName.MANAToken, POLYGON).address, POLYGON)!
    })

    it('should report the functionSignature field', () => {
      expect(getMetaTransactionCalldataField(contract.abi)).toBe('functionSignature')
    })
  })

  describe('and the contract executes the functionData struct', () => {
    beforeEach(() => {
      contract = getKnownDecentralandContract(getContract(ContractName.OffChainMarketplace, POLYGON).address, POLYGON)!
    })

    it('should report the functionData field', () => {
      expect(getMetaTransactionCalldataField(contract.abi)).toBe('functionData')
    })
  })

  describe('and the contract has no executeMetaTransaction', () => {
    beforeEach(() => {
      contract = getKnownDecentralandContract(getContract(ContractName.BidV2, POLYGON).address, POLYGON)!
    })

    it('should report no support and no calldata field', () => {
      expect(contract).toEqual(expect.objectContaining({ supportsMetaTransactions: false, calldataField: null }))
    })
  })
})

describe('when building the meta-transaction salt', () => {
  let salt: string

  beforeEach(() => {
    salt = getMetaTransactionSalt(POLYGON)
  })

  it('should encode the chain id as a 32-byte hex word', () => {
    expect(salt).toBe('0x0000000000000000000000000000000000000000000000000000000000000089')
  })
})

describe('when resolving a contract', () => {
  let isCollection: jest.Mock
  let resolution: ContractResolution

  beforeEach(() => {
    isCollection = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the address is in the static registry on that chain', () => {
    beforeEach(async () => {
      resolution = await resolveKnownDecentralandContract(getContract(ContractName.MANAToken, POLYGON).address, POLYGON, {
        metaTransactionChainId: POLYGON,
        isCollection
      })
    })

    it('should resolve to the registry contract', () => {
      expect(resolution).toEqual({ status: 'found', contract: expect.objectContaining({ name: ContractName.MANAToken }) })
    })

    it('should not consult the collection lookup', () => {
      expect(isCollection).not.toHaveBeenCalled()
    })
  })

  describe('and the address is unknown on the meta-transaction chain', () => {
    describe('and the lookup confirms a collection', () => {
      beforeEach(async () => {
        isCollection.mockResolvedValueOnce(true)
        resolution = await resolveKnownDecentralandContract(COLLECTION_ADDRESS, POLYGON, { metaTransactionChainId: POLYGON, isCollection })
      })

      it('should resolve to the collection template with the lowercased address', () => {
        expect(resolution).toEqual({
          status: 'found',
          contract: expect.objectContaining({
            name: ContractName.ERC721CollectionV2,
            address: COLLECTION_ADDRESS.toLowerCase(),
            chainId: POLYGON,
            supportsMetaTransactions: true,
            calldataField: 'functionSignature'
          })
        })
      })

      it('should ask the lookup about that address', () => {
        expect(isCollection).toHaveBeenCalledWith(COLLECTION_ADDRESS)
      })
    })

    describe('and the lookup denies it', () => {
      beforeEach(async () => {
        isCollection.mockResolvedValueOnce(false)
        resolution = await resolveKnownDecentralandContract(COLLECTION_ADDRESS, POLYGON, { metaTransactionChainId: POLYGON, isCollection })
      })

      it('should resolve to not found', () => {
        expect(resolution).toEqual({ status: 'not_found' })
      })
    })

    describe('and the lookup could not answer', () => {
      beforeEach(async () => {
        isCollection.mockResolvedValueOnce('unavailable')
        resolution = await resolveKnownDecentralandContract(COLLECTION_ADDRESS, POLYGON, { metaTransactionChainId: POLYGON, isCollection })
      })

      it('should resolve to unavailable rather than not found', () => {
        expect(resolution).toEqual({ status: 'unavailable' })
      })
    })

    describe('and the lookup throws', () => {
      beforeEach(async () => {
        isCollection.mockRejectedValueOnce(new Error('network'))
        resolution = await resolveKnownDecentralandContract(COLLECTION_ADDRESS, POLYGON, { metaTransactionChainId: POLYGON, isCollection })
      })

      it('should resolve to unavailable', () => {
        expect(resolution).toEqual({ status: 'unavailable' })
      })
    })
  })

  describe('and the address is unknown on a chain other than the meta-transaction chain', () => {
    beforeEach(async () => {
      resolution = await resolveKnownDecentralandContract(COLLECTION_ADDRESS, ETHEREUM, { metaTransactionChainId: POLYGON, isCollection })
    })

    it('should resolve to not found', () => {
      expect(resolution).toEqual({ status: 'not_found' })
    })

    it('should not consult the collection lookup', () => {
      expect(isCollection).not.toHaveBeenCalled()
    })
  })
})

describe('when decoding a call against a known contract', () => {
  let mana: KnownContract
  let collection: KnownContract
  let transferData: `0x${string}`
  let decoded: DecodedCall | null

  beforeEach(() => {
    mana = getKnownDecentralandContract(getContract(ContractName.MANAToken, POLYGON).address, POLYGON)!
    collection = {
      ...mana,
      name: ContractName.ERC721CollectionV2,
      abi: getContract(ContractName.ERC721CollectionV2, POLYGON).abi as KnownContract['abi']
    }
    transferData = encodeFunctionData({ abi: mana.abi, functionName: 'transfer', args: [RECIPIENT, 1000n] })
  })

  describe('and the calldata is a canonical call', () => {
    beforeEach(() => {
      decoded = decodeKnownContractCall(mana, transferData)
    })

    it('should return the function name, its arguments and that it is not payable', () => {
      expect(decoded).toEqual({ functionName: 'transfer', args: [getAddress(RECIPIENT), 1000n], payable: false })
    })
  })

  describe('and the calldata differs from the canonical call only in hex casing', () => {
    beforeEach(() => {
      decoded = decodeKnownContractCall(mana, `0x${transferData.slice(2).toUpperCase()}`)
    })

    it('should still decode it', () => {
      expect(decoded).toEqual(expect.objectContaining({ functionName: 'transfer' }))
    })
  })

  describe('and the calldata carries a trailing byte', () => {
    beforeEach(() => {
      decoded = decodeKnownContractCall(mana, `${transferData}00`)
    })

    it('should reject it', () => {
      expect(decoded).toBeNull()
    })
  })

  describe('and the calldata carries an extra word', () => {
    beforeEach(() => {
      decoded = decodeKnownContractCall(mana, `${transferData}${'00'.repeat(32)}`)
    })

    it('should reject it', () => {
      expect(decoded).toBeNull()
    })
  })

  describe('and an address argument has dirty upper bytes', () => {
    beforeEach(() => {
      const dirty = `${transferData.slice(0, 10)}ffffffffffffffffffffffff${RECIPIENT.slice(2)}${transferData.slice(74)}`
      decoded = decodeKnownContractCall(mana, dirty)
    })

    it('should reject it', () => {
      expect(decoded).toBeNull()
    })
  })

  describe('and the calldata is empty', () => {
    beforeEach(() => {
      decoded = decodeKnownContractCall(mana, '0x')
    })

    it('should reject it', () => {
      expect(decoded).toBeNull()
    })
  })

  describe('and the calldata is a bare selector for a function that takes arguments', () => {
    beforeEach(() => {
      decoded = decodeKnownContractCall(mana, transferData.slice(0, 10))
    })

    it('should reject it', () => {
      expect(decoded).toBeNull()
    })
  })

  describe('and the selector is not in the ABI', () => {
    beforeEach(() => {
      decoded = decodeKnownContractCall(mana, `0xdeadbeef${'00'.repeat(64)}`)
    })

    it('should reject it', () => {
      expect(decoded).toBeNull()
    })
  })

  describe('and the calldata is executeMetaTransaction', () => {
    beforeEach(() => {
      const data = encodeFunctionData({
        abi: mana.abi,
        functionName: 'executeMetaTransaction',
        args: [USER, transferData, `0x${'11'.repeat(32)}`, `0x${'22'.repeat(32)}`, 27]
      })
      decoded = decodeKnownContractCall(mana, data)
    })

    it('should decode it as payable', () => {
      expect(decoded).toEqual(expect.objectContaining({ functionName: 'executeMetaTransaction', payable: true }))
    })
  })

  describe('and the calldata is the three-argument safeTransferFrom overload', () => {
    beforeEach(() => {
      const data = encodeFunctionData({ abi: collection.abi, functionName: 'safeTransferFrom', args: [USER, RECIPIENT, 7n] })
      decoded = decodeKnownContractCall(collection, data)
    })

    it('should decode it with three arguments', () => {
      expect(decoded).toEqual({ functionName: 'safeTransferFrom', args: [getAddress(USER), getAddress(RECIPIENT), 7n], payable: false })
    })
  })

  describe('and the calldata is the four-argument safeTransferFrom overload', () => {
    beforeEach(() => {
      const data = encodeFunctionData({ abi: collection.abi, functionName: 'safeTransferFrom', args: [USER, RECIPIENT, 7n, '0x1234'] })
      decoded = decodeKnownContractCall(collection, data)
    })

    it('should decode it with four arguments', () => {
      expect(decoded).toEqual({
        functionName: 'safeTransferFrom',
        args: [getAddress(USER), getAddress(RECIPIENT), 7n, '0x1234'],
        payable: false
      })
    })
  })
})
