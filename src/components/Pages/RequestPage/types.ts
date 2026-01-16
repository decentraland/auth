import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { Rarity } from '@dcl/schemas'
import { Profile as ProfileComponent } from 'decentraland-ui2'

type NFTTransferData = {
  imageUrl: string
  tokenId: string
  toAddress: string
  contractAddress: string
  name: string
  description: string
  rarity: Rarity
  recipientProfile?: Profile
}

type MANATransferData = {
  manaAmount: string
  toAddress: string
  recipientProfile?: Profile
  sceneName: string
  sceneImageUrl: string
}

type ProfileAvatar = Parameters<typeof ProfileComponent>[0]['avatar']

enum TransferType {
  TIP = 'tip',
  GIFT = 'gift'
}

export { TransferType }
export type { MANATransferData, NFTTransferData, ProfileAvatar }
