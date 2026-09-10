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
  let onAcknowledgedChange: jest.Mock
  let props: SignatureRequestViewProps

  beforeEach(() => {
    onApprove = jest.fn()
    onDeny = jest.fn()
    onAcknowledgedChange = jest.fn()
    props = {
      requestId: 'r1',
      method: 'eth_signTypedData_v4',
      raw: '{"primaryType":"MetaTransaction"}',
      verifyingContract: CONTRACT,
      functionName: 'transfer',
      contractName: '(PoS) Decentraland MANA',
      simulation: { status: 'ready', result: transferResult },
      userAddress: USER,
      chainId: 137,
      approveBlocked: false,
      onAcknowledgedChange,
      onDeny,
      onApprove
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the simulation is ready', () => {
    it('should render the simulated asset summary instead of the raw payload', () => {
      render(<SignatureRequestView {...props} />)
      expect(screen.getByText('5 MANA')).toBeInTheDocument()
      expect(screen.queryByTestId('signature-raw')).not.toBeInTheDocument()
    })

    it('should name the decoded call and the contract', () => {
      render(<SignatureRequestView {...props} />)
      expect(screen.getByTestId('signature-call')).toHaveTextContent('request.wallet_interaction.calls_function')
    })

    it('should link the verifying contract to the block explorer of its chain', () => {
      render(<SignatureRequestView {...props} />)
      expect(screen.getByRole('link', { name: '0xa1c5…6fd4' })).toHaveAttribute('href', `https://polygonscan.com/address/${CONTRACT}`)
    })

    it('should explain that the signature can be submitted later', () => {
      render(<SignatureRequestView {...props} />)
      expect(screen.getByTestId('signature-meta-tx-notice')).toHaveTextContent('request.signature.meta_tx_notice')
    })

    it('should reveal the raw payload on the raw toggle click', async () => {
      render(<SignatureRequestView {...props} />)
      expect(screen.getByText('request.signature.view_raw')).toHaveAttribute('aria-expanded', 'false')
      await userEvent.click(screen.getByText('request.signature.view_raw'))
      expect(screen.getByTestId('signature-raw')).toHaveTextContent('"primaryType": "MetaTransaction"')
      expect(screen.getByText('request.signature.hide_raw')).toHaveAttribute('aria-expanded', 'true')
    })

    it('should approve on a single click without an acknowledgment', async () => {
      render(<SignatureRequestView {...props} />)
      await userEvent.click(screen.getByTestId('signature-approve-button'))
      expect(onApprove).toHaveBeenCalledTimes(1)
    })

    it('should call onDeny on the deny button click', async () => {
      render(<SignatureRequestView {...props} />)
      await userEvent.click(screen.getByTestId('signature-deny-button'))
      expect(onDeny).toHaveBeenCalledTimes(1)
    })
  })

  describe('and the page reports the review is not actionable', () => {
    beforeEach(() => {
      props = { ...props, approveBlocked: true }
    })

    it('should keep approval disabled, whatever it can see of the preview itself', () => {
      render(<SignatureRequestView {...props} />)
      expect(screen.getByTestId('signature-approve-button')).toBeDisabled()
    })

    it('should still offer Deny', () => {
      render(<SignatureRequestView {...props} />)
      expect(screen.getByTestId('signature-deny-button')).toBeEnabled()
    })
  })

  describe('and code could be deployed before the signature is submitted', () => {
    let onDeferredCallbackAcknowledgedChange: jest.Mock

    beforeEach(() => {
      onDeferredCallbackAcknowledgedChange = jest.fn()
      props = {
        ...props,
        deferredCallbackAddresses: ['0x1234567890abcdef1234567890abcdef12345678'],
        onDeferredCallbackAcknowledgedChange,
        approveBlocked: true
      }
    })

    it('should explain the limitation and render an unchecked risk checkbox', () => {
      render(<SignatureRequestView {...props} />)
      expect(screen.getByTestId('signature-deferred-callback-notice')).toHaveTextContent('request.transaction_dialog.callback_code_notice')
      expect(screen.getByRole('checkbox', { name: 'request.transaction_dialog.acknowledge_callback_code' })).not.toBeChecked()
      expect(screen.getByRole('button', { name: 'common.allow' })).toBeDisabled()
    })

    it('should send explicit consent to the page', async () => {
      render(<SignatureRequestView {...props} />)
      await userEvent.click(screen.getByRole('checkbox', { name: 'request.transaction_dialog.acknowledge_callback_code' }))
      expect(onDeferredCallbackAcknowledgedChange).toHaveBeenCalledWith(true)
      expect(onAcknowledgedChange).not.toHaveBeenCalled()
    })

    describe('and another risk also needs acknowledgment', () => {
      beforeEach(() => {
        props = { ...props, requiresAcknowledgment: true, acknowledged: true }
      })

      it('should keep the callback acknowledgment separate and unchecked', () => {
        render(<SignatureRequestView {...props} />)
        expect(screen.getByRole('checkbox', { name: 'request.transaction_dialog.acknowledge_risk' })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'request.transaction_dialog.acknowledge_callback_code' })).not.toBeChecked()
      })
    })
  })

  describe('and an acknowledgment is required', () => {
    beforeEach(() => {
      props = { ...props, requiresAcknowledgment: true }
    })

    it('should report a tick to the page rather than decide for itself what it enables', async () => {
      render(<SignatureRequestView {...props} />)

      await userEvent.click(screen.getByRole('checkbox'))

      expect(onAcknowledgedChange).toHaveBeenCalledWith(true)
    })

    it('should render the checkbox from what the page says was acknowledged', () => {
      render(<SignatureRequestView {...{ ...props, acknowledged: true }} />)
      expect(screen.getByRole('checkbox')).toBeChecked()
    })

    it('should word the acknowledgment for the granted access since the preview shows changes', () => {
      render(<SignatureRequestView {...props} />)
      expect(screen.getByText('request.transaction_dialog.acknowledge_risk')).toBeInTheDocument()
    })

    describe('and the preview is unavailable', () => {
      beforeEach(() => {
        props = { ...props, simulation: { status: 'unavailable' } }
      })

      it('should word the acknowledgment for effects that could not be verified', () => {
        render(<SignatureRequestView {...props} />)
        expect(screen.getByText('request.signature.acknowledge_unverified')).toBeInTheDocument()
      })
    })

    describe('and the inner call reverts', () => {
      beforeEach(() => {
        props = {
          ...props,
          simulation: {
            status: 'ready',
            result: { ...transferResult, status: 'reverted', error: 'Trade not effective yet', assetChanges: [] }
          }
        }
      })

      it('should explain that the action fails right now', () => {
        render(<SignatureRequestView {...props} />)
        expect(screen.getByTestId('signature-meta-tx-reverted')).toBeInTheDocument()
      })

      it('should word the acknowledgment for effects that could not be verified', () => {
        render(<SignatureRequestView {...props} />)
        expect(screen.getByText('request.signature.acknowledge_unverified')).toBeInTheDocument()
      })
    })

    describe('and the preview shows no visible effects', () => {
      beforeEach(() => {
        props = { ...props, simulation: { status: 'ready', result: { ...transferResult, assetChanges: [] } } }
      })

      it('should word the acknowledgment for a call whose effects the preview cannot show', () => {
        render(<SignatureRequestView {...props} />)
        expect(screen.getByText('request.transaction_dialog.acknowledge_no_visible_effects')).toBeInTheDocument()
      })
    })
  })
})
