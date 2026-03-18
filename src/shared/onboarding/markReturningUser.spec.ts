import { getStoredEmail } from './getStoredEmail'
import { markReturningUser } from './markReturningUser'
import { trackCheckpoint } from './trackCheckpoint'

jest.mock('./getStoredEmail')
jest.mock('./trackCheckpoint')

describe('markReturningUser', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when the user has a stored email and account', () => {
    let account: string

    beforeEach(() => {
      account = '0xABC123'
      jest.mocked(getStoredEmail).mockReturnValueOnce('user@test.com')
    })

    it('should track checkpoint for the email identifier', () => {
      markReturningUser(account)
      expect(trackCheckpoint).toHaveBeenCalledWith({
        checkpointId: 2,
        action: 'completed',
        userIdentifier: 'user@test.com',
        identifierType: 'email',
        wallet: '0xabc123'
      })
    })

    it('should track checkpoint for the wallet identifier', () => {
      markReturningUser(account)
      expect(trackCheckpoint).toHaveBeenCalledWith({
        checkpointId: 2,
        action: 'completed',
        userIdentifier: account,
        identifierType: 'wallet',
        wallet: '0xabc123'
      })
    })
  })

  describe('when the user has no stored email', () => {
    let account: string

    beforeEach(() => {
      account = '0xABC123'
      jest.mocked(getStoredEmail).mockReturnValueOnce(null)
    })

    it('should only track checkpoint for the wallet identifier', () => {
      markReturningUser(account)
      expect(trackCheckpoint).toHaveBeenCalledTimes(1)
      expect(trackCheckpoint).toHaveBeenCalledWith(expect.objectContaining({ identifierType: 'wallet' }))
    })
  })
})
