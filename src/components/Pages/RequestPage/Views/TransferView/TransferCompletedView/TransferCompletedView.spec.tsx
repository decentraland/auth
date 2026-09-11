import { render, screen } from '@testing-library/react'
import { Rarity } from '@dcl/schemas'
import { DclThemeProvider, darkTheme } from 'decentraland-ui2'
import { TransferType } from '../../../types'
import type { NFTTransferData } from '../../../types'
import { TransferCompletedView } from './TransferCompletedView'
import { TransferCompletedViewProps } from './TransferCompletedView.types'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

// TransferLayout renders the WebGL AnimatedBackground, which jsdom can't run.
jest.mock('../../../../../AnimatedBackground', () => ({
  AnimatedBackground: () => null
}))

const ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa5678'

const renderView = (props: TransferCompletedViewProps) =>
  render(
    <DclThemeProvider theme={darkTheme}>
      <TransferCompletedView {...props} />
    </DclThemeProvider>
  )

const giftTo = (toAddress: string, avatar?: { name: string; hasClaimedName: boolean }): TransferCompletedViewProps => ({
  type: TransferType.GIFT,
  transferData: {
    imageUrl: 'https://example.com/nft.png',
    tokenId: '1',
    toAddress,
    contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    name: 'Hat',
    description: 'A hat',
    rarity: Rarity.COMMON,
    recipientProfile: avatar ? ({ avatars: [avatar] } as NFTTransferData['recipientProfile']) : undefined
  }
})

describe('when a gift has been sent', () => {
  // The screen that tells the user where their NFT went. A display name does not say that: an unclaimed one
  // is free to copy and Profile disambiguates it only with the last four characters of the address, so the
  // account that now holds the item is named by its address as well (see TransferConfirmView).
  describe('and the recipient has a name they have not claimed', () => {
    it('should name the account that now holds it by address as well as by name', () => {
      renderView(giftTo(ADDRESS, { name: 'Alice', hasClaimedName: false }))

      expect(screen.getByText('Alice#5678')).toBeInTheDocument()
      expect(screen.getByText('0xaaaa…5678')).toBeInTheDocument()
    })
  })

  describe('and the recipient has no profile at all', () => {
    it('should name them by their address', () => {
      renderView(giftTo(ADDRESS))

      expect(screen.getByText('0xaaaa…5678')).toBeInTheDocument()
    })
  })
})
