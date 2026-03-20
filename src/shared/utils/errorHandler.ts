import { captureException } from '@sentry/react'
import { TrackingEvents } from '../../modules/analytics/types'
import { isErrorWithMessage } from '../errors'
import { trackEvent } from './analytics'
import { ErrorContext, HandleErrorOptions } from './errorHandler.types'

const shouldSkipReporting = (error: unknown): boolean =>
  error instanceof Error && 'skipReporting' in error && error.skipReporting === true

const handleError = (error: unknown, context: string, options?: HandleErrorOptions) => {
  if (shouldSkipReporting(error)) {
    return isErrorWithMessage(error) ? error.message : 'Unknown error'
  }

  const errorMessage = isErrorWithMessage(error) ? error.message : 'Unknown error'

  if (!options?.skipLogging) {
    console.error(`${context}:`, errorMessage)
  }

  captureException(error, {
    tags: options?.sentryTags,
    extra: options?.sentryExtra
  })

  if (!options?.skipTracking) {
    const trackingEvent = (options?.trackingEvent as TrackingEvents) || TrackingEvents.LOGIN_ERROR
    trackEvent(trackingEvent, {
      error: errorMessage,
      context,
      ...options?.trackingData
    })
  }

  return errorMessage
}

const handleErrorWithContext = (error: unknown, context: string, errorContext: ErrorContext) => {
  return handleError(error, context, {
    sentryTags: {
      feature: errorContext.feature,
      account: errorContext.account,
      isWeb2Wallet: errorContext.isWeb2Wallet,
      connectionType: errorContext.connectionType
    },
    sentryExtra: {
      url: errorContext.url,
      ...errorContext
    },
    trackingData: {
      error: isErrorWithMessage(error) ? error.message : 'Unknown error'
    }
  })
}

export type { ErrorContext, HandleErrorOptions, SentryExtra, SentryTags, TrackingData } from './errorHandler.types'
export { handleError, handleErrorWithContext }
