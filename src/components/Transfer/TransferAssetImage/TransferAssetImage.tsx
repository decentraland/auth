import { AssetImage } from 'decentraland-ui2/dist/components/AssetImage'
import { AssetImageWrapper, StyledRawImage } from './TransferAssetImage.styled'
import { TransferAssetImageProps } from './TransferAssetImage.types'

const TransferAssetImage = ({ alt, name, rarity, src }: TransferAssetImageProps) => {
  return (
    <AssetImageWrapper>
      {name && rarity ? <AssetImage src={src} name={name} rarity={rarity} /> : <StyledRawImage src={src} alt={alt ?? name ?? ''} />}
    </AssetImageWrapper>
  )
}

export { TransferAssetImage }
