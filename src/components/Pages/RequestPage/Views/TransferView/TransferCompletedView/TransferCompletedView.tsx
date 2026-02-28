import { useEffect, useState } from 'react'
import { Rarity } from '@dcl/schemas'
import { Box, Profile } from 'decentraland-ui2'
import { TransferAlert, TransferAssetImage, TransferLayout } from '../../../../../Transfer'
import { CenteredContent, ItemName, Label, Title } from '../../../../../Transfer/Transfer.styled'
import { TransferType } from '../../../types'
import type { ProfileAvatar } from '../../../types'
import { SceneName } from '../TransferTipComponents.styled'
import { TransferCompletedViewProps } from './TransferCompletedView.types'
import { SceneImageWrapper, SuccessAnimation } from './TransferCompletedView.styled'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnimationData = any

const TransferCompletedView = (props: TransferCompletedViewProps) => {
  const [successAnimation, setSuccessAnimation] = useState<AnimationData>(null)

  // Dynamically imported so the 67 KB animation JSON is split into its own chunk
  // instead of being bundled into the main bundle. This view only renders after
  // a successful transfer, so most users never need it.
  useEffect(() => {
    import('../../../../../../assets/animations/successAnimation_Lottie.json').then(m => setSuccessAnimation(m.default))
  }, [])
  const { type, transferData } = props
  const isTip = type === TransferType.TIP
  const recipientAvatar = transferData.recipientProfile?.avatars?.[0]

  return (
    <TransferLayout>
      <CenteredContent>
        <Title>{isTip ? `Success! ${transferData.manaAmount} tip Sent to` : 'Gift Sent to'}</Title>

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

            <Label>CREATOR OF</Label>

            <SceneImageWrapper>
              <TransferAssetImage src={transferData.sceneImageUrl} alt={transferData.sceneName} />
              {successAnimation && <SuccessAnimation animationData={successAnimation} loop={true} />}
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
                {successAnimation && <SuccessAnimation animationData={successAnimation} loop={true} />}
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
