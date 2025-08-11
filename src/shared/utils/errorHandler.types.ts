export interface TrackingData {
  error?: string
  context?: string
  browserTime?: number
  requestTime?: number
  requestType?: string
  method?: string
  ethAddress?: string
  // eslint-disable-next-line @typescript-eslint/naming-convention
  eth_address?: string
  type?: string
  feature?: string
  account?: string
  url?: string
  referrer?: string
  connectionType?: string
  isWeb2Wallet?: boolean
  // eslint-disable-next-line @typescript-eslint/naming-convention
  is_guest?: boolean
  action?: string
  email?: string
  name?: string
  profile?: string
  isGuest?: boolean
}

export interface SentryTags {
  [key: string]: string | number | boolean | undefined
  feature?: string
  account?: string
  isWeb2Wallet?: boolean
  connectionType?: string
  method?: string
  type?: string
  environment?: string
}

export interface SentryExtra {
  url?: string
  referrer?: string
  requestId?: string
  userId?: string
  userAgent?: string
  timestamp?: number
  browserTime?: number
  requestType?: string
  ethAddress?: string
  email?: string
  profile?: string
  [key: string]: string | number | boolean | undefined
}

export interface ErrorContext {
  feature?: string
  account?: string
  url?: string
  connectionType?: string
  isWeb2Wallet?: boolean
  referrer?: string
  requestId?: string
  method?: string
  [key: string]: string | number | boolean | undefined
}

export interface HandleErrorOptions {
  trackingData?: TrackingData
  sentryTags?: SentryTags
  sentryExtra?: SentryExtra
  skipLogging?: boolean
  skipTracking?: boolean
  trackingEvent?: string
}
