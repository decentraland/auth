import { createContext } from 'react'

enum FeatureFlagsKeys {
  MAGIC_TEST = 'dapps-magic-dev-test',
  DAPPS_MAGIC_AUTO_SIGN = 'dapps-magic-auto-sign',
  LOGIN_ON_SETUP = 'dapps-login-on-setup',
  HTTP_AUTH = 'dapps-http-auth',
  UNITY_WEARABLE_PREVIEW = 'dapps-unity-wearable-preview',
  ONBOARDING_FLOW = 'dapps-onboarding-flow',
  DISABLED_CATALYSTS = 'explorer-disabled-catalyst',
  EMAIL_OTP_LOGIN = 'dapps-email-otp-login'
}

enum OnboardingFlowVariant {
  V1 = 'V1',
  V2 = 'V2'
}

type FeatureFlagsVariants = Record<FeatureFlagsKeys, { enabled: boolean; name: string; payload?: { type: string; value: string } }>

type FeatureFlagsContextType = {
  flags: Partial<Record<FeatureFlagsKeys, boolean>>
  variants: Partial<FeatureFlagsVariants>
  initialized: boolean
}

const defaultFeatureFlagsContextValue: FeatureFlagsContextType = {
  flags: {},
  variants: {},
  initialized: false
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const FeatureFlagsContext = createContext(defaultFeatureFlagsContextValue)

export { FeatureFlagsKeys, OnboardingFlowVariant, defaultFeatureFlagsContextValue, FeatureFlagsContext }
export type { FeatureFlagsContextType }
