/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/unbound-method */
import { createPublicClient, decodeFunctionData, formatEther } from 'viem'
import { Rarity } from '@dcl/schemas'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { connection } from 'decentraland-connect'
import { ContractName, getContract, getContractName } from 'decentraland-transactions'
import { config } from '../../../modules/config'
import { MalformedSignatureRequestError } from '../../../shared/auth/errors'
import { assertSignatureParamsAreCanonical } from '../../../shared/auth/signMethodGuard'
import {
  buildSendTransactionSimulationPayload,
  checkMetaTransactionSupport,
  decodeManaTransferData,
  decodeMetaTransactionTypedData,
  decodeNftTransferData,
  extractSignaturePayload,
  fetchNftMetadata,
  getConnectedProvider,
  getExplorerDeeplink,
  getMetaTransactionChainId,
  getNetworkProvider,
  getSigninDeeplink,
  isApprovalGrantingTypedData,
  isDecentralandContractAddress,
  isSignatureMethod
} from './utils'

jest.mock('decentraland-connect')
jest.mock('decentraland-transactions')
jest.mock('../../../modules/config')
jest.mock('viem', () => ({
  createPublicClient: jest.fn(),
  custom: jest.fn((provider: any) => provider),
  decodeFunctionData: jest.fn(),
  formatEther: jest.fn(),
  // Use the real hexToString so signature-message decoding can be exercised.
  hexToString: jest.requireActual('viem').hexToString
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

describe('when testing isDecentralandContractAddress', () => {
  let contractAddress: string
  let metaTransactionServerUrl: string

  beforeEach(() => {
    contractAddress = '0x1234567890abcdef'
    metaTransactionServerUrl = 'https://meta-transactions.decentraland.org'
    jest.mocked(config.get).mockReturnValueOnce(metaTransactionServerUrl)
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the contract is a valid Decentraland contract', () => {
    beforeEach(() => {
      jest.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ ok: true })
      } as any)
    })

    it('should return true', async () => {
      const result = await isDecentralandContractAddress(contractAddress)
      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        `${metaTransactionServerUrl}/v1/contracts/${contractAddress}`,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
  })

  describe('and the contract is not a valid Decentraland contract', () => {
    beforeEach(() => {
      jest.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ ok: false })
      } as any)
    })

    it('should return false', async () => {
      const result = await isDecentralandContractAddress(contractAddress)
      expect(result).toBe(false)
    })
  })

  describe('and the API returns a non-200 status', () => {
    beforeEach(() => {
      jest.mocked(fetch).mockResolvedValueOnce({
        status: 404
      } as any)
    })

    it('should return false', async () => {
      const result = await isDecentralandContractAddress(contractAddress)
      expect(result).toBe(false)
    })
  })

  describe('and the API call fails', () => {
    beforeEach(() => {
      jest.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
    })

    it('should return false', async () => {
      const result = await isDecentralandContractAddress(contractAddress)
      expect(result).toBe(false)
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

describe('when testing checkMetaTransactionSupport', () => {
  let contractAddress: string

  beforeEach(() => {
    contractAddress = '0x1234567890abcdef'
    // getMetaTransactionChainId() reads ENVIRONMENT and isDecentralandContractAddress() reads the
    // meta-transaction server URL; resolve both deterministically by key regardless of call order.
    jest
      .mocked(config.get)
      .mockImplementation((key: string) => (key === 'ENVIRONMENT' ? 'dev' : 'https://meta-transactions.decentraland.org'))
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the contract is a known Decentraland contract on the meta-transaction chain', () => {
    beforeEach(() => {
      jest.mocked(getContractName).mockReturnValueOnce(ContractName.MANAToken)
      jest.mocked(getContract).mockReturnValueOnce({ address: contractAddress } as any)
    })

    it('should return willUseMetaTransaction as true with the contract name', async () => {
      const result = await checkMetaTransactionSupport(contractAddress)
      expect(result).toEqual({
        willUseMetaTransaction: true,
        contractName: ContractName.MANAToken
      })
    })
  })

  describe('and the address matches a Decentraland contract but on a different chain', () => {
    beforeEach(() => {
      // getContractName matches an address on ANY chain, but the deployment on the meta-tx chain
      // has a different address — so this must NOT be relayed as a meta-transaction.
      jest.mocked(getContractName).mockReturnValueOnce(ContractName.MANAToken)
      jest.mocked(getContract).mockReturnValueOnce({ address: '0xdifferentchainaddress' } as any)
      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ ok: false })
      } as any)
    })

    it('should return willUseMetaTransaction as false with null contract name', async () => {
      const result = await checkMetaTransactionSupport(contractAddress)
      expect(result).toEqual({
        willUseMetaTransaction: false,
        contractName: null
      })
    })
  })

  describe('and the contract is not known but is a valid Decentraland collection contract', () => {
    beforeEach(() => {
      jest.mocked(getContractName).mockImplementationOnce(() => {
        throw new Error('Unknown contract')
      })
      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ ok: true })
      } as any)
    })

    it('should return willUseMetaTransaction as true with ERC721CollectionV2', async () => {
      const result = await checkMetaTransactionSupport(contractAddress)
      expect(result).toEqual({
        willUseMetaTransaction: true,
        contractName: ContractName.ERC721CollectionV2
      })
    })
  })

  describe('and the contract is not a Decentraland contract', () => {
    beforeEach(() => {
      jest.mocked(getContractName).mockImplementationOnce(() => {
        throw new Error('Unknown contract')
      })
      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValueOnce({ ok: false })
      } as any)
    })

    it('should return willUseMetaTransaction as false with null contract name', async () => {
      const result = await checkMetaTransactionSupport(contractAddress)
      expect(result).toEqual({
        willUseMetaTransaction: false,
        contractName: null
      })
    })
  })
})

describe('when testing decodeNftTransferData', () => {
  let contractABI: object[]
  let transactionData: string

  beforeEach(() => {
    contractABI = [{ type: 'function', name: 'transferFrom' }]
    transactionData = '0x23b872dd'
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the transaction data is valid', () => {
    beforeEach(() => {
      jest.mocked(decodeFunctionData).mockReturnValueOnce({
        functionName: 'transferFrom',
        args: ['0xfrom', '0xto', BigInt(123)]
      })
    })

    it('should return the tokenId and toAddress', () => {
      const result = decodeNftTransferData(transactionData, contractABI)
      expect(result).toEqual({
        tokenId: '123',
        toAddress: '0xto'
      })
    })
  })

  describe('and the transaction data is empty', () => {
    beforeEach(() => {
      transactionData = ''
    })

    it('should return null', () => {
      const result = decodeNftTransferData(transactionData, contractABI)
      expect(result).toBeNull()
    })
  })

  describe('and the transaction data is too short', () => {
    beforeEach(() => {
      transactionData = '0x1234'
    })

    it('should return null', () => {
      const result = decodeNftTransferData(transactionData, contractABI)
      expect(result).toBeNull()
    })
  })

  describe('and decoding returns insufficient args', () => {
    beforeEach(() => {
      jest.mocked(decodeFunctionData).mockReturnValueOnce({
        functionName: 'transferFrom',
        args: ['0xfrom']
      })
    })

    it('should return null', () => {
      const result = decodeNftTransferData(transactionData, contractABI)
      expect(result).toBeNull()
    })
  })

  describe('and decoding throws an error', () => {
    beforeEach(() => {
      jest.mocked(decodeFunctionData).mockImplementationOnce(() => {
        throw new Error('Decoding error')
      })
    })

    it('should return null', () => {
      const result = decodeNftTransferData(transactionData, contractABI)
      expect(result).toBeNull()
    })
  })
})

describe('when testing decodeManaTransferData', () => {
  let transactionData: string
  let manaContractAddress: string
  let mockContract: any

  beforeEach(() => {
    jest.mocked(config.get).mockReturnValue('production')
    manaContractAddress = '0x0f5d2fb29fb7d3cfee444a200298f468908cc942'
    mockContract = {
      abi: [{ type: 'function', name: 'transfer' }],
      address: manaContractAddress
    }
    jest.mocked(getContract).mockReturnValue(mockContract)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the transaction data is a valid MANA transfer', () => {
    beforeEach(() => {
      transactionData =
        '0xa9059cbb000000000000000000000000abcdef1234567890abcdef1234567890abcdef12000000000000000000000000000000000000000000000000016345785d8a0000'
      jest.mocked(decodeFunctionData).mockReturnValueOnce({
        functionName: 'transfer',
        args: ['0xabcdef1234567890abcdef1234567890abcdef12', BigInt('100000000000000000')]
      })
      jest.mocked(formatEther).mockReturnValueOnce('0.1')
    })

    it('should return the manaAmount and toAddress', () => {
      const result = decodeManaTransferData(transactionData, manaContractAddress)
      expect(result).toEqual({
        manaAmount: '0.1',
        toAddress: '0xabcdef1234567890abcdef1234567890abcdef12'
      })
    })
  })

  describe('and the transaction targets the MANA contract with a differently-cased address', () => {
    beforeEach(() => {
      transactionData =
        '0xa9059cbb000000000000000000000000abcdef1234567890abcdef1234567890abcdef12000000000000000000000000000000000000000000000000016345785d8a0000'
      jest.mocked(decodeFunctionData).mockReturnValueOnce({
        functionName: 'transfer',
        args: ['0xabcdef1234567890abcdef1234567890abcdef12', BigInt('100000000000000000')]
      })
      jest.mocked(formatEther).mockReturnValueOnce('0.1')
    })

    it('should decode the transfer regardless of address casing', () => {
      const result = decodeManaTransferData(transactionData, manaContractAddress.toUpperCase())
      expect(result).toEqual({
        manaAmount: '0.1',
        toAddress: '0xabcdef1234567890abcdef1234567890abcdef12'
      })
    })
  })

  describe('and the transaction targets a non-MANA token contract', () => {
    beforeEach(() => {
      transactionData =
        '0xa9059cbb000000000000000000000000abcdef1234567890abcdef1234567890abcdef12000000000000000000000000000000000000000000000000016345785d8a0000'
    })

    it('should return null without decoding the transfer', () => {
      const result = decodeManaTransferData(transactionData, '0x1111111111111111111111111111111111111111')
      expect(result).toBeNull()
    })
  })

  describe('and the contract address is empty', () => {
    beforeEach(() => {
      transactionData =
        '0xa9059cbb000000000000000000000000abcdef1234567890abcdef1234567890abcdef12000000000000000000000000000000000000000000000000016345785d8a0000'
    })

    it('should return null', () => {
      const result = decodeManaTransferData(transactionData, '')
      expect(result).toBeNull()
    })
  })

  describe('and the transaction data is empty', () => {
    beforeEach(() => {
      transactionData = ''
    })

    it('should return null', () => {
      const result = decodeManaTransferData(transactionData, manaContractAddress)
      expect(result).toBeNull()
    })
  })

  describe('and the transaction data is too short', () => {
    beforeEach(() => {
      transactionData = '0x1234'
    })

    it('should return null', () => {
      const result = decodeManaTransferData(transactionData, manaContractAddress)
      expect(result).toBeNull()
    })
  })

  describe('and the transaction data is not a transfer function', () => {
    beforeEach(() => {
      transactionData = '0x12345678000000000000000000000000abcdef1234567890abcdef1234567890abcdef12'
    })

    it('should return null', () => {
      const result = decodeManaTransferData(transactionData, manaContractAddress)
      expect(result).toBeNull()
    })
  })

  describe('and decoding returns insufficient args', () => {
    beforeEach(() => {
      transactionData = '0xa9059cbb000000000000000000000000abcdef1234567890abcdef1234567890abcdef12'
      jest.mocked(decodeFunctionData).mockReturnValueOnce({
        functionName: 'transfer',
        args: ['0xabcdef1234567890abcdef1234567890abcdef12']
      })
    })

    it('should return null', () => {
      const result = decodeManaTransferData(transactionData, manaContractAddress)
      expect(result).toBeNull()
    })
  })

  describe('and decoding throws an error', () => {
    beforeEach(() => {
      transactionData = '0xa9059cbb000000000000000000000000abcdef1234567890abcdef1234567890abcdef12'
      jest.mocked(decodeFunctionData).mockImplementationOnce(() => {
        throw new Error('Decoding error')
      })
    })

    it('should return null', () => {
      const result = decodeManaTransferData(transactionData, manaContractAddress)
      expect(result).toBeNull()
    })
  })

  describe('and the transaction has a large amount', () => {
    beforeEach(() => {
      transactionData = '0xa9059cbb000000000000000000000000abcdef1234567890abcdef1234567890abcdef12'
      // 1000 MANA in wei (1000 * 10^18)
      jest.mocked(decodeFunctionData).mockReturnValueOnce({
        functionName: 'transfer',
        args: ['0xabcdef1234567890abcdef1234567890abcdef12', BigInt('1000000000000000000000')]
      })
      jest.mocked(formatEther).mockReturnValueOnce('1000.0')
    })

    it('should correctly convert large amounts from wei to MANA', () => {
      const result = decodeManaTransferData(transactionData, manaContractAddress)
      expect(result).toEqual({
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

describe('when testing isSignatureMethod', () => {
  describe.each(['personal_sign', 'eth_sign', 'eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4'])(
    'and the method is a signature method (%s)',
    method => {
      it('should return true', () => {
        expect(isSignatureMethod(method)).toBe(true)
      })
    }
  )

  describe.each(['eth_sendTransaction', 'dcl_personal_sign', 'wallet_switchEthereumChain'])(
    'and the method is not a signature method (%s)',
    method => {
      it('should return false', () => {
        expect(isSignatureMethod(method)).toBe(false)
      })
    }
  )
})

describe('when testing extractSignaturePayload', () => {
  const userAddress = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'

  describe('and the method is personal_sign with a hex-encoded message', () => {
    it('should decode the hex message to its UTF-8 text', () => {
      const result = extractSignaturePayload('personal_sign', ['0x48656c6c6f', userAddress])
      expect(result).toEqual({ kind: 'message', message: 'Hello' })
    })
  })

  describe('and the method is personal_sign with a plain-text message', () => {
    it('should return the message unchanged', () => {
      const result = extractSignaturePayload('personal_sign', ['just text', userAddress])
      expect(result).toEqual({ kind: 'message', message: 'just text' })
    })
  })

  describe('and the method is eth_sign with the address first', () => {
    it('should pick the non-address element as the message', () => {
      const result = extractSignaturePayload('eth_sign', [userAddress, 'sign me'])
      expect(result).toEqual({ kind: 'message', message: 'sign me' })
    })
  })

  describe('and the method is eth_signTypedData_v4 with a JSON string', () => {
    let json: string

    beforeEach(() => {
      json = '{"primaryType":"Order","domain":{"chainId":137},"message":{"price":"1"}}'
    })

    it('should parse the typed data and keep the raw string', () => {
      const result = extractSignaturePayload('eth_signTypedData_v4', [userAddress, json])
      expect(result).toEqual({
        kind: 'typedData',
        raw: json,
        typedData: { primaryType: 'Order', domain: { chainId: 137 }, message: { price: '1' } }
      })
    })
  })

  describe('and the typed-data JSON cannot be parsed', () => {
    it('should fall back to a plain message payload', () => {
      const result = extractSignaturePayload('eth_signTypedData_v4', [userAddress, 'not-json'])
      expect(result).toEqual({ kind: 'message', message: 'not-json' })
    })
  })

  describe('and the signer address is provided to disambiguate', () => {
    describe('and personal_sign passes the message first and the signer second', () => {
      it('should treat the first element as the message', () => {
        const result = extractSignaturePayload('personal_sign', ['gm', userAddress], userAddress)
        expect(result).toEqual({ kind: 'message', message: 'gm' })
      })
    })

    describe('and eth_sign passes the signer first and the message second', () => {
      it('should treat the second element as the message', () => {
        const result = extractSignaturePayload('eth_sign', [userAddress, 'sign me'], userAddress)
        expect(result).toEqual({ kind: 'message', message: 'sign me' })
      })
    })

    describe('and the hex-encoded message is itself address-shaped', () => {
      it('should decode the message rather than mistaking it for the signer address', () => {
        // A 20-byte message hex-encodes to `0x` + 40 hex chars, which matches the address shape;
        // matching the known signer keeps it correctly classified as the message.
        const hexMessage = '0x' + '61'.repeat(20) // 20 bytes of 'a'
        const result = extractSignaturePayload('personal_sign', [hexMessage, userAddress], userAddress)
        expect(result).toEqual({ kind: 'message', message: 'a'.repeat(20) })
      })
    })
  })

  describe('and no params are provided', () => {
    it('should return null', () => {
      expect(extractSignaturePayload('personal_sign', undefined)).toBeNull()
    })
  })

  describe('and the typed-data params pass the canonical guard', () => {
    const signer = '0x1234567890abcdef1234567890abcdef12345678'
    const permit = JSON.stringify({ primaryType: 'Permit', domain: {}, types: {}, message: {} })

    it('should preview exactly the payload the wallet signs, the second param', () => {
      const params = [signer, permit]
      expect(() => assertSignatureParamsAreCanonical('eth_signTypedData_v4', params, signer)).not.toThrow()
      expect(extractSignaturePayload('eth_signTypedData_v4', params, signer)).toEqual({
        kind: 'typedData',
        typedData: JSON.parse(permit),
        raw: params[1]
      })
    })
  })

  describe('and two typed-data payloads are passed with no signer address', () => {
    const signer = '0x1234567890abcdef1234567890abcdef12345678'
    const statement = JSON.stringify({ primaryType: 'Statement', domain: {}, types: {}, message: { text: 'harmless' } })
    const permit = JSON.stringify({ primaryType: 'Permit', domain: {}, types: {}, message: {} })

    it('should preview the first one while the wallet signs the second, which is why the canonical guard rejects it', () => {
      const params = [statement, permit]
      expect(extractSignaturePayload('eth_signTypedData_v4', params, signer)).toMatchObject({ kind: 'typedData', raw: statement })
      expect(() => assertSignatureParamsAreCanonical('eth_signTypedData_v4', params, signer)).toThrow(MalformedSignatureRequestError)
    })
  })
})

describe('when testing decodeMetaTransactionTypedData', () => {
  describe('and the typed data is a meta-transaction with a salt-encoded chain id', () => {
    let typedData: any

    beforeEach(() => {
      typedData = {
        primaryType: 'MetaTransaction',
        domain: {
          verifyingContract: '0xfef5c99885c3036e591b6e6db52482891834a5f4',
          salt: '0x0000000000000000000000000000000000000000000000000000000000000089'
        },
        message: { nonce: 0, from: '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd', functionSignature: '0xa9059cbb' }
      }
    })

    it('should return the inner call with the chain id decoded from the salt', () => {
      expect(decodeMetaTransactionTypedData(typedData)).toEqual({
        from: '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd',
        verifyingContract: '0xfef5c99885c3036e591b6e6db52482891834a5f4',
        functionSignature: '0xa9059cbb',
        chainId: 137
      })
    })
  })

  describe('and the meta-transaction has no salt but a chainId domain field', () => {
    let typedData: any

    beforeEach(() => {
      typedData = {
        primaryType: 'MetaTransaction',
        domain: { verifyingContract: '0xfef5c99885c3036e591b6e6db52482891834a5f4', chainId: 80002 },
        message: { from: '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd', functionSignature: '0xa9059cbb' }
      }
    })

    it('should fall back to the chainId domain field', () => {
      expect(decodeMetaTransactionTypedData(typedData)?.chainId).toBe(80002)
    })
  })

  describe('and the typed data is not a meta-transaction', () => {
    it('should return null', () => {
      expect(decodeMetaTransactionTypedData({ primaryType: 'Order', domain: {}, message: {} })).toBeNull()
    })
  })

  describe('and the typed data is undefined', () => {
    it('should return null', () => {
      expect(decodeMetaTransactionTypedData(undefined)).toBeNull()
    })
  })
})

describe('when testing isApprovalGrantingTypedData', () => {
  describe.each(['Permit', 'PermitSingle', 'PermitBatch', 'PermitTransferFrom', 'PermitBatchTransferFrom', 'OrderComponents', 'BulkOrder'])(
    'and the typed data primaryType is the approval-granting type %s',
    primaryType => {
      it('should return true', () => {
        expect(isApprovalGrantingTypedData({ primaryType } as any)).toBe(true)
      })
    }
  )

  describe('and the primaryType casing differs', () => {
    it('should still match case-insensitively', () => {
      expect(isApprovalGrantingTypedData({ primaryType: 'PERMIT' } as any)).toBe(true)
    })
  })

  describe('and the typed data is a benign primaryType', () => {
    it('should return false', () => {
      expect(isApprovalGrantingTypedData({ primaryType: 'Mail' } as any)).toBe(false)
    })
  })

  describe('and the typed data is a Decentraland MetaTransaction', () => {
    it('should return false because meta-transactions are handled separately', () => {
      expect(isApprovalGrantingTypedData({ primaryType: 'MetaTransaction' } as any)).toBe(false)
    })
  })

  describe('and the typed data is undefined', () => {
    it('should return false', () => {
      expect(isApprovalGrantingTypedData(undefined)).toBe(false)
    })
  })
})

describe('when testing buildSendTransactionSimulationPayload', () => {
  const signerAddress = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the transaction will be relayed as a meta-transaction', () => {
    let txParams: Record<string, unknown>

    beforeEach(() => {
      ;(config.get as jest.Mock).mockReturnValue('production')
      txParams = { to: '0xfef5c99885c3036e591b6e6db52482891834a5f4', data: '0xa9059cbb', value: '0x0' }
    })

    it('should simulate on the meta-transaction chain', () => {
      const result = buildSendTransactionSimulationPayload(txParams, signerAddress, 1, true)
      expect(result?.chainId).toBe(ChainId.MATIC_MAINNET)
    })

    it('should default the from address to the signer when not present in the params', () => {
      const result = buildSendTransactionSimulationPayload(txParams, signerAddress, 1, true)
      expect(result?.from).toBe(signerAddress)
    })

    it('should ignore a request-supplied from address and always simulate as the connected signer', () => {
      const attackerControlledFrom = '0x000000000000000000000000000000000000dead'
      const result = buildSendTransactionSimulationPayload({ ...txParams, from: attackerControlledFrom }, signerAddress, 1, true)
      expect(result?.from).toBe(signerAddress)
    })
  })

  describe('and the transaction will not be relayed as a meta-transaction', () => {
    let txParams: Record<string, unknown>

    beforeEach(() => {
      txParams = { to: '0x1111111111111111111111111111111111111111', data: '0x', value: '0x0' }
    })

    it('should simulate on the connected chain', () => {
      const result = buildSendTransactionSimulationPayload(txParams, signerAddress, 1, false)
      expect(result?.chainId).toBe(1)
    })
  })

  describe('and the transaction has no to address', () => {
    it('should return null', () => {
      expect(buildSendTransactionSimulationPayload({ data: '0x' }, signerAddress, 1, false)).toBeNull()
    })
  })

  describe('and the transaction carries calldata outside the data field', () => {
    it.each(['input', 'extraCallData'])('should return null for %s so the preview is unavailable', field => {
      const txParams = { to: '0x1111111111111111111111111111111111111111', data: '0x', value: '0x0', [field]: '0xa9059cbb' }
      expect(buildSendTransactionSimulationPayload(txParams, signerAddress, 1, false)).toBeNull()
    })
  })
})
