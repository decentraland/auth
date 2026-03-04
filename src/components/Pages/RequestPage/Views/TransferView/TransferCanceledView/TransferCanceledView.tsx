import { memo } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Rarity } from '@dcl/schemas'
import { Box, Profile } from 'decentraland-ui2'
import { TransferAlert, TransferAssetImage, TransferLayout, TransferSecondaryText } from '../../../../../Transfer'
import { CenteredContent, ItemName, Label, Title } from '../../../../../Transfer/Transfer.styled'
import { type MANATransferData, type NFTTransferData, type ProfileAvatar, TransferType } from '../../../types'
import { ColumnContainer, SceneName } from '../TransferTipComponents.styled'
import { TransferCanceledViewProps } from './TransferCanceledView.types'

const TransferCanceledView = memo((props: TransferCanceledViewProps) => {
  const { t } = useTranslation()
  const { type, transferData } = props
  const isTip = type === TransferType.TIP
  const recipientAvatar = transferData.recipientProfile?.avatars?.[0]

  return (
    <TransferLayout>
      <CenteredContent>
        <Title>
          {isTip
            ? t('transfer.canceled.tip_cancelled', { manaAmount: (transferData as MANATransferData).manaAmount })
            : t('transfer.canceled.gift_canceled')}{' '}
        </Title>
        {isTip && (
          <>
            <TransferSecondaryText>
              <ColumnContainer>
                <Box>{t('transfer.canceled.tip_not_delivered')}</Box>
                <Profile
                  address={transferData.toAddress}
                  avatar={recipientAvatar as ProfileAvatar}
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
            <TransferAssetImage src={(transferData as MANATransferData).sceneImageUrl} alt={(transferData as MANATransferData).sceneName} />
            <SceneName>{(transferData as MANATransferData).sceneName}</SceneName>
            <TransferAlert />
          </>
        )}
        {!isTip && (
          <>
            <TransferSecondaryText>
              {t('transfer.canceled.gift_not_delivered')}
              <Profile address={transferData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline shortenAddress />
            </TransferSecondaryText>
            <TransferAssetImage
              src={(transferData as NFTTransferData).imageUrl}
              alt={(transferData as NFTTransferData).name}
              name={(transferData as NFTTransferData).name}
              rarity={(transferData as NFTTransferData).rarity || Rarity.COMMON}
            />
            <ItemName>{(transferData as NFTTransferData).name}</ItemName>
            <TransferAlert />
          </>
        )}
      </CenteredContent>
    </TransferLayout>
  )
})

export { TransferCanceledView }
