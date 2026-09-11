import { render, screen } from '@testing-library/react'
import { Rarity } from '@dcl/schemas'
import { DclThemeProvider, darkTheme } from 'decentraland-ui2'
import { TransferType } from '../../../types'
import type { NFTTransferData } from '../../../types'
import { TransferCanceledView } from './TransferCanceledView'
import { TransferCanceledViewProps } from './TransferCanceledView.types'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

// TransferLayout renders the WebGL AnimatedBackground, which jsdom can't run.
jest.mock('../../../../../AnimatedBackground', () => ({
  AnimatedBackground: () => null
}))

const ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa5678'

const renderView = (props: TransferCanceledViewProps) =>
  render(
    <DclThemeProvider theme={darkTheme}>
      <TransferCanceledView {...props} />
    </DclThemeProvider>
  )

const giftTo = (toAddress: string, avatar?: { name: string; hasClaimedName: boolean }): TransferCanceledViewProps => ({
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

describe('when a gift was not delivered', () => {
  // `shortenAddress` on its own said nothing here: Profile renders the name instead of the address whenever
  // the recipient has one, so the account that would have received the item went unnamed.
  describe('and the recipient has a name they have not claimed', () => {
    it('should name the account it would have gone to by address as well as by name', () => {
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
