import { createContentClient } from 'dcl-catalyst-client'
import { AuthChain } from '@dcl/schemas'
import { createFetcher } from '../../shared/fetcher'
import { config } from '../config'
import { DeploymentError } from './errors'
import { getCatalystUrlsForRotation } from './utils'

interface DeploymentEntity {
  entityId: string
  files: Map<string, Uint8Array>
  authChain: AuthChain
}

interface DeployWithCatalystRotationOptions {
  entity: DeploymentEntity
  disabledCatalysts?: string[]
  signal?: AbortSignal
}

async function deployWithCatalystRotation({ entity, disabledCatalysts, signal }: DeployWithCatalystRotationOptions): Promise<void> {
  signal?.throwIfAborted()
  const catalystUrls = getCatalystUrlsForRotation(disabledCatalysts)
  // Give each request a timeout so a stalled catalyst aborts (a retryable error) instead of
  // hanging the whole rotation forever, letting it advance to the next catalyst.
  const fetcher = createFetcher({ timeout: Number(config.get('PROFILE_CONSISTENCY_CHECK_TIMEOUT')) || 10000, signal })

  for (let attempt = 0; attempt < catalystUrls.length; attempt++) {
    const catalystUrl = catalystUrls[attempt]

    try {
      signal?.throwIfAborted()
      const client = createContentClient({ url: catalystUrl, fetcher })
      const response = (await client.deploy({
        entityId: entity.entityId,
        files: entity.files,
        authChain: entity.authChain
      })) as Response

      signal?.throwIfAborted()
      if (!response.ok) {
        const responseBody = await response.text().catch(() => 'Unable to read response body')
        signal?.throwIfAborted()
        throw new DeploymentError(
          `Deployment failed with status ${response.status}: ${responseBody}`,
          response.status,
          responseBody,
          catalystUrl
        )
      }

      return
    } catch (error) {
      // Caller cancellation is final, not a catalyst failure to retry or wrap.
      signal?.throwIfAborted()
      const isLastAttempt = attempt === catalystUrls.length - 1
      const shouldRetry = isLastAttempt ? false : isRetryableError(error)

      console.warn(`Profile deployment failed on catalyst ${catalystUrl} (attempt ${attempt + 1}/${catalystUrls.length}):`, error)

      if (isLastAttempt || !shouldRetry) {
        if (isLastAttempt) {
          console.error('Profile deployment failed on all available catalysts')
        }

        // Wrap non-DeploymentError errors (e.g. network failures) so they carry
        // the catalyst URL context for Sentry logging.
        if (error instanceof DeploymentError) {
          throw error
        }

        const message = error instanceof Error ? error.message : 'Unknown error'
        throw new DeploymentError(message, undefined, undefined, catalystUrl)
      }
    }
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof DeploymentError && error.statusCode !== undefined) {
    // Don't retry on 4xx client errors (bad request, auth issues, etc.)
    return error.statusCode >= 500
  }

  // Network errors (no response at all) are retryable
  return true
}

export type { DeploymentEntity, DeployWithCatalystRotationOptions }
export { deployWithCatalystRotation, isRetryableError }
