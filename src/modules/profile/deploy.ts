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
}

async function deployWithCatalystRotation({ entity, disabledCatalysts }: DeployWithCatalystRotationOptions): Promise<void> {
  const catalystUrls = getCatalystUrlsForRotation(disabledCatalysts)
  // Give each request a timeout so a stalled catalyst aborts (a retryable error) instead of
  // hanging the whole rotation forever, letting it advance to the next catalyst.
  const fetcher = createFetcher({ timeout: Number(config.get('PROFILE_CONSISTENCY_CHECK_TIMEOUT')) || 10000 })

  for (let attempt = 0; attempt < catalystUrls.length; attempt++) {
    const catalystUrl = catalystUrls[attempt]

    try {
      const client = createContentClient({ url: catalystUrl, fetcher })
      const response = (await client.deploy({
        entityId: entity.entityId,
        files: entity.files,
        authChain: entity.authChain
      })) as Response

      if (!response.ok) {
        const responseBody = await response.text().catch(() => 'Unable to read response body')
        throw new DeploymentError(
          `Deployment failed with status ${response.status}: ${responseBody}`,
          response.status,
          responseBody,
          catalystUrl
        )
      }

      return
    } catch (error) {
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
    // Retry on server errors (5xx) and on transient per-server conditions another catalyst is
    // likely to accept: 429 (rate limited) and 408 (request timeout). Other 4xx (e.g. 400 bad
    // request, auth) are deterministic — the same payload would fail on every catalyst, so don't
    // waste the remaining attempts.
    return error.statusCode >= 500 || error.statusCode === 429 || error.statusCode === 408
  }

  // Network errors (no response at all) are retryable
  return true
}

export type { DeploymentEntity, DeployWithCatalystRotationOptions }
export { deployWithCatalystRotation, isRetryableError }
