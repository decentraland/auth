import { DeploymentBuilder, createContentClient } from 'dcl-catalyst-client'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { EntityType } from '@dcl/schemas'
import { config } from '../../../modules/config'
import { fetcher } from '../../../shared/fetcher'

async function subscribeToNewsletter(email: string) {
  const url = config.get('BUILDER_SERVER_URL')

  if (!url) {
    throw new Error('Missing BUILDER_SERVER_URL.')
  }

  const response = await fetch(url + '/v1/newsletter', {
    method: 'post',
    body: JSON.stringify({ email, source: 'auth' }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    headers: { 'content-type': 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`Could not subscribe to newsletter. Status: ${response.status}`)
  }
}

async function deployProfileFromDefault({
  defaultProfile,
  connectedAccount,
  deploymentProfileName,
  connectedAccountIdentity
}: {
  defaultProfile: string
  connectedAccount: string
  deploymentProfileName: string
  connectedAccountIdentity: AuthIdentity
}) {
  // Create the content client to fetch and deploy profiles.
  const peerUrl = config.get('PEER_URL', '')
  const client = createContentClient({ url: peerUrl + '/content', fetcher })

  // Fetch the entity of the currently selected default profile.
  const defaultEntities = await client.fetchEntitiesByPointers([defaultProfile])
  const defaultEntity = defaultEntities[0]

  // Both org and zone content server profiles have legacy ids for wearables and body shapes.
  // We need to map them to urns to be able to deploy the profile.
  const mapLegacyIdToUrn = (urn: string) => urn.replace('dcl://base-avatars/', 'urn:decentraland:off-chain:base-avatars:')

  // Override the default avatar with the provided name and connected account address.
  const avatar = defaultEntity.metadata.avatars?.[0]

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

  // Deploy the profile for the currently connected account.
  await client.deploy({
    entityId: deploymentEntity.entityId,
    files: deploymentEntity.files,
    authChain: Authenticator.signPayload(connectedAccountIdentity, deploymentEntity.entityId)
  })
}

export { subscribeToNewsletter, deployProfileFromDefault }
