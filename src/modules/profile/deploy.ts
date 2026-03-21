import { createContentClient } from 'dcl-catalyst-client'
import { AuthChain } from '@dcl/schemas'
import { createFetcher } from '../../shared/fetcher'
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
  const fetcher = createFetcher()

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
        throw error
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
