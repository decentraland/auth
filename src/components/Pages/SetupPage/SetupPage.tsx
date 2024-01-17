import { useContext } from 'react'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'

export const SetupPage = () => {
  const { initialized, flags } = useContext(FeatureFlagsContext)

  if (!initialized) {
    return null
  }

  if (!flags[FeatureFlagsKeys.SIMPLIFIED_AVATAR_SETUP]) {
    window.location.href = '/'
    return null
  }

  return <div>Setup Page</div>
}
