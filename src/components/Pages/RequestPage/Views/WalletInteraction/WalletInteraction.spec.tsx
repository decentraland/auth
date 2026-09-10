import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SimulationResponseBody } from '../../../../../shared/auth'
import { WalletInteraction } from './WalletInteraction'
import { WalletInteractionProps } from './WalletInteraction.types'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

// Container renders the WebGL AnimatedBackground, which jsdom can't run.
jest.mock('../../Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'

const successResult: SimulationResponseBody = {
  status: 'success',
  assetChanges: [
    {
      type: 'transfer',
      standard: 'erc20',
      from: USER,
      to: '0x1234567890abcdef1234567890abcdef12345678',
      amount: '100',
      rawAmount: '100',
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
  events: [],
  eventsTruncated: false
}

describe('when rendering the WalletInteraction view', () => {
  let onDeny: jest.Mock
  let onApprove: jest.Mock
  let onAcknowledgedChange: jest.Mock
  let props: WalletInteractionProps

  beforeEach(() => {
    onDeny = jest.fn()
    onApprove = jest.fn()
    onAcknowledgedChange = jest.fn()
    props = {
      requestId: 'r1',
      functionName: 'approve',
      contractName: 'Decentraland MANA',
      simulation: { status: 'ready', result: successResult },
      userAddress: USER,
      gas: { covered: true },
      approveBlocked: false,
      onAcknowledgedChange,
      onDeny,
      onApprove
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and a ready simulation is provided', () => {
    it('should render the asset-change summary', () => {
      render(<WalletInteraction {...props} />)
      expect(screen.getByText('100 MANA')).toBeInTheDocument()
      expect(screen.getByText('request.transaction_dialog.you_send')).toBeInTheDocument()
    })

    it('should name the decoded call and the contract it runs on', () => {
      render(<WalletInteraction {...props} />)
      expect(screen.getByTestId('wallet-interaction-call')).toHaveTextContent('request.wallet_interaction.calls_function')
    })

    it('should approve directly on Allow', async () => {
      render(<WalletInteraction {...props} />)
      await userEvent.click(screen.getByRole('button', { name: 'common.allow' }))
      expect(onApprove).toHaveBeenCalledTimes(1)
    })

    it('should not show the restart notice', () => {
      render(<WalletInteraction {...props} />)
      expect(screen.queryByTestId('review-restarted-notice')).not.toBeInTheDocument()
    })
  })

  describe('and the page reports the review is not actionable', () => {
    beforeEach(() => {
      props = { ...props, approveBlocked: true }
    })

    it('should keep the approve button disabled, whatever it can see of the preview itself', () => {
      render(<WalletInteraction {...props} />)
      expect(screen.getByRole('button', { name: 'common.allow' })).toBeDisabled()
    })

    it('should still offer Deny', () => {
      render(<WalletInteraction {...props} />)
      expect(screen.getByRole('button', { name: 'common.deny' })).toBeEnabled()
    })
  })

  describe('and an acknowledgment is required', () => {
    beforeEach(() => {
      props = { ...props, requiresAcknowledgment: true }
    })

    it('should report a tick to the page rather than decide for itself what it enables', async () => {
      render(<WalletInteraction {...props} />)

      await userEvent.click(screen.getByRole('checkbox'))

      expect(onAcknowledgedChange).toHaveBeenCalledWith(true)
    })

    it('should report the tick being taken back', async () => {
      render(<WalletInteraction {...{ ...props, acknowledged: true }} />)

      await userEvent.click(screen.getByRole('checkbox'))

      expect(onAcknowledgedChange).toHaveBeenCalledWith(false)
    })

    it('should render the checkbox from what the page says was acknowledged', () => {
      render(<WalletInteraction {...{ ...props, acknowledged: true }} />)
      expect(screen.getByRole('checkbox')).toBeChecked()
    })

    it('should render it unchecked when the page says the tick no longer counts', () => {
      render(<WalletInteraction {...props} />)
      expect(screen.getByRole('checkbox')).not.toBeChecked()
    })
  })

  describe('and the transaction is relayed as a meta-transaction', () => {
    it('should show the gas-covered note inline', () => {
      render(<WalletInteraction {...props} />)
      expect(screen.getByText('request.transaction_dialog.gas_covered')).toBeInTheDocument()
    })
  })

  describe('and the user pays their own gas', () => {
    describe('and the fee has been estimated', () => {
      beforeEach(() => {
        props = {
          ...props,
          gas: { covered: false, status: 'ready', cost: BigInt('2500000000000000'), balance: BigInt('1500000000000000000') }
        }
      })

      it('should show the transaction cost and balance inline', () => {
        render(<WalletInteraction {...props} />)
        expect(screen.getByText(/request.transaction_dialog.transaction_cost/)).toBeInTheDocument()
        expect(screen.getByText(/request.transaction_dialog.your_balance/)).toBeInTheDocument()
      })
    })

    describe('and the fee could not be estimated', () => {
      beforeEach(() => {
        props = { ...props, gas: { covered: false, status: 'unavailable' } }
      })

      it('should show the fee as unavailable', () => {
        render(<WalletInteraction {...props} />)
        expect(screen.getByText('request.unverified.fact_fee_unavailable')).toBeInTheDocument()
      })
    })
  })

  describe('and the simulation preview is unavailable', () => {
    beforeEach(() => {
      props = { ...props, simulation: { status: 'unavailable' }, requiresAcknowledgment: true }
    })

    it('should warn that the preview is unavailable', () => {
      render(<WalletInteraction {...props} />)
      expect(screen.getByTestId('preview-unavailable-warning')).toBeInTheDocument()
    })

    it('should word the acknowledgment for the unavailable preview rather than the generic risk copy', () => {
      render(<WalletInteraction {...props} />)
      expect(screen.getByText('request.wallet_interaction.acknowledge_preview_unavailable')).toBeInTheDocument()
    })

    it('should still ask for a tick, reported to the page', async () => {
      render(<WalletInteraction {...props} />)

      await userEvent.click(screen.getByRole('checkbox'))

      expect(onAcknowledgedChange).toHaveBeenCalledWith(true)
    })
  })

  describe('and the preview shows no visible effects', () => {
    beforeEach(() => {
      props = { ...props, simulation: { status: 'ready', result: { ...successResult, assetChanges: [] } }, requiresAcknowledgment: true }
    })

    it('should word the acknowledgment for a call whose effects the preview cannot show', () => {
      render(<WalletInteraction {...props} />)
      expect(screen.getByText('request.transaction_dialog.acknowledge_no_visible_effects')).toBeInTheDocument()
    })
  })

  describe('and the review replaced one invalidated by a network change', () => {
    beforeEach(() => {
      props = { ...props, reviewRestarted: true }
    })

    it('should tell the user why the page reloaded', () => {
      render(<WalletInteraction {...props} />)
      expect(screen.getByTestId('review-restarted-notice')).toHaveTextContent('request.wallet_interaction.review_restarted_notice')
    })
  })
})
