import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SimulationResponseBody } from '../../../../../shared/auth'
import { SignaturePayload, SimulationState } from '../../types'
import { SignatureRequestView } from './SignatureRequestView'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('../../Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'

describe('when rendering the SignatureRequestView', () => {
  let onApprove: jest.Mock
  let onDeny: jest.Mock

  beforeEach(() => {
    onApprove = jest.fn()
    onDeny = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the payload is a plain message', () => {
    let payload: SignaturePayload

    beforeEach(() => {
      payload = { kind: 'message', message: 'Sign in to Decentraland' }
    })

    it('should render the message text', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="personal_sign"
          payload={payload}
          simulation={{ status: 'idle' }}
          userAddress={USER}
          isMetaTransaction={false}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByTestId('signature-message')).toHaveTextContent('Sign in to Decentraland')
    })

    it('should call onApprove when the approve button is clicked', async () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="personal_sign"
          payload={payload}
          simulation={{ status: 'idle' }}
          userAddress={USER}
          isMetaTransaction={false}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      await userEvent.click(screen.getByTestId('signature-approve-button'))
      expect(onApprove).toHaveBeenCalledTimes(1)
    })

    describe('and the message is not readable text', () => {
      let opaquePayload: SignaturePayload

      beforeEach(() => {
        opaquePayload = { kind: 'message', message: `0x${'ab'.repeat(32)}` }
      })

      it('should warn that the message cannot be checked', () => {
        render(
          <SignatureRequestView
            requestId="r1"
            method="personal_sign"
            payload={opaquePayload}
            simulation={{ status: 'idle' }}
            userAddress={USER}
            isMetaTransaction={false}
            unverifiableReason="opaque_message"
            requiresAcknowledgment
            onDeny={onDeny}
            onApprove={onApprove}
          />
        )
        expect(screen.getByTestId('signature-unverifiable-notice')).toHaveTextContent('request.signature.opaque_message')
      })

      it('should keep approval disabled until the user acknowledges it', async () => {
        render(
          <SignatureRequestView
            requestId="r1"
            method="personal_sign"
            payload={opaquePayload}
            simulation={{ status: 'idle' }}
            userAddress={USER}
            isMetaTransaction={false}
            unverifiableReason="opaque_message"
            requiresAcknowledgment
            onDeny={onDeny}
            onApprove={onApprove}
          />
        )
        expect(screen.getByTestId('signature-approve-button')).toBeDisabled()
        await userEvent.click(screen.getByTestId('risk-acknowledgment'))
        expect(screen.getByTestId('signature-approve-button')).toBeEnabled()
      })
    })

    it('should gate approval behind the acknowledgment when required', async () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="personal_sign"
          payload={payload}
          simulation={{ status: 'idle' }}
          userAddress={USER}
          isMetaTransaction={false}
          requiresAcknowledgment
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByTestId('signature-approve-button')).toBeDisabled()
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByTestId('signature-approve-button')).not.toBeDisabled()
    })
  })

  describe('and the payload is typed data that is not a meta-transaction', () => {
    let payload: SignaturePayload

    beforeEach(() => {
      payload = {
        kind: 'typedData',
        raw: '{}',
        typedData: {
          primaryType: 'Order',
          domain: { name: 'Marketplace', chainId: 137, verifyingContract: '0x480a0f4e360e8964e68858dd231c2922f1df45ef' },
          message: { price: '1000000000000000000' }
        }
      }
    })

    it('should render the verifying contract shortened', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={{ status: 'idle' }}
          userAddress={USER}
          isMetaTransaction={false}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByText('0x480a…45ef')).toBeInTheDocument()
    })

    describe('and Auth does not recognize the struct', () => {
      it('should explain that it cannot preview what the signature authorizes', () => {
        render(
          <SignatureRequestView
            requestId="r1"
            method="eth_signTypedData_v4"
            payload={payload}
            simulation={{ status: 'idle' }}
            userAddress={USER}
            isMetaTransaction={false}
            unverifiableReason="unrecognized_typed_data"
            requiresAcknowledgment
            onDeny={onDeny}
            onApprove={onApprove}
          />
        )
        expect(screen.getByTestId('signature-unverifiable-notice')).toHaveTextContent('request.signature.unrecognized_typed_data')
      })

      it('should ask the user to acknowledge unverified effects rather than an approval', () => {
        render(
          <SignatureRequestView
            requestId="r1"
            method="eth_signTypedData_v4"
            payload={payload}
            simulation={{ status: 'idle' }}
            userAddress={USER}
            isMetaTransaction={false}
            unverifiableReason="unrecognized_typed_data"
            requiresAcknowledgment
            onDeny={onDeny}
            onApprove={onApprove}
          />
        )
        expect(screen.getByText('request.signature.acknowledge_unverified')).toBeInTheDocument()
      })
    })

    it('should not show an unverifiable notice when the struct is recognized', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={{ status: 'idle' }}
          userAddress={USER}
          isMetaTransaction={false}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.queryByTestId('signature-unverifiable-notice')).not.toBeInTheDocument()
    })

    it('should not show the meta-transaction notice', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={{ status: 'idle' }}
          userAddress={USER}
          isMetaTransaction={false}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.queryByTestId('signature-meta-tx-notice')).not.toBeInTheDocument()
    })

    it('should render the typed-data message fields as a tree', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={{ status: 'idle' }}
          userAddress={USER}
          isMetaTransaction={false}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByText('price:')).toBeInTheDocument()
    })
  })

  describe('and the payload is a meta-transaction with a ready simulation', () => {
    let payload: SignaturePayload
    let simulation: SimulationState

    beforeEach(() => {
      payload = {
        kind: 'typedData',
        raw: '{"primaryType":"MetaTransaction"}',
        typedData: { primaryType: 'MetaTransaction', domain: {}, message: {} }
      }
      const result: SimulationResponseBody = {
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
            contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
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
      simulation = { status: 'ready', result }
    })

    it('should render the simulated asset summary instead of the raw payload', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={simulation}
          userAddress={USER}
          isMetaTransaction={true}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByText('5 MANA')).toBeInTheDocument()
      expect(screen.queryByTestId('signature-raw')).not.toBeInTheDocument()
    })

    it('should reveal the raw payload when the raw toggle is clicked', async () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={simulation}
          userAddress={USER}
          isMetaTransaction={true}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      const toggle = screen.getByText('request.signature.view_raw')
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await userEvent.click(toggle)
      expect(screen.getByTestId('signature-raw')).toBeInTheDocument()
      expect(screen.getByText('request.signature.hide_raw')).toHaveAttribute('aria-expanded', 'true')
    })

    it('should keep approval disabled while the meta-transaction simulation is loading', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={{ status: 'loading' }}
          userAddress={USER}
          isMetaTransaction={true}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByTestId('signature-approve-button')).toBeDisabled()
    })

    it('should explain that the signature is a bearer authorization the requester can submit later', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={simulation}
          userAddress={USER}
          isMetaTransaction={true}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByTestId('signature-meta-tx-notice')).toHaveTextContent('request.signature.meta_tx_notice')
    })

    describe('and the acknowledgment wording changes after the user ticked it', () => {
      it('should ask again instead of carrying the tick over to the new statement', async () => {
        const { rerender } = render(
          <SignatureRequestView
            requestId="r1"
            method="eth_signTypedData_v4"
            payload={payload}
            simulation={simulation}
            userAddress={USER}
            isMetaTransaction={true}
            contractTrust="pending"
            requiresAcknowledgment
            onDeny={onDeny}
            onApprove={onApprove}
          />
        )
        await userEvent.click(screen.getByRole('checkbox'))
        expect(screen.getByRole('checkbox')).toBeChecked()
        rerender(
          <SignatureRequestView
            requestId="r1"
            method="eth_signTypedData_v4"
            payload={payload}
            simulation={simulation}
            userAddress={USER}
            isMetaTransaction={true}
            contractTrust="unconfirmed"
            requiresAcknowledgment
            onDeny={onDeny}
            onApprove={onApprove}
          />
        )
        expect(screen.getByRole('checkbox')).not.toBeChecked()
      })
    })

    it('should keep approval disabled while the contract is still being recognized', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={simulation}
          userAddress={USER}
          isMetaTransaction={true}
          contractTrust="pending"
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByTestId('signature-approve-button')).toBeDisabled()
    })

    it('should not warn about the contract when it is a recognized Decentraland contract', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={simulation}
          userAddress={USER}
          isMetaTransaction={true}
          contractTrust="confirmed"
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.queryByTestId('signature-meta-tx-unrecognized-contract')).not.toBeInTheDocument()
    })

    it('should not mention a revert when the simulated call succeeds', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={simulation}
          userAddress={USER}
          isMetaTransaction={true}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.queryByTestId('signature-meta-tx-reverted')).not.toBeInTheDocument()
    })

    describe('and an acknowledgment is required for a dangerous approval', () => {
      it('should use the approval acknowledgment label', () => {
        render(
          <SignatureRequestView
            requestId="r1"
            method="eth_signTypedData_v4"
            payload={payload}
            simulation={simulation}
            userAddress={USER}
            isMetaTransaction={true}
            requiresAcknowledgment
            onDeny={onDeny}
            onApprove={onApprove}
          />
        )
        expect(screen.getByText('request.transaction_dialog.acknowledge_risk')).toBeInTheDocument()
      })
    })
  })

  describe('and the payload is a meta-transaction whose simulated call reverts', () => {
    let payload: SignaturePayload
    let simulation: SimulationState

    beforeEach(() => {
      payload = {
        kind: 'typedData',
        raw: '{"primaryType":"MetaTransaction"}',
        typedData: { primaryType: 'MetaTransaction', domain: {}, message: {} }
      }
      const result: SimulationResponseBody = {
        status: 'reverted',
        error: 'Trade not effective yet',
        assetChanges: [],
        approvalChanges: [],
        balanceChanges: [],
        events: []
      }
      simulation = { status: 'ready', result }
    })

    it('should warn that the effects could not be previewed because the call fails today', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={simulation}
          userAddress={USER}
          isMetaTransaction={true}
          requiresAcknowledgment
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByTestId('signature-meta-tx-reverted')).toHaveTextContent('request.signature.meta_tx_reverted')
    })

    it('should ask the user to acknowledge unverified effects rather than an approval', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={simulation}
          userAddress={USER}
          isMetaTransaction={true}
          requiresAcknowledgment
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByText('request.signature.acknowledge_unverified')).toBeInTheDocument()
    })

    it('should keep approval disabled until the unverified effects are acknowledged', async () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={simulation}
          userAddress={USER}
          isMetaTransaction={true}
          requiresAcknowledgment
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByTestId('signature-approve-button')).toBeDisabled()
      await userEvent.click(screen.getByTestId('risk-acknowledgment'))
      expect(screen.getByTestId('signature-approve-button')).toBeEnabled()
    })
  })

  describe('and the payload is a meta-transaction to a contract that is not a recognized Decentraland contract', () => {
    let payload: SignaturePayload
    let simulation: SimulationState

    beforeEach(() => {
      payload = {
        kind: 'typedData',
        raw: '{"primaryType":"MetaTransaction"}',
        typedData: { primaryType: 'MetaTransaction', domain: {}, message: {} }
      }
      simulation = { status: 'ready', result: { status: 'success', assetChanges: [], approvalChanges: [], balanceChanges: [], events: [] } }
    })

    it('should warn that Decentraland cannot vouch for the contract', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={simulation}
          userAddress={USER}
          isMetaTransaction={true}
          contractTrust="unconfirmed"
          requiresAcknowledgment
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByTestId('signature-meta-tx-unrecognized-contract')).toHaveTextContent(
        'request.signature.meta_tx_unrecognized_contract'
      )
    })

    it('should ask the user to acknowledge unverified effects', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={simulation}
          userAddress={USER}
          isMetaTransaction={true}
          contractTrust="unconfirmed"
          requiresAcknowledgment
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByText('request.signature.acknowledge_unverified')).toBeInTheDocument()
    })

    it('should keep approval disabled until acknowledged', async () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={simulation}
          userAddress={USER}
          isMetaTransaction={true}
          contractTrust="unconfirmed"
          requiresAcknowledgment
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByTestId('signature-approve-button')).toBeDisabled()
      await userEvent.click(screen.getByTestId('risk-acknowledgment'))
      expect(screen.getByTestId('signature-approve-button')).toBeEnabled()
    })
  })

  describe('and the payload is a meta-transaction whose simulation is unavailable', () => {
    let payload: SignaturePayload

    beforeEach(() => {
      payload = {
        kind: 'typedData',
        raw: '{"primaryType":"MetaTransaction"}',
        typedData: { primaryType: 'MetaTransaction', domain: {}, message: {} }
      }
    })

    it('should ask the user to acknowledge unverified effects', () => {
      render(
        <SignatureRequestView
          requestId="r1"
          method="eth_signTypedData_v4"
          payload={payload}
          simulation={{ status: 'unavailable' }}
          userAddress={USER}
          isMetaTransaction={true}
          requiresAcknowledgment
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByText('request.signature.acknowledge_unverified')).toBeInTheDocument()
    })
  })
})
