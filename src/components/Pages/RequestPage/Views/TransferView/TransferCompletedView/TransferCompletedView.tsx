import { useTranslation } from '@dcl/hooks'
import { Rarity } from '@dcl/schemas'
import { Box, Profile } from 'decentraland-ui2'
import successAnimation from '../../../../../../assets/animations/successAnimation_Lottie.json'
import { TransferAlert, TransferAssetImage, TransferLayout } from '../../../../../Transfer'
import { CenteredContent, ItemName, Label, Title } from '../../../../../Transfer/Transfer.styled'
import { TransferType } from '../../../types'
import type { MANATransferData, NFTTransferData, ProfileAvatar } from '../../../types'
import { SceneName } from '../TransferTipComponents.styled'
import { TransferCompletedViewProps } from './TransferCompletedView.types'
import { SceneImageWrapper, SuccessAnimation } from './TransferCompletedView.styled'

const TransferCompletedView = (props: TransferCompletedViewProps) => {
  const { t } = useTranslation()
  const { type, transferData } = props
  const isTip = type === TransferType.TIP
  const recipientAvatar = transferData.recipientProfile?.avatars?.[0]

  return (
    <TransferLayout>
      <CenteredContent>
        <Title>
          {isTip
            ? t('transfer.completed.tip_success', { manaAmount: (transferData as MANATransferData).manaAmount })
            : t('transfer.completed.gift_sent')}
        </Title>
        {isTip ? (
          <>
            <Profile
              address={transferData.toAddress}
              avatar={recipientAvatar as ProfileAvatar}
              inline
              showBothNameAndAddress
              shortenAddress
              size="huge"
              showCopyButton
              highlightName
            />
            <Label>{t('transfer.completed.creator_of')}</Label>
            <SceneImageWrapper>
              <TransferAssetImage
                src={(transferData as MANATransferData).sceneImageUrl}
                alt={(transferData as MANATransferData).sceneName}
              />
              <SuccessAnimation animationData={successAnimation} loop={true} />
            </SceneImageWrapper>
            <SceneName>{(transferData as MANATransferData).sceneName}</SceneName>
          </>
        ) : (
          <>
            <Profile address={transferData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline />
            <Box>
              <SceneImageWrapper isGift>
                <TransferAssetImage
                  src={(transferData as NFTTransferData).imageUrl}
                  name={(transferData as NFTTransferData).name || `NFT #${(transferData as NFTTransferData).tokenId}`}
                  rarity={(transferData as NFTTransferData).rarity || Rarity.COMMON}
                />
                <SuccessAnimation animationData={successAnimation} loop={true} />
              </SceneImageWrapper>
            </Box>
            {(transferData as NFTTransferData).name && <ItemName>{(transferData as NFTTransferData).name}</ItemName>}
          </>
        )}
        <TransferAlert />
      </CenteredContent>
    </TransferLayout>
  )
}

export { TransferCompletedView }
