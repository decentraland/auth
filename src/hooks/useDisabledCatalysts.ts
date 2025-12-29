import { useContext, useMemo } from 'react'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../components/FeatureFlagsProvider'

export const useDisabledCatalysts = (): string[] => {
  const { variants, initialized } = useContext(FeatureFlagsContext)

  return useMemo(() => {
    if (!initialized) {
      return []
    }

    const disabledVariant = variants[FeatureFlagsKeys.DISABLED_CATALYSTS]
    if (!disabledVariant?.enabled) {
      return []
    }

    try {
      return JSON.parse(disabledVariant.payload?.value ?? '[]')
    } catch {
      return []
    }
  }, [initialized, variants[FeatureFlagsKeys.DISABLED_CATALYSTS]])
}
