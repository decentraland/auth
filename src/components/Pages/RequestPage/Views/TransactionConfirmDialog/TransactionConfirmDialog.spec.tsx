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
      render(<TransactionConfirmDialog open={false} onCancel={onCancel} onConfirm={onConfirm} />)
      expect(screen.queryByText('request.transaction_dialog.gas_covered')).not.toBeInTheDocument()
    })
  })

  describe('and the dialog is open', () => {
    it('should say that gas is covered by Decentraland', () => {
      render(<TransactionConfirmDialog open onCancel={onCancel} onConfirm={onConfirm} />)
      expect(screen.getByText('request.transaction_dialog.gas_covered')).toBeInTheDocument()
    })

    it('should call onConfirm when the confirm button is clicked', async () => {
      render(<TransactionConfirmDialog open onCancel={onCancel} onConfirm={onConfirm} />)
      await userEvent.click(screen.getByText('common.confirm'))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('should call onCancel when the cancel button is clicked', async () => {
      render(<TransactionConfirmDialog open onCancel={onCancel} onConfirm={onConfirm} />)
      await userEvent.click(screen.getByText('common.cancel'))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('and the approval is in flight', () => {
    it('should disable both buttons', () => {
      render(<TransactionConfirmDialog open isLoading onCancel={onCancel} onConfirm={onConfirm} />)
      expect(screen.getByText('common.cancel').closest('button')).toBeDisabled()
      expect(screen.getByRole('button', { name: '' })).toBeDisabled()
    })
  })
})
