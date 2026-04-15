import { renderHook } from '@testing-library/react'
import { locations } from '../shared/locations'
import { useSetupNavigation } from './useSetupNavigation'

const mockNavigate = jest.fn()
jest.mock('./navigation', () => ({
  useNavigateWithSearchParams: () => mockNavigate
}))

jest.mock('../shared/locations', () => ({
  locations: {
    quickSetup: jest.fn((redirectTo: string, referrer: string | null) => `/quick-setup?redirectTo=${redirectTo}&referrer=${referrer}`)
  }
}))

describe('useSetupNavigation', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should always navigate to quick-setup', async () => {
    const { result } = renderHook(() => useSetupNavigation())
    await result.current.navigateToSetup('https://decentraland.org', 'https://referrer.com')
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/quick-setup'), undefined)
  })

  it('should pass navigate options through', async () => {
    const { result } = renderHook(() => useSetupNavigation())
    await result.current.navigateToSetup('https://decentraland.org', null, { replace: true })
    expect(mockNavigate).toHaveBeenCalledWith(expect.any(String), { replace: true })
  })

  it('should pass redirectTo and referrer to locations.quickSetup', async () => {
    const { result } = renderHook(() => useSetupNavigation())
    await result.current.navigateToSetup('https://example.com', 'https://ref.com')
    expect(jest.mocked(locations.quickSetup)).toHaveBeenCalledWith('https://example.com', 'https://ref.com')
  })
})
