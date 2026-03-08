import { useEffect, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Rarity } from '@dcl/schemas'
import { Box, Profile } from 'decentraland-ui2'
import { TransferAlert, TransferAssetImage, TransferLayout } from '../../../../../Transfer'
import { CenteredContent, ItemName, Label, Title } from '../../../../../Transfer/Transfer.styled'
import { SceneName } from '../TransferTipComponents.styled'
import { useTransferViewData } from '../useTransferViewData'
import { TransferCompletedViewProps } from './TransferCompletedView.types'
import { SceneImageWrapper, SuccessAnimation } from './TransferCompletedView.styled'

type AnimationData = unknown

const TransferCompletedView = (props: TransferCompletedViewProps) => {
  const { t } = useTranslation()
  const [successAnimation, setSuccessAnimation] = useState<AnimationData>(null)

  // Dynamically imported so the 67 KB animation JSON is split into its own chunk
  // instead of being bundled into the main bundle. This view only renders after
  // a successful transfer, so most users never need it.
  useEffect(() => {
    import('../../../../../../assets/animations/successAnimation_Lottie.json').then(m => setSuccessAnimation(m.default))
  }, [])
  const { isTip, recipientAvatar, tipData, giftData, transferData } = useTransferViewData(props)

  return (
    <TransferLayout>
      <CenteredContent>
        <Title>
          {isTip ? t('transfer.completed.tip_success', { manaAmount: tipData!.manaAmount }) : t('transfer.completed.gift_sent')}
        </Title>
        {isTip ? (
          <>
            <Profile
              address={transferData.toAddress}
              avatar={recipientAvatar}
              inline
              showBothNameAndAddress
              shortenAddress
              size="huge"
              showCopyButton
              highlightName
            />
            <Label>{t('transfer.completed.creator_of')}</Label>
            <SceneImageWrapper>
              <TransferAssetImage src={tipData!.sceneImageUrl} alt={tipData!.sceneName} />
              {successAnimation ? <SuccessAnimation animationData={successAnimation} loop={true} /> : null}
            </SceneImageWrapper>
            <SceneName>{tipData!.sceneName}</SceneName>
          </>
        ) : (
          <>
            <Profile address={transferData.toAddress} avatar={recipientAvatar} size="huge" inline />
            <Box>
              <SceneImageWrapper isGift>
                <TransferAssetImage
                  src={giftData!.imageUrl}
                  name={giftData!.name || `NFT #${giftData!.tokenId}`}
                  rarity={giftData!.rarity || Rarity.COMMON}
                />
                {successAnimation ? <SuccessAnimation animationData={successAnimation} loop={true} /> : null}
              </SceneImageWrapper>
            </Box>
            {giftData!.name && <ItemName>{giftData!.name}</ItemName>}
          </>
        )}
        <TransferAlert />
      </CenteredContent>
    </TransferLayout>
  )
}

export { TransferCompletedView }
