import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Rarity } from '@dcl/schemas'
import { TransferType } from '../../../types'
import type { MANATransferData, NFTTransferData } from '../../../types'
import { TransferConfirmView } from './TransferConfirmView'
import { TransferConfirmViewProps } from './TransferConfirmView.types'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

jest.mock('decentraland-ui2', () => ({
  ...jest.requireActual('decentraland-ui2'),
  Profile: () => null
}))

// TransferLayout renders the WebGL AnimatedBackground, which jsdom can't run.
jest.mock('../../../../../AnimatedBackground', () => ({
  AnimatedBackground: () => null
}))

describe('when confirming a branded transfer', () => {
  let props: TransferConfirmViewProps
  let onApprove: jest.Mock
  let onDeny: jest.Mock
  let onCallbackAcknowledgedChange: jest.Mock
  let transferData: MANATransferData

  beforeEach(() => {
    onApprove = jest.fn()
    onDeny = jest.fn()
    onCallbackAcknowledgedChange = jest.fn()
    transferData = {
      manaAmount: '10 MANA',
      toAddress: '0x1234567890abcdef1234567890abcdef12345678',
      sceneName: 'Genesis Plaza',
      sceneImageUrl: 'https://example.com/scene.png'
    }
    props = { type: TransferType.TIP, transferData, isLoading: false, onApprove, onDeny, onCallbackAcknowledgedChange }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the approval hands the user to a wallet prompt that is still open', () => {
    let resolveApproval: () => void

    beforeEach(() => {
      onApprove.mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolveApproval = resolve
          })
      )
    })

    it('should show the processing state instead of the buttons while the prompt is open', async () => {
      render(<TransferConfirmView {...props} />)
      await userEvent.click(screen.getByTestId('transfer-confirm-button'))
      expect(screen.queryByTestId('transfer-confirm-button')).not.toBeInTheDocument()
      expect(screen.getByText('transfer.confirm.processing_authorization')).toBeInTheDocument()
      await act(async () => resolveApproval())
    })
  })

  describe('and the approval only opened a confirmation dialog the user then cancelled', () => {
    beforeEach(() => {
      onApprove.mockResolvedValue(undefined)
    })

    it('should hand the buttons back so the user can still deny or confirm', async () => {
      render(<TransferConfirmView {...props} />)
      await userEvent.click(screen.getByTestId('transfer-confirm-button'))
      expect(screen.getByTestId('transfer-confirm-button')).toBeInTheDocument()
      expect(screen.getByTestId('transfer-cancel-button')).toBeInTheDocument()
    })
  })

  describe('and the page is executing the confirmed request', () => {
    beforeEach(() => {
      props = { ...props, isLoading: true }
    })

    it('should show the processing state', () => {
      render(<TransferConfirmView {...props} />)
      expect(screen.getByText('transfer.confirm.processing_authorization')).toBeInTheDocument()
      expect(screen.queryByTestId('transfer-confirm-button')).not.toBeInTheDocument()
    })
  })

  describe('and a called address had no code during the preview', () => {
    beforeEach(() => {
      props = { ...props, callbackAddresses: ['0x1234567890abcdef1234567890abcdef12345678'] }
    })

    it('should warn that code can appear before execution', () => {
      render(<TransferConfirmView {...props} />)
      expect(screen.getByTestId('callback-code-warning')).toHaveTextContent('request.transaction_dialog.callback_code_notice')
    })

    it('should report callback consent to the page', async () => {
      render(<TransferConfirmView {...props} />)
      await userEvent.click(screen.getByRole('checkbox', { name: 'request.transaction_dialog.acknowledge_callback_code' }))
      expect(onCallbackAcknowledgedChange).toHaveBeenCalledWith(true)
    })

    // jsdom lays nothing out, so the geometry itself is checked in the browser (see the e2e suite). What can
    // be checked here is the cause: a notice with a negative bottom margin drags whatever follows it up over
    // itself, and the checkbox follows its warning.
    it('should lay the warning and its checkbox out in one group, with no notice pulling the next one over it', () => {
      render(<TransferConfirmView {...props} />)
      const group = screen.getByTestId('transfer-notices')
      const warning = screen.getByTestId('callback-code-warning')
      const checkbox = screen.getByRole('checkbox', { name: 'request.transaction_dialog.acknowledge_callback_code' })
      expect(group).toContainElement(warning)
      expect(group).toContainElement(checkbox)
      for (const notice of Array.from(group.children)) {
        expect(parseFloat(getComputedStyle(notice).marginBottom || '0')).toBeGreaterThanOrEqual(0)
      }
    })

    describe('and the transfer is a gift, which carries a notice of its own', () => {
      beforeEach(() => {
        const nftData: NFTTransferData = {
          imageUrl: 'https://example.com/nft.png',
          tokenId: '1',
          toAddress: transferData.toAddress,
          contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          name: 'Hat',
          description: 'A hat',
          rarity: Rarity.COMMON
        }
        props = { ...props, type: TransferType.GIFT, transferData: nftData }
      })

      it('should keep both notices and the checkbox in the group, none pulling the next over it', () => {
        render(<TransferConfirmView {...props} />)
        const group = screen.getByTestId('transfer-notices')
        expect(group).toContainElement(screen.getByTestId('gifting-warning'))
        expect(group).toContainElement(screen.getByTestId('callback-code-warning'))
        expect(group).toContainElement(screen.getByRole('checkbox', { name: 'request.transaction_dialog.acknowledge_callback_code' }))
        for (const notice of Array.from(group.children)) {
          expect(parseFloat(getComputedStyle(notice).marginBottom || '0')).toBeGreaterThanOrEqual(0)
        }
      })
    })
  })
})
