import { config } from '../../../modules/config'
import { subscribeToNewsletter } from './utils'

jest.mock('../../../modules/config')

const mockConfig = config as jest.Mocked<typeof config>

let mockFetch: jest.Mock
let mockEmail: string
let mockBuilderServerUrl: string

beforeEach(() => {
  mockEmail = 'email@domain.com'
  mockBuilderServerUrl = 'https://builder.com'
  mockFetch = jest.fn()
  global.fetch = mockFetch
})

describe('when subscribing to the newsletter', () => {
  beforeEach(() => {
    mockConfig.get.mockReturnValue('')
  })

  describe('when config does not have a builder server url', () => {
    it('should fail with a missing builder server url error', async () => {
      await expect(subscribeToNewsletter(mockEmail)).rejects.toThrow('Missing BUILDER_SERVER_URL.')
    })
  })

  describe('when config has a builder server url', () => {
    beforeEach(() => {
      mockConfig.get.mockReturnValue(mockBuilderServerUrl)
    })

    describe('when the request response is not ok', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({ ok: false, status: 500 })
      })

      it('should fail with a subscription error containing the status code', async () => {
        await expect(subscribeToNewsletter(mockEmail)).rejects.toThrow('Could not subscribe to newsletter. Status: 500')
      })
    })

    describe('when the request response is ok', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({ ok: true })
      })

      it('should not throw any error', async () => {
        await expect(subscribeToNewsletter(mockEmail)).resolves.not.toThrow()
      })

      it('should have called fetch with the correct url and the correct body', async () => {
        await expect(subscribeToNewsletter(mockEmail)).resolves.not.toThrow()

        expect(mockFetch).toHaveBeenCalledWith(mockBuilderServerUrl + '/v1/newsletter', {
          method: 'post',
          body: JSON.stringify({ email: mockEmail, source: 'auth' }),
          // eslint-disable-next-line @typescript-eslint/naming-convention
          headers: { 'content-type': 'application/json' }
        })
      })
    })
  })
})
