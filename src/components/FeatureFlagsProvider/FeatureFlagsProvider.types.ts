import { createContext } from 'react'

export enum FeatureFlagsKeys {
  MAGIC_TEST = 'dapps-magic-dev-test'
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
