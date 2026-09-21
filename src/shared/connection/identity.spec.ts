import { createWalletClient } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { localStorageGetIdentity, localStorageStoreIdentity } from '@dcl/single-sign-on-client'
import { Provider } from 'decentraland-connect'
import { WalletSignatureUnsupportedError } from '../errors'
import { getCachedIdentity, getIdentitySignature } from './identity'

jest.mock('@dcl/single-sign-on-client')
jest.mock('@dcl/crypto')
jest.mock('viem/accounts')
jest.mock('viem', () => ({
  createWalletClient: jest.fn(),
  custom: jest.fn(),
  // Real implementation: the signing account is checksummed before it goes on the wire, and a
  // stub would hide whether that actually happens.
  getAddress: jest.requireActual('viem').getAddress
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
  mockGeneratePrivateKey.mockReturnValue(VALID_PRIVATE_KEY as `0x${string}`)
  mockPrivateKeyToAccount.mockReturnValue({
    address: VALID_ADDRESS as `0x${string}`,
    publicKey: VALID_PUBLIC_KEY as `0x${string}`
  } as ReturnType<typeof privateKeyToAccount>)
  mockAuthenticator.initializeAuthChain.mockResolvedValue(resultIdentity)
  mockCreateWalletClient.mockReturnValue({
    getAddresses: jest.fn().mockResolvedValue([VALID_ADDRESS]),
    signMessage: jest.fn().mockResolvedValue('0xsignature')
  } as unknown as ReturnType<typeof createWalletClient>)
}

describe('getCachedIdentity', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678'

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when no cached identity exists', () => {
    it('should return undefined', () => {
      mockLocalStorageGetIdentity.mockReturnValue(null)

      expect(getCachedIdentity(address)).toBeUndefined()
    })
  })

  describe('when a valid cached identity exists', () => {
    it('should return the identity', () => {
      const identity = createMockIdentity()
      mockLocalStorageGetIdentity.mockReturnValue(identity)

      expect(getCachedIdentity(address)).toBe(identity)
    })
  })

  describe('when the cached identity has a double-encoded private key', () => {
    it('should return undefined', () => {
      const identity = createMockIdentity({ privateKey: DOUBLE_ENCODED_PRIVATE_KEY })
      mockLocalStorageGetIdentity.mockReturnValue(identity)

      expect(getCachedIdentity(address)).toBeUndefined()
    })
  })

  describe('when the cached identity has a double-encoded public key', () => {
    it('should return undefined', () => {
      const identity = createMockIdentity({ publicKey: DOUBLE_ENCODED_PUBLIC_KEY })
      mockLocalStorageGetIdentity.mockReturnValue(identity)

      expect(getCachedIdentity(address)).toBeUndefined()
    })
  })

  describe('when the cached identity has a non-hex private key', () => {
    it('should return undefined', () => {
      const identity = createMockIdentity({ privateKey: 'not-a-hex-key' })
      mockLocalStorageGetIdentity.mockReturnValue(identity)

      expect(getCachedIdentity(address)).toBeUndefined()
    })
  })

  describe('when the cached identity has an invalid address', () => {
    it('should return undefined', () => {
      const identity = createMockIdentity({ address: '0xinvalid' })
      mockLocalStorageGetIdentity.mockReturnValue(identity)

      expect(getCachedIdentity(address)).toBeUndefined()
    })
  })
})

describe('getIdentitySignature', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678'
  const provider = {} as Provider

  afterEach(() => {
    jest.clearAllMocks()
  })

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

  describe('when no explicit expiration is provided', () => {
    it('should use the default one-month ephemeral expiration', async () => {
      mockLocalStorageGetIdentity.mockReturnValue(null)
      setupGenerateIdentityMocks(createMockIdentity())

      await getIdentitySignature(address, provider)

      expect(mockAuthenticator.initializeAuthChain).toHaveBeenCalledWith(address, expect.any(Object), 60 * 24 * 30, expect.any(Function))
    })
  })

  describe('when a custom expiration is provided (e.g. the 3-month mobile identity TTL)', () => {
    it('should forward it to the auth chain', async () => {
      const mobileExpiration = 60 * 24 * 30 * 3
      mockLocalStorageGetIdentity.mockReturnValue(null)
      setupGenerateIdentityMocks(createMockIdentity())

      await getIdentitySignature(address, provider, mobileExpiration)

      expect(mockAuthenticator.initializeAuthChain).toHaveBeenCalledWith(
        address,
        expect.any(Object),
        mobileExpiration,
        expect.any(Function)
      )
    })
  })

  describe('when a valid cached identity already exists', () => {
    it('should still generate a fresh identity and overwrite SSO storage', async () => {
      const cachedIdentity = createMockIdentity()
      const freshIdentity = createMockIdentity({ privateKey: '0x' + '11'.repeat(32) })
      mockLocalStorageGetIdentity.mockReturnValue(cachedIdentity)
      setupGenerateIdentityMocks(freshIdentity)

      const result = await getIdentitySignature(address, provider)

      expect(result).toBe(freshIdentity)
      expect(result).not.toBe(cachedIdentity)
      expect(mockLocalStorageStoreIdentity).toHaveBeenCalledWith(address, freshIdentity)
      expect(mockAuthenticator.initializeAuthChain).toHaveBeenCalledTimes(1)
    })
  })

  describe('when called twice in a row for the same wallet', () => {
    it('should generate two distinct identities and overwrite SSO storage each time', async () => {
      const firstIdentity = createMockIdentity({ privateKey: '0x' + '11'.repeat(32) })
      const secondIdentity = createMockIdentity({ privateKey: '0x' + '22'.repeat(32) })

      mockLocalStorageGetIdentity.mockReturnValue(null)
      setupGenerateIdentityMocks(firstIdentity)
      const first = await getIdentitySignature(address, provider)

      mockLocalStorageGetIdentity.mockReturnValue(firstIdentity)
      mockAuthenticator.initializeAuthChain.mockResolvedValueOnce(secondIdentity)
      const second = await getIdentitySignature(address, provider)

      expect(first).toBe(firstIdentity)
      expect(second).toBe(secondIdentity)
      expect(first).not.toBe(second)
      expect(mockLocalStorageStoreIdentity).toHaveBeenNthCalledWith(1, address, firstIdentity)
      expect(mockLocalStorageStoreIdentity).toHaveBeenNthCalledWith(2, address, secondIdentity)
      expect(mockAuthenticator.initializeAuthChain).toHaveBeenCalledTimes(2)
    })
  })
})

describe('when the connected wallet cannot relay the login signature', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678'
  // A WalletConnect session whose approved eip155 namespace leaves personal_sign out. The
  // universal provider would answer it from a public RPC node, so the wallet never prompts.
  const provider = {
    session: { namespaces: { eip155: { methods: ['eth_sendTransaction', 'eth_signTypedData_v4'] } } }
  } as unknown as Provider

  beforeEach(() => {
    mockLocalStorageGetIdentity.mockReturnValue(null)
    setupGenerateIdentityMocks(createMockIdentity())
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should reject with a WalletSignatureUnsupportedError instead of asking the wallet to sign', async () => {
    await expect(getIdentitySignature(address, provider)).rejects.toBeInstanceOf(WalletSignatureUnsupportedError)
  })

  it('should not build an auth chain', async () => {
    await expect(getIdentitySignature(address, provider)).rejects.toThrow()

    expect(mockAuthenticator.initializeAuthChain).not.toHaveBeenCalled()
  })
})

describe('when the wallet reports no accounts for the chain it is connected on', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678'
  const provider = {} as Provider
  let signMessage: jest.Mock

  beforeEach(() => {
    signMessage = jest.fn().mockResolvedValue('0xsignature')
    mockLocalStorageGetIdentity.mockReturnValue(null)
    mockGeneratePrivateKey.mockReturnValue(VALID_PRIVATE_KEY as `0x${string}`)
    mockPrivateKeyToAccount.mockReturnValue({
      address: VALID_ADDRESS as `0x${string}`,
      publicKey: VALID_PUBLIC_KEY as `0x${string}`
    } as ReturnType<typeof privateKeyToAccount>)
    mockAuthenticator.initializeAuthChain.mockResolvedValue(createMockIdentity())
    mockCreateWalletClient.mockReturnValue({
      // WalletConnect answers eth_accounts from the approved session and filters it by the chain
      // the provider is on, so an empty list here is not a disconnected wallet.
      getAddresses: jest.fn().mockResolvedValue([]),
      signMessage
    } as unknown as ReturnType<typeof createWalletClient>)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should sign the login message with the account the connection was established with', async () => {
    await getIdentitySignature(address, provider)
    const signer = mockAuthenticator.initializeAuthChain.mock.calls[0][3]

    await signer('Decentraland Login')

    expect(signMessage).toHaveBeenCalledWith({
      account: '0x1234567890AbcdEF1234567890aBcdef12345678',
      message: 'Decentraland Login'
    })
  })
})

describe('when the caller passes the connected account in lower case', () => {
  // The mobile flows lowercase the address before handing it over.
  const lowercaseAddress = '0x875efbf78ce670d1f0961783b2073f0e45a05e66'
  const checksummedAddress = '0x875EFBF78ce670D1F0961783B2073f0e45a05E66'
  const provider = {} as Provider
  let signMessage: jest.Mock

  beforeEach(() => {
    signMessage = jest.fn().mockResolvedValue('0xsignature')
    mockLocalStorageGetIdentity.mockReturnValue(null)
    mockGeneratePrivateKey.mockReturnValue(VALID_PRIVATE_KEY as `0x${string}`)
    mockPrivateKeyToAccount.mockReturnValue({
      address: VALID_ADDRESS as `0x${string}`,
      publicKey: VALID_PUBLIC_KEY as `0x${string}`
    } as ReturnType<typeof privateKeyToAccount>)
    mockAuthenticator.initializeAuthChain.mockResolvedValue(createMockIdentity())
    mockCreateWalletClient.mockReturnValue({
      getAddresses: jest.fn().mockResolvedValue([checksummedAddress]),
      signMessage
    } as unknown as ReturnType<typeof createWalletClient>)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should send the checksummed address to the wallet, matching what the provider reports', async () => {
    await getIdentitySignature(lowercaseAddress, provider)
    const signer = mockAuthenticator.initializeAuthChain.mock.calls[0][3]

    await signer('Decentraland Login')

    expect(signMessage).toHaveBeenCalledWith({ account: checksummedAddress, message: 'Decentraland Login' })
  })

  it('should keep building the auth chain with the address exactly as it was passed in', async () => {
    await getIdentitySignature(lowercaseAddress, provider)

    expect(mockAuthenticator.initializeAuthChain).toHaveBeenCalledWith(
      lowercaseAddress,
      expect.anything(),
      expect.any(Number),
      expect.any(Function)
    )
  })
})
