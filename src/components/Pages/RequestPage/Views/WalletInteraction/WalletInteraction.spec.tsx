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
  events: []
}

describe('when rendering the WalletInteraction view', () => {
  let onDeny: jest.Mock
  let onApprove: jest.Mock
  let baseProps: WalletInteractionProps

  beforeEach(() => {
    onDeny = jest.fn()
    onApprove = jest.fn()
    baseProps = {
      requestId: 'r1',
      functionName: 'approve',
      contractName: 'Decentraland MANA',
      simulation: { status: 'ready', result: successResult },
      userAddress: USER,
      gas: { covered: true },
      onDeny,
      onApprove
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and a ready simulation is provided', () => {
    it('should render the asset-change summary', () => {
      render(<WalletInteraction {...baseProps} />)
      expect(screen.getByText('100 MANA')).toBeInTheDocument()
      expect(screen.getByText('request.transaction_dialog.you_send')).toBeInTheDocument()
    })

    it('should name the decoded call and the contract it runs on', () => {
      render(<WalletInteraction {...baseProps} />)
      expect(screen.getByTestId('wallet-interaction-call')).toHaveTextContent('request.wallet_interaction.calls_function')
    })
  })

  describe('and the simulation is still loading', () => {
    it('should keep the approve button disabled until it resolves', () => {
      render(<WalletInteraction {...baseProps} simulation={{ status: 'loading' }} />)
      expect(screen.getByTestId('transfer-confirm-button')).toBeDisabled()
    })
  })

  describe('and the request changes after the user ticked the acknowledgment', () => {
    it('should clear the tick and disable approval for the new request in the same render', async () => {
      const { rerender } = render(<WalletInteraction {...baseProps} requiresAcknowledgment />)
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByRole('button', { name: 'common.allow' })).toBeEnabled()
      rerender(<WalletInteraction {...baseProps} requestId="r2" requiresAcknowledgment />)
      expect(screen.getByRole('checkbox')).not.toBeChecked()
      expect(screen.getByRole('button', { name: 'common.allow' })).toBeDisabled()
    })
  })

  describe('and the same request re-simulates to a different preview after the user ticked the acknowledgment', () => {
    let changedResult: SimulationResponseBody

    beforeEach(() => {
      changedResult = {
        ...successResult,
        assetChanges: [{ ...successResult.assetChanges[0], to: '0x000000000000000000000000000000000000dead' }]
      }
    })

    it('should clear the tick because it was given to the previous preview', async () => {
      const { rerender } = render(<WalletInteraction {...baseProps} requiresAcknowledgment />)
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByRole('button', { name: 'common.allow' })).toBeEnabled()
      rerender(<WalletInteraction {...baseProps} simulation={{ status: 'ready', result: changedResult }} requiresAcknowledgment />)
      expect(screen.getByRole('checkbox')).not.toBeChecked()
      expect(screen.getByRole('button', { name: 'common.allow' })).toBeDisabled()
    })
  })

  describe('and a high-risk acknowledgment is required', () => {
    it('should keep approval disabled until the acknowledgment is checked', async () => {
      render(<WalletInteraction {...baseProps} requiresAcknowledgment />)
      expect(screen.getByTestId('transfer-confirm-button')).toBeDisabled()
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByTestId('transfer-confirm-button')).not.toBeDisabled()
    })
  })

  describe('and the transaction is relayed as a meta-transaction', () => {
    it('should show the gas-covered note inline', () => {
      render(<WalletInteraction {...baseProps} gas={{ covered: true }} />)
      expect(screen.getByText('request.transaction_dialog.gas_covered')).toBeInTheDocument()
    })
  })

  describe('and the user pays their own gas', () => {
    describe('and the fee has been estimated', () => {
      it('should show the transaction cost and balance inline', () => {
        render(
          <WalletInteraction
            {...baseProps}
            gas={{ covered: false, status: 'ready', cost: BigInt('2500000000000000'), balance: BigInt('1500000000000000000') }}
          />
        )
        expect(screen.getByText(/request.transaction_dialog.transaction_cost/)).toBeInTheDocument()
        expect(screen.getByText(/request.transaction_dialog.your_balance/)).toBeInTheDocument()
      })
    })

    describe('and the fee is still being estimated', () => {
      it('should keep approval disabled so the cost is seen before sending', () => {
        render(<WalletInteraction {...baseProps} gas={{ covered: false, status: 'loading' }} />)
        expect(screen.getByTestId('transfer-confirm-button')).toBeDisabled()
      })
    })

    describe('and the fee could not be estimated', () => {
      it('should say so and leave approval to the other gates', () => {
        render(<WalletInteraction {...baseProps} gas={{ covered: false, status: 'unavailable' }} />)
        expect(screen.getByText('request.unverified.fact_fee_unavailable')).toBeInTheDocument()
        expect(screen.getByTestId('transfer-confirm-button')).toBeEnabled()
      })
    })
  })

  describe('and clicking allow', () => {
    it('should approve directly without a second confirmation step', async () => {
      render(<WalletInteraction {...baseProps} />)
      await userEvent.click(screen.getByTestId('transfer-confirm-button'))
      expect(onApprove).toHaveBeenCalledTimes(1)
    })
  })

  describe('and the simulation preview is unavailable', () => {
    it('should warn that the preview is unavailable', () => {
      render(<WalletInteraction {...baseProps} simulation={{ status: 'unavailable' }} requiresAcknowledgment />)
      expect(screen.getByTestId('preview-unavailable-warning')).toBeInTheDocument()
    })

    it('should word the acknowledgment for the unavailable preview rather than the generic risk copy', () => {
      render(<WalletInteraction {...baseProps} simulation={{ status: 'unavailable' }} requiresAcknowledgment />)
      expect(screen.getByText('request.wallet_interaction.acknowledge_preview_unavailable')).toBeInTheDocument()
    })

    it('should keep approval disabled until the unavailable preview is acknowledged', async () => {
      render(<WalletInteraction {...baseProps} simulation={{ status: 'unavailable' }} requiresAcknowledgment />)
      expect(screen.getByTestId('transfer-confirm-button')).toBeDisabled()
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByTestId('transfer-confirm-button')).not.toBeDisabled()
    })
  })

  describe('and the preview shows no visible effects', () => {
    let emptyResult: SimulationResponseBody

    beforeEach(() => {
      emptyResult = { ...successResult, assetChanges: [] }
    })

    it('should word the acknowledgment for a call whose effects the preview cannot show', () => {
      render(<WalletInteraction {...baseProps} simulation={{ status: 'ready', result: emptyResult }} requiresAcknowledgment />)
      expect(screen.getByText('request.transaction_dialog.acknowledge_no_visible_effects')).toBeInTheDocument()
    })
  })

  describe('and the review replaced one invalidated by a network change', () => {
    it('should tell the user why the page reloaded', () => {
      render(<WalletInteraction {...baseProps} reviewRestarted />)
      expect(screen.getByTestId('review-restarted-notice')).toHaveTextContent('request.wallet_interaction.review_restarted_notice')
    })
  })

  describe('and the review is the first one for the request', () => {
    it('should not show the restart notice', () => {
      render(<WalletInteraction {...baseProps} />)
      expect(screen.queryByTestId('review-restarted-notice')).not.toBeInTheDocument()
    })
  })
})
