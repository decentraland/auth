import { preAuthenticate } from 'thirdweb/wallets'
import { sendEmailOTP } from './emailAuth'

jest.mock('thirdweb/wallets', () => ({
  preAuthenticate: jest.fn(),
  inAppWallet: jest.fn()
}))

jest.mock('./client', () => ({
  getThirdwebClient: jest.fn().mockResolvedValue({ clientId: 'test-client-id' })
}))

jest.mock('decentraland-connect', () => ({
  connection: { storeConnectionData: jest.fn() }
}))

const mockPreAuthenticate = preAuthenticate as jest.Mock

describe('sendEmailOTP', () => {
  afterEach(() => {
    mockPreAuthenticate.mockReset()
  })

  describe('when thirdweb sends the verification code', () => {
    beforeEach(() => {
      mockPreAuthenticate.mockResolvedValueOnce(undefined)
    })

    it('should resolve after requesting the code for the given email', async () => {
      await expect(sendEmailOTP('jane.doe@example.com')).resolves.toBeUndefined()
      expect(mockPreAuthenticate).toHaveBeenCalledWith(expect.objectContaining({ strategy: 'email', email: 'jane.doe@example.com' }))
    })
  })

  describe('when thirdweb rejects the address as an invalid email', () => {
    let rejection: Error

    beforeEach(() => {
      rejection = new Error('Invalid email.')
      mockPreAuthenticate.mockRejectedValueOnce(rejection)
    })

    it('should rethrow the same error flagged with skipReporting so it stays out of Sentry', async () => {
      await expect(sendEmailOTP('jane.doe@example.c')).rejects.toBe(rejection)
      expect(rejection).toMatchObject({ message: 'Invalid email.', skipReporting: true })
    })
  })

  describe('when thirdweb fails for any other reason', () => {
    let rejection: Error

    beforeEach(() => {
      rejection = new Error('Failed to send verification code')
      mockPreAuthenticate.mockRejectedValueOnce(rejection)
    })

    it('should rethrow the error without the skipReporting flag', async () => {
      await expect(sendEmailOTP('jane.doe@example.com')).rejects.toBe(rejection)
      expect(rejection).not.toHaveProperty('skipReporting')
    })
  })
})
