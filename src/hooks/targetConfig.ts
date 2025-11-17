import { useLocation, Location } from 'react-router-dom'
import { ConnectionOptionType } from '../components/Connection'
import { isMobile } from '../components/Pages/LoginPage/utils'
import { extractRedirectToFromSearchParameters } from '../shared/locations'

type TargetConfigId = 'default' | 'alternative' | 'ios' | 'android' | 'androidSocial' | 'androidWeb3'

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
  explorerText: 'Decentraland',
  connectionOptions: {
    primary: ConnectionOptionType.GOOGLE,
    secondary: ConnectionOptionType.METAMASK,
    extraOptions: [
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
  explorerText: 'Mobile App',
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
      secondary: ConnectionOptionType.WALLET_CONNECT,
      extraOptions: [
        ConnectionOptionType.GOOGLE,
        ConnectionOptionType.DISCORD,
        ConnectionOptionType.X,
        ConnectionOptionType.FORTMATIC,
        ConnectionOptionType.COINBASE
      ]
    }
  },
  android: {
    ...defaultMobileConfig,
    connectionOptions: {
      primary: ConnectionOptionType.GOOGLE,
      secondary: ConnectionOptionType.WALLET_CONNECT,
      extraOptions: [
        ConnectionOptionType.DISCORD,
        ConnectionOptionType.APPLE,
        ConnectionOptionType.X,
        ConnectionOptionType.FORTMATIC,
        ConnectionOptionType.COINBASE
      ]
    }
  },
  androidSocial: {
    ...defaultMobileConfig,
    connectionOptions: {
      primary: ConnectionOptionType.GOOGLE,
      secondary: ConnectionOptionType.X,
      extraOptions: [ConnectionOptionType.APPLE, ConnectionOptionType.DISCORD]
    }
  },
  androidWeb3: {
    ...defaultMobileConfig,
    connectionOptions: {
      primary: ConnectionOptionType.WALLET_CONNECT
    }
  }
}

const adjustWeb3OptionsForMobile = (config: TargetConfig): TargetConfig => {
  let { primary, secondary, extraOptions } = config.connectionOptions

  // Replace Metamask Extension for Wallet Connect on Mobile
  if (primary === ConnectionOptionType.METAMASK) {
    primary = ConnectionOptionType.WALLET_CONNECT
    extraOptions = extraOptions?.filter(option => option !== ConnectionOptionType.WALLET_CONNECT)
  }

  if (secondary === ConnectionOptionType.METAMASK) {
    secondary = ConnectionOptionType.WALLET_CONNECT
    extraOptions = extraOptions?.filter(option => option !== ConnectionOptionType.WALLET_CONNECT)
  }

  extraOptions = extraOptions?.filter(option => option !== ConnectionOptionType.METAMASK)

  return {
    ...config,
    connectionOptions: { primary, secondary, extraOptions }
  }
}

// Exporting targetConfigs specifically for testing
export const _targetConfigs = targetConfigs

const getTargetConfigId = (location: Location): TargetConfigId => {
  const search = new URLSearchParams(location.search)
  const targetConfigIdParam = search.get('targetConfigId') as TargetConfigId
  const redirectTo = extractRedirectToFromSearchParameters(search)
  // Get the targetConfigId from the search parameters or the redirectTo URL
  if (targetConfigIdParam in targetConfigs) {
    return targetConfigIdParam
  } else if (redirectTo) {
    try {
      let searchParams: URLSearchParams
      // If the redirectTo is a relative URL, we need to parse it as a search params
      if (redirectTo.startsWith('/')) {
        searchParams = new URLSearchParams(redirectTo)
      } else {
        searchParams = new URL(redirectTo).searchParams
      }
      const targetConfigIdFromRedirectTo = searchParams.get('targetConfigId') as TargetConfigId
      if (targetConfigIdFromRedirectTo) {
        return targetConfigIdFromRedirectTo
      }
    } catch (error) {
      console.error("Can't parse redirectTo URL")
    }
  }
  return 'default'
}

export const useTargetConfig = (): [TargetConfig, TargetConfigId] => {
  const location = useLocation()
  const targetConfigId = getTargetConfigId(location)
  let config = targetConfigs[targetConfigId]
  if (isMobile()) {
    config = adjustWeb3OptionsForMobile(config)
  }
  return [config, targetConfigId]
}
