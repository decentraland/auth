import { Rarity } from '@dcl/schemas'
import { Avatar } from '@dcl/schemas/dist/platform/profile/avatar'
import { MANATransferData, NFTTransferData } from '../types'

const avatar: Avatar = {
  hasClaimedName: true,
  description: 'My description',
  tutorialStep: 4095,
  name: 'MotherHacker',
  userId: '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd',
  email: '',
  ethAddress: '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd',
  version: 64,
  avatar: {
    bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
    wearables: [
      'urn:decentraland:off-chain:base-avatars:eyebrows_17',
      'urn:decentraland:off-chain:base-avatars:eyes_07',
      'urn:decentraland:off-chain:base-avatars:beard',
      'urn:decentraland:off-chain:base-avatars:mouth_03',
      'urn:decentraland:off-chain:base-avatars:hair_coolshortstyle',
      'urn:decentraland:matic:collections-v2:0xc43914be599f3f8fe4956aa3ec9d6a6aead1edfa:0:84',
      'urn:decentraland:matic:collections-v2:0xd50191baed16bc532feb9d499fdaa805fe01d3ff:6:631873750011343120187508166102022593913370572403294667525865865224',
      'urn:decentraland:matic:collections-v2:0xc43914be599f3f8fe4956aa3ec9d6a6aead1edfa:2:210624583337114373395836055367340864637790190801098222508621955166',
      'urn:decentraland:off-chain:base-avatars:punk_piercing',
      'urn:decentraland:matic:collections-v2:0x6b9ad15f1b82eb1d8b0f13d847f348b56589f83c:0:78'
    ],
    forceRender: [],
    emotes: [
      {
        urn: 'urn:decentraland:matic:collections-v2:0xea954afa4d2a8d0624adfafeb0e5a725ef777774:1:105312291668557186697918027683670432318895095400549111254310977736',
        slot: 0
      },
      {
        urn: 'urn:decentraland:matic:collections-v2:0xd50191baed16bc532feb9d499fdaa805fe01d3ff:3:315936875005671560093754083051011296956685286201647333762932932714',
        slot: 1
      },
      {
        urn: 'urn:decentraland:matic:collections-v2:0xea954afa4d2a8d0624adfafeb0e5a725ef777774:0:219',
        slot: 2
      },
      {
        urn: 'urn:decentraland:matic:collections-v2:0xef832a5183bf2e4099efed4c6ec981b7b41aa545:0:124',
        slot: 3
      },
      {
        slot: 4,
        urn: 'hammer'
      },
      {
        urn: 'urn:decentraland:matic:collections-v2:0x768c1027b1f1a452ecb8dab017a1e630a75f0d30:1:105312291668557186697918027683670432318895095400549111254310977547',
        slot: 5
      },
      {
        urn: 'urn:decentraland:matic:collections-v2:0x83134b69f9af4cb3239e0645281902a0a02adb37:0:100',
        slot: 6
      },
      {
        slot: 7,
        urn: 'kiss'
      },
      {
        urn: 'urn:decentraland:matic:collections-v2:0xc43914be599f3f8fe4956aa3ec9d6a6aead1edfa:4:421249166674228746791672110734681729275580381602196445017243910359',
        slot: 8
      },
      {
        urn: 'urn:decentraland:matic:collections-v2:0x0b472c2c04325a545a43370b54e93c87f3d5badf:3:315936875005671560093754083051011296956685286201647333762932932643',
        slot: 9
      }
    ],
    snapshots: {
      body: 'https://peer-ec2.decentraland.org/content/contents/bafkreierlxqaqy2wqjmdf5y46p7xdzg5skpfbeyaixyrzim2hdmimazbce',
      face256: 'https://peer-ec2.decentraland.org/content/contents/bafkreicow7jrxxezwqdkv63lvgahf42khbnuvnm5auam4sp2ph7ghbhyhi'
    },
    eyes: {
      color: {
        r: 0.37109375,
        g: 0.22265625,
        b: 0.1953125
      }
    },
    hair: {
      color: {
        r: 0.234375,
        g: 0.12890625,
        b: 0.04296875
      }
    },
    skin: {
      color: {
        r: 0.60546875,
        g: 0.4609375,
        b: 0.35546875
      }
    }
  },
  interests: [],
  hasConnectedWeb3: true,
  muted: []
}

const nftData: NFTTransferData = {
  contractAddress: '0x0000000000000000000000000000000000000000',
  description: 'Test description',
  imageUrl: 'https://placehold.co/512x512/png',
  name: 'Test NFT',
  rarity: Rarity.COMMON,
  toAddress: '0x0000000000000000000000000000000000000000',
  tokenId: '1',
  recipientProfile: {
    avatars: [avatar]
  }
}

const manaData: MANATransferData = {
  manaAmount: '10',
  sceneImageUrl: 'https://placehold.co/940x656/png',
  sceneName: 'Test Scene',
  toAddress: '0x0000000000000000000000000000000000000000',
  recipientProfile: {
    avatars: [avatar]
  }
}

export { avatar, manaData, nftData }
