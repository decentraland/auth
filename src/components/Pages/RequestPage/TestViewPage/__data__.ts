import { Rarity } from '@dcl/schemas'
import { Avatar } from '@dcl/schemas/dist/platform/profile/avatar'
import { SimulationResponseBody } from '../../../../shared/auth'
import { MANATransferData, NFTTransferData, SignaturePayload } from '../types'

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
  imageUrl:
    'https://peer.decentraland.org/lambdas/collections/contents/urn:decentraland:matic:collections-v2:0xfef5c99885c3036e591b6e6db52482891834a5f4:0/thumbnail',
  name: 'Test NFT',
  rarity: Rarity.UNIQUE,
  toAddress: '0x0000000000000000000000000000000000000000',
  tokenId: '1',
  recipientProfile: {
    avatars: [avatar]
  }
}

const manaData: MANATransferData = {
  manaAmount: '10 MANA',
  sceneImageUrl: 'https://peer.decentraland.org/content/contents/bafybeietrfx6arffgapt65jkawued7mcsu75uuloodf3drxbvq2pfpggei',
  sceneName: 'Test Scene',
  toAddress: '0x0000000000000000000000000000000000000000',
  recipientProfile: {
    avatars: [avatar]
  }
}

const USER_ADDRESS = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'

const MARKETPLACE_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'
const USDC_ADDRESS = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'
const COLLECTION_ADDRESS = '0xfef5c99885c3036e591b6e6db52482891834a5f4'

const simulationSuccess: SimulationResponseBody = {
  status: 'success',
  assetChanges: [
    {
      type: 'transfer',
      standard: 'erc20',
      from: USER_ADDRESS,
      to: MARKETPLACE_ADDRESS,
      amount: '100',
      rawAmount: '100000000000000000000',
      tokenId: null,
      contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
      symbol: 'MANA',
      name: 'Decentraland MANA',
      decimals: 18,
      logoUrl: null,
      dollarValue: '42.00'
    },
    {
      type: 'transfer',
      standard: 'erc20',
      from: USER_ADDRESS,
      to: MARKETPLACE_ADDRESS,
      amount: '250.5',
      rawAmount: '250500000',
      tokenId: null,
      contractAddress: USDC_ADDRESS,
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoUrl: null,
      dollarValue: '250.50'
    },
    {
      type: 'transfer',
      standard: 'native',
      from: USER_ADDRESS,
      to: MARKETPLACE_ADDRESS,
      amount: '1.5',
      rawAmount: '1500000000000000000',
      tokenId: null,
      contractAddress: null,
      symbol: 'MATIC',
      name: null,
      decimals: 18,
      logoUrl: null,
      dollarValue: '1.05'
    },
    {
      type: 'transfer',
      standard: 'erc20',
      from: MARKETPLACE_ADDRESS,
      to: USER_ADDRESS,
      amount: '0.05',
      rawAmount: '50000000000000000',
      tokenId: null,
      contractAddress: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      logoUrl: null,
      dollarValue: '160.00'
    },
    {
      type: 'mint',
      standard: 'erc721',
      from: null,
      to: USER_ADDRESS,
      amount: null,
      rawAmount: null,
      tokenId: '512',
      contractAddress: COLLECTION_ADDRESS,
      symbol: 'WEAR',
      name: 'Fancy Hat',
      decimals: null,
      logoUrl: null,
      dollarValue: null
    }
  ],
  approvalChanges: [
    {
      kind: 'approval',
      standard: 'erc20',
      owner: USER_ADDRESS,
      spender: MARKETPLACE_ADDRESS,
      amount: '500',
      rawAmount: '500000000',
      isUnlimited: false,
      tokenId: null,
      approved: null,
      contractAddress: USDC_ADDRESS,
      symbol: 'USDC',
      name: 'USD Coin'
    },
    {
      kind: 'approval',
      standard: 'erc20',
      owner: USER_ADDRESS,
      spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      amount: null,
      rawAmount: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
      isUnlimited: true,
      tokenId: null,
      approved: null,
      contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
      symbol: 'MANA',
      name: 'Decentraland MANA'
    },
    {
      kind: 'approvalForAll',
      standard: 'erc721',
      owner: USER_ADDRESS,
      spender: MARKETPLACE_ADDRESS,
      amount: null,
      rawAmount: null,
      isUnlimited: true,
      tokenId: null,
      approved: true,
      contractAddress: COLLECTION_ADDRESS,
      symbol: null,
      name: 'Fancy Wearables'
    },
    {
      kind: 'approvalForAll',
      standard: 'erc721',
      owner: USER_ADDRESS,
      spender: '0x9999999999999999999999999999999999999999',
      amount: null,
      rawAmount: null,
      isUnlimited: false,
      tokenId: null,
      approved: false,
      contractAddress: '0x1111111111111111111111111111111111111111',
      symbol: null,
      name: 'Old Wearables'
    },
    {
      kind: 'approval',
      standard: 'erc721',
      owner: USER_ADDRESS,
      spender: MARKETPLACE_ADDRESS,
      amount: null,
      rawAmount: null,
      isUnlimited: false,
      tokenId: '7',
      approved: null,
      contractAddress: COLLECTION_ADDRESS,
      symbol: null,
      name: 'Fancy Wearables'
    }
  ],
  balanceChanges: [{ address: USER_ADDRESS, dollarValue: '-133.55' }],
  events: [
    { name: 'Transfer', address: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942' },
    { name: 'Approval', address: USDC_ADDRESS },
    { name: null, address: MARKETPLACE_ADDRESS }
  ]
}

const simulationReverted: SimulationResponseBody = {
  status: 'reverted',
  error: 'ERC20: transfer amount exceeds balance',
  assetChanges: [],
  approvalChanges: [],
  balanceChanges: [],
  events: []
}

const simulationNoChanges: SimulationResponseBody = {
  status: 'success',
  assetChanges: [],
  approvalChanges: [],
  balanceChanges: [],
  events: [{ name: 'ConfigUpdated', address: MARKETPLACE_ADDRESS }]
}

const messageSignaturePayload: SignaturePayload = {
  kind: 'message',
  message: 'Sign this message to prove you own this wallet.\nNonce: 12345'
}

const typedDataSignaturePayload: SignaturePayload = {
  kind: 'typedData',
  raw: '{"types":{},"primaryType":"Order","domain":{"name":"Decentraland Marketplace","chainId":137,"verifyingContract":"0x480a0f4e360e8964e68858dd231c2922f1df45ef"},"message":{"price":"1000000000000000000","expiration":"1700000000"}}',
  typedData: {
    types: {},
    primaryType: 'Order',
    domain: { name: 'Decentraland Marketplace', chainId: 137, verifyingContract: '0x480a0f4e360e8964e68858dd231c2922f1df45ef' },
    message: { price: '1000000000000000000', expiration: '1700000000' }
  }
}

const metaTxSignaturePayload: SignaturePayload = {
  kind: 'typedData',
  raw: '{"primaryType":"MetaTransaction","domain":{"name":"Decentraland Collection","verifyingContract":"0xfef5c99885c3036e591b6e6db52482891834a5f4","salt":"0x0000000000000000000000000000000000000000000000000000000000000089"},"message":{"nonce":0,"from":"0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd","functionSignature":"0xa9059cbb"}}',
  typedData: {
    primaryType: 'MetaTransaction',
    domain: {
      name: 'Decentraland Collection',
      verifyingContract: '0xfef5c99885c3036e591b6e6db52482891834a5f4',
      salt: '0x0000000000000000000000000000000000000000000000000000000000000089'
    },
    message: { nonce: 0, from: USER_ADDRESS, functionSignature: '0xa9059cbb' }
  }
}

export {
  avatar,
  manaData,
  metaTxSignaturePayload,
  messageSignaturePayload,
  nftData,
  simulationNoChanges,
  simulationReverted,
  simulationSuccess,
  typedDataSignaturePayload,
  USER_ADDRESS
}
