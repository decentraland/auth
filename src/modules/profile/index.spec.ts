import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { config } from '../config'
import { fetchProfile } from './index'

jest.mock('../config', () => ({
  config: {
    get: jest.fn()
  }
}))

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => undefined)
jest.spyOn(console, 'warn').mockImplementation(() => undefined)
jest.spyOn(console, 'error').mockImplementation(() => undefined)

describe('profile module', () => {
  const mockAddress = '0x1234567890abcdef1234567890abcdef12345678'
  const mockAssetBundleRegistryUrl = 'https://asset-bundle-registry.decentraland.org'

  beforeEach(() => {
    ;(config.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'ASSET_BUNDLE_REGISTRY_URL') {
        return mockAssetBundleRegistryUrl
      }
      return null
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('when fetching a profile with fetchProfile', () => {
    let result: Profile | null
    let mockFetch: jest.Mock

    beforeEach(() => {
      mockFetch = jest.fn()
      global.fetch = mockFetch
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    describe('and the profile exists', () => {
      let mockProfile: Profile

      beforeEach(async () => {
        mockProfile = {
          timestamp: 1000,
          avatars: [
            {
              hasClaimedName: false,
              name: 'TestUser',
              description: '',
              tutorialStep: 0,
              userId: mockAddress,
              email: '',
              ethAddress: mockAddress,
              version: 1,
              avatar: {
                bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
                wearables: [],
                snapshots: {
                  face256: 'https://example.com/face.png',
                  body: 'https://example.com/body.png'
                },
                eyes: { color: { r: 0, g: 0, b: 0, a: 1 } },
                hair: { color: { r: 0, g: 0, b: 0, a: 1 } },
                skin: { color: { r: 0, g: 0, b: 0, a: 1 } }
              },
              hasConnectedWeb3: true
            }
          ]
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce([mockProfile])
        })

        result = await fetchProfile(mockAddress)
      })

      it('should call fetch with the correct URL and options', () => {
        expect(mockFetch).toHaveBeenCalledWith(`${mockAssetBundleRegistryUrl}/profiles`, {
          method: 'POST',
          headers: expect.any(Headers),
          body: JSON.stringify({ ids: [mockAddress] })
        })
      })

      it('should return the profile', () => {
        expect(result).toEqual(mockProfile)
      })
    })

    describe('and the profile does not exist', () => {
      beforeEach(async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce([])
        })

        result = await fetchProfile(mockAddress)
      })

      it('should return null', () => {
        expect(result).toBeNull()
      })
    })

    describe('and the request fails with a non-ok response', () => {
      beforeEach(async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500
        })

        result = await fetchProfile(mockAddress)
      })

      it('should return null', () => {
        expect(result).toBeNull()
      })
    })

    describe('and the request throws an error', () => {
      beforeEach(async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        result = await fetchProfile(mockAddress)
      })

      it('should return null', () => {
        expect(result).toBeNull()
      })
    })
  })
})
