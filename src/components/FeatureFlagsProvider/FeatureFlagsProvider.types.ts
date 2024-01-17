import { createContext } from 'react'

export enum FeatureFlagsKeys {
  SIMPLIFIED_AVATAR_SETUP = 'dapps-simplified-avatar-setup'
}

export type FeatureFlagsContextType = {
  flags: Record<string, boolean>
  initialized: boolean
}

export const defaultFeatureFlagsContextValue: FeatureFlagsContextType = {
  flags: {},
  initialized: false
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const FeatureFlagsContext = createContext(defaultFeatureFlagsContextValue)
