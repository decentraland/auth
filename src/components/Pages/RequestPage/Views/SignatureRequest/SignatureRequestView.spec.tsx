import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SimulationResponseBody } from '../../../../../shared/auth'
import { SignatureRequestView } from './SignatureRequestView'
import { SignatureRequestViewProps } from './SignatureRequest.types'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('../../Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
const CONTRACT = '0xa1c57f48f0deb89f569dfbe6e2b7f46d33606fd4'

const transferResult: SimulationResponseBody = {
  status: 'success',
  assetChanges: [
    {
      type: 'transfer',
      standard: 'erc20',
      from: USER,
      to: '0x1234567890abcdef1234567890abcdef12345678',
      amount: '5',
      rawAmount: '5000000000000000000',
      tokenId: null,
      contractAddress: CONTRACT,
      symbol: 'MANA',
      name: 'MANA',
      decimals: 18,
      logoUrl: null,
      dollarValue: null
    }
  ],
  approvalChanges: [],
  balanceChanges: [],
  events: []
}

describe('when rendering the SignatureRequestView', () => {
  let onApprove: jest.Mock
  let onDeny: jest.Mock
  let baseProps: SignatureRequestViewProps

  beforeEach(() => {
    onApprove = jest.fn()
    onDeny = jest.fn()
    baseProps = {
      requestId: 'r1',
      method: 'eth_signTypedData_v4',
      raw: '{"primaryType":"MetaTransaction"}',
      verifyingContract: CONTRACT,
      functionName: 'transfer',
      contractName: '(PoS) Decentraland MANA',
      simulation: { status: 'ready', result: transferResult },
      userAddress: USER,
      chainId: 137,
      onDeny,
      onApprove
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the simulation is ready', () => {
    it('should render the simulated asset summary instead of the raw payload', () => {
      render(<SignatureRequestView {...baseProps} />)
      expect(screen.getByText('5 MANA')).toBeInTheDocument()
      expect(screen.queryByTestId('signature-raw')).not.toBeInTheDocument()
    })

    it('should name the decoded call and the contract', () => {
      render(<SignatureRequestView {...baseProps} />)
      expect(screen.getByTestId('signature-call')).toHaveTextContent('request.wallet_interaction.calls_function')
    })

    it('should link the verifying contract to the block explorer of its chain', () => {
      render(<SignatureRequestView {...baseProps} />)
      expect(screen.getByRole('link', { name: '0xa1c5…6fd4' })).toHaveAttribute('href', `https://polygonscan.com/address/${CONTRACT}`)
    })

    it('should explain that the signature can be submitted later', () => {
      render(<SignatureRequestView {...baseProps} />)
      expect(screen.getByTestId('signature-meta-tx-notice')).toHaveTextContent('request.signature.meta_tx_notice')
    })

    it('should reveal the raw payload when the raw toggle is clicked', async () => {
      render(<SignatureRequestView {...baseProps} />)
      const toggle = screen.getByText('request.signature.view_raw')
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await userEvent.click(toggle)
      expect(screen.getByTestId('signature-raw')).toHaveTextContent('{"primaryType":"MetaTransaction"}')
      expect(screen.getByText('request.signature.hide_raw')).toHaveAttribute('aria-expanded', 'true')
    })

    it('should approve on a single click when no acknowledgment is required', async () => {
      render(<SignatureRequestView {...baseProps} />)
      await userEvent.click(screen.getByTestId('signature-approve-button'))
      expect(onApprove).toHaveBeenCalledTimes(1)
    })

    it('should call onDeny when the deny button is clicked', async () => {
      render(<SignatureRequestView {...baseProps} />)
      await userEvent.click(screen.getByTestId('signature-deny-button'))
      expect(onDeny).toHaveBeenCalledTimes(1)
    })
  })

  describe('and the simulation is still loading', () => {
    it('should keep approval disabled until it resolves', () => {
      render(<SignatureRequestView {...baseProps} simulation={{ status: 'loading' }} />)
      expect(screen.getByTestId('signature-approve-button')).toBeDisabled()
    })
  })

  describe('and an acknowledgment is required', () => {
    it('should keep approval disabled until the acknowledgment is checked', async () => {
      render(<SignatureRequestView {...baseProps} requiresAcknowledgment />)
      expect(screen.getByTestId('signature-approve-button')).toBeDisabled()
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByTestId('signature-approve-button')).toBeEnabled()
    })

    it('should word the acknowledgment for the granted access when the preview shows changes', () => {
      render(<SignatureRequestView {...baseProps} requiresAcknowledgment />)
      expect(screen.getByText('request.transaction_dialog.acknowledge_risk')).toBeInTheDocument()
    })

    it('should clear the tick when the request changes', async () => {
      const { rerender } = render(<SignatureRequestView {...baseProps} requiresAcknowledgment />)
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByTestId('signature-approve-button')).toBeEnabled()
      rerender(<SignatureRequestView {...baseProps} requestId="r2" requiresAcknowledgment />)
      expect(screen.getByRole('checkbox')).not.toBeChecked()
      expect(screen.getByTestId('signature-approve-button')).toBeDisabled()
    })
  })

  describe('and the preview is unavailable', () => {
    it('should word the acknowledgment for effects that could not be verified', () => {
      render(<SignatureRequestView {...baseProps} simulation={{ status: 'unavailable' }} requiresAcknowledgment />)
      expect(screen.getByText('request.signature.acknowledge_unverified')).toBeInTheDocument()
    })
  })

  describe('and the inner call reverts', () => {
    let revertedResult: SimulationResponseBody

    beforeEach(() => {
      revertedResult = { ...transferResult, status: 'reverted', error: 'Trade not effective yet', assetChanges: [] }
    })

    it('should explain that the action fails right now', () => {
      render(<SignatureRequestView {...baseProps} simulation={{ status: 'ready', result: revertedResult }} requiresAcknowledgment />)
      expect(screen.getByTestId('signature-meta-tx-reverted')).toBeInTheDocument()
    })

    it('should word the acknowledgment for effects that could not be verified', () => {
      render(<SignatureRequestView {...baseProps} simulation={{ status: 'ready', result: revertedResult }} requiresAcknowledgment />)
      expect(screen.getByText('request.signature.acknowledge_unverified')).toBeInTheDocument()
    })
  })

  describe('and the preview shows no visible effects', () => {
    let emptyResult: SimulationResponseBody

    beforeEach(() => {
      emptyResult = { ...transferResult, assetChanges: [] }
    })

    it('should word the acknowledgment for a call whose effects the preview cannot show', () => {
      render(<SignatureRequestView {...baseProps} simulation={{ status: 'ready', result: emptyResult }} requiresAcknowledgment />)
      expect(screen.getByText('request.transaction_dialog.acknowledge_no_visible_effects')).toBeInTheDocument()
    })
  })
})
