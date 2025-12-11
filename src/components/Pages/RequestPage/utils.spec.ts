/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/unbound-method */
import { ethers } from 'ethers'
import { Rarity } from '@dcl/schemas'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { connection } from 'decentraland-connect'
import { ContractName, getContractName, getContract } from 'decentraland-transactions'
import { config } from '../../../modules/config'
import {
  getConnectedProvider,
  getNetworkProvider,
  isDecentralandContractAddress,
  checkMetaTransactionSupport,
  decodeNftTransferData,
  decodeManaTransferData,
  fetchNftMetadata,
  getMetaTransactionChainId
} from './utils'

jest.mock('decentraland-connect')
jest.mock('decentraland-transactions')
jest.mock('../../../modules/config')
jest.mock('ethers')

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
  let mockBrowserProvider: any
  let mockNetwork: any

  beforeEach(() => {
    mockConnectedProvider = { isProvider: true }
    mockNetworkProvider = { isNetworkProvider: true }
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the connected provider matches the requested chainId', () => {
    beforeEach(() => {
      mockNetwork = { chainId: BigInt(ChainId.MATIC_MAINNET) }
      mockBrowserProvider = {
        getNetwork: jest.fn().mockResolvedValueOnce(mockNetwork)
      }
      jest.mocked(connection.getProvider).mockResolvedValueOnce(mockConnectedProvider)
      jest.mocked(ethers.BrowserProvider).mockImplementationOnce(() => mockBrowserProvider)
    })

    it('should return the connected provider', async () => {
      const result = await getNetworkProvider(ChainId.MATIC_MAINNET)
      expect(result).toBe(mockConnectedProvider)
    })
  })

  describe('and the connected provider has a different chainId', () => {
    beforeEach(() => {
      mockNetwork = { chainId: BigInt(ChainId.ETHEREUM_MAINNET) }
      mockBrowserProvider = {
        getNetwork: jest.fn().mockResolvedValueOnce(mockNetwork)
      }
      jest.mocked(connection.getProvider).mockResolvedValueOnce(mockConnectedProvider)
      jest.mocked(ethers.BrowserProvider).mockImplementationOnce(() => mockBrowserProvider)
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
      expect(fetch).toHaveBeenCalledWith(`${metaTransactionServerUrl}/v1/contracts/${contractAddress}`)
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
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the contract is a known Decentraland contract', () => {
    beforeEach(() => {
      jest.mocked(getContractName).mockReturnValueOnce(ContractName.MANAToken)
    })

    it('should return willUseMetaTransaction as true with the contract name', async () => {
      const result = await checkMetaTransactionSupport(contractAddress)
      expect(result).toEqual({
        willUseMetaTransaction: true,
        contractName: ContractName.MANAToken
      })
    })
  })

  describe('and the contract is not known but is a valid Decentraland collection contract', () => {
    beforeEach(() => {
      jest.mocked(getContractName).mockImplementationOnce(() => {
        throw new Error('Unknown contract')
      })
      jest.mocked(config.get).mockReturnValueOnce('https://meta-transactions.decentraland.org')
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
      jest.mocked(config.get).mockReturnValueOnce('https://meta-transactions.decentraland.org')
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
  let mockInterface: any
  let transactionData: string

  beforeEach(() => {
    contractABI = [{ type: 'function', name: 'transferFrom' }]
    transactionData = '0x23b872dd'
    mockInterface = {
      parseTransaction: jest.fn()
    }
    jest.mocked(ethers.Interface).mockImplementation(() => mockInterface)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the transaction data is valid', () => {
    let mockDecodedData: any

    beforeEach(() => {
      mockDecodedData = {
        args: ['0xfrom', '0xto', BigInt(123)]
      }
      mockInterface.parseTransaction.mockReturnValueOnce(mockDecodedData)
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

  describe('and parsing the transaction fails', () => {
    beforeEach(() => {
      mockInterface.parseTransaction.mockReturnValueOnce(null)
    })

    it('should return null', () => {
      const result = decodeNftTransferData(transactionData, contractABI)
      expect(result).toBeNull()
    })
  })

  describe('and decoding throws an error', () => {
    beforeEach(() => {
      mockInterface.parseTransaction.mockImplementationOnce(() => {
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
  let mockInterface: any
  let mockContract: any

  beforeEach(() => {
    jest.mocked(config.get).mockReturnValue('production')
    mockInterface = {
      parseTransaction: jest.fn()
    }
    mockContract = {
      abi: [{ type: 'function', name: 'transfer' }]
    }
    jest.mocked(ethers.Interface).mockImplementation(() => mockInterface)
    jest.mocked(getContract).mockReturnValue(mockContract)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the transaction data is a valid ERC20 transfer', () => {
    let mockDecodedData: any

    beforeEach(() => {
      transactionData =
        '0xa9059cbb000000000000000000000000abcdef1234567890abcdef1234567890abcdef12000000000000000000000000000000000000000000000000016345785d8a0000'
      mockContract = {
        abi: [{ type: 'function', name: 'transfer' }]
      }
      mockDecodedData = {
        args: ['0xabcdef1234567890abcdef1234567890abcdef12', BigInt('100000000000000000')]
      }
      mockInterface.parseTransaction.mockReturnValueOnce(mockDecodedData)
      jest.mocked(ethers.formatEther).mockReturnValueOnce('0.1')
    })

    it('should return the manaAmount and toAddress', () => {
      const result = decodeManaTransferData(transactionData)
      expect(result).toEqual({
        manaAmount: '0.1',
        toAddress: '0xabcdef1234567890abcdef1234567890abcdef12'
      })
    })
  })

  describe('and the transaction data is empty', () => {
    beforeEach(() => {
      transactionData = ''
    })

    it('should return null', () => {
      const result = decodeManaTransferData(transactionData)
      expect(result).toBeNull()
    })
  })

  describe('and the transaction data is too short', () => {
    beforeEach(() => {
      transactionData = '0x1234'
    })

    it('should return null', () => {
      const result = decodeManaTransferData(transactionData)
      expect(result).toBeNull()
    })
  })

  describe('and the transaction data is not a transfer function', () => {
    beforeEach(() => {
      transactionData = '0x12345678000000000000000000000000abcdef1234567890abcdef1234567890abcdef12'
    })

    it('should return null', () => {
      const result = decodeManaTransferData(transactionData)
      expect(result).toBeNull()
    })
  })

  describe('and parsing the transaction fails', () => {
    beforeEach(() => {
      transactionData = '0xa9059cbb000000000000000000000000abcdef1234567890abcdef1234567890abcdef12'
      mockInterface.parseTransaction.mockReturnValueOnce(null)
    })

    it('should return null', () => {
      const result = decodeManaTransferData(transactionData)
      expect(result).toBeNull()
    })
  })

  describe('and decoding throws an error', () => {
    beforeEach(() => {
      transactionData = '0xa9059cbb000000000000000000000000abcdef1234567890abcdef1234567890abcdef12'
      mockInterface.parseTransaction.mockImplementationOnce(() => {
        throw new Error('Decoding error')
      })
    })

    it('should return null', () => {
      const result = decodeManaTransferData(transactionData)
      expect(result).toBeNull()
    })
  })

  describe('and the transaction has a large amount', () => {
    let mockDecodedData: any

    beforeEach(() => {
      transactionData = '0xa9059cbb000000000000000000000000abcdef1234567890abcdef1234567890abcdef12'
      // 1000 MANA in wei (1000 * 10^18)
      mockDecodedData = {
        args: ['0xabcdef1234567890abcdef1234567890abcdef12', BigInt('1000000000000000000000')]
      }
      mockInterface.parseTransaction.mockReturnValueOnce(mockDecodedData)
      jest.mocked(ethers.formatEther).mockReturnValueOnce('1000.0')
    })

    it('should correctly convert large amounts from wei to MANA', () => {
      const result = decodeManaTransferData(transactionData)
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
  let mockProvider: any
  let mockContract: any

  beforeEach(() => {
    contractAddress = '0xcontract'
    contractABI = [{ type: 'function', name: 'tokenURI' }]
    tokenId = '123'
    global.fetch = jest.fn()
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
      mockContract = {
        tokenURI: jest.fn().mockResolvedValueOnce(tokenUri)
      }
      jest.mocked(ethers.Contract).mockImplementationOnce(() => mockContract)
      jest.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(metadata)
      } as any)
    })

    it('should return the metadata with image URL, name, and description', async () => {
      const result = await fetchNftMetadata(contractAddress, contractABI, tokenId, mockProvider)
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
      mockContract = {
        tokenURI: jest.fn().mockResolvedValueOnce(tokenUri)
      }
      jest.mocked(ethers.Contract).mockImplementationOnce(() => mockContract)
      jest.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(metadata)
      } as any)
    })

    it('should return the metadata with the rarity', async () => {
      const result = await fetchNftMetadata(contractAddress, contractABI, tokenId, mockProvider)
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
      mockContract = {
        tokenURI: jest.fn().mockResolvedValueOnce(tokenUri)
      }
      jest.mocked(ethers.Contract).mockImplementationOnce(() => mockContract)
      jest.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(metadata)
      } as any)
    })

    it('should return the metadata with image_url', async () => {
      const result = await fetchNftMetadata(contractAddress, contractABI, tokenId, mockProvider)
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
      mockContract = {
        tokenURI: jest.fn().mockResolvedValueOnce(tokenUri)
      }
      jest.mocked(ethers.Contract).mockImplementationOnce(() => mockContract)
      jest.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(metadata)
      } as any)
    })

    it('should correctly map the rarity', async () => {
      const result = await fetchNftMetadata(contractAddress, contractABI, tokenId, mockProvider)
      expect(result.rarity).toBe(expectedRarity)
    })
  })

  describe('and the contract does not return a tokenURI', () => {
    beforeEach(() => {
      mockContract = {
        tokenURI: jest.fn().mockResolvedValueOnce(null)
      }
      jest.mocked(ethers.Contract).mockImplementationOnce(() => mockContract)
    })

    it('should throw an error indicating no tokenURI', async () => {
      await expect(fetchNftMetadata(contractAddress, contractABI, tokenId, mockProvider)).rejects.toThrow(
        `No tokenURI returned for token ${tokenId} at contract ${contractAddress}`
      )
    })
  })

  describe('and fetching the metadata fails', () => {
    let tokenUri: string

    beforeEach(() => {
      tokenUri = 'https://example.com/token/123'
      mockContract = {
        tokenURI: jest.fn().mockResolvedValueOnce(tokenUri)
      }
      jest.mocked(ethers.Contract).mockImplementationOnce(() => mockContract)
      jest.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as any)
    })

    it('should throw an error with the status', async () => {
      await expect(fetchNftMetadata(contractAddress, contractABI, tokenId, mockProvider)).rejects.toThrow(
        `Failed to fetch metadata from ${tokenUri}: 404 Not Found`
      )
    })
  })
})
