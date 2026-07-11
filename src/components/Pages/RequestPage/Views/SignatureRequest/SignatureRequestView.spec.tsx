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
      await userEvent.click(screen.getByText('request.signature.view_raw'))
      expect(screen.getByTestId('signature-raw')).toBeInTheDocument()
    })
  })
})
