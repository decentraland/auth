import { Location, useLocation } from 'react-router-dom'
import { renderHook } from '@testing-library/react'
import { FeatureFlagsKeys } from '../components/FeatureFlagsProvider'
import { _targetConfigs } from './targetConfig'
import { useSkipSetup } from './useSkipSetup'

jest.mock('react-router-dom')
jest.mock('./targetConfig', () => {
  const actual = jest.requireActual('./targetConfig')
  return {
    ...actual,
    useTargetConfig: jest.fn()
  }
})
jest.mock('../components/FeatureFlagsProvider', () => {
  const actual = jest.requireActual('../components/FeatureFlagsProvider')
  return {
    ...actual,
    FeatureFlagsContext: { Consumer: () => null, Provider: () => null }
  }
})
jest.mock('react', () => {
  const actual = jest.requireActual('react')
  return {
    ...actual,
    useContext: jest.fn()
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useTargetConfig } = require('./targetConfig')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useContext } = require('react')

const mockedUseLocation = useLocation as jest.Mock<ReturnType<typeof useLocation>, Parameters<typeof useLocation>>
const mockedUseTargetConfig = useTargetConfig as jest.Mock
const mockedUseContext = useContext as jest.Mock

const buildMagicState = (redirectTo: string) =>
  btoa(JSON.stringify({ customData: JSON.stringify({ redirectTo }) }))

describe('when using the useSkipSetup hook', () => {
  beforeEach(() => {
    mockedUseTargetConfig.mockReturnValue([_targetConfigs.default, 'default'])
    mockedUseContext.mockReturnValue({ flags: {}, initialized: true })
  })

  afterEach(() => {
    mockedUseLocation.mockReset()
    mockedUseTargetConfig.mockReset()
    mockedUseContext.mockReset()
  })

  describe('and the target config forces skipSetup (e.g. Explorer/mobile target)', () => {
    beforeEach(() => {
      mockedUseTargetConfig.mockReturnValue([{ ..._targetConfigs.default, skipSetup: true }, 'alternative'])
      mockedUseLocation.mockReturnValue({ search: '' } as Location)
    })

    it('should skip setup regardless of feature flags', () => {
      const { result } = renderHook(() => useSkipSetup())
      expect(result.current).toBe(true)
    })
  })

  describe('and the ONBOARDING_TO_EXPLORER feature flag is disabled', () => {
    beforeEach(() => {
      mockedUseContext.mockReturnValue({ flags: { [FeatureFlagsKeys.ONBOARDING_TO_EXPLORER]: false }, initialized: true })
    })

    describe('and no redirectTo is present', () => {
      beforeEach(() => {
        mockedUseLocation.mockReturnValue({ search: '' } as Location)
      })

      it('should not skip setup', () => {
        const { result } = renderHook(() => useSkipSetup())
        expect(result.current).toBe(false)
      })
    })
  })

  describe('and the ONBOARDING_TO_EXPLORER feature flag is enabled', () => {
    beforeEach(() => {
      mockedUseContext.mockReturnValue({ flags: { [FeatureFlagsKeys.ONBOARDING_TO_EXPLORER]: true }, initialized: true })
    })

    describe('and no redirectTo is present (Explorer first-time login)', () => {
      beforeEach(() => {
        mockedUseLocation.mockReturnValue({ search: '' } as Location)
      })

      it('should skip setup (Explorer handles onboarding in-app)', () => {
        const { result } = renderHook(() => useSkipSetup())
        expect(result.current).toBe(true)
      })
    })

    describe('and an explicit external redirectTo is present (web flow from marketplace)', () => {
      beforeEach(() => {
        mockedUseLocation.mockReturnValue({ search: 'redirectTo=http://localhost/marketplace' } as Location)
      })

      it('should not skip setup (web quick-setup is required)', () => {
        const { result } = renderHook(() => useSkipSetup())
        expect(result.current).toBe(false)
      })
    })

    describe('and the redirectTo points back to an /auth/requests/ URL (Explorer signing flow)', () => {
      beforeEach(() => {
        mockedUseLocation.mockReturnValue({ search: 'redirectTo=/auth/requests/abc123' } as Location)
      })

      it('should skip setup (internal auth redirection is not explicit)', () => {
        const { result } = renderHook(() => useSkipSetup())
        expect(result.current).toBe(true)
      })
    })

    describe('and the user is returning from Magic OAuth (state contains internal /auth/requests/ redirect)', () => {
      beforeEach(() => {
        mockedUseLocation.mockReturnValue({
          search: `state=${buildMagicState('http://localhost/auth/requests/abc123')}`
        } as Location)
      })

      it('should skip setup (Explorer social flow should not trigger web onboarding)', () => {
        const { result } = renderHook(() => useSkipSetup())
        expect(result.current).toBe(true)
      })
    })

    describe('and the user is returning from Magic OAuth (state contains external redirectTo)', () => {
      beforeEach(() => {
        mockedUseLocation.mockReturnValue({
          search: `state=${buildMagicState('http://localhost/marketplace')}`
        } as Location)
      })

      it('should not skip setup (web social flow must run quick-setup when needed)', () => {
        const { result } = renderHook(() => useSkipSetup())
        expect(result.current).toBe(false)
      })
    })
  })
})
