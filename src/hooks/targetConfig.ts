import { useLocation } from 'react-router-dom'

type TargetConfigId = 'default' | 'alternative'
type TargetConfig = {
  skipVerifyCode: boolean
  skipSetup: boolean
  showWearablePreview: boolean
  explorerText: string
}

const targetConfigRecord: Record<TargetConfigId, TargetConfig> = {
  default: {
    skipVerifyCode: false,
    skipSetup: false,
    showWearablePreview: true,
    explorerText: 'Desktop App'
  },
  alternative: {
    skipVerifyCode: false,
    skipSetup: true,
    showWearablePreview: false,
    explorerText: 'Explorer'
  }
}

export const useTargetConfig = (): [TargetConfig, TargetConfigId] => {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const targetConfigIdSearchParam = search.get('targetConfigId') || 'default'
  const targetConfigId =
    targetConfigIdSearchParam && targetConfigIdSearchParam in targetConfigRecord ? (targetConfigIdSearchParam as TargetConfigId) : 'default'
  return [targetConfigRecord[targetConfigId], targetConfigId]
}
