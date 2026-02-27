import { useTranslation } from '@dcl/hooks'
import { Rarity } from '@dcl/schemas'
import { Box, Profile } from 'decentraland-ui2'
import successAnimation from '../../../../../../assets/animations/successAnimation_Lottie.json'
import { TransferAlert, TransferAssetImage, TransferLayout } from '../../../../../Transfer'
import { CenteredContent, ItemName, Label, Title } from '../../../../../Transfer/Transfer.styled'
import { TransferType } from '../../../types'
import type { ProfileAvatar } from '../../../types'
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
        <Title>{isTip ? t('transfer.completed.tip_success', { manaAmount: transferData.manaAmount }) : t('transfer.completed.gift_sent')}</Title>

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
              <TransferAssetImage src={transferData.sceneImageUrl} alt={transferData.sceneName} />
              <SuccessAnimation animationData={successAnimation} loop={true} />
            </SceneImageWrapper>

            <SceneName>{transferData.sceneName}</SceneName>
          </>
        ) : (
          <>
            <Profile address={transferData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline />

            <Box>
              <SceneImageWrapper isGift>
                <TransferAssetImage
                  src={transferData.imageUrl}
                  name={transferData.name || `NFT #${transferData.tokenId}`}
                  rarity={transferData.rarity || Rarity.COMMON}
                />
                <SuccessAnimation animationData={successAnimation} loop={true} />
              </SceneImageWrapper>
            </Box>

            {transferData.name && <ItemName>{transferData.name}</ItemName>}
          </>
        )}

        <TransferAlert />
      </CenteredContent>
    </TransferLayout>
  )
}

export { TransferCompletedView }
