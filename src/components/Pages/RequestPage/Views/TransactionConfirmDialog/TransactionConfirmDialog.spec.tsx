import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransactionConfirmDialog } from './TransactionConfirmDialog'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

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
        <TransactionConfirmDialog open={false} transactionCost={BigInt(0)} balance={BigInt(0)} onCancel={onCancel} onConfirm={onConfirm} />
      )
      expect(screen.queryByText('request.transaction_dialog.transaction_cost')).not.toBeInTheDocument()
    })
  })

  describe('and the dialog is open', () => {
    it('should render the gas cost and balance lines', () => {
      render(<TransactionConfirmDialog open transactionCost={BigInt(1)} balance={BigInt(2)} onCancel={onCancel} onConfirm={onConfirm} />)
      expect(screen.getByText('request.transaction_dialog.transaction_cost')).toBeInTheDocument()
      expect(screen.getByText('request.transaction_dialog.your_balance')).toBeInTheDocument()
    })

    it('should not render the asset-change summary (it lives on the interaction screen)', () => {
      render(<TransactionConfirmDialog open transactionCost={BigInt(1)} balance={BigInt(2)} onCancel={onCancel} onConfirm={onConfirm} />)
      expect(screen.queryByText('request.transaction_dialog.you_send')).not.toBeInTheDocument()
    })

    it('should call onConfirm when the confirm button is clicked', async () => {
      render(<TransactionConfirmDialog open transactionCost={BigInt(1)} balance={BigInt(2)} onCancel={onCancel} onConfirm={onConfirm} />)
      await userEvent.click(screen.getByText('common.confirm'))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
  })

  describe('and the transaction is expected to revert', () => {
    it('should keep the confirm button enabled but visually flagged', () => {
      render(
        <TransactionConfirmDialog
          open
          transactionCost={BigInt(1)}
          balance={BigInt(2)}
          isReverted
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      )
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
