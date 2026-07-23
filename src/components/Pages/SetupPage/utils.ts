import { DeploymentBuilder, createContentClient } from 'dcl-catalyst-client'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { EntityType } from '@dcl/schemas'
import { config } from '../../../modules/config'
import { deployWithCatalystRotation } from '../../../modules/profile'
import { createFetcher } from '../../../shared/fetcher'

// These calls run in the onboarding submit path, mostly after the profile has already deployed, so
// they must be bounded: a hung server would otherwise leave the user stuck on the deploying spinner
// indefinitely rather than surfacing (or swallowing) a failure.
const REQUEST_TIMEOUT_MS = 10_000

async function subscribeToNewsletter(email: string) {
  const url = config.get('BUILDER_SERVER_URL')

  if (!url) {
    throw new Error('Missing BUILDER_SERVER_URL.')
  }

  const response = await fetch(url + '/v1/newsletter', {
    method: 'post',
    body: JSON.stringify({ email, source: 'auth' }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })

  if (!response.ok) {
    throw new Error(`Could not subscribe to newsletter. Status: ${response.status}`)
  }
}

async function deployProfileFromDefault({
  defaultProfile,
  connectedAccount,
  deploymentProfileName,
  connectedAccountIdentity,
  disabledCatalysts
}: {
  defaultProfile: string
  connectedAccount: string
  deploymentProfileName: string
  connectedAccountIdentity: AuthIdentity
  disabledCatalysts?: string[]
}) {
  // Create the content client to fetch and deploy profiles. Use a timeout-bounded fetcher so a
  // stalled PEER catalyst can't hang the entity fetch forever (the deploy step below already
  // rotates across catalysts with its own timeout).
  const peerUrl = config.get('PEER_URL', '')
  const client = createContentClient({ url: peerUrl + '/content', fetcher: createFetcher({ timeout: REQUEST_TIMEOUT_MS }) })

  // Fetch the entity of the currently selected default profile.
  const defaultEntities = await client.fetchEntitiesByPointers([defaultProfile])
  const defaultEntity = defaultEntities[0]

  // The default-profile pointer can come back empty (unsynced/pruned on the catalyst). Fail with a
  // clear message instead of a cryptic "cannot read properties of undefined" further down.
  const avatar = defaultEntity?.metadata?.avatars?.[0]
  if (!avatar) {
    throw new Error(`Default profile "${defaultProfile}" could not be loaded. Try selecting another default look.`)
  }

  // Both org and zone content server profiles have legacy ids for wearables and body shapes.
  // We need to map them to urns to be able to deploy the profile.
  const mapLegacyIdToUrn = (urn: string) => urn.replace('dcl://base-avatars/', 'urn:decentraland:off-chain:base-avatars:')

  // Override the default avatar with the provided name and connected account address.
  avatar.name = deploymentProfileName
  avatar.ethAddress = connectedAccount
  avatar.userId = connectedAccount
  avatar.version = 1
  avatar.tutorialStep = 0
  avatar.hasClaimedName = false
  avatar.hasConnectedWeb3 = true
  avatar.avatar.bodyShape = mapLegacyIdToUrn(defaultEntity.metadata.avatars[0].avatar.bodyShape)
  avatar.avatar.wearables = defaultEntity.metadata.avatars[0].avatar.wearables.map(mapLegacyIdToUrn)
  avatar.avatar.emotes = []
  delete avatar.avatar.snapshots

  // Build the entity for the profile to be deployed.
  const deploymentEntity = await DeploymentBuilder.buildEntity({
    type: EntityType.PROFILE,
    pointers: [connectedAccount],
    metadata: { avatars: [avatar] },
    timestamp: Date.now(),
    files: new Map()
  })

  // Deploy the profile for the currently connected account with catalyst rotation.
  await deployWithCatalystRotation({
    entity: {
      entityId: deploymentEntity.entityId,
      files: deploymentEntity.files,
      authChain: Authenticator.signPayload(connectedAccountIdentity, deploymentEntity.entityId)
    },
    disabledCatalysts
  })
}

export { subscribeToNewsletter, deployProfileFromDefault }
