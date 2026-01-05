import { createContext } from 'react'

export enum FeatureFlagsKeys {
  MAGIC_TEST = 'dapps-magic-dev-test',
  DAPPS_MAGIC_AUTO_SIGN = 'dapps-magic-auto-sign',
  LOGIN_ON_SETUP = 'dapps-login-on-setup',
  HTTP_AUTH = 'dapps-http-auth',
  UNITY_WEARABLE_PREVIEW = 'dapps-unity-wearable-preview',
  ONBOARDING_FLOW = 'dapps-onboarding-flow',
  DISABLED_CATALYSTS = 'explorer-disabled-catalyst'
}

export enum OnboardingFlowVariant {
  V1 = 'V1',
  V2 = 'V2'
}

type FeatureFlagsVariants = Record<FeatureFlagsKeys, { enabled: boolean; name: string; payload?: { type: string; value: string } }>

export type FeatureFlagsContextType = {
  flags: Partial<Record<FeatureFlagsKeys, boolean>>
  variants: Partial<FeatureFlagsVariants>
  initialized: boolean
}

export const defaultFeatureFlagsContextValue: FeatureFlagsContextType = {
  flags: {},
  variants: {},
  initialized: false
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const FeatureFlagsContext = createContext(defaultFeatureFlagsContextValue)
