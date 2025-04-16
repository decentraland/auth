import { createContext } from 'react'

export enum FeatureFlagsKeys {
  MAGIC_TEST = 'dapps-magic-dev-test',
  DAPPS_MAGIC_AUTO_SIGN = 'dapps-magic-auto-sign',
  LOGIN_ON_SETUP = 'dapps-login-on-setup',
  HTTP_AUTH = 'dapps-http-auth'
}

export type FeatureFlagsContextType = {
  flags: Partial<Record<FeatureFlagsKeys, boolean>>
  initialized: boolean
}

export const defaultFeatureFlagsContextValue: FeatureFlagsContextType = {
  flags: {},
  initialized: false
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const FeatureFlagsContext = createContext(defaultFeatureFlagsContextValue)
