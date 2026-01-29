import { captureException } from '@sentry/react'
import { TrackingEvents } from '../../modules/analytics/types'
import { isErrorWithMessage } from '../errors'
import { trackEvent } from './analytics'
import { ErrorContext, HandleErrorOptions } from './errorHandler.types'

/**
 * Normalizes an error to ensure it's a proper Error instance.
 * External libraries (ethers, WalletConnect, Magic) sometimes throw/reject
 * with plain objects like { code: number, message: string } which Sentry
 * captures as "Object captured as exception with keys: code, message".
 */
const normalizeError = (error: unknown): Error => {
  // Already an Error instance
  if (error instanceof Error) {
    return error
  }

  // Object with message property (common pattern from wallet libraries)
  if (error && typeof error === 'object' && 'message' in error) {
    const obj = error as { message: string; code?: number; name?: string }
    const normalizedError = new Error(obj.message)
    if (obj.code) {
      ;(normalizedError as Error & { code?: number }).code = obj.code
    }
    if (obj.name) {
      normalizedError.name = obj.name
    }
    return normalizedError
  }

  // String error
  if (typeof error === 'string') {
    return new Error(error)
  }

  // Fallback for unknown types
  return new Error(`Unknown error: ${JSON.stringify(error)}`)
}

const handleError = (error: unknown, context: string, options?: HandleErrorOptions) => {
  const errorMessage = isErrorWithMessage(error) ? error.message : 'Unknown error'

  if (!options?.skipLogging) {
    console.error(`${context}:`, errorMessage)
  }

  // Skip Sentry if explicitly requested (ignorable errors are also filtered in Sentry's beforeSend)
  if (!options?.skipSentry) {
    // Normalize the error to ensure it's a proper Error instance
    // This prevents "Object captured as exception" issues in Sentry
    const normalizedError = normalizeError(error)
    captureException(normalizedError, {
      tags: options?.sentryTags,
      extra: options?.sentryExtra
    })
  }

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
