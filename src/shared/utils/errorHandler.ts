import { captureException } from '@sentry/react'
import { TrackingEvents } from '../../modules/analytics/types'
import { DeploymentError } from '../../modules/profile/errors'
import { isErrorWithMessage } from '../errors'
import { trackEvent } from './analytics'
import { ErrorContext, HandleErrorOptions, SentryExtra } from './errorHandler.types'

function getDeploymentErrorExtra(error: unknown): SentryExtra | undefined {
  if (error instanceof DeploymentError) {
    return {
      statusCode: error.statusCode,
      responseBody: error.responseBody,
      catalystUrl: error.catalystUrl
    }
  }
  return undefined
}

const shouldSkipReporting = (error: unknown): boolean => error instanceof Error && 'skipReporting' in error && error.skipReporting === true

/**
 * Wallets and RPC libraries (EIP-1193, ethers, viem, Magic SDK) often throw
 * plain objects shaped like `{ code, message }` instead of `Error` instances.
 * Sentry's `captureException` falls back to "Object captured as exception with
 * keys: …" for those, which kills stack traces and groups every distinct
 * failure into a single unhelpful issue.
 *
 * This normalises any thrown value into a real `Error`:
 *  - `Error` → returned as-is.
 *  - object with `message` → wrap into `new Error(message)`, preserve any
 *    extra fields (code, data, etc.) on the resulting Error so Sentry's
 *    "additional data" tab still surfaces them.
 *  - string → `new Error(string)`.
 *  - everything else → `new Error(<JSON dump>)`.
 */
function normaliseError(error: unknown): { error: Error; originalShape?: SentryExtra } {
  if (error instanceof Error) return { error }

  if (typeof error === 'string') return { error: new Error(error) }

  if (error !== null && typeof error === 'object') {
    const message = isErrorWithMessage(error) ? error.message : 'Unknown error (non-Error thrown)'
    const wrapped = new Error(message)
    // Surface as much of the original shape as possible for debugging while
    // keeping the key the Error type uses for grouping (`message`).
    const shape: SentryExtra = {}
    for (const [key, value] of Object.entries(error)) {
      if (key === 'message') continue
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        shape[key] = value
      } else if (value !== null && value !== undefined) {
        try {
          shape[key] = JSON.stringify(value)
        } catch {
          shape[key] = String(value)
        }
      }
    }
    return { error: wrapped, originalShape: Object.keys(shape).length > 0 ? shape : undefined }
  }

  try {
    return { error: new Error(JSON.stringify(error)) }
  } catch {
    return { error: new Error(String(error)) }
  }
}

const handleError = (error: unknown, context: string, options?: HandleErrorOptions) => {
  if (shouldSkipReporting(error)) {
    return isErrorWithMessage(error) ? error.message : 'Unknown error'
  }

  const errorMessage = isErrorWithMessage(error) ? error.message : 'Unknown error'

  if (!options?.skipLogging) {
    console.error(`${context}:`, errorMessage)
  }

  const deploymentExtra = getDeploymentErrorExtra(error)
  const { error: normalised, originalShape } = normaliseError(error)

  captureException(normalised, {
    tags: options?.sentryTags,
    extra: { ...deploymentExtra, ...(originalShape ?? {}), ...options?.sentryExtra }
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
