import { memo } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Rarity } from '@dcl/schemas'
import { Box, Profile } from 'decentraland-ui2'
import { TransferAlert, TransferAssetImage, TransferLayout, TransferSecondaryText } from '../../../../../Transfer'
import { CenteredContent, ItemName, Label, Title } from '../../../../../Transfer/Transfer.styled'
import { ColumnContainer, SceneName } from '../TransferTipComponents.styled'
import { useTransferViewData } from '../useTransferViewData'
import { TransferCanceledViewProps } from './TransferCanceledView.types'

const TransferCanceledView = memo((props: TransferCanceledViewProps) => {
  const { t } = useTranslation()
  const { isTip, recipientAvatar, tipData, giftData, transferData } = useTransferViewData(props)

  return (
    <TransferLayout>
      <CenteredContent>
        <Title>
          {isTip ? t('transfer.canceled.tip_cancelled', { manaAmount: tipData!.manaAmount }) : t('transfer.canceled.gift_canceled')}{' '}
        </Title>
        {isTip && (
          <>
            <TransferSecondaryText>
              <ColumnContainer>
                <Box>{t('transfer.canceled.tip_not_delivered')}</Box>
                <Profile
                  address={transferData.toAddress}
                  avatar={recipientAvatar}
                  size="huge"
                  inline
                  showBothNameAndAddress
                  shortenAddress
                  showCopyButton
                  highlightName
                />
              </ColumnContainer>
            </TransferSecondaryText>
            <Label>{t('transfer.canceled.creator_of')}</Label>
            <TransferAssetImage src={tipData!.sceneImageUrl} alt={tipData!.sceneName} />
            <SceneName>{tipData!.sceneName}</SceneName>
            <TransferAlert />
          </>
        )}
        {!isTip && (
          <>
            <TransferSecondaryText>
              {t('transfer.canceled.gift_not_delivered')}
              <Profile address={transferData.toAddress} avatar={recipientAvatar} size="huge" inline shortenAddress />
            </TransferSecondaryText>
            <TransferAssetImage
              src={giftData!.imageUrl}
              alt={giftData!.name}
              name={giftData!.name}
              rarity={giftData!.rarity || Rarity.COMMON}
            />
            <ItemName>{giftData!.name}</ItemName>
            <TransferAlert />
          </>
        )}
      </CenteredContent>
    </TransferLayout>
  )
})

export { TransferCanceledView }
