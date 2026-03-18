/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
import { renderHook } from '@testing-library/react'
import { FeatureFlagsKeys, OnboardingFlowVariant } from '../components/FeatureFlagsProvider'
import { checkWebGpuSupport } from '../shared/utils/webgpu'
import { useSetupNavigation } from './useSetupNavigation'

const mockNavigate = jest.fn()
jest.mock('./navigation', () => ({
  useNavigateWithSearchParams: () => mockNavigate
}))

jest.mock('../shared/utils/webgpu')

jest.mock('../shared/locations', () => ({
  locations: {
    setup: jest.fn((redirectTo: string, referrer: string | null) => `/setup?redirectTo=${redirectTo}&referrer=${referrer}`),
    avatarSetup: jest.fn((redirectTo: string, referrer: string | null) => `/avatar-setup?redirectTo=${redirectTo}&referrer=${referrer}`)
  }
}))

const mockTrackWebGPUSupportCheck = jest.fn()
jest.mock('./useAnalytics', () => ({
  useAnalytics: () => ({
    trackWebGPUSupportCheck: mockTrackWebGPUSupportCheck
  })
}))

let mockVariants: any
jest.mock('react', () => {
  const actual = jest.requireActual('react')
  return {
    ...actual,
    useContext: () => ({
      flags: {},
      variants: mockVariants,
      initialized: true
    })
  }
})

describe('useSetupNavigation', () => {
  let redirectTo: string
  let referrer: string | null

  beforeEach(() => {
    redirectTo = 'https://decentraland.org'
    referrer = 'https://referrer.com'
    mockVariants = {}
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when calling navigateToSetup', () => {
    describe('and the onboarding flow is V2 with WebGPU support', () => {
      beforeEach(() => {
        mockVariants = {
          [FeatureFlagsKeys.ONBOARDING_FLOW]: { name: OnboardingFlowVariant.V2, enabled: true }
        }
        jest.mocked(checkWebGpuSupport).mockResolvedValueOnce(true)
      })

      it('should navigate to the avatar setup page', async () => {
        const { result } = renderHook(() => useSetupNavigation())
        await result.current.navigateToSetup(redirectTo, referrer)
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/avatar-setup'), undefined)
      })

      it('should track WebGPU as supported', async () => {
        const { result } = renderHook(() => useSetupNavigation())
        await result.current.navigateToSetup(redirectTo, referrer)
        expect(mockTrackWebGPUSupportCheck).toHaveBeenCalledWith({ supported: true })
      })
    })

    describe('and the onboarding flow is V2 without WebGPU support', () => {
      beforeEach(() => {
        mockVariants = {
          [FeatureFlagsKeys.ONBOARDING_FLOW]: { name: OnboardingFlowVariant.V2, enabled: true }
        }
        jest.mocked(checkWebGpuSupport).mockResolvedValueOnce(false)
      })

      it('should navigate to the standard setup page', async () => {
        const { result } = renderHook(() => useSetupNavigation())
        await result.current.navigateToSetup(redirectTo, referrer)
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/setup'), undefined)
        expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/avatar-setup'), undefined)
      })

      it('should track WebGPU as not supported', async () => {
        const { result } = renderHook(() => useSetupNavigation())
        await result.current.navigateToSetup(redirectTo, referrer)
        expect(mockTrackWebGPUSupportCheck).toHaveBeenCalledWith({ supported: false })
      })
    })

    describe('and the onboarding flow is V1', () => {
      beforeEach(() => {
        mockVariants = {
          [FeatureFlagsKeys.ONBOARDING_FLOW]: { name: OnboardingFlowVariant.V1, enabled: true }
        }
        jest.mocked(checkWebGpuSupport).mockResolvedValueOnce(true)
      })

      it('should navigate to the standard setup page regardless of WebGPU', async () => {
        const { result } = renderHook(() => useSetupNavigation())
        await result.current.navigateToSetup(redirectTo, referrer)
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/setup'), undefined)
        expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/avatar-setup'), undefined)
      })
    })

    describe('and no onboarding flow variant is set', () => {
      beforeEach(() => {
        jest.mocked(checkWebGpuSupport).mockResolvedValueOnce(true)
      })

      it('should navigate to the standard setup page', async () => {
        const { result } = renderHook(() => useSetupNavigation())
        await result.current.navigateToSetup(redirectTo, referrer)
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/setup'), undefined)
      })
    })

    describe('and navigate options are provided', () => {
      beforeEach(() => {
        jest.mocked(checkWebGpuSupport).mockResolvedValueOnce(false)
      })

      it('should pass the navigate options through', async () => {
        const { result } = renderHook(() => useSetupNavigation())
        await result.current.navigateToSetup(redirectTo, referrer, { replace: true })
        expect(mockNavigate).toHaveBeenCalledWith(expect.any(String), { replace: true })
      })
    })
  })
})
