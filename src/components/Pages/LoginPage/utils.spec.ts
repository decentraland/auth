import { SignInOptionsMode } from '../../Connection/Connection.types'
import { FeatureFlagsKeys, SignInPrimaryOptionVariant } from '../../FeatureFlagsProvider/FeatureFlagsProvider.types'
import type { FeatureFlagsVariants } from '../../FeatureFlagsProvider/FeatureFlagsProvider.types'
import { getSignInOptionsMode } from './utils'

afterEach(() => {
  jest.clearAllMocks()
})

describe('getSignInOptionsMode', () => {
  let variants: Partial<FeatureFlagsVariants>

  beforeEach(() => {
    variants = {}
  })

  describe('when feature flag does not exist', () => {
    it('should return FULL mode', () => {
      const result = getSignInOptionsMode(variants)

      expect(result).toBe(SignInOptionsMode.FULL)
    })
  })

  describe('when feature flag is not enabled', () => {
    it('should return FULL mode', () => {
      const result = getSignInOptionsMode(variants)

      expect(result).toBe(SignInOptionsMode.FULL)
    })
  })

  describe('when feature flag is enabled', () => {
    describe('and variant is TWO_OPTIONS', () => {
      beforeEach(() => {
        variants[FeatureFlagsKeys.SIGN_IN_PRIMARY_OPTION] = {
          enabled: true,
          name: SignInPrimaryOptionVariant.TWO_OPTIONS
        }
      })

      it('should return TWO mode', () => {
        const result = getSignInOptionsMode(variants)

        expect(result).toBe(SignInOptionsMode.TWO)
      })
    })

    describe('and variant is ONE_OPTION', () => {
      beforeEach(() => {
        variants[FeatureFlagsKeys.SIGN_IN_PRIMARY_OPTION] = {
          enabled: true,
          name: SignInPrimaryOptionVariant.ONE_OPTION
        }
      })

      it('should return ONE mode', () => {
        const result = getSignInOptionsMode(variants)

        expect(result).toBe(SignInOptionsMode.ONE)
      })
    })
  })
})
