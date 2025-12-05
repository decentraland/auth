/**
 * Mock data for MANA Transfer Views
 * Use this in development and testing
 */

import { MANATransferData } from '../../types'

// Placeholder scene image (you can replace with actual scene thumbnails)
const MOCK_SCENE_IMAGE = 'https://peer.decentraland.org/content/contents/QmScenePlaceholder'

export const mockMANATransferData: MANATransferData = {
  manaAmount: '100 MANA',
  toAddress: '0x1234567890abcdef1234567890abcdef12345678',
  recipientProfile: {
    avatars: [
      {
        avatar: {
          bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
          snapshots: {
            face256: 'https://peer.decentraland.org/content/contents/QmDefaultAvatar',
            body: 'https://peer.decentraland.org/content/contents/QmDefaultAvatarBody'
          },
          eyes: { color: { r: 0.23, g: 0.62, b: 0.3, a: 1 } },
          hair: { color: { r: 0.59, g: 0.37, b: 0.21, a: 1 } },
          skin: { color: { r: 0.8, g: 0.6, b: 0.46, a: 1 } },
          wearables: [],
          emotes: []
        },
        hasClaimedName: true,
        name: 'CoolCreator',
        description: 'Scene creator and builder',
        userId: '0x1234567890abcdef1234567890abcdef12345678',
        ethAddress: '0x1234567890abcdef1234567890abcdef12345678',
        version: 1,
        tutorialStep: 0,
        interests: [],
        hasConnectedWeb3: true
      }
    ]
  },
  sceneName: 'Genesis Plaza',
  sceneImageUrl: MOCK_SCENE_IMAGE
}

export const mockMANATransferData2: MANATransferData = {
  manaAmount: '250 MANA',
  toAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  recipientProfile: {
    avatars: [
      {
        avatar: {
          bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseFemale',
          snapshots: {
            face256: 'https://peer.decentraland.org/content/contents/QmDefaultAvatar2',
            body: 'https://peer.decentraland.org/content/contents/QmDefaultAvatarBody2'
          },
          eyes: { color: { r: 0.1, g: 0.5, b: 0.8, a: 1 } },
          hair: { color: { r: 0.2, g: 0.1, b: 0.05, a: 1 } },
          skin: { color: { r: 0.95, g: 0.75, b: 0.65, a: 1 } },
          wearables: [],
          emotes: []
        },
        hasClaimedName: true,
        name: 'ArtistCreator',
        description: 'Digital artist and scene designer',
        userId: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        ethAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        version: 1,
        tutorialStep: 0,
        interests: [],
        hasConnectedWeb3: true
      }
    ]
  },
  sceneName: 'Dragon City Casino',
  sceneImageUrl: MOCK_SCENE_IMAGE
}

export const mockMANATransferData3: MANATransferData = {
  manaAmount: '50 MANA',
  toAddress: '0x9999999999999999999999999999999999999999',
  sceneName: 'Wonderzone',
  sceneImageUrl: MOCK_SCENE_IMAGE
  // No profile - testing without recipient profile
}

