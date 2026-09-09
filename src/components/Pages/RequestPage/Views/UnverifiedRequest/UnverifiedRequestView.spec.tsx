import { fireEvent, render, screen } from '@testing-library/react'
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
  let props: UnverifiedRequestViewProps

  beforeEach(() => {
    onDeny = jest.fn()
    onApprove = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the request is a transaction to an unknown contract', () => {
    beforeEach(() => {
      props = {
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

    it('should title it as a transaction and say Decentraland cannot check it', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.getByText('request.unverified.title_transaction')).toBeInTheDocument()
      expect(screen.getByTestId('unverified-intro')).toHaveTextContent('request.unverified.intro_transaction')
    })

    it('should list the transaction warnings', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.getByTestId('unverified-warnings')).toHaveTextContent('request.unverified.warning_transaction_assets')
      expect(screen.getByTestId('unverified-warnings')).toHaveTextContent('request.unverified.warning_transaction_final')
      expect(screen.getByTestId('unverified-warnings')).toHaveTextContent('request.unverified.trust_scene')
    })

    it('should link the contract to the block explorer of its chain', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.getByRole('link', { name: '0x1234…5678' })).toHaveAttribute('href', `https://polygonscan.com/address/${CONTRACT}`)
    })

    it('should show the estimated fee in the native currency', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.getByTestId('unverified-fee')).toHaveTextContent('0.0042 POL')
    })

    it('should not show an amount for a transaction without value', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.queryByTestId('unverified-amount')).not.toBeInTheDocument()
    })

    it('should keep Allow disabled until the acknowledgment is ticked', async () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.getByRole('button', { name: 'common.allow' })).toBeDisabled()
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByRole('button', { name: 'common.allow' })).toBeEnabled()
    })

    it('should keep Deny enabled at all times', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.getByRole('button', { name: 'common.deny' })).toBeEnabled()
    })

    it('should call onApprove once ticked and clicked', async () => {
      render(<UnverifiedRequestView {...props} />)
      await userEvent.click(screen.getByRole('checkbox'))
      await userEvent.click(screen.getByRole('button', { name: 'common.allow' }))
      expect(onApprove).toHaveBeenCalledTimes(1)
    })

    describe('and the wallet is on a chain Decentraland does not know', () => {
      beforeEach(() => {
        props = { ...props, chainId: 56, nativeValue: '0xb1a2bc2ec50000' }
      })

      it('should name the chain by its id and the amounts in native-currency wording', () => {
        render(<UnverifiedRequestView {...props} />)
        expect(screen.getByText('request.unverified.unknown_network {"chainId":56}')).toBeInTheDocument()
        expect(screen.getByTestId('unverified-amount')).toHaveTextContent('0.05 request.unverified.native_currency')
        expect(screen.getByTestId('unverified-fee')).toHaveTextContent('0.0042 request.unverified.native_currency')
      })

      it('should not link the contract to an explorer it has no address for', () => {
        render(<UnverifiedRequestView {...props} />)
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
      })
    })

    describe('and the Advanced tab is opened', () => {
      it('should label the tab list and wire each panel to its tab', async () => {
        render(<UnverifiedRequestView {...props} />)
        expect(screen.getByRole('tablist', { name: 'request.unverified.tabs_label' })).toBeInTheDocument()
        expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'unverified-tab-summary')
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'unverified-tab-advanced')
      })

      it('should show the exact to, value and data the wallet will send', async () => {
        render(<UnverifiedRequestView {...props} />)
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.getByTestId('unverified-raw-to')).toHaveTextContent(CONTRACT)
        expect(screen.getByTestId('unverified-raw-value')).toHaveTextContent('0x0')
        expect(screen.getByTestId('unverified-raw-data')).toHaveTextContent('0x095ea7b3')
      })

      it('should hide the summary facts', async () => {
        render(<UnverifiedRequestView {...props} />)
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.queryByTestId('unverified-summary')).not.toBeInTheDocument()
      })
    })

    describe('and a value is attached', () => {
      beforeEach(() => {
        props = { ...props, nativeValue: '0xde0b6b3a7640000' }
      })

      it('should show the amount in the native currency', () => {
        render(<UnverifiedRequestView {...props} />)
        expect(screen.getByTestId('unverified-amount')).toHaveTextContent('1 POL')
      })
    })

    describe('and the fee is still being estimated', () => {
      beforeEach(() => {
        props = { ...props, gas: { status: 'loading' } }
      })

      it('should keep Allow disabled even after the acknowledgment is ticked', async () => {
        render(<UnverifiedRequestView {...props} />)
        await userEvent.click(screen.getByRole('checkbox'))
        expect(screen.getByTestId('unverified-fee')).toHaveTextContent('request.unverified.fact_fee_loading')
        expect(screen.getByRole('button', { name: 'common.allow' })).toBeDisabled()
      })
    })

    describe('and the fee could not be estimated', () => {
      beforeEach(() => {
        props = { ...props, gas: { status: 'unavailable' } }
      })

      it('should show the fee as unavailable and let the acknowledgment alone enable Allow', async () => {
        render(<UnverifiedRequestView {...props} />)
        expect(screen.getByTestId('unverified-fee')).toHaveTextContent('request.unverified.fact_fee_unavailable')
        await userEvent.click(screen.getByRole('checkbox'))
        expect(screen.getByRole('button', { name: 'common.allow' })).toBeEnabled()
      })
    })

    describe('and the payload changes after the user ticked the acknowledgment', () => {
      let nextProps: UnverifiedRequestViewProps

      beforeEach(() => {
        nextProps = { ...props, payloadFingerprint: 'other' }
      })

      it('should clear the tick in the same render', async () => {
        const { rerender } = render(<UnverifiedRequestView {...props} />)
        await userEvent.click(screen.getByRole('checkbox'))
        expect(screen.getByRole('button', { name: 'common.allow' })).toBeEnabled()
        rerender(<UnverifiedRequestView {...nextProps} />)
        expect(screen.getByRole('checkbox')).not.toBeChecked()
        expect(screen.getByRole('button', { name: 'common.allow' })).toBeDisabled()
      })
    })

    describe('and the request id changes after the user ticked the acknowledgment', () => {
      let nextProps: UnverifiedRequestViewProps

      beforeEach(() => {
        nextProps = { ...props, requestId: 'r2' }
      })

      it('should clear the tick in the same render', async () => {
        const { rerender } = render(<UnverifiedRequestView {...props} />)
        await userEvent.click(screen.getByRole('checkbox'))
        rerender(<UnverifiedRequestView {...nextProps} />)
        expect(screen.getByRole('checkbox')).not.toBeChecked()
      })
    })

    describe('and the review replaced one invalidated by a network change', () => {
      beforeEach(() => {
        props = { ...props, reviewRestarted: true }
      })

      it('should tell the user why the page reloaded', () => {
        render(<UnverifiedRequestView {...props} />)
        expect(screen.getByTestId('review-restarted-notice')).toBeInTheDocument()
      })
    })
  })

  describe('and the request is a plain value transfer to the user own address', () => {
    beforeEach(() => {
      props = {
        requestId: 'r1',
        kind: 'native_transfer',
        method: 'eth_sendTransaction',
        targetAddress: USER,
        targetIsSelf: true,
        chainId: 137,
        nativeValue: '0x6f05b59d3b20000',
        gas: { status: 'ready', cost: BigInt('4200000000000000') },
        balance: BigInt('1500000000000000000'),
        payload: { kind: 'transaction', to: USER, data: '0x', value: '0x6f05b59d3b20000' },
        payloadFingerprint: `${USER}|0x|0x6f05b59d3b20000|137`,
        onDeny,
        onApprove
      }
    })

    it('should say what is sent and to whom', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.getByTestId('unverified-intro')).toHaveTextContent(
        'request.unverified.intro_native_transfer {"amount":"0.5","symbol":"POL"}'
      )
    })

    it('should label the recipient as the user own address', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.getByText('(request.unverified.your_own_address)')).toBeInTheDocument()
    })

    it('should word the acknowledgment with the amount', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.getByText('request.unverified.acknowledge_native_transfer {"amount":"0.5","symbol":"POL"}')).toBeInTheDocument()
    })

    it('should not warn about moving other assets', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.getByTestId('unverified-warnings')).not.toHaveTextContent('request.unverified.warning_transaction_assets')
    })
  })

  describe('and the request is a MetaTransaction Decentraland cannot vouch for', () => {
    beforeEach(() => {
      props = {
        requestId: 'r1',
        kind: 'unknown_meta_transaction',
        method: 'eth_signTypedData_v4',
        targetAddress: CONTRACT,
        chainId: 137,
        payload: { kind: 'typed_data', raw: '{"primaryType":"MetaTransaction"}' },
        payloadFingerprint: '{"primaryType":"MetaTransaction"}',
        onDeny,
        onApprove
      }
    })

    it('should title it as a signature and list the meta-transaction warnings', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.getByText('request.unverified.title_signature')).toBeInTheDocument()
      expect(screen.getByTestId('unverified-warnings')).toHaveTextContent('request.unverified.warning_meta_tx_no_expiry')
      expect(screen.getByTestId('unverified-warnings')).toHaveTextContent('request.unverified.warning_meta_tx_bearer')
      expect(screen.getByTestId('unverified-warnings')).toHaveTextContent('request.unverified.warning_meta_tx_unknown_call')
      expect(screen.getByTestId('unverified-warnings')).toHaveTextContent('request.unverified.warning_meta_tx_no_preview')
    })

    it('should not ask for a fee because signatures are gasless', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.queryByTestId('unverified-fee')).not.toBeInTheDocument()
    })

    it('should enable Allow on the acknowledgment alone', async () => {
      render(<UnverifiedRequestView {...props} />)
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByRole('button', { name: 'common.allow' })).toBeEnabled()
    })

    describe('and the Advanced tab is opened', () => {
      it('should show only the typed data as the wallet reads it without inferring a call or digest', async () => {
        render(<UnverifiedRequestView {...props} />)
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.getByTestId('unverified-raw-typed-data')).toHaveTextContent('"primaryType": "MetaTransaction"')
        expect(screen.queryByTestId('unverified-raw-calldata')).not.toBeInTheDocument()
        expect(screen.queryByTestId('unverified-raw-digest')).not.toBeInTheDocument()
      })

      it('should say that only the declared fields are signed', async () => {
        render(<UnverifiedRequestView {...props} />)
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.getByText('request.unverified.advanced_hint_typed_data')).toBeInTheDocument()
      })
    })
  })

  describe('and the request is typed data that is not a MetaTransaction', () => {
    beforeEach(() => {
      props = {
        requestId: 'r1',
        kind: 'unknown_typed_data',
        method: 'eth_signTypedData_v4',
        payload: { kind: 'typed_data', raw: '{"primaryType":"Permit"}' },
        payloadFingerprint: '{"primaryType":"Permit"}',
        onDeny,
        onApprove
      }
    })

    it('should list the signature warnings', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.getByTestId('unverified-warnings')).toHaveTextContent('request.unverified.warning_signature_login')
      expect(screen.getByTestId('unverified-warnings')).toHaveTextContent('request.unverified.warning_signature_orders')
      expect(screen.getByTestId('unverified-warnings')).toHaveTextContent('request.unverified.warning_signature_unverifiable')
    })

    it('should show the method being used', () => {
      render(<UnverifiedRequestView {...props} />)
      expect(screen.getByText('eth_signTypedData_v4')).toBeInTheDocument()
    })

    describe('and the Advanced tab is opened', () => {
      it('should show the JSON verbatim without a call or a digest block', async () => {
        render(<UnverifiedRequestView {...props} />)
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.getByTestId('unverified-raw-typed-data')).toHaveTextContent('"primaryType": "Permit"')
        expect(screen.queryByTestId('unverified-raw-calldata')).not.toBeInTheDocument()
        expect(screen.queryByTestId('unverified-raw-digest')).not.toBeInTheDocument()
      })
    })
  })

  describe('and the request is a personal_sign', () => {
    describe('and the message is readable text', () => {
      beforeEach(() => {
        props = {
          requestId: 'r1',
          kind: 'personal_sign',
          method: 'personal_sign',
          payload: { kind: 'message', hex: '0x48656c6c6f', text: 'Hello' },
          payloadFingerprint: '0x48656c6c6f',
          onDeny,
          onApprove
        }
      })

      it('should show the text on the summary tab', () => {
        render(<UnverifiedRequestView {...props} />)
        expect(screen.getByTestId('unverified-message')).toHaveTextContent('Hello')
      })

      it('should state the size of the message', () => {
        render(<UnverifiedRequestView {...props} />)
        expect(screen.getByTestId('unverified-message-length')).toHaveTextContent(
          'request.unverified.message_length {"lines":1,"characters":5}'
        )
      })

      it('should let the acknowledgment be ticked for a message that fits its block', () => {
        render(<UnverifiedRequestView {...props} />)
        expect(screen.getByRole('checkbox')).toBeEnabled()
        expect(screen.queryByTestId('unverified-message-scroll-hint')).not.toBeInTheDocument()
      })

      describe('and the message is longer than its block shows', () => {
        let scrollHeight: PropertyDescriptor | undefined
        let clientHeight: PropertyDescriptor | undefined

        beforeEach(() => {
          scrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
          clientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
          Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 1000 })
          Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 320 })
        })

        afterEach(() => {
          if (scrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeight)
          if (clientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeight)
        })

        it('should keep the acknowledgment disabled and ask to scroll to the end', () => {
          render(<UnverifiedRequestView {...props} />)
          expect(screen.getByRole('checkbox')).toBeDisabled()
          expect(screen.getByTestId('unverified-message-scroll-hint')).toBeInTheDocument()
        })

        it('should enable the acknowledgment once the message has been scrolled to its end', () => {
          render(<UnverifiedRequestView {...props} />)
          const block = screen.getByTestId('unverified-message')
          Object.defineProperty(block, 'scrollTop', { configurable: true, value: 680 })
          fireEvent.scroll(block)
          expect(screen.getByRole('checkbox')).toBeEnabled()
          expect(screen.queryByTestId('unverified-message-scroll-hint')).not.toBeInTheDocument()
        })
      })

      it('should show the text and the bytes on the Advanced tab', async () => {
        render(<UnverifiedRequestView {...props} />)
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.getByText('Hello')).toBeInTheDocument()
        expect(screen.getByTestId('unverified-raw-hex')).toHaveTextContent('0x48656c6c6f')
      })
    })

    describe('and the message is not readable text', () => {
      beforeEach(() => {
        props = {
          requestId: 'r1',
          kind: 'personal_sign',
          method: 'personal_sign',
          payload: { kind: 'message', hex: `0x${'9f'.repeat(32)}`, text: null },
          payloadFingerprint: `0x${'9f'.repeat(32)}`,
          onDeny,
          onApprove
        }
      })

      it('should say the message is unreadable instead of rendering it', () => {
        render(<UnverifiedRequestView {...props} />)
        expect(screen.getByTestId('unverified-message-unreadable')).toBeInTheDocument()
        expect(screen.queryByTestId('unverified-message')).not.toBeInTheDocument()
      })

      it('should still show the bytes on the Advanced tab', async () => {
        render(<UnverifiedRequestView {...props} />)
        await userEvent.click(screen.getByRole('tab', { name: 'request.unverified.tab_advanced' }))
        expect(screen.getByTestId('unverified-raw-hex')).toHaveTextContent(`0x${'9f'.repeat(32)}`)
      })
    })
  })
})
