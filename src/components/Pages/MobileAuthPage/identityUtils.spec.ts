import { createWalletClient } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { localStorageStoreIdentity } from '@dcl/single-sign-on-client'
import { Provider } from 'decentraland-connect'
import { getIdentitySignature } from './identityUtils'

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

const mockLocalStorageStoreIdentity = localStorageStoreIdentity as jest.MockedFunction<typeof localStorageStoreIdentity>
const mockGeneratePrivateKey = generatePrivateKey as jest.MockedFunction<typeof generatePrivateKey>
const mockPrivateKeyToAccount = privateKeyToAccount as jest.MockedFunction<typeof privateKeyToAccount>
const mockCreateWalletClient = createWalletClient as jest.MockedFunction<typeof createWalletClient>
const mockAuthenticator = Authenticator as jest.Mocked<typeof Authenticator>

const VALID_PRIVATE_KEY = '0x' + 'ab'.repeat(32)
const VALID_PUBLIC_KEY = '0x' + 'cd'.repeat(65)
const VALID_ADDRESS = '0x' + 'ef'.repeat(20)

// Mobile flow uses a 3-month ephemeral expiration vs 1 month on desktop.
// Asserting this catches drift between identity.ts and identityUtils.ts if either
// is changed without updating the other.
const MOBILE_EPHEMERAL_MINUTES = 60 * 24 * 30 * 3

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

describe('getIdentitySignature (mobile)', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678'
  const provider = {} as Provider

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when no identity exists in SSO storage', () => {
    it('should generate a new identity and store it', async () => {
      const freshIdentity = createMockIdentity()
      setupGenerateIdentityMocks(freshIdentity)

      const result = await getIdentitySignature(address, provider)

      expect(result).toBe(freshIdentity)
      expect(mockLocalStorageStoreIdentity).toHaveBeenCalledWith(address, freshIdentity)
      expect(mockAuthenticator.initializeAuthChain).toHaveBeenCalledWith(
        address,
        expect.any(Object),
        MOBILE_EPHEMERAL_MINUTES,
        expect.any(Function)
      )
    })
  })

  describe('when a valid identity already exists in SSO storage', () => {
    it('should still generate a fresh identity and overwrite SSO storage', async () => {
      const freshIdentity = createMockIdentity({ privateKey: '0x' + '11'.repeat(32) })
      setupGenerateIdentityMocks(freshIdentity)

      const result = await getIdentitySignature(address, provider)

      expect(result).toBe(freshIdentity)
      expect(mockLocalStorageStoreIdentity).toHaveBeenCalledWith(address, freshIdentity)
      expect(mockAuthenticator.initializeAuthChain).toHaveBeenCalledTimes(1)
    })
  })

  describe('when called twice in a row for the same wallet', () => {
    it('should generate two distinct identities and overwrite SSO storage each time', async () => {
      const firstIdentity = createMockIdentity({ privateKey: '0x' + '11'.repeat(32) })
      const secondIdentity = createMockIdentity({ privateKey: '0x' + '22'.repeat(32) })

      setupGenerateIdentityMocks(firstIdentity)
      const first = await getIdentitySignature(address, provider)

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
