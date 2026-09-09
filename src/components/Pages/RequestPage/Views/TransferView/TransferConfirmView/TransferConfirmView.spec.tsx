import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransferType } from '../../../types'
import type { MANATransferData } from '../../../types'
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
  let transferData: MANATransferData

  beforeEach(() => {
    onApprove = jest.fn()
    onDeny = jest.fn()
    transferData = {
      manaAmount: '10 MANA',
      toAddress: '0x1234567890abcdef1234567890abcdef12345678',
      sceneName: 'Genesis Plaza',
      sceneImageUrl: 'https://example.com/scene.png'
    }
    props = { type: TransferType.TIP, transferData, isLoading: false, onApprove, onDeny }
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
})
