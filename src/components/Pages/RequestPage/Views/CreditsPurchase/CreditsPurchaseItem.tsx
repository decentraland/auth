import { useTranslation } from '@dcl/hooks'
import { Rarity } from '@dcl/schemas'
import { TransferAssetImage } from '../../../../Transfer'
import { ItemName } from '../../../../Transfer/Transfer.styled'
import type { CreditsPurchaseData } from '../../types'
import { AssetIdentifiers } from './CreditsPurchase.styled'

/**
 * The item a purchase delivers: its picture and its name when the catalyst could answer for it, and the
 * identifiers out of the signed trade either way when it could not.
 *
 * The identifiers are the fallback rather than the norm on purpose. They are what the call actually names,
 * so they are always true, but a collection address and an item number tell a buyer nothing about what they
 * are getting; the name and the picture do, and they are what the screen leads with when they exist. What
 * they may never do is stand in for a fact: the price, the recipient and the contracts are read from the
 * payload and are on screen whatever the catalyst said.
 */
const CreditsPurchaseItem = ({ purchaseData }: { purchaseData: CreditsPurchaseData }) => {
  const { t } = useTranslation()
  const { asset } = purchaseData.purchase
  const metadata = purchaseData.metadata
  const assetId = asset.kind === 'collection_item' ? asset.itemId : asset.tokenId

  return (
    <>
      <TransferAssetImage
        compact
        src={metadata?.imageUrl ?? ''}
        alt={metadata?.name ?? ''}
        name={metadata?.name || t('credits_purchase.unnamed_item', { id: assetId })}
        rarity={metadata?.rarity ?? Rarity.COMMON}
      />
      <ItemName data-testid="credits-purchase-item-name">{metadata?.name || t('credits_purchase.unnamed_item', { id: assetId })}</ItemName>
      {metadata ? null : (
        <AssetIdentifiers data-testid="credits-purchase-item-identifiers">
          {t(asset.kind === 'collection_item' ? 'credits_purchase.item_identifiers' : 'credits_purchase.token_identifiers', {
            collection: asset.contractAddress,
            id: assetId
          })}
        </AssetIdentifiers>
      )}
    </>
  )
}

export { CreditsPurchaseItem }
