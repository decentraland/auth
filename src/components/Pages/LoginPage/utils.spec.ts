import { createWalletClient } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { localStorageGetIdentity, localStorageStoreIdentity } from '@dcl/single-sign-on-client'
import { getIdentitySignature, getIdentityWithSigner } from './utils'

jest.mock('@dcl/single-sign-on-client')
jest.mock('@dcl/crypto')
jest.mock('viem/accounts')
jest.mock('viem', () => ({
  createWalletClient: jest.fn(),
  custom: jest.fn()
}))
jest.mock('viem/chains', () => ({
  mainnet: {}
}))

const mockLocalStorageGetIdentity = localStorageGetIdentity as jest.MockedFunction<typeof localStorageGetIdentity>
const mockLocalStorageStoreIdentity = localStorageStoreIdentity as jest.MockedFunction<typeof localStorageStoreIdentity>
const mockGeneratePrivateKey = generatePrivateKey as jest.MockedFunction<typeof generatePrivateKey>
const mockPrivateKeyToAccount = privateKeyToAccount as jest.MockedFunction<typeof privateKeyToAccount>
const mockCreateWalletClient = createWalletClient as jest.MockedFunction<typeof createWalletClient>
const mockAuthenticator = Authenticator as jest.Mocked<typeof Authenticator>

afterEach(() => {
  jest.clearAllMocks()
})

// Valid hex values with correct lengths
const VALID_PRIVATE_KEY = '0x' + 'ab'.repeat(32) // 66 chars
const VALID_PUBLIC_KEY = '0x' + 'cd'.repeat(65) // 132 chars
const VALID_ADDRESS = '0x' + 'ef'.repeat(20) // 42 chars

// Double-encoded private key (66 bytes = 132 hex chars + 0x prefix = 134 chars)
const DOUBLE_ENCODED_PRIVATE_KEY = '0x' + 'ab'.repeat(66)
const DOUBLE_ENCODED_PUBLIC_KEY = '0x' + 'cd'.repeat(130)

function createMockIdentity(overrides?: { privateKey?: string; publicKey?: string; address?: string }): AuthIdentity {
  return {
    ephemeralIdentity: {
      privateKey: overrides?.privateKey ?? VALID_PRIVATE_KEY,
      publicKey: overrides?.publicKey ?? VALID_PUBLIC_KEY,
      address: overrides?.address ?? VALID_ADDRESS
    },
    expiration: new Date(Date.now() + 1000 * 60 * 60),
    authChain: []
  } as unknown as AuthIdentity
}

function setupGenerateIdentityMocks(resultIdentity: AuthIdentity) {
  const mockSignMessage = jest.fn().mockResolvedValue('0xsignature')
  mockGeneratePrivateKey.mockReturnValue(VALID_PRIVATE_KEY as `0x${string}`)
  mockPrivateKeyToAccount.mockReturnValue({
    address: VALID_ADDRESS as `0x${string}`,
    publicKey: VALID_PUBLIC_KEY as `0x${string}`
  } as ReturnType<typeof privateKeyToAccount>)
  mockAuthenticator.initializeAuthChain.mockResolvedValue(resultIdentity)
  mockCreateWalletClient.mockReturnValue({
    getAddresses: jest.fn().mockResolvedValue([VALID_ADDRESS]),
    signMessage: mockSignMessage
  } as unknown as ReturnType<typeof createWalletClient>)
  return mockSignMessage
}

describe('getIdentitySignature', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678'
  const provider = {} as any

  describe('when no cached identity exists', () => {
    it('should generate and store a new identity', async () => {
      const freshIdentity = createMockIdentity()
      mockLocalStorageGetIdentity.mockReturnValue(null)
      setupGenerateIdentityMocks(freshIdentity)

      const result = await getIdentitySignature(address, provider)

      expect(result).toBe(freshIdentity)
      expect(mockLocalStorageStoreIdentity).toHaveBeenCalledWith(address, freshIdentity)
    })
  })

  describe('when a valid cached identity exists', () => {
    it('should return the cached identity without regenerating', async () => {
      const cachedIdentity = createMockIdentity()
      mockLocalStorageGetIdentity.mockReturnValue(cachedIdentity)

      const result = await getIdentitySignature(address, provider)

      expect(result).toBe(cachedIdentity)
      expect(mockLocalStorageStoreIdentity).not.toHaveBeenCalled()
      expect(mockAuthenticator.initializeAuthChain).not.toHaveBeenCalled()
    })
  })

  describe('when the cached identity has a double-encoded private key', () => {
    it('should discard it and generate a new identity', async () => {
      const invalidIdentity = createMockIdentity({ privateKey: DOUBLE_ENCODED_PRIVATE_KEY })
      const freshIdentity = createMockIdentity()
      mockLocalStorageGetIdentity.mockReturnValue(invalidIdentity)
      setupGenerateIdentityMocks(freshIdentity)

      const result = await getIdentitySignature(address, provider)

      expect(result).toBe(freshIdentity)
      expect(mockLocalStorageStoreIdentity).toHaveBeenCalledWith(address, freshIdentity)
    })
  })

  describe('when the cached identity has a double-encoded public key', () => {
    it('should discard it and generate a new identity', async () => {
      const invalidIdentity = createMockIdentity({ publicKey: DOUBLE_ENCODED_PUBLIC_KEY })
      const freshIdentity = createMockIdentity()
      mockLocalStorageGetIdentity.mockReturnValue(invalidIdentity)
      setupGenerateIdentityMocks(freshIdentity)

      const result = await getIdentitySignature(address, provider)

      expect(result).toBe(freshIdentity)
      expect(mockLocalStorageStoreIdentity).toHaveBeenCalledWith(address, freshIdentity)
    })
  })

  describe('when the cached identity has an invalid address', () => {
    it('should discard it and generate a new identity', async () => {
      const invalidIdentity = createMockIdentity({ address: '0x' + 'ff'.repeat(30) })
      const freshIdentity = createMockIdentity()
      mockLocalStorageGetIdentity.mockReturnValue(invalidIdentity)
      setupGenerateIdentityMocks(freshIdentity)

      const result = await getIdentitySignature(address, provider)

      expect(result).toBe(freshIdentity)
      expect(mockLocalStorageStoreIdentity).toHaveBeenCalledWith(address, freshIdentity)
    })
  })

  describe('when the cached identity has a non-hex private key', () => {
    it('should discard it and generate a new identity', async () => {
      const invalidIdentity = createMockIdentity({ privateKey: '0x' + 'zz'.repeat(32) })
      const freshIdentity = createMockIdentity()
      mockLocalStorageGetIdentity.mockReturnValue(invalidIdentity)
      setupGenerateIdentityMocks(freshIdentity)

      const result = await getIdentitySignature(address, provider)

      expect(result).toBe(freshIdentity)
      expect(mockLocalStorageStoreIdentity).toHaveBeenCalledWith(address, freshIdentity)
    })
  })
})

describe('getIdentityWithSigner', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678'
  const signMessage = jest.fn().mockResolvedValue('0xsignature')

  describe('when no cached identity exists', () => {
    it('should generate and store a new identity', async () => {
      const freshIdentity = createMockIdentity()
      mockLocalStorageGetIdentity.mockReturnValue(null)
      setupGenerateIdentityMocks(freshIdentity)

      const result = await getIdentityWithSigner(address, signMessage)

      expect(result).toBe(freshIdentity)
      expect(mockLocalStorageStoreIdentity).toHaveBeenCalledWith(address, freshIdentity)
    })
  })

  describe('when a valid cached identity exists', () => {
    it('should return the cached identity without regenerating', async () => {
      const cachedIdentity = createMockIdentity()
      mockLocalStorageGetIdentity.mockReturnValue(cachedIdentity)

      const result = await getIdentityWithSigner(address, signMessage)

      expect(result).toBe(cachedIdentity)
      expect(mockLocalStorageStoreIdentity).not.toHaveBeenCalled()
      expect(mockAuthenticator.initializeAuthChain).not.toHaveBeenCalled()
    })
  })

  describe('when the cached identity has a double-encoded private key', () => {
    it('should discard it and generate a new identity', async () => {
      const invalidIdentity = createMockIdentity({ privateKey: DOUBLE_ENCODED_PRIVATE_KEY })
      const freshIdentity = createMockIdentity()
      mockLocalStorageGetIdentity.mockReturnValue(invalidIdentity)
      setupGenerateIdentityMocks(freshIdentity)

      const result = await getIdentityWithSigner(address, signMessage)

      expect(result).toBe(freshIdentity)
      expect(mockLocalStorageStoreIdentity).toHaveBeenCalledWith(address, freshIdentity)
    })
  })

  describe('when the cached identity has a double-encoded public key', () => {
    it('should discard it and generate a new identity', async () => {
      const invalidIdentity = createMockIdentity({ publicKey: DOUBLE_ENCODED_PUBLIC_KEY })
      const freshIdentity = createMockIdentity()
      mockLocalStorageGetIdentity.mockReturnValue(invalidIdentity)
      setupGenerateIdentityMocks(freshIdentity)

      const result = await getIdentityWithSigner(address, signMessage)

      expect(result).toBe(freshIdentity)
      expect(mockLocalStorageStoreIdentity).toHaveBeenCalledWith(address, freshIdentity)
    })
  })
})
