import { render, waitFor } from '@testing-library/react'
import { getCurrentConnectionData } from '../../../shared/connection/connection'
import { locations } from '../../../shared/locations'
import { DefaultPage } from './DefaultPage'

const mockNavigate = jest.fn()

jest.mock('../../../hooks/navigation', () => ({
  useNavigateWithSearchParams: () => mockNavigate
}))

jest.mock('../../../shared/connection/connection')
jest.mock('../../../shared/locations', () => ({
  locations: {
    home: jest.fn().mockReturnValue('https://decentraland.org'),
    login: jest.fn().mockReturnValue('/login')
  }
}))

describe('DefaultPage', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(locations.home as jest.Mock).mockReturnValue('https://decentraland.org')
    ;(locations.login as jest.Mock).mockReturnValue('/login')
  })

  describe('when the user has a valid identity', () => {
    beforeEach(() => {
      // Use Object.defineProperty to mock window.location.href
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true
      })
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue({
        account: '0x123',
        identity: { ephemeralIdentity: {}, expiration: new Date(), authChain: [] }
      })
    })

    it('should redirect to the home page', async () => {
      render(<DefaultPage />)

      await waitFor(() => {
        expect(window.location.href).toBe('https://decentraland.org')
      })
    })
  })

  describe('when the user has no identity', () => {
    beforeEach(() => {
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue({
        account: '0x123',
        identity: undefined
      })
    })

    it('should navigate to the login page', async () => {
      render(<DefaultPage />)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login')
      })
    })
  })

  describe('when there is no connection data', () => {
    beforeEach(() => {
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(null)
    })

    it('should navigate to the login page', async () => {
      render(<DefaultPage />)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login')
      })
    })
  })
})
