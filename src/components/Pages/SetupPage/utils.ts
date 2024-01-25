import { createFetchComponent } from '@well-known-components/fetch-component'
import { DeploymentBuilder, createContentClient } from 'dcl-catalyst-client'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { hashV1 } from '@dcl/hashing'
import { EntityType } from '@dcl/schemas'
import { config } from '../../../modules/config'
import { resizeImage } from './resizeImage'

export async function subscribeToNewsletter(email: string) {
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

export async function deployProfileFromDefault({
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
  const client = createContentClient({ url: peerUrl + '/content', fetcher: createFetchComponent() })

  // Fetch the entity of the currently selected default profile.
  const defaultEntities = await client.fetchEntitiesByPointers([defaultProfile])
  const defaultEntity = defaultEntities[0]

  // Check if the retrieved entity belongs to a legacy profile.
  const isLegacy = defaultEntity.id.startsWith('Qm')

  // Download the content of the default profile and create the files map to be used for deploying the new profile.
  const bodyFile = 'body.png'
  const faceFile = 'face.png'
  const face256File = 'face256.png'

  const contentHashesByFile = defaultEntity.content.reduce(
    (acc, next) => ({ ...acc, [next.file]: next.hash }),
    {} as Record<string, string>
  )

  const bodyBuffer = await client.downloadContent(contentHashesByFile[bodyFile])
  const faceBuffer = !isLegacy
    ? await client.downloadContent(contentHashesByFile[face256File])
    : // Legacy profiles have a face.png file that needs to be resized to 256x256.
      await resizeImage(await client.downloadContent(contentHashesByFile[faceFile]))

  const files = new Map<string, Uint8Array>()

  files.set(bodyFile, bodyBuffer)
  // We are going to upload a new profile that needs to have a face256 file.
  // We can use the face file from the legacy profile for it.
  files.set(face256File, faceBuffer)

  // Both org and zone content server profiles have legacy ids for wearables and body shapes.
  // We need to map them to urns to be able to deploy the profile.
  const mapLegacyIdToUrn = (urn: string) => urn.replace('dcl://base-avatars/', 'urn:decentraland:off-chain:base-avatars:')

  // Override the default avatar with the provided name and connected account address.
  const avatar = defaultEntity.metadata?.avatars?.[0]

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

  if (isLegacy) {
    const [body, face256] = await Promise.all([hashV1(bodyBuffer), hashV1(faceBuffer)])
    avatar.avatar.snapshots = { body, face256 }
  }

  // Build the entity for the profile to be deployed.
  const deploymentEntity = await DeploymentBuilder.buildEntity({
    type: EntityType.PROFILE,
    pointers: [connectedAccount],
    metadata: { avatars: [avatar] },
    timestamp: Date.now(),
    files
  })

  // Deploy the profile for the currently connected account.
  await client.deploy({
    entityId: deploymentEntity.entityId,
    files: deploymentEntity.files,
    authChain: Authenticator.signPayload(connectedAccountIdentity, deploymentEntity.entityId)
  })
}
