import { Location, useLocation } from 'react-router-dom'
import { ConnectionOptionType } from '../components/Connection'
import { isIos, isMobile } from '../components/Pages/LoginPage/utils'
import { extractRedirectToFromSearchParameters } from '../shared/locations'

type TargetConfigId = 'default' | 'alternative' | 'ios' | 'android'

type ConnectionOptions = {
  primary: ConnectionOptionType
  secondary?: ConnectionOptionType
  extraOptions?: ConnectionOptionType[]
}

type TargetConfig = {
  skipSetup: boolean
  showWearablePreview: boolean
  explorerText: string
  connectionOptions: ConnectionOptions
  deepLink?: string
}

const defaultConfig: TargetConfig = {
  skipSetup: false,
  showWearablePreview: true,
  explorerText: 'Decentraland app',
  connectionOptions: {
    primary: ConnectionOptionType.EMAIL,
    secondary: ConnectionOptionType.METAMASK,
    extraOptions: [
      ConnectionOptionType.GOOGLE,
      ConnectionOptionType.DISCORD,
      ConnectionOptionType.APPLE,
      ConnectionOptionType.X,
      ConnectionOptionType.FORTMATIC,
      ConnectionOptionType.COINBASE,
      ConnectionOptionType.WALLET_CONNECT
    ]
  }
}

const defaultMobileConfig: TargetConfig = {
  ...defaultConfig,
  skipSetup: true,
  showWearablePreview: false,
  explorerText: 'Decentraland Mobile App',
  deepLink: 'decentraland://'
}

const targetConfigs: Record<TargetConfigId, TargetConfig> = {
  default: {
    ...defaultConfig
  },
  alternative: {
    ...defaultConfig,
    skipSetup: true,
    showWearablePreview: false,
    explorerText: 'Explorer'
  },
  ios: {
    ...defaultMobileConfig,
    connectionOptions: {
      primary: ConnectionOptionType.APPLE,
      secondary: ConnectionOptionType.GOOGLE,
      extraOptions: [ConnectionOptionType.WALLET_CONNECT]
    }
  },
  android: {
    ...defaultMobileConfig,
    connectionOptions: {
      primary: ConnectionOptionType.GOOGLE,
      secondary: ConnectionOptionType.APPLE,
      extraOptions: [ConnectionOptionType.METAMASK]
    }
  }
}

// Exporting targetConfigs specifically for testing
const _targetConfigs = targetConfigs

const getTargetConfigId = (location: Location): TargetConfigId => {
  // On mobile, always use the OS-specific config and ignore any explicit
  // targetConfigId override. This guarantees mobile users only ever see
  // mobile-friendly providers (no METAMASK extension, etc.).
  if (isMobile()) {
    return isIos() ? 'ios' : 'android'
  }

  const search = new URLSearchParams(location.search)
  const targetConfigIdParam = search.get('targetConfigId') as TargetConfigId
  const redirectTo = extractRedirectToFromSearchParameters(search)

  // If explicit targetConfigId is provided, use it
  if (targetConfigIdParam in targetConfigs) {
    return targetConfigIdParam
  }

  // Check redirectTo URL for targetConfigId (desktop flow)
  if (redirectTo) {
    try {
      let searchParams: URLSearchParams
      // If the redirectTo is a relative URL, we need to parse it as a search params
      if (redirectTo.startsWith('/')) {
        searchParams = new URLSearchParams(redirectTo)
      } else {
        searchParams = new URL(redirectTo).searchParams
      }
      const targetConfigIdFromRedirectTo = searchParams.get('targetConfigId') as TargetConfigId
      if (targetConfigIdFromRedirectTo in targetConfigs) {
        return targetConfigIdFromRedirectTo
      }
    } catch {
      console.error("Can't parse redirectTo URL")
    }
  }

  return 'default'
}

const useTargetConfig = (): [TargetConfig, TargetConfigId] => {
  const location = useLocation()
  const targetConfigId = getTargetConfigId(location)
  return [targetConfigs[targetConfigId], targetConfigId]
}

export { _targetConfigs, useTargetConfig }
