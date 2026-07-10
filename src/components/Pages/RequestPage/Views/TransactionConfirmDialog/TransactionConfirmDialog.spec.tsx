import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SimulationState } from '../../types'
import { TransactionConfirmDialog } from './TransactionConfirmDialog'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'

describe('when rendering the TransactionConfirmDialog', () => {
  let onCancel: jest.Mock
  let onConfirm: jest.Mock

  beforeEach(() => {
    onCancel = jest.fn()
    onConfirm = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the dialog is closed', () => {
    it('should not render the gas information', () => {
      render(
        <TransactionConfirmDialog
          open={false}
          transactionCost={BigInt(0)}
          balance={BigInt(0)}
          simulation={{ status: 'idle' }}
          userAddress={USER}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      )
      expect(screen.queryByText('request.transaction_dialog.transaction_cost')).not.toBeInTheDocument()
    })
  })

  describe('and the dialog is open', () => {
    it('should render the gas cost and balance lines', () => {
      render(
        <TransactionConfirmDialog
          open
          transactionCost={BigInt(1)}
          balance={BigInt(2)}
          simulation={{ status: 'idle' }}
          userAddress={USER}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      )
      expect(screen.getByText('request.transaction_dialog.transaction_cost')).toBeInTheDocument()
      expect(screen.getByText('request.transaction_dialog.your_balance')).toBeInTheDocument()
    })

    it('should call onConfirm when the confirm button is clicked', async () => {
      render(
        <TransactionConfirmDialog
          open
          transactionCost={BigInt(1)}
          balance={BigInt(2)}
          simulation={{ status: 'idle' }}
          userAddress={USER}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      )
      await userEvent.click(screen.getByText('common.confirm'))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
  })

  describe('and the simulation reports the transaction would revert', () => {
    let simulation: SimulationState

    beforeEach(() => {
      simulation = {
        status: 'ready',
        result: { status: 'reverted', error: 'out of gas', assetChanges: [], approvalChanges: [] }
      }
    })

    it('should surface the revert warning while still allowing confirmation', () => {
      render(
        <TransactionConfirmDialog
          open
          transactionCost={BigInt(1)}
          balance={BigInt(2)}
          simulation={simulation}
          userAddress={USER}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      )
      expect(screen.getByText('request.transaction_dialog.revert_title')).toBeInTheDocument()
      expect(screen.getByText('common.confirm').closest('button')).not.toBeDisabled()
    })
  })

  describe('and gas is covered by a meta-transaction', () => {
    it('should show the gas-covered note instead of the user gas cost', () => {
      render(
        <TransactionConfirmDialog
          open
          transactionCost={BigInt(1000)}
          balance={BigInt(2000)}
          simulation={{ status: 'idle' }}
          userAddress={USER}
          gasCovered
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      )
      expect(screen.getByText('request.transaction_dialog.gas_covered')).toBeInTheDocument()
      expect(screen.queryByText('request.transaction_dialog.transaction_cost')).not.toBeInTheDocument()
    })
  })
})
