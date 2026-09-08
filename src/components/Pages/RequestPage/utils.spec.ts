/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/unbound-method */
import { createPublicClient, custom, formatEther } from 'viem'
import { Rarity } from '@dcl/schemas'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { connection } from 'decentraland-connect'
import { getContract } from 'decentraland-transactions'
import { config } from '../../../modules/config'
import { DecodedCall, KnownContract, SimulationResponseBody } from '../../../shared/auth'
import { RequestClassification } from './classifyRequest'
import {
  buildSendTransactionSimulationPayload,
  decodeManaTransferData,
  decodeNftTransferData,
  fetchNftMetadata,
  getConnectedProvider,
  getExplorerDeeplink,
  getMetaTransactionChainId,
  getNetworkProvider,
  getSigninDeeplink,
  isAddressWithoutCode,
  isDecentralandCollection,
  isExactNftTransferSimulation
} from './utils'

jest.mock('decentraland-connect')
jest.mock('decentraland-transactions')
jest.mock('../../../modules/config')
jest.mock('viem', () => ({
  createPublicClient: jest.fn(),
  custom: jest.fn((provider: any) => provider),
  formatEther: jest.fn()
}))

describe('when testing getConnectedProvider', () => {
  let mockProvider: any

  beforeEach(() => {
    mockProvider = { isProvider: true }
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the provider is already connected', () => {
    beforeEach(() => {
      jest.mocked(connection.getProvider).mockResolvedValueOnce(mockProvider)
    })

    it('should return the connected provider', async () => {
      const result = await getConnectedProvider()
      expect(result).toBe(mockProvider)
    })
  })

  describe('and the provider is not connected but has previous connection', () => {
    beforeEach(() => {
      jest.mocked(connection.getProvider).mockRejectedValueOnce(new Error('Not connected'))
      jest.mocked(connection.tryPreviousConnection).mockResolvedValueOnce({ provider: mockProvider } as any)
    })

    it('should return the provider from previous connection', async () => {
      const result = await getConnectedProvider()
      expect(result).toBe(mockProvider)
    })
  })

  describe('and no provider connection is available', () => {
    beforeEach(() => {
      jest.mocked(connection.getProvider).mockRejectedValueOnce(new Error('Not connected'))
      jest.mocked(connection.tryPreviousConnection).mockRejectedValueOnce(new Error('No previous connection'))
    })

    it('should return null', async () => {
      const result = await getConnectedProvider()
      expect(result).toBeNull()
    })
  })
})

describe('when testing getNetworkProvider', () => {
  let mockConnectedProvider: any
  let mockNetworkProvider: any
  let mockPublicClient: any

  beforeEach(() => {
    mockConnectedProvider = { isProvider: true }
    mockNetworkProvider = { isNetworkProvider: true }
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the connected provider matches the requested chainId', () => {
    beforeEach(() => {
      mockPublicClient = {
        getChainId: jest.fn().mockResolvedValueOnce(ChainId.MATIC_MAINNET)
      }
      jest.mocked(connection.getProvider).mockResolvedValueOnce(mockConnectedProvider)
      jest.mocked(createPublicClient).mockReturnValueOnce(mockPublicClient)
    })

    it('should return the connected provider', async () => {
      const result = await getNetworkProvider(ChainId.MATIC_MAINNET)
      expect(result).toBe(mockConnectedProvider)
    })
  })

  describe('and the connected provider has a different chainId', () => {
    beforeEach(() => {
      mockPublicClient = {
        getChainId: jest.fn().mockResolvedValueOnce(ChainId.ETHEREUM_MAINNET)
      }
      jest.mocked(connection.getProvider).mockResolvedValueOnce(mockConnectedProvider)
      jest.mocked(createPublicClient).mockReturnValueOnce(mockPublicClient)
      jest.mocked(connection.createProvider).mockReturnValueOnce(mockNetworkProvider)
    })

    it('should create a new network provider with the requested chainId', async () => {
      const result = await getNetworkProvider(ChainId.MATIC_MAINNET)
      expect(result).toBe(mockNetworkProvider)
      expect(connection.createProvider).toHaveBeenCalledWith(ProviderType.NETWORK, ChainId.MATIC_MAINNET)
    })
  })

  describe('and no provider is connected', () => {
    beforeEach(() => {
      jest.mocked(connection.getProvider).mockRejectedValueOnce(new Error('Not connected'))
      jest.mocked(connection.tryPreviousConnection).mockRejectedValueOnce(new Error('No previous connection'))
      jest.mocked(connection.createProvider).mockReturnValueOnce(mockNetworkProvider)
    })

    it('should create a new network provider', async () => {
      const result = await getNetworkProvider(ChainId.MATIC_MAINNET)
      expect(result).toBe(mockNetworkProvider)
      expect(connection.createProvider).toHaveBeenCalledWith(ProviderType.NETWORK, ChainId.MATIC_MAINNET)
    })
  })
})

describe('when checking whether a recipient has no code', () => {
  let address: string
  let chainId: number
  let networkProvider: Record<string, boolean>
  let request: jest.Mock

  beforeEach(() => {
    address = '0x1234567890abcdef1234567890abcdef12345678'
    chainId = ChainId.ETHEREUM_MAINNET
    networkProvider = { isTrustedNetworkProvider: true }
    request = jest.fn()
    jest.mocked(connection.createProvider).mockReturnValueOnce(networkProvider as any)
    jest.mocked(custom).mockImplementationOnce(provider => provider as any)
    jest.mocked(createPublicClient).mockReturnValueOnce({ request } as any)
  })

  afterEach(() => {
    jest.resetAllMocks()
    jest.useRealTimers()
  })

  describe('and the RPC confirms empty code', () => {
    beforeEach(() => {
      request.mockResolvedValueOnce('0x')
    })

    it('should confirm that the recipient has no code', async () => {
      await expect(isAddressWithoutCode(address, chainId)).resolves.toBe(true)
    })

    it('should ask Decentraland’s RPC on the execution chain', async () => {
      await isAddressWithoutCode(address, chainId)
      expect(connection.createProvider).toHaveBeenCalledWith(ProviderType.NETWORK, chainId)
      expect(custom).toHaveBeenCalledWith(networkProvider)
      expect(request).toHaveBeenCalledWith({ method: 'eth_getCode', params: [address, 'latest'] })
      expect(connection.getProvider).not.toHaveBeenCalled()
    })
  })

  describe.each([
    ['deployed code', '0x60006000'],
    ['delegated code', '0xef01001234567890abcdef1234567890abcdef12345678'],
    ['a missing response', undefined],
    ['a malformed response', '']
  ])('and the RPC returns %s', (_label, code) => {
    beforeEach(() => {
      request.mockResolvedValueOnce(code)
    })

    it('should not confirm an account without code', async () => {
      await expect(isAddressWithoutCode(address, chainId)).resolves.toBe(false)
    })
  })

  describe('and the RPC fails', () => {
    beforeEach(() => {
      request.mockRejectedValueOnce(new Error('RPC unavailable'))
    })

    it('should leave the recipient unverified', async () => {
      await expect(isAddressWithoutCode(address, chainId)).rejects.toThrow('RPC unavailable')
    })
  })

  describe('and the RPC does not answer', () => {
    let outcome: Promise<void>

    beforeEach(() => {
      jest.useFakeTimers()
      request.mockReturnValueOnce(new Promise(() => undefined))
      outcome = expect(isAddressWithoutCode(address, chainId)).rejects.toThrow('Recipient code lookup timed out')
    })

    it('should stop waiting so classification can show the unverified review', async () => {
      await jest.advanceTimersByTimeAsync(10_000)
      await outcome
    })
  })
})

describe('when testing isDecentralandCollection', () => {
  let contractAddress: string
  let mockNetworkProvider: any
  let mockWalletProvider: any
  let mockReadContract: jest.Mock

  beforeEach(() => {
    contractAddress = '0xcollection'
    jest.mocked(config.get).mockReturnValue('production')
    jest.mocked(getContract).mockImplementation((name: string) => ({ address: `0xfactory-${name}`, abi: [] }) as any)
    // A connected wallet is available and already on the meta-transaction chain: the one case where
    // getNetworkProvider would hand back the wallet's own RPC instead of Decentraland's.
    mockWalletProvider = { isWalletProvider: true }
    mockNetworkProvider = { isNetworkProvider: true }
    jest.mocked(connection.getProvider).mockResolvedValue(mockWalletProvider)
    jest.mocked(connection.createProvider).mockReturnValue(mockNetworkProvider)
    mockReadContract = jest.fn()
    jest.mocked(createPublicClient).mockReturnValue({ readContract: mockReadContract, getChainId: jest.fn().mockResolvedValue(137) } as any)
  })

  afterEach(() => {
    jest.resetAllMocks()
    jest.useRealTimers()
  })

  describe('and a connected wallet reports the same chain', () => {
    beforeEach(() => {
      mockReadContract.mockResolvedValue(true)
    })

    it("should read the factories through Decentraland's own RPC for the meta-transaction chain", async () => {
      await isDecentralandCollection(contractAddress)
      expect(connection.createProvider).toHaveBeenCalledWith(ProviderType.NETWORK, ChainId.MATIC_MAINNET)
      expect(custom).toHaveBeenCalledWith(mockNetworkProvider)
    })

    it('should never consult the connected wallet, whose RPC the user may have been talked into replacing', async () => {
      await isDecentralandCollection(contractAddress)
      expect(connection.getProvider).not.toHaveBeenCalled()
      expect(connection.tryPreviousConnection).not.toHaveBeenCalled()
      expect(custom).not.toHaveBeenCalledWith(mockWalletProvider)
    })
  })

  describe('and one of the collection factories deployed the contract', () => {
    beforeEach(() => {
      mockReadContract.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    })

    it('should return true', async () => {
      await expect(isDecentralandCollection(contractAddress)).resolves.toBe(true)
    })

    it('should ask each factory whether it deployed that contract', async () => {
      await isDecentralandCollection(contractAddress)
      expect(mockReadContract).toHaveBeenCalledTimes(2)
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: '0xfactory-CollectionFactory',
          functionName: 'isCollectionFromFactory',
          args: [contractAddress]
        })
      )
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: '0xfactory-CollectionFactoryV3',
          functionName: 'isCollectionFromFactory',
          args: [contractAddress]
        })
      )
    })
  })

  describe('and one factory read fails while the other factory says it deployed the contract', () => {
    beforeEach(() => {
      mockReadContract.mockImplementation(({ address }: { address: string }) =>
        address === '0xfactory-CollectionFactory' ? Promise.reject(new Error('rpc down')) : Promise.resolve(true)
      )
    })

    it('should return true because one yes is the whole answer', async () => {
      await expect(isDecentralandCollection(contractAddress)).resolves.toBe(true)
    })
  })

  describe('and one factory read fails while the other factory says it did not deploy the contract', () => {
    beforeEach(() => {
      mockReadContract.mockImplementation(({ address }: { address: string }) =>
        address === '0xfactory-CollectionFactory' ? Promise.reject(new Error('rpc down')) : Promise.resolve(false)
      )
    })

    it('should throw because nothing vouched for the contract and nothing ruled it out', async () => {
      await expect(isDecentralandCollection(contractAddress)).rejects.toThrow('rpc down')
    })
  })

  describe('and no collection factory deployed the contract', () => {
    beforeEach(() => {
      mockReadContract.mockResolvedValue(false)
    })

    it('should return false', async () => {
      await expect(isDecentralandCollection(contractAddress)).resolves.toBe(false)
    })
  })

  describe('and the chain cannot be asked', () => {
    beforeEach(() => {
      mockReadContract.mockRejectedValue(new Error('rpc down'))
    })

    it('should throw instead of answering, so an outage is not read as a verdict', async () => {
      await expect(isDecentralandCollection(contractAddress)).rejects.toThrow('rpc down')
    })
  })

  describe('and the chain does not answer', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      mockReadContract.mockImplementation(() => new Promise(() => undefined))
    })

    it('should give up after the lookup timeout so the classifier reports the answer as unavailable', async () => {
      const lookup = isDecentralandCollection(contractAddress)
      const outcome = expect(lookup).rejects.toThrow('timed out')
      await jest.advanceTimersByTimeAsync(10_000)
      await outcome
    })
  })

  describe('and no collection factory exists on the meta-transaction chain', () => {
    beforeEach(() => {
      jest.mocked(getContract).mockImplementation(() => {
        throw new Error('not deployed')
      })
    })

    it('should return false without asking the chain', async () => {
      await expect(isDecentralandCollection(contractAddress)).resolves.toBe(false)
      expect(mockReadContract).not.toHaveBeenCalled()
    })
  })
})

describe('when testing getMetaTransactionChainId', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the environment is production', () => {
    beforeEach(() => {
      jest.mocked(config.get).mockReturnValueOnce('production')
    })

    it('should return MATIC_MAINNET', () => {
      const result = getMetaTransactionChainId()
      expect(result).toBe(ChainId.MATIC_MAINNET)
    })
  })

  describe('and the environment is staging', () => {
    beforeEach(() => {
      jest.mocked(config.get).mockReturnValueOnce('staging')
    })

    it('should return MATIC_MAINNET', () => {
      const result = getMetaTransactionChainId()
      expect(result).toBe(ChainId.MATIC_MAINNET)
    })
  })

  describe('and the environment is development', () => {
    beforeEach(() => {
      jest.mocked(config.get).mockReturnValueOnce('development')
    })

    it('should return MATIC_AMOY', () => {
      const result = getMetaTransactionChainId()
      expect(result).toBe(ChainId.MATIC_AMOY)
    })
  })
})

describe('when testing decodeNftTransferData', () => {
  let call: DecodedCall

  describe('and the call is a transferFrom', () => {
    beforeEach(() => {
      call = { functionName: 'transferFrom', args: ['0xfrom', '0xto', BigInt(123)], payable: false, forwardsCall: false }
    })

    it('should return the source, tokenId and destination', () => {
      expect(decodeNftTransferData(call)).toEqual({ fromAddress: '0xfrom', tokenId: '123', toAddress: '0xto' })
    })
  })

  describe('and the call is a safeTransferFrom with a data argument', () => {
    beforeEach(() => {
      call = { functionName: 'safeTransferFrom', args: ['0xfrom', '0xto', BigInt(9), '0x'], payable: false, forwardsCall: false }
    })

    it('should return the source, tokenId and destination', () => {
      expect(decodeNftTransferData(call)).toEqual({ fromAddress: '0xfrom', tokenId: '9', toAddress: '0xto' })
    })
  })

  describe('and the call is another collection call that also takes three arguments', () => {
    beforeEach(() => {
      // batchTransferFrom(address from, address to, uint256[] tokenIds) decodes into a "to" and a
      // "token id" as well; shown as the gift of one token it would transfer every listed one.
      call = {
        functionName: 'batchTransferFrom',
        args: ['0xfrom', '0xto', [BigInt(1), BigInt(2), BigInt(3)]],
        payable: false,
        forwardsCall: false
      }
    })

    it('should return null so the generic review previews it', () => {
      expect(decodeNftTransferData(call)).toBeNull()
    })
  })

  describe('and the call is a collection admin call whose second argument is a list of addresses', () => {
    beforeEach(() => {
      // setItemsMinters(uint256[] itemIds, address[] minters, uint256[] values) grants minting rights;
      // its single-element lists decode into a plausible "to" and "token id".
      call = { functionName: 'setItemsMinters', args: [[BigInt(0)], ['0xto'], [BigInt(1)]], payable: false, forwardsCall: false }
    })

    it('should return null instead of presenting it as a gift', () => {
      expect(decodeNftTransferData(call)).toBeNull()
    })
  })

  describe('and a transfer decodes with a token id that is not a single uint256', () => {
    beforeEach(() => {
      call = { functionName: 'transferFrom', args: ['0xfrom', '0xto', 'not-a-token-id'], payable: false, forwardsCall: false }
    })

    it('should return null', () => {
      expect(decodeNftTransferData(call)).toBeNull()
    })
  })

  describe('and the call has fewer arguments than a transfer', () => {
    beforeEach(() => {
      call = { functionName: 'transferFrom', args: ['0xfrom'], payable: false, forwardsCall: false }
    })

    it('should return null', () => {
      expect(decodeNftTransferData(call)).toBeNull()
    })
  })
})

describe('when checking whether an NFT simulation exactly matches the branded gift', () => {
  let result: SimulationResponseBody
  let signerAddress: string
  let contractAddress: string
  let transfer: { fromAddress: string; tokenId: string; toAddress: string }

  beforeEach(() => {
    signerAddress = '0x0000000000000000000000000000000000000001'
    contractAddress = '0x0000000000000000000000000000000000000002'
    transfer = {
      fromAddress: signerAddress,
      tokenId: '7',
      toAddress: '0x0000000000000000000000000000000000000003'
    }
    result = {
      status: 'success',
      assetChanges: [
        {
          type: 'transfer',
          standard: 'erc721',
          from: signerAddress,
          to: transfer.toAddress,
          amount: '1',
          rawAmount: '1',
          tokenId: transfer.tokenId,
          contractAddress,
          symbol: null,
          name: 'Wearable',
          decimals: null,
          logoUrl: null,
          dollarValue: null
        }
      ],
      approvalChanges: [],
      balanceChanges: [],
      events: []
    }
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the only effect is the displayed transfer from the connected signer', () => {
    it('should allow the specialized gift view', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(true)
    })
  })

  describe('and a receiver callback moves another asset', () => {
    beforeEach(() => {
      result.assetChanges.push({
        ...result.assetChanges[0],
        standard: 'erc20',
        tokenId: null,
        contractAddress: '0x0000000000000000000000000000000000000004'
      })
    })

    it('should require the generic simulation summary', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(false)
    })
  })

  describe('and the transfer grants an approval', () => {
    beforeEach(() => {
      result.approvalChanges.push({
        kind: 'approvalForAll',
        standard: 'erc721',
        owner: signerAddress,
        spender: transfer.toAddress,
        amount: null,
        rawAmount: null,
        isUnlimited: true,
        tokenId: null,
        approved: true,
        contractAddress,
        symbol: null,
        name: null
      })
    })

    it('should require the generic simulation summary', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(false)
    })
  })

  describe('and the calldata transfers an NFT owned by another account', () => {
    beforeEach(() => {
      transfer.fromAddress = '0x0000000000000000000000000000000000000005'
    })

    it('should require the generic simulation summary', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(false)
    })
  })

  describe('and the simulation reverted', () => {
    beforeEach(() => {
      result.status = 'reverted'
    })

    it('should require the generic simulation summary', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(false)
    })
  })

  describe('and the token goes to a recipient other than the one on screen', () => {
    beforeEach(() => {
      result.assetChanges[0].to = '0x0000000000000000000000000000000000000009'
    })

    it('should require the generic simulation summary', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(false)
    })
  })

  describe('and the token moves on a contract other than the one being called', () => {
    beforeEach(() => {
      result.assetChanges[0].contractAddress = '0x0000000000000000000000000000000000000009'
    })

    it('should require the generic simulation summary', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(false)
    })
  })

  describe('and a different token than the one on screen moves', () => {
    beforeEach(() => {
      result.assetChanges[0].tokenId = '8'
    })

    it('should require the generic simulation summary', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(false)
    })
  })

  describe('and the server reports the same token id in another notation', () => {
    beforeEach(() => {
      result.assetChanges[0].tokenId = '0x7'
    })

    it('should still allow the specialized gift view', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(true)
    })
  })

  describe('and the server reports a token id that is not a number', () => {
    beforeEach(() => {
      result.assetChanges[0].tokenId = 'seven'
    })

    it('should require the generic simulation summary', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(false)
    })
  })

  describe.each<['mint' | 'burn']>([['mint'], ['burn']])('and the only change is a %s rather than a transfer', type => {
    beforeEach(() => {
      result.assetChanges[0].type = type
    })

    it('should require the generic simulation summary', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(false)
    })
  })

  describe('and the asset is not an ERC-721 token', () => {
    beforeEach(() => {
      result.assetChanges[0].standard = 'erc1155'
    })

    it('should require the generic simulation summary', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(false)
    })
  })

  describe('and the receiver emitted an event of its own', () => {
    beforeEach(() => {
      // e.g. a receiver acting on a permission it already holds, which moves no asset but logs.
      result.events = [
        { name: 'Transfer', address: contractAddress },
        { name: 'UpdateOperator', address: '0x0000000000000000000000000000000000000009' }
      ]
    })

    it('should require the generic simulation summary', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(false)
    })
  })

  describe("and the only events are the collection's own", () => {
    beforeEach(() => {
      result.events = [
        { name: 'Approval', address: contractAddress },
        { name: 'Transfer', address: contractAddress.toUpperCase() }
      ]
    })

    it('should allow the specialized gift view', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(true)
    })
  })

  describe('and the addresses only differ in casing between the calldata and the simulation', () => {
    beforeEach(() => {
      // The decoder returns EIP-55 checksummed addresses; the preview server lowercases.
      signerAddress = '0x0000000000000000000000000000000000000AbC'
      contractAddress = '0x0000000000000000000000000000000000000DeF'
      transfer = { fromAddress: signerAddress, tokenId: '7', toAddress: '0x0000000000000000000000000000000000000FeD' }
      result.assetChanges[0] = {
        ...result.assetChanges[0],
        from: signerAddress.toLowerCase(),
        to: transfer.toAddress.toLowerCase(),
        contractAddress: contractAddress.toLowerCase()
      }
    })

    it('should allow the specialized gift view', () => {
      expect(isExactNftTransferSimulation(result, signerAddress, contractAddress, transfer)).toBe(true)
    })
  })
})

describe('when testing decodeManaTransferData', () => {
  let call: DecodedCall

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the call is a transfer', () => {
    beforeEach(() => {
      call = {
        functionName: 'transfer',
        args: ['0xabcdef1234567890abcdef1234567890abcdef12', BigInt('100000000000000000')],
        payable: false,
        forwardsCall: false
      }
      jest.mocked(formatEther).mockReturnValueOnce('0.1')
    })

    it('should return the manaAmount and toAddress', () => {
      expect(decodeManaTransferData(call)).toEqual({
        manaAmount: '0.1',
        toAddress: '0xabcdef1234567890abcdef1234567890abcdef12'
      })
    })
  })

  describe('and the call is not a transfer', () => {
    beforeEach(() => {
      call = {
        functionName: 'approve',
        args: ['0xabcdef1234567890abcdef1234567890abcdef12', BigInt(1)],
        payable: false,
        forwardsCall: false
      }
    })

    it('should return null', () => {
      expect(decodeManaTransferData(call)).toBeNull()
    })
  })

  describe('and the call has fewer arguments than a transfer', () => {
    beforeEach(() => {
      call = { functionName: 'transfer', args: ['0xabcdef1234567890abcdef1234567890abcdef12'], payable: false, forwardsCall: false }
    })

    it('should return null', () => {
      expect(decodeManaTransferData(call)).toBeNull()
    })
  })

  describe('and the transfer has a large amount', () => {
    beforeEach(() => {
      // 1000 MANA in wei (1000 * 10^18)
      call = {
        functionName: 'transfer',
        args: ['0xabcdef1234567890abcdef1234567890abcdef12', BigInt('1000000000000000000000')],
        payable: false,
        forwardsCall: false
      }
      jest.mocked(formatEther).mockReturnValueOnce('1000.0')
    })

    it('should correctly convert large amounts from wei to MANA', () => {
      expect(decodeManaTransferData(call)).toEqual({
        manaAmount: '1000.0',
        toAddress: '0xabcdef1234567890abcdef1234567890abcdef12'
      })
    })
  })
})

describe('when testing fetchNftMetadata', () => {
  let contractAddress: string
  let contractABI: object[]
  let tokenId: string
  let mockPublicClient: any
  let mockNetworkProvider: any

  beforeEach(() => {
    contractAddress = '0xcontract'
    contractABI = [{ type: 'function', name: 'tokenURI' }]
    tokenId = '123'
    global.fetch = jest.fn()

    // Mock config.get for getMetaTransactionChainId
    jest.mocked(config.get).mockReturnValue('production')

    // Mock getNetworkProvider dependencies
    mockNetworkProvider = { isNetworkProvider: true }
    jest.mocked(connection.getProvider).mockRejectedValue(new Error('Not connected'))
    jest.mocked(connection.tryPreviousConnection).mockRejectedValue(new Error('No previous'))
    jest.mocked(connection.createProvider).mockReturnValue(mockNetworkProvider)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the NFT has basic metadata', () => {
    let tokenUri: string
    let metadata: any

    beforeEach(() => {
      tokenUri = 'https://example.com/token/123'
      metadata = {
        name: 'Test NFT',
        description: 'A test NFT',
        image: 'https://example.com/image.png'
      }
      mockPublicClient = {
        getChainId: jest.fn().mockResolvedValue(1),
        readContract: jest.fn().mockResolvedValueOnce(tokenUri)
      }
      jest.mocked(createPublicClient).mockReturnValue(mockPublicClient)
      jest.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(metadata)
      } as any)
    })

    it('should return the metadata with image URL, name, and description', async () => {
      const result = await fetchNftMetadata(contractAddress, contractABI, tokenId)
      expect(result).toEqual({
        imageUrl: 'https://example.com/image.png',
        name: 'Test NFT',
        description: 'A test NFT',
        rarity: Rarity.COMMON
      })
    })
  })

  describe('and the NFT has rarity attribute', () => {
    let tokenUri: string
    let metadata: any

    beforeEach(() => {
      tokenUri = 'https://example.com/token/123'
      metadata = {
        name: 'Rare NFT',
        description: 'A rare NFT',
        image: 'https://example.com/image.png',
        attributes: [
          { trait_type: 'Color', value: 'Blue' },
          { trait_type: 'Rarity', value: 'Epic' }
        ]
      }
      mockPublicClient = {
        getChainId: jest.fn().mockResolvedValue(1),
        readContract: jest.fn().mockResolvedValueOnce(tokenUri)
      }
      jest.mocked(createPublicClient).mockReturnValue(mockPublicClient)
      jest.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(metadata)
      } as any)
    })

    it('should return the metadata with the rarity', async () => {
      const result = await fetchNftMetadata(contractAddress, contractABI, tokenId)
      expect(result).toEqual({
        imageUrl: 'https://example.com/image.png',
        name: 'Rare NFT',
        description: 'A rare NFT',
        rarity: Rarity.EPIC
      })
    })
  })

  describe('and the NFT uses image_url instead of image', () => {
    let tokenUri: string
    let metadata: any

    beforeEach(() => {
      tokenUri = 'https://example.com/token/123'
      metadata = {
        name: 'Test NFT',
        image_url: 'https://example.com/image.png'
      }
      mockPublicClient = {
        getChainId: jest.fn().mockResolvedValue(1),
        readContract: jest.fn().mockResolvedValueOnce(tokenUri)
      }
      jest.mocked(createPublicClient).mockReturnValue(mockPublicClient)
      jest.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(metadata)
      } as any)
    })

    it('should return the metadata with image_url', async () => {
      const result = await fetchNftMetadata(contractAddress, contractABI, tokenId)
      expect(result.imageUrl).toBe('https://example.com/image.png')
    })
  })

  describe.each([
    ['unique', 'Unique', Rarity.UNIQUE],
    ['mythic', 'Mythic', Rarity.MYTHIC],
    ['epic', 'Epic', Rarity.EPIC],
    ['legendary', 'Legendary', Rarity.LEGENDARY],
    ['rare', 'Rare', Rarity.RARE],
    ['uncommon', 'Uncommon', Rarity.UNCOMMON],
    ['common', 'Common', Rarity.COMMON],
    ['unknown', 'Unknown', Rarity.COMMON]
  ])('and the NFT metadata has the %s rarity', (_rarityName, rarityValue, expectedRarity) => {
    let tokenUri: string
    let metadata: any

    beforeEach(() => {
      tokenUri = 'https://example.com/token/123'
      metadata = {
        image: 'https://example.com/image.png',
        attributes: [{ trait_type: 'Rarity', value: rarityValue }]
      }
      mockPublicClient = {
        getChainId: jest.fn().mockResolvedValue(1),
        readContract: jest.fn().mockResolvedValueOnce(tokenUri)
      }
      jest.mocked(createPublicClient).mockReturnValue(mockPublicClient)
      jest.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(metadata)
      } as any)
    })

    it('should correctly map the rarity', async () => {
      const result = await fetchNftMetadata(contractAddress, contractABI, tokenId)
      expect(result.rarity).toBe(expectedRarity)
    })
  })

  describe('and the contract does not return a tokenURI', () => {
    beforeEach(() => {
      mockPublicClient = {
        getChainId: jest.fn().mockResolvedValue(1),
        readContract: jest.fn().mockResolvedValueOnce(null)
      }
      jest.mocked(createPublicClient).mockReturnValue(mockPublicClient)
    })

    it('should throw an error indicating no tokenURI', async () => {
      await expect(fetchNftMetadata(contractAddress, contractABI, tokenId)).rejects.toThrow(
        `No tokenURI returned for token ${tokenId} at contract ${contractAddress}`
      )
    })
  })

  describe('and fetching the metadata fails', () => {
    let tokenUri: string

    beforeEach(() => {
      tokenUri = 'https://example.com/token/123'
      mockPublicClient = {
        getChainId: jest.fn().mockResolvedValue(1),
        readContract: jest.fn().mockResolvedValueOnce(tokenUri)
      }
      jest.mocked(createPublicClient).mockReturnValue(mockPublicClient)
      jest.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as any)
    })

    it('should throw an error with the status', async () => {
      await expect(fetchNftMetadata(contractAddress, contractABI, tokenId)).rejects.toThrow(
        `Failed to fetch metadata from ${tokenUri}: 404 Not Found`
      )
    })
  })

  describe('and the tokenURI uses a non-http scheme', () => {
    beforeEach(() => {
      mockPublicClient = {
        getChainId: jest.fn().mockResolvedValue(1),
        readContract: jest.fn().mockResolvedValueOnce('javascript:alert(1)')
      }
      jest.mocked(createPublicClient).mockReturnValue(mockPublicClient)
    })

    it('should throw an unsupported-scheme error without fetching', async () => {
      await expect(fetchNftMetadata(contractAddress, contractABI, tokenId)).rejects.toThrow('Unsupported tokenURI scheme')
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('and the metadata image uses a non-http scheme', () => {
    let tokenUri: string
    let metadata: any

    beforeEach(() => {
      tokenUri = 'https://example.com/token/123'
      metadata = {
        name: 'Test NFT',
        description: 'A test NFT',
        image: 'data:image/svg+xml,<svg onload="alert(1)"></svg>'
      }
      mockPublicClient = {
        getChainId: jest.fn().mockResolvedValue(1),
        readContract: jest.fn().mockResolvedValueOnce(tokenUri)
      }
      jest.mocked(createPublicClient).mockReturnValue(mockPublicClient)
      jest.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(metadata)
      } as any)
    })

    it('should drop the image URL and return an empty imageUrl', async () => {
      const result = await fetchNftMetadata(contractAddress, contractABI, tokenId)
      expect(result.imageUrl).toBe('')
    })
  })
})

describe('when building the explorer deep link', () => {
  let deepLink: string | undefined

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the environment is production', () => {
    beforeEach(() => {
      jest.mocked(config.get).mockReturnValue('production')
      deepLink = 'decentraland://'
    })

    describe('and bridgeOnly is disabled', () => {
      it('should return the bare deep link without query params', () => {
        expect(getExplorerDeeplink(deepLink, false)).toBe('decentraland://')
      })
    })

    describe('and bridgeOnly is enabled', () => {
      it('should append the canonical bridgeOnly flag', () => {
        expect(getExplorerDeeplink(deepLink, true)).toBe('decentraland://?bridgeOnly=true')
      })
    })

    describe('and an authRequestId is provided', () => {
      it('should append it verbatim alongside the bridgeOnly flag', () => {
        expect(getExplorerDeeplink(deepLink, true, 'abc-123')).toBe('decentraland://?bridgeOnly=true&authRequestId=abc-123')
      })
    })

    describe('and the authRequestId contains url-significant characters', () => {
      it('should url-encode the authRequestId value', () => {
        expect(getExplorerDeeplink(deepLink, false, 'a/b c')).toBe('decentraland://?authRequestId=a%2Fb+c')
      })
    })
  })

  describe('and the environment is development', () => {
    beforeEach(() => {
      jest.mocked(config.get).mockReturnValue('development')
      deepLink = 'decentraland://'
    })

    describe('and bridgeOnly is disabled', () => {
      it('should append only the dclenv zone param', () => {
        expect(getExplorerDeeplink(deepLink, false)).toBe('decentraland://?dclenv=zone')
      })
    })

    describe('and bridgeOnly is enabled', () => {
      it('should append both the dclenv zone param and the bridgeOnly flag', () => {
        expect(getExplorerDeeplink(deepLink, true)).toBe('decentraland://?dclenv=zone&bridgeOnly=true')
      })
    })
  })

  describe('and the environment is a named non-production env', () => {
    beforeEach(() => {
      jest.mocked(config.get).mockReturnValue('staging')
      deepLink = 'dcl-creator-hub://'
    })

    describe('and bridgeOnly is enabled', () => {
      it('should append the raw env as dclenv alongside the bridgeOnly flag', () => {
        expect(getExplorerDeeplink(deepLink, true)).toBe('dcl-creator-hub://?dclenv=staging&bridgeOnly=true')
      })
    })
  })

  describe('and no deep link is provided', () => {
    beforeEach(() => {
      jest.mocked(config.get).mockReturnValue('production')
      deepLink = undefined
    })

    describe('and bridgeOnly is enabled', () => {
      it('should fall back to the decentraland scheme with the bridgeOnly flag', () => {
        expect(getExplorerDeeplink(deepLink, true)).toBe('decentraland://?bridgeOnly=true')
      })
    })
  })
})

describe('when building the signin deep link', () => {
  let deepLink: string | undefined
  let identityId: string

  beforeEach(() => {
    identityId = 'anIdentityId'
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the environment is production', () => {
    beforeEach(() => {
      jest.mocked(config.get).mockReturnValue('production')
      deepLink = 'decentraland://'
    })

    describe('and bridgeOnly is disabled', () => {
      it('should return the signin deep link without extra query params', () => {
        expect(getSigninDeeplink(deepLink, identityId, false)).toBe('decentraland://open?signin=anIdentityId')
      })
    })

    describe('and bridgeOnly is enabled', () => {
      it('should append the canonical bridgeOnly flag after the signin param', () => {
        expect(getSigninDeeplink(deepLink, identityId, true)).toBe('decentraland://open?signin=anIdentityId&bridgeOnly=true')
      })
    })

    describe('and an authRequestId is provided', () => {
      it('should append it verbatim after the signin and bridgeOnly params', () => {
        expect(getSigninDeeplink(deepLink, identityId, true, 'abc-123')).toBe(
          'decentraland://open?signin=anIdentityId&bridgeOnly=true&authRequestId=abc-123'
        )
      })
    })
  })

  describe('and the environment is development', () => {
    beforeEach(() => {
      jest.mocked(config.get).mockReturnValue('development')
      deepLink = 'decentraland://'
    })

    describe('and bridgeOnly is disabled', () => {
      it('should append only the dclenv zone param after the signin param', () => {
        expect(getSigninDeeplink(deepLink, identityId, false)).toBe('decentraland://open?signin=anIdentityId&dclenv=zone')
      })
    })

    describe('and bridgeOnly is enabled', () => {
      it('should append both the dclenv zone param and the bridgeOnly flag after the signin param', () => {
        expect(getSigninDeeplink(deepLink, identityId, true)).toBe('decentraland://open?signin=anIdentityId&dclenv=zone&bridgeOnly=true')
      })
    })
  })

  describe('and the environment is a named non-production env and a custom scheme is used', () => {
    beforeEach(() => {
      jest.mocked(config.get).mockReturnValue('staging')
      deepLink = 'dcl-creator-hub://'
    })

    it('should build the signin deep link on the custom scheme with the raw env as dclenv', () => {
      expect(getSigninDeeplink(deepLink, identityId, false)).toBe('dcl-creator-hub://open?signin=anIdentityId&dclenv=staging')
    })
  })

  describe('and no deep link is provided', () => {
    beforeEach(() => {
      jest.mocked(config.get).mockReturnValue('production')
      deepLink = undefined
    })

    it('should fall back to the decentraland scheme', () => {
      expect(getSigninDeeplink(deepLink, identityId, false)).toBe('decentraland://open?signin=anIdentityId')
    })
  })

  describe('and the identity id contains url-significant characters', () => {
    beforeEach(() => {
      jest.mocked(config.get).mockReturnValue('production')
      deepLink = 'decentraland://'
      identityId = 'a&b=c'
    })

    it('should url-encode the identity id in the signin param', () => {
      expect(getSigninDeeplink(deepLink, identityId, false)).toBe('decentraland://open?signin=a%26b%3Dc')
    })
  })
})

describe('when testing buildSendTransactionSimulationPayload', () => {
  let signerAddress: string
  let contract: KnownContract
  let transaction: Extract<RequestClassification, { kind: 'dcl_transaction' }>

  beforeEach(() => {
    signerAddress = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
    contract = {
      name: 'MANAToken' as KnownContract['name'],
      address: '0xa1c57f48f0deb89f569dfbe6e2b7f46d33606fd4',
      chainId: 137,
      abi: [],
      domainName: '(PoS) Decentraland MANA',
      domainVersion: '1',
      supportsMetaTransactions: true,
      calldataField: 'functionSignature'
    }
  })

  describe('and the transaction will be relayed as a meta-transaction', () => {
    beforeEach(() => {
      transaction = {
        kind: 'dcl_transaction',
        contract,
        call: { functionName: 'transfer', args: [], payable: false, forwardsCall: false },
        to: contract.address,
        data: '0xa9059cbb',
        value: '0x0',
        chainId: 137,
        relayed: true,
        branded: 'tip'
      }
    })

    it('should simulate on the meta-transaction chain', () => {
      expect(buildSendTransactionSimulationPayload(transaction, signerAddress).chainId).toBe(ChainId.MATIC_MAINNET)
    })

    it('should preview the contract calling itself, as the relay makes the inner call', () => {
      expect(buildSendTransactionSimulationPayload(transaction, signerAddress)).toMatchObject({
        from: contract.address,
        to: contract.address
      })
    })

    it('should append the connected signer to the calldata as the meta-transaction sender', () => {
      expect(buildSendTransactionSimulationPayload(transaction, signerAddress).data).toBe(`0xa9059cbb${signerAddress.slice(2)}`)
    })

    it('should preview without value because the relay forwards none', () => {
      expect(buildSendTransactionSimulationPayload(transaction, signerAddress).value).toBe('0')
    })
  })

  describe('and the transaction is sent by the wallet on the connected chain', () => {
    beforeEach(() => {
      transaction = {
        kind: 'dcl_transaction',
        contract: { ...contract, chainId: 1 },
        call: { functionName: 'approve', args: [], payable: false, forwardsCall: false },
        to: contract.address,
        data: '0x095ea7b3',
        value: '0x0',
        chainId: 1,
        relayed: false,
        branded: null
      }
    })

    it('should simulate on the connected chain as the connected signer with the reviewed fields', () => {
      expect(buildSendTransactionSimulationPayload(transaction, signerAddress)).toEqual({
        chainId: 1,
        from: signerAddress,
        to: contract.address,
        data: '0x095ea7b3',
        value: '0x0'
      })
    })
  })
})
