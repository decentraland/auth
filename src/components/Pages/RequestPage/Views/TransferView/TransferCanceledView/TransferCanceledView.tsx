import { memo } from 'react'
import { Rarity } from '@dcl/schemas'
import { Box, Profile } from 'decentraland-ui2'
import { TransferAlert, TransferAssetImage, TransferLayout, TransferSecondaryText } from '../../../../../Transfer'
import { CenteredContent, ItemName, Label, Title } from '../../../../../Transfer/Transfer.styled'
import { type ProfileAvatar, TransferType } from '../../../types'
import { ColumnContainer, SceneName } from '../TransferTipComponents.styled'
import { TransferCanceledViewProps } from './TransferCanceledView.types'

const TransferCanceledView = memo((props: TransferCanceledViewProps) => {
  const { type, transferData } = props
  const isTip = type === TransferType.TIP
  const recipientAvatar = transferData.recipientProfile?.avatars?.[0]

  return (
    <TransferLayout>
      <CenteredContent>
        <Title>{isTip ? `${transferData.manaAmount} MANA Tip Cancelled` : 'Gift Canceled'} </Title>

        {isTip && (
          <>
            <TransferSecondaryText>
              <ColumnContainer>
                <Box>Your tip wasn&apos;t delivered to</Box>
                <Profile
                  address={transferData.toAddress}
                  avatar={recipientAvatar as ProfileAvatar}
                  size="huge"
                  inline
                  showBothNameAndAddress
                  shortenAddress
                />
              </ColumnContainer>
            </TransferSecondaryText>
            <Label>CREATOR OF</Label>
            <TransferAssetImage src={transferData.sceneImageUrl} alt={transferData.sceneName} />
            <SceneName>{transferData.sceneName}</SceneName>
            <TransferAlert />
          </>
        )}
        {!isTip && (
          <>
            <TransferSecondaryText>
              Your gift wasn&apos;t delivered to
              <Profile address={transferData.toAddress} avatar={recipientAvatar as ProfileAvatar} size="huge" inline shortenAddress />
            </TransferSecondaryText>
            <TransferAssetImage
              src={transferData.imageUrl}
              alt={transferData.name}
              name={transferData.name}
              rarity={transferData.rarity || Rarity.COMMON}
            />
            <ItemName>{transferData.name}</ItemName>
            <TransferAlert />
          </>
        )}
      </CenteredContent>
    </TransferLayout>
  )
})

export { TransferCanceledView }
