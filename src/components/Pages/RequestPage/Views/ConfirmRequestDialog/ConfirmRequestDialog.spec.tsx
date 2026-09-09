import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmRequestDialog } from './ConfirmRequestDialog'
import { ConfirmRequestDialogProps } from './ConfirmRequestDialog.types'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => (values ? `${key} ${JSON.stringify(values)}` : key)
  })
}))

describe('when rendering the ConfirmRequestDialog', () => {
  let onCancel: jest.Mock
  let onConfirm: jest.Mock
  let props: ConfirmRequestDialogProps

  beforeEach(() => {
    onCancel = jest.fn()
    onConfirm = jest.fn()
    props = { open: true, kind: 'transaction', gas: { covered: true }, onCancel, onConfirm }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the dialog is closed', () => {
    beforeEach(() => {
      props = { ...props, open: false }
    })

    it('should render nothing', () => {
      render(<ConfirmRequestDialog {...props} />)
      expect(screen.queryByTestId('confirm-request-dialog')).not.toBeInTheDocument()
    })
  })

  describe('and it confirms a relayed transaction', () => {
    it('should title it as a transaction and say gas is covered', () => {
      render(<ConfirmRequestDialog {...props} />)
      expect(screen.getByText('request.transaction_dialog.title')).toBeInTheDocument()
      expect(screen.getByText('request.transaction_dialog.summary_transaction')).toBeInTheDocument()
      expect(screen.getByTestId('confirm-request-gas')).toHaveTextContent('request.transaction_dialog.gas_covered')
    })

    it('should call onConfirm on the confirm button click', async () => {
      render(<ConfirmRequestDialog {...props} />)
      await userEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('should call onCancel on the cancel button click', async () => {
      render(<ConfirmRequestDialog {...props} />)
      await userEvent.click(screen.getByRole('button', { name: 'common.cancel' }))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('and it confirms a transaction the user pays gas for', () => {
    beforeEach(() => {
      props = { ...props, gas: { covered: false, status: 'ready', cost: BigInt('4200000000000000'), chainId: 137 } }
    })

    it('should show the estimated fee in the native currency', () => {
      render(<ConfirmRequestDialog {...props} />)
      expect(screen.getByTestId('confirm-request-gas')).toHaveTextContent(
        'request.transaction_dialog.fee_estimate {"cost":"0.0042","symbol":"POL"}'
      )
    })
  })

  describe('and the fee could not be estimated', () => {
    beforeEach(() => {
      props = { ...props, gas: { covered: false, status: 'unavailable' } }
    })

    it('should show the fee as unavailable instead of an amount', () => {
      render(<ConfirmRequestDialog {...props} />)
      expect(screen.getByTestId('confirm-request-gas')).toHaveTextContent('request.unverified.fact_fee_unavailable')
    })
  })

  describe('and it confirms a signature', () => {
    beforeEach(() => {
      props = { ...props, kind: 'signature', gas: undefined }
    })

    it('should title it as a signature and show no gas line', () => {
      render(<ConfirmRequestDialog {...props} />)
      expect(screen.getByText('request.transaction_dialog.title_signature')).toBeInTheDocument()
      expect(screen.getByText('request.transaction_dialog.summary_signature')).toBeInTheDocument()
      expect(screen.queryByTestId('confirm-request-gas')).not.toBeInTheDocument()
    })
  })

  describe('and the approval is in flight', () => {
    beforeEach(() => {
      props = { ...props, isLoading: true }
    })

    it('should disable both buttons', () => {
      render(<ConfirmRequestDialog {...props} />)
      // While loading the confirm button shows a spinner instead of its name, so both are read by role alone.
      screen.getAllByRole('button').forEach(button => expect(button).toBeDisabled())
    })
  })
})
