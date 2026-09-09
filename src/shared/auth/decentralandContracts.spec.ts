import { encodeFunctionData, getAddress } from 'viem'
import { ContractData, ContractName, getContract } from 'decentraland-transactions'
import {
  ContractResolution,
  DecodedCall,
  KnownContract,
  collectCallAddresses,
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

  describe('and the address is a Decentraland contract on a chain that does not relay meta-transactions', () => {
    beforeEach(() => {
      result = getKnownDecentralandContract(getContract(ContractName.MANAToken, ETHEREUM).address, ETHEREUM)
    })

    it('should report no meta-transaction support although the registry ABI declares executeMetaTransaction', () => {
      expect(result).toEqual(
        expect.objectContaining({ name: ContractName.MANAToken, chainId: ETHEREUM, supportsMetaTransactions: false, calldataField: null })
      )
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

    it('should return the function name, its arguments and that it neither is payable nor forwards a call', () => {
      expect(decoded).toEqual({ functionName: 'transfer', args: [getAddress(RECIPIENT), 1000n], payable: false, forwardsCall: false })
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

    it('should decode it as payable and as forwarding a call', () => {
      expect(decoded).toEqual(expect.objectContaining({ functionName: 'executeMetaTransaction', payable: true, forwardsCall: true }))
    })
  })

  describe('and the calldata is a non-payable call that forwards another call', () => {
    beforeEach(() => {
      const manager = getKnownDecentralandContract(getContract(ContractName.CollectionManager, POLYGON).address, POLYGON)!
      decoded = decodeKnownContractCall(
        manager,
        encodeFunctionData({ abi: manager.abi, functionName: 'manageCollection', args: [RECIPIENT, RECIPIENT, transferData] })
      )
    })

    it('should decode it as forwarding a call although it is not payable', () => {
      expect(decoded).toEqual(expect.objectContaining({ functionName: 'manageCollection', payable: false, forwardsCall: true }))
    })
  })

  describe('and the calldata is the three-argument safeTransferFrom overload', () => {
    beforeEach(() => {
      const data = encodeFunctionData({ abi: collection.abi, functionName: 'safeTransferFrom', args: [USER, RECIPIENT, 7n] })
      decoded = decodeKnownContractCall(collection, data)
    })

    it('should decode it with three arguments', () => {
      expect(decoded).toEqual({
        functionName: 'safeTransferFrom',
        args: [getAddress(USER), getAddress(RECIPIENT), 7n],
        payable: false,
        forwardsCall: false
      })
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
        payable: false,
        forwardsCall: false
      })
    })
  })
})

describe('when collecting the addresses a call reaches', () => {
  const POLYGON = 137
  const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
  const OTHER = '0x1234567890abcdef1234567890abcdef12345678'
  const UNKNOWN_NFT = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
  let credits: KnownContract
  let marketplace: KnownContract
  let acceptCalldata: `0x${string}`
  let result: ReturnType<typeof collectCallAddresses>

  const zeroHash = `0x${'00'.repeat(32)}`
  const trade = {
    signer: OTHER,
    signature: '0x',
    checks: {
      uses: 1n,
      expiration: 4102444800n,
      effective: 0n,
      salt: zeroHash,
      contractSignatureIndex: 0n,
      signerSignatureIndex: 0n,
      allowedRoot: zeroHash,
      allowedProof: [],
      externalChecks: []
    },
    sent: [{ assetType: 1n, contractAddress: UNKNOWN_NFT, value: 1n, beneficiary: USER, extra: '0x' }],
    received: [
      { assetType: 1n, contractAddress: getContract(ContractName.MANAToken, POLYGON).address, value: 100n, beneficiary: OTHER, extra: '0x' }
    ]
  }
  const useCreditsWith = (externalCall: { target: string; selector: string; data: string }) =>
    decodeKnownContractCall(
      credits,
      encodeFunctionData({
        abi: credits.abi,
        functionName: 'useCredits',
        args: [
          {
            credits: [],
            creditsSignatures: [],
            externalCall: { ...externalCall, expiresAt: 4102444800n, salt: zeroHash },
            customExternalCallSignature: '0x',
            maxUncreditedValue: 0n,
            maxCreditedValue: 0n
          }
        ]
      })
    )!

  beforeEach(() => {
    credits = getKnownDecentralandContract(getContract(ContractName.CreditsManager, POLYGON).address, POLYGON)!
    marketplace = getKnownDecentralandContract(getContract(ContractName.OffChainMarketplaceV2, POLYGON).address, POLYGON)!
    acceptCalldata = encodeFunctionData({ abi: marketplace.abi, functionName: 'accept', args: [[trade]] })
  })

  describe('and a credits purchase nests a marketplace trade naming an unknown NFT registry', () => {
    beforeEach(() => {
      result = collectCallAddresses(
        useCreditsWith({ target: marketplace.address, selector: acceptCalldata.slice(0, 10), data: `0x${acceptCalldata.slice(10)}` }),
        POLYGON
      )
    })

    it('should follow the nested call and surface the registry hidden in its payload', () => {
      expect(result.opaque).toBe(false)
      expect([...result.addresses]).toEqual(expect.arrayContaining([marketplace.address, UNKNOWN_NFT, OTHER, USER]))
    })
  })

  describe('and the nested call targets a contract the registry does not know', () => {
    beforeEach(() => {
      result = collectCallAddresses(
        useCreditsWith({ target: OTHER, selector: acceptCalldata.slice(0, 10), data: `0x${acceptCalldata.slice(10)}` }),
        POLYGON
      )
    })

    it('should keep the target and flag the payload as unread', () => {
      expect(result.opaque).toBe(true)
      expect(result.addresses.has(OTHER)).toBe(true)
    })
  })

  describe('and the nested payload does not decode against the target', () => {
    beforeEach(() => {
      result = collectCallAddresses(useCreditsWith({ target: marketplace.address, selector: '0x12345678', data: '0x' }), POLYGON)
    })

    it('should flag the payload as unread', () => {
      expect(result.opaque).toBe(true)
    })
  })

  describe('and the nested call is itself a forwarder', () => {
    beforeEach(() => {
      const forwarder = getKnownDecentralandContract(getContract(ContractName.Forwarder, POLYGON).address, POLYGON)!
      const forwardCalldata = encodeFunctionData({ abi: forwarder.abi, functionName: 'forwardCall', args: [OTHER, '0x'] })
      result = collectCallAddresses(
        useCreditsWith({ target: forwarder.address, selector: forwardCalldata.slice(0, 10), data: `0x${forwardCalldata.slice(10)}` }),
        POLYGON
      )
    })

    it('should flag the payload as unread rather than trust what the forwarder is handed', () => {
      expect(result.opaque).toBe(true)
    })
  })
})
