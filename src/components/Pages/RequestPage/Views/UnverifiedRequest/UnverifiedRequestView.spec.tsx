import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnverifiedRequestView } from './UnverifiedRequestView'
import { UnverifiedRequestViewProps } from './UnverifiedRequest.types'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => (values ? `${key} ${JSON.stringify(values)}` : key)
  })
}))

// Container renders the WebGL AnimatedBackground, which jsdom can't run.
jest.mock('../../Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
const CONTRACT = '0x1234567890abcdef1234567890abcdef12345678'

describe('when rendering the UnverifiedRequestView', () => {
  let onDeny: jest.Mock
  let onApprove: jest.Mock
  let transactionProps: UnverifiedRequestViewProps

  beforeEach(() => {
    onDeny = jest.fn()
    onApprove = jest.fn()
    transactionProps = {
      requestId: 'r1',
      kind: 'unknown_transaction',
      method: 'eth_sendTransaction',
      targetAddress: CONTRACT,
      chainId: 137,
      nativeValue: '0x0',
      gas: { status: 'ready', cost: BigInt('4200000000000000') },
      balance: BigInt('1500000000000000000'),
      payload: { kind: 'transaction', to: CONTRACT, data: '0x095ea7b3', value: '0x0' },
      payloadFingerprint: `${CONTRACT}|0x095ea7b3|0x0|137`,
      onDeny,
      onApprove
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the request is a transaction to an unknown contract', () => {
    it('should title it as a transaction and say Decentraland cannot check it', () => {
      render(<UnverifiedRequestView {...transactionProps} />)
      expect(screen.getByText('request.unverified.title_transaction')).toBeInTheDocument()
      expect(screen.getByTestId('unverified-intro')).toHaveTextContent('request.unverified.intro_transaction')
    })

    it('should list the transaction warnings', () => {
      render(<UnverifiedRequestView {...transactionProps} />)
      const warnings = screen.getByTestId('unverified-warnings')
      expect(warnings).toHaveTextContent('request.unverified.warning_transaction_assets')
      expect(warnings).toHaveTextContent('request.unverified.warning_transaction_final')
      expect(warnings).toHaveTextContent('request.unverified.trust_scene')
    })

    it('should link the contract to the block explorer of its chain', () => {
      render(<UnverifiedRequestView {...transactionProps} />)
      expect(screen.getByRole('link', { name: '0x1234…5678' })).toHaveAttribute('href', `https://polygonscan.com/address/${CONTRACT}`)
    })

    it('should show the estimated fee in the native currency', () => {
      render(<UnverifiedRequestView {...transactionProps} />)
      expect(screen.getByTestId('unverified-fee')).toHaveTextContent('0.0042 POL')
    })

    it('should not show an amount when no value is attached', () => {
      render(<UnverifiedRequestView {...transactionProps} />)
      expect(screen.queryByTestId('unverified-amount')).not.toBeInTheDocument()
    })

    it('should keep Allow disabled until the acknowledgment is ticked', async () => {
      render(<UnverifiedRequestView {...transactionProps} />)
      expect(screen.getByTestId('unverified-approve-button')).toBeDisabled()
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByTestId('unverified-approve-button')).toBeEnabled()
    })

    it('should keep Deny enabled at all times', () => {
      render(<UnverifiedRequestView {...transactionProps} />)
      expect(screen.getByTestId('unverified-deny-button')).toBeEnabled()
    })

    it('should call onApprove once ticked and clicked', async () => {
      render(<UnverifiedRequestView {...transactionProps} />)
      await userEvent.click(screen.getByRole('checkbox'))
      await userEvent.click(screen.getByTestId('unverified-approve-button'))
      expect(onApprove).toHaveBeenCalledTimes(1)
    })

    describe('and the Advanced tab is opened', () => {
      it('should show the exact to, value and data the wallet will send', async () => {
        render(<UnverifiedRequestView {...transactionProps} />)
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.getByTestId('unverified-raw-to')).toHaveTextContent(CONTRACT)
        expect(screen.getByTestId('unverified-raw-value')).toHaveTextContent('0x0')
        expect(screen.getByTestId('unverified-raw-data')).toHaveTextContent('0x095ea7b3')
      })

      it('should hide the summary facts', async () => {
        render(<UnverifiedRequestView {...transactionProps} />)
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.queryByTestId('unverified-summary')).not.toBeInTheDocument()
      })
    })

    describe('and a value is attached', () => {
      it('should show the amount in the native currency', () => {
        render(<UnverifiedRequestView {...transactionProps} nativeValue="0xde0b6b3a7640000" />)
        expect(screen.getByTestId('unverified-amount')).toHaveTextContent('1 POL')
      })
    })

    describe('and the fee is still being estimated', () => {
      it('should keep Allow disabled even after the acknowledgment is ticked', async () => {
        render(<UnverifiedRequestView {...transactionProps} gas={{ status: 'loading' }} />)
        await userEvent.click(screen.getByRole('checkbox'))
        expect(screen.getByTestId('unverified-fee')).toHaveTextContent('request.unverified.fact_fee_loading')
        expect(screen.getByTestId('unverified-approve-button')).toBeDisabled()
      })
    })

    describe('and the fee could not be estimated', () => {
      it('should say so and let the acknowledgment enable Allow', async () => {
        render(<UnverifiedRequestView {...transactionProps} gas={{ status: 'unavailable' }} />)
        expect(screen.getByTestId('unverified-fee')).toHaveTextContent('request.unverified.fact_fee_unavailable')
        await userEvent.click(screen.getByRole('checkbox'))
        expect(screen.getByTestId('unverified-approve-button')).toBeEnabled()
      })
    })

    describe('and the payload changes after the user ticked the acknowledgment', () => {
      it('should clear the tick in the same render', async () => {
        const { rerender } = render(<UnverifiedRequestView {...transactionProps} />)
        await userEvent.click(screen.getByRole('checkbox'))
        expect(screen.getByTestId('unverified-approve-button')).toBeEnabled()
        rerender(<UnverifiedRequestView {...transactionProps} payloadFingerprint="other" />)
        expect(screen.getByRole('checkbox')).not.toBeChecked()
        expect(screen.getByTestId('unverified-approve-button')).toBeDisabled()
      })
    })

    describe('and the request id changes after the user ticked the acknowledgment', () => {
      it('should clear the tick in the same render', async () => {
        const { rerender } = render(<UnverifiedRequestView {...transactionProps} />)
        await userEvent.click(screen.getByRole('checkbox'))
        rerender(<UnverifiedRequestView {...transactionProps} requestId="r2" />)
        expect(screen.getByRole('checkbox')).not.toBeChecked()
      })
    })

    describe('and the review replaced one invalidated by a network change', () => {
      it('should tell the user why the page reloaded', () => {
        render(<UnverifiedRequestView {...transactionProps} reviewRestarted />)
        expect(screen.getByTestId('review-restarted-notice')).toBeInTheDocument()
      })
    })
  })

  describe('and the request is a plain value transfer', () => {
    let transferProps: UnverifiedRequestViewProps

    beforeEach(() => {
      transferProps = {
        ...transactionProps,
        kind: 'native_transfer',
        targetAddress: USER,
        targetIsSelf: true,
        nativeValue: '0x6f05b59d3b20000',
        payload: { kind: 'transaction', to: USER, data: '0x', value: '0x6f05b59d3b20000' }
      }
    })

    it('should say what is sent and to whom', () => {
      render(<UnverifiedRequestView {...transferProps} />)
      expect(screen.getByTestId('unverified-intro')).toHaveTextContent(
        'request.unverified.intro_native_transfer {"amount":"0.5","symbol":"POL"}'
      )
    })

    it('should label the recipient as the user own address', () => {
      render(<UnverifiedRequestView {...transferProps} />)
      expect(screen.getByText('(request.unverified.your_own_address)')).toBeInTheDocument()
    })

    it('should word the acknowledgment with the amount', () => {
      render(<UnverifiedRequestView {...transferProps} />)
      expect(screen.getByText('request.unverified.acknowledge_native_transfer {"amount":"0.5","symbol":"POL"}')).toBeInTheDocument()
    })

    it('should not warn about moving other assets', () => {
      render(<UnverifiedRequestView {...transferProps} />)
      expect(screen.getByTestId('unverified-warnings')).not.toHaveTextContent('request.unverified.warning_transaction_assets')
    })
  })

  describe('and the request is a MetaTransaction Decentraland cannot vouch for', () => {
    let metaTxProps: UnverifiedRequestViewProps

    beforeEach(() => {
      metaTxProps = {
        requestId: 'r1',
        kind: 'unknown_meta_transaction',
        method: 'eth_signTypedData_v4',
        targetAddress: CONTRACT,
        chainId: 137,
        payload: { kind: 'typed_data', raw: '{"primaryType":"MetaTransaction"}', calldata: '0xa9059cbb', digest: '0xd1ge57' },
        payloadFingerprint: '{"primaryType":"MetaTransaction"}',
        onDeny,
        onApprove
      }
    })

    it('should title it as a signature and list the meta-transaction warnings', () => {
      render(<UnverifiedRequestView {...metaTxProps} />)
      expect(screen.getByText('request.unverified.title_signature')).toBeInTheDocument()
      const warnings = screen.getByTestId('unverified-warnings')
      expect(warnings).toHaveTextContent('request.unverified.warning_meta_tx_no_expiry')
      expect(warnings).toHaveTextContent('request.unverified.warning_meta_tx_bearer')
      expect(warnings).toHaveTextContent('request.unverified.warning_meta_tx_unknown_call')
      expect(warnings).toHaveTextContent('request.unverified.warning_meta_tx_no_preview')
    })

    it('should not ask for a fee because signatures are gasless', () => {
      render(<UnverifiedRequestView {...metaTxProps} />)
      expect(screen.queryByTestId('unverified-fee')).not.toBeInTheDocument()
    })

    it('should enable Allow on the acknowledgment alone', async () => {
      render(<UnverifiedRequestView {...metaTxProps} />)
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByTestId('unverified-approve-button')).toBeEnabled()
    })

    describe('and the Advanced tab is opened', () => {
      it('should show the typed data verbatim, the inner call and the digest', async () => {
        render(<UnverifiedRequestView {...metaTxProps} />)
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.getByTestId('unverified-raw-typed-data')).toHaveTextContent('{"primaryType":"MetaTransaction"}')
        expect(screen.getByTestId('unverified-raw-calldata')).toHaveTextContent('0xa9059cbb')
        expect(screen.getByTestId('unverified-raw-digest')).toHaveTextContent('0xd1ge57')
      })
    })
  })

  describe('and the request is typed data that is not a MetaTransaction', () => {
    let typedDataProps: UnverifiedRequestViewProps

    beforeEach(() => {
      typedDataProps = {
        requestId: 'r1',
        kind: 'unknown_typed_data',
        method: 'eth_signTypedData_v4',
        payload: { kind: 'typed_data', raw: '{"primaryType":"Permit"}', calldata: null, digest: null },
        payloadFingerprint: '{"primaryType":"Permit"}',
        onDeny,
        onApprove
      }
    })

    it('should list the signature warnings', () => {
      render(<UnverifiedRequestView {...typedDataProps} />)
      const warnings = screen.getByTestId('unverified-warnings')
      expect(warnings).toHaveTextContent('request.unverified.warning_signature_login')
      expect(warnings).toHaveTextContent('request.unverified.warning_signature_orders')
      expect(warnings).toHaveTextContent('request.unverified.warning_signature_unverifiable')
    })

    it('should show the method being used', () => {
      render(<UnverifiedRequestView {...typedDataProps} />)
      expect(screen.getByText('eth_signTypedData_v4')).toBeInTheDocument()
    })

    describe('and the Advanced tab is opened', () => {
      it('should show the JSON verbatim without a call or a digest block', async () => {
        render(<UnverifiedRequestView {...typedDataProps} />)
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.getByTestId('unverified-raw-typed-data')).toHaveTextContent('{"primaryType":"Permit"}')
        expect(screen.queryByTestId('unverified-raw-calldata')).not.toBeInTheDocument()
        expect(screen.queryByTestId('unverified-raw-digest')).not.toBeInTheDocument()
      })
    })
  })

  describe('and the request is a personal_sign', () => {
    let messageProps: UnverifiedRequestViewProps

    beforeEach(() => {
      messageProps = {
        requestId: 'r1',
        kind: 'personal_sign',
        method: 'personal_sign',
        payload: { kind: 'message', hex: '0x48656c6c6f', text: 'Hello' },
        payloadFingerprint: '0x48656c6c6f',
        onDeny,
        onApprove
      }
    })

    describe('and the message is readable text', () => {
      it('should show the text on the summary tab', () => {
        render(<UnverifiedRequestView {...messageProps} />)
        expect(screen.getByTestId('unverified-message')).toHaveTextContent('Hello')
      })

      it('should show the text and the bytes on the Advanced tab', async () => {
        render(<UnverifiedRequestView {...messageProps} />)
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.getByText('Hello')).toBeInTheDocument()
        expect(screen.getByTestId('unverified-raw-hex')).toHaveTextContent('0x48656c6c6f')
      })
    })

    describe('and the message is not readable text', () => {
      beforeEach(() => {
        messageProps = { ...messageProps, payload: { kind: 'message', hex: `0x${'9f'.repeat(32)}`, text: null } }
      })

      it('should say the message is unreadable instead of rendering it', () => {
        render(<UnverifiedRequestView {...messageProps} />)
        expect(screen.getByTestId('unverified-message-unreadable')).toBeInTheDocument()
        expect(screen.queryByTestId('unverified-message')).not.toBeInTheDocument()
      })

      it('should still show the bytes on the Advanced tab', async () => {
        render(<UnverifiedRequestView {...messageProps} />)
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.getByTestId('unverified-raw-hex')).toHaveTextContent(`0x${'9f'.repeat(32)}`)
      })
    })
  })
})
