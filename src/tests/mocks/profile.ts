import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { AuthIdentity } from '@dcl/crypto'
import { Entity, EntityType } from '@dcl/schemas'

const DEFAULT_MOCK_ADDRESS = '0x1234567890abcdef'

function createMockIdentity(address: string = DEFAULT_MOCK_ADDRESS): AuthIdentity {
  return {
    ephemeralIdentity: {
      privateKey: 'mock-private-key',
      publicKey: 'mock-public-key',
      address
    },
    expiration: new Date(Date.now() + 3600000),
    authChain: []
  }
}

function createMockProfile(address: string = DEFAULT_MOCK_ADDRESS): Profile {
  return {
    avatars: [
      {
        name: 'TestAvatar',
        userId: address,
        email: 'test@test.com',
        ethAddress: address,
        version: 1,
        hasClaimedName: false,
        description: 'Test',
        tutorialStep: 0,
        avatar: {
          bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
          wearables: [],
          eyes: { color: { r: 0, g: 0, b: 0 } },
          hair: { color: { r: 0, g: 0, b: 0 } },
          skin: { color: { r: 0, g: 0, b: 0 } }
        }
      }
    ]
  }
}

function createMockEntity(address: string = DEFAULT_MOCK_ADDRESS): Entity {
  return {
    version: 'v3',
    id: 'mock-entity-id',
    type: EntityType.PROFILE,
    pointers: [address],
    timestamp: Date.now(),
    content: [],
    metadata: {
      avatars: [
        {
          name: 'TestAvatar',
          userId: address,
          email: 'test@test.com',
          ethAddress: address,
          version: 1,
          hasClaimedName: false,
          description: 'Test',
          tutorialStep: 0,
          avatar: {
            bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
            wearables: ['urn:decentraland:off-chain:base-avatars:eyes_00'],
            emotes: [],
            eyes: { color: { r: 0, g: 0, b: 0 } },
            hair: { color: { r: 0, g: 0, b: 0 } },
            skin: { color: { r: 0, g: 0, b: 0 } }
          }
        }
      ]
    }
  } as Entity
}

const createMockDeploymentResult = () => ({
  entityId: 'mock-entity-id',
  files: new Map()
})

export { DEFAULT_MOCK_ADDRESS, createMockIdentity, createMockProfile, createMockEntity, createMockDeploymentResult }
