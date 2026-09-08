import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Rarity } from '@dcl/schemas'
import { DclThemeProvider, darkTheme } from 'decentraland-ui2'
import { TransferType } from '../../../types'
import type { MANATransferData, NFTTransferData } from '../../../types'
import { TransferConfirmView } from './TransferConfirmView'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => (options ? `${key} ${Object.values(options).join(' ')}` : key)
  })
}))

// TransferLayout renders the WebGL AnimatedBackground, which jsdom can't run.
jest.mock('../../../../../Transfer', () => ({
  ...jest.requireActual('../../../../../Transfer'),
  TransferLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

const RECIPIENT = '0x1234567890abcdef1234567890abcdef12345678'

// The Profile component reads the theme, so the view is rendered under the app's provider.
const renderView = (view: React.ReactElement) => render(<DclThemeProvider theme={darkTheme}>{view}</DclThemeProvider>)

describe('when confirming a gift', () => {
  let transferData: NFTTransferData
  let onApprove: jest.Mock
  let onDeny: jest.Mock

  beforeEach(() => {
    onApprove = jest.fn().mockResolvedValue(undefined)
    onDeny = jest.fn()
    transferData = {
      imageUrl: 'https://example.com/hat.png',
      tokenId: '7',
      toAddress: RECIPIENT,
      contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      name: 'Rare Hat',
      description: 'A rare hat',
      rarity: Rarity.RARE,
      recipientProfile: { avatars: [{ name: 'alice', hasClaimedName: true }] } as unknown as NFTTransferData['recipientProfile']
    }
  })

  it('should name the item and the recipient in the acknowledgment', () => {
    renderView(
      <TransferConfirmView type={TransferType.GIFT} transferData={transferData} isLoading={false} onApprove={onApprove} onDeny={onDeny} />
    )
    expect(screen.getByText('transfer.confirm.acknowledge_gift Rare Hat alice')).toBeInTheDocument()
  })

  it('should hold the confirmation until the gift is acknowledged', async () => {
    renderView(
      <TransferConfirmView type={TransferType.GIFT} transferData={transferData} isLoading={false} onApprove={onApprove} onDeny={onDeny} />
    )
    expect(screen.getByTestId('transfer-confirm-button')).toBeDisabled()
    await userEvent.click(screen.getByTestId('gift-acknowledgment'))
    expect(screen.getByTestId('transfer-confirm-button')).toBeEnabled()
    await userEvent.click(screen.getByTestId('transfer-confirm-button'))
    expect(onApprove).toHaveBeenCalledTimes(1)
  })

  describe('and the recipient has no profile', () => {
    beforeEach(() => {
      delete transferData.recipientProfile
    })

    it('should name the recipient by a shortened address', () => {
      renderView(
        <TransferConfirmView type={TransferType.GIFT} transferData={transferData} isLoading={false} onApprove={onApprove} onDeny={onDeny} />
      )
      expect(screen.getByText('transfer.confirm.acknowledge_gift Rare Hat 0x1234…5678')).toBeInTheDocument()
    })
  })
})

describe('when confirming a tip', () => {
  let transferData: MANATransferData
  let onApprove: jest.Mock
  let onDeny: jest.Mock

  beforeEach(() => {
    onApprove = jest.fn().mockResolvedValue(undefined)
    onDeny = jest.fn()
    transferData = {
      manaAmount: '5 MANA',
      toAddress: RECIPIENT,
      sceneName: 'Genesis Plaza',
      sceneImageUrl: 'https://example.com/scene.png'
    }
  })

  it('should say what is sent, to whom, and that it cannot be undone', () => {
    renderView(
      <TransferConfirmView type={TransferType.TIP} transferData={transferData} isLoading={false} onApprove={onApprove} onDeny={onDeny} />
    )
    expect(screen.getByTestId('tip-warning')).toHaveTextContent('transfer.confirm.tip_warning 5 MANA 0x1234…5678')
  })

  it('should not ask for a checkbox', () => {
    renderView(
      <TransferConfirmView type={TransferType.TIP} transferData={transferData} isLoading={false} onApprove={onApprove} onDeny={onDeny} />
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByTestId('transfer-confirm-button')).toBeEnabled()
  })
})
