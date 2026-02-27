import { AssetImage } from 'decentraland-ui2/dist/components/AssetImage'
import { TransferAssetImageProps } from './TransferAssetImage.types'
import { AssetImageWrapper, StyledRawImage } from './TransferAssetImage.styled'

const TransferAssetImage = (props: TransferAssetImageProps) => {
  const { alt, name, rarity, src } = props

  return (
    <AssetImageWrapper isGift={!!rarity}>
      {name && rarity ? <AssetImage src={src} name={name} rarity={rarity} /> : <StyledRawImage src={src} alt={alt ?? name ?? ''} />}
    </AssetImageWrapper>
  )
}

export { TransferAssetImage }
