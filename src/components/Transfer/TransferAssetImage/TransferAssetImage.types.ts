import { Rarity } from '@dcl/schemas'

export type TransferAssetImageProps = {
  alt?: string
  /** A smaller frame, for a screen that has to fit more than the item (see AssetImageWrapper). */
  compact?: boolean
  name?: string
  rarity?: Rarity
  src: string
}
