import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionRequestView } from './ActionRequestView'
import { ActionRequestViewProps } from './ActionRequest.types'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, string | number>) => (opts ? `${key} ${JSON.stringify(opts)}` : key) })
}))

// Container renders the WebGL AnimatedBackground, which jsdom can't run.
jest.mock('../../Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

const TO = '0x1234567890abcdef1234567890abcdef12345678'
const DATA = '0xae7b0333000000000000000000000000fef5c99885c3036e591b6e6db52482891834a5f4'

describe('when rendering the ActionRequestView', () => {
  let onDeny: jest.Mock
  let onApprove: jest.Mock
  let onAcknowledgedChange: jest.Mock
  let props: ActionRequestViewProps

  beforeEach(() => {
    onDeny = jest.fn()
    onApprove = jest.fn()
    onAcknowledgedChange = jest.fn()
    props = {
      requestId: 'r1',
      payload: { kind: 'transaction', to: TO, data: DATA, value: '0x6f05b59d3b20000', chainId: 137 },
      approveBlocked: true,
      onAcknowledgedChange,
      onDeny,
      onApprove
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should title the screen and say that an action with the wallet was asked for', () => {
    render(<ActionRequestView {...props} />)
    expect(screen.getByTestId('action-title')).toHaveTextContent('request.action.title')
    expect(screen.getByTestId('action-statement')).toHaveTextContent('request.action.statement')
  })

  it('should frame the consent in a box of its own', () => {
    render(<ActionRequestView {...props} />)
    expect(screen.getByTestId('action-consent')).toContainElement(screen.getByRole('checkbox'))
  })

  it('should place the warning after the payload and right before the consent', () => {
    render(<ActionRequestView {...props} />)
    const payload = screen.getByTestId('action-payload')
    const warnings = screen.getByTestId('action-warnings')
    const consent = screen.getByTestId('action-consent')
    // DOCUMENT_POSITION_FOLLOWING: the argument comes after the node it is compared with.
    expect(payload.compareDocumentPosition(warnings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(warnings.compareDocumentPosition(consent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('should label the payload as what will be sent to the wallet', () => {
    render(<ActionRequestView {...props} />)
    expect(screen.getByText('request.action.payload_label')).toBeInTheDocument()
  })

  it('should ask for the responsibility acknowledgment, unchecked', () => {
    render(<ActionRequestView {...props} />)
    expect(screen.getByRole('checkbox', { name: 'request.action.acknowledge' })).not.toBeChecked()
  })

  describe('and the payload fits in the box without scrolling', () => {
    it('should count it as read: the checkbox is enabled and nothing asks to scroll', () => {
      render(<ActionRequestView {...props} />)
      expect(screen.getByRole('checkbox')).toBeEnabled()
      expect(screen.queryByTestId('action-scroll-hint')).not.toBeInTheDocument()
    })
  })

  describe('and the payload is longer than the box', () => {
    beforeEach(() => {
      // jsdom lays nothing out, so the box is given the geometry of a payload three screens long. The getters
      // shadow jsdom's own, which live on Element.prototype, and are removed again after each case.
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 1000 })
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 320 })
      props = { ...props, approveBlocked: false }
    })

    afterEach(() => {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight')
      Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
    })

    it('should keep the checkbox and Allow disabled and ask to scroll to the end, whatever the page says', () => {
      render(<ActionRequestView {...props} />)
      expect(screen.getByRole('checkbox')).toBeDisabled()
      expect(screen.getByTestId('action-approve-button')).toBeDisabled()
      expect(screen.getByTestId('action-scroll-hint')).toHaveTextContent('request.action.scroll_hint')
    })

    it('should keep them disabled after a partial scroll', () => {
      render(<ActionRequestView {...props} />)
      const block = screen.getByTestId('action-payload')
      Object.defineProperty(block, 'scrollTop', { configurable: true, value: 300 })
      fireEvent.scroll(block)
      expect(screen.getByRole('checkbox')).toBeDisabled()
      expect(screen.getByTestId('action-approve-button')).toBeDisabled()
      expect(screen.getByTestId('action-scroll-hint')).toBeInTheDocument()
    })

    it('should enable the checkbox and Allow once the box has been scrolled to its end', () => {
      render(<ActionRequestView {...props} />)
      const block = screen.getByTestId('action-payload')
      Object.defineProperty(block, 'scrollTop', { configurable: true, value: 680 })
      fireEvent.scroll(block)
      expect(screen.getByRole('checkbox')).toBeEnabled()
      expect(screen.getByTestId('action-approve-button')).toBeEnabled()
      expect(screen.queryByTestId('action-scroll-hint')).not.toBeInTheDocument()
    })

    it('should still keep Deny available before the end is reached', () => {
      render(<ActionRequestView {...props} />)
      expect(screen.getByTestId('action-deny-button')).toBeEnabled()
    })

    it('should keep them enabled when the reader scrolls back up, since the end was already reached', () => {
      render(<ActionRequestView {...props} />)
      const block = screen.getByTestId('action-payload')
      Object.defineProperty(block, 'scrollTop', { configurable: true, value: 680 })
      fireEvent.scroll(block)

      // Back to the top to re-read a line: the gate asked for one pass and got it.
      Object.defineProperty(block, 'scrollTop', { configurable: true, value: 0 })
      fireEvent.scroll(block)

      expect(screen.getByRole('checkbox')).toBeEnabled()
      expect(screen.getByTestId('action-approve-button')).toBeEnabled()
      expect(screen.queryByTestId('action-scroll-hint')).not.toBeInTheDocument()
    })

    describe('and the payload is replaced by another', () => {
      it('should ask for the new one to be read to its end', () => {
        const { rerender } = render(<ActionRequestView {...props} />)
        const block = screen.getByTestId('action-payload')
        // Writable, unlike the cases above: the view puts the box back at the top for a new payload, and a
        // read-only stub would swallow that and leave the old scroll position in place.
        Object.defineProperty(block, 'scrollTop', { configurable: true, writable: true, value: 680 })
        fireEvent.scroll(block)
        expect(screen.getByRole('checkbox')).toBeEnabled()

        rerender(<ActionRequestView {...{ ...props, payload: { kind: 'typed_data', raw: '{"primaryType":"Permit"}' } }} />)

        expect(screen.getByRole('checkbox')).toBeDisabled()
        expect(screen.getByTestId('action-scroll-hint')).toBeInTheDocument()
      })
    })
  })

  it('should report a tick to the page rather than decide for itself what it enables', async () => {
    render(<ActionRequestView {...props} />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onAcknowledgedChange).toHaveBeenCalledWith(true)
  })

  it('should render the checkbox from what the page says was acknowledged', () => {
    render(<ActionRequestView {...{ ...props, acknowledged: true }} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('should not show the restart notice unless the review was restarted', () => {
    render(<ActionRequestView {...props} />)
    expect(screen.queryByTestId('review-restarted-notice')).not.toBeInTheDocument()
  })

  describe('and the payload is a transaction', () => {
    it('should warn what a malicious transaction could do', () => {
      render(<ActionRequestView {...props} />)
      const warnings = screen.getByTestId('action-warnings')
      expect(warnings).toHaveTextContent('request.action.warning_title')
      expect(warnings).toHaveTextContent('request.action.warning_transaction_assets')
      expect(warnings).toHaveTextContent('request.action.warning_transaction_permissions')
      expect(warnings).toHaveTextContent('request.action.warning_transaction_final')
      expect(warnings).toHaveTextContent('request.action.warning_trust')
      expect(warnings).not.toHaveTextContent('request.action.warning_signature_bearer')
    })

    it('should show every field the wallet will be handed, with the value also read as an amount', () => {
      render(<ActionRequestView {...props} />)
      const payload = screen.getByTestId('action-payload')
      expect(payload).toHaveTextContent(`request.action.payload_to: ${TO}`)
      expect(payload).toHaveTextContent('request.action.payload_value: 0x6f05b59d3b20000 (0.5 POL)')
      expect(payload).toHaveTextContent(`request.action.payload_data: ${DATA}`)
      expect(payload).toHaveTextContent('request.action.payload_chain: 137')
    })

    describe('and the chain is not one the page knows', () => {
      beforeEach(() => {
        props = { ...props, payload: { kind: 'transaction', to: TO, data: '0x', value: '0x0', chainId: 42 } }
      })

      it('should still state the chain and name the currency generically', () => {
        render(<ActionRequestView {...props} />)
        const payload = screen.getByTestId('action-payload')
        expect(payload).toHaveTextContent('request.action.payload_value: 0x0 (0 request.transaction_dialog.native_currency)')
        expect(payload).toHaveTextContent('request.action.payload_chain: 42')
      })
    })
  })

  describe('and the payload is typed data', () => {
    beforeEach(() => {
      props = { ...props, payload: { kind: 'typed_data', raw: '{"primaryType":"Permit","message":{"value":"1"}}' } }
    })

    it('should warn what a malicious signature could do, including that it never expires', () => {
      render(<ActionRequestView {...props} />)
      const warnings = screen.getByTestId('action-warnings')
      expect(warnings).toHaveTextContent('request.action.warning_signature_orders')
      expect(warnings).toHaveTextContent('request.action.warning_signature_bearer')
      expect(warnings).toHaveTextContent('request.action.warning_signature_login')
      expect(warnings).toHaveTextContent('request.action.warning_trust')
      expect(warnings).not.toHaveTextContent('request.action.warning_transaction_final')
    })

    it('should show the JSON pretty-printed, as the wallet will read it', () => {
      render(<ActionRequestView {...props} />)
      const payload = screen.getByTestId('action-payload')
      expect(payload).toHaveTextContent('"primaryType": "Permit"')
      expect(payload).toHaveTextContent('"value": "1"')
    })
  })

  describe('and the payload is a readable message', () => {
    beforeEach(() => {
      props = { ...props, payload: { kind: 'message', hex: '0x57656c636f6d65', text: 'Welcome' } }
    })

    it('should warn that a message can log the user in elsewhere or authorize an order', () => {
      render(<ActionRequestView {...props} />)
      const warnings = screen.getByTestId('action-warnings')
      expect(warnings).toHaveTextContent('request.action.warning_signature_login')
      expect(warnings).toHaveTextContent('request.action.warning_signature_orders')
      expect(warnings).not.toHaveTextContent('request.action.warning_signature_bearer')
    })

    it('should show the text', () => {
      render(<ActionRequestView {...props} />)
      expect(screen.getByTestId('action-payload')).toHaveTextContent('Welcome')
      expect(screen.getByTestId('action-payload')).not.toHaveTextContent('0x57656c636f6d65')
    })
  })

  describe('and the payload is a message that is not readable text', () => {
    beforeEach(() => {
      props = { ...props, payload: { kind: 'message', hex: `0x${'9f'.repeat(32)}`, text: null } }
    })

    it('should show the bytes', () => {
      render(<ActionRequestView {...props} />)
      expect(screen.getByTestId('action-payload')).toHaveTextContent(`0x${'9f'.repeat(32)}`)
    })
  })

  describe('and the page reports the review is not actionable', () => {
    it('should keep Allow disabled', () => {
      render(<ActionRequestView {...props} />)
      expect(screen.getByTestId('action-approve-button')).toBeDisabled()
    })

    it('should still offer Deny', () => {
      render(<ActionRequestView {...props} />)
      expect(screen.getByTestId('action-deny-button')).toBeEnabled()
    })
  })

  describe('and the page reports the review is actionable', () => {
    beforeEach(() => {
      props = { ...props, approveBlocked: false, acknowledged: true }
    })

    it('should approve on Allow', async () => {
      render(<ActionRequestView {...props} />)
      await userEvent.click(screen.getByTestId('action-approve-button'))
      expect(onApprove).toHaveBeenCalledTimes(1)
    })

    it('should deny on Deny', async () => {
      render(<ActionRequestView {...props} />)
      await userEvent.click(screen.getByTestId('action-deny-button'))
      expect(onDeny).toHaveBeenCalledTimes(1)
    })
  })

  describe('and an approval is in flight', () => {
    beforeEach(() => {
      props = { ...props, isLoading: true, approveBlocked: true }
    })

    it('should disable both buttons', () => {
      render(<ActionRequestView {...props} />)
      expect(screen.getByTestId('action-approve-button')).toBeDisabled()
      expect(screen.getByTestId('action-deny-button')).toBeDisabled()
    })
  })

  describe('and the review replaced one invalidated by a network change', () => {
    beforeEach(() => {
      props = { ...props, reviewRestarted: true }
    })

    it('should tell the user why the page reloaded', () => {
      render(<ActionRequestView {...props} />)
      expect(screen.getByTestId('review-restarted-notice')).toHaveTextContent('request.action.review_restarted_notice')
    })
  })
})
