import { useContext, useMemo } from 'react'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../components/FeatureFlagsProvider'

// Stable reference for the empty case so consumers that depend on this value
// (e.g. useCallback dependency arrays) don't re-create on every render.
const EMPTY_LIST: string[] = []

export const useDisabledCatalysts = (): string[] => {
  const { variants, initialized } = useContext(FeatureFlagsContext)
  const disabledVariant = variants[FeatureFlagsKeys.DISABLED_CATALYSTS]

  // Extract the payload value as a primitive string so the useMemo dependency
  // is compared by value, not by object reference. This prevents unnecessary
  // recalculations when the variant object reference changes but the value hasn't.
  const payloadValue = disabledVariant?.enabled ? disabledVariant.payload?.value : undefined

  return useMemo(() => {
    if (!initialized || !payloadValue) {
      return EMPTY_LIST
    }

    try {
      return JSON.parse(payloadValue)
    } catch {
      return EMPTY_LIST
    }
  }, [initialized, payloadValue])
}
