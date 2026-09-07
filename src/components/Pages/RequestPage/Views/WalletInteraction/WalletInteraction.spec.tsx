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

describe('when a transaction preview is unavailable', () => {
  let props: WalletInteractionProps

  beforeEach(() => {
    props = { requestId: 'r1', simulation: { status: 'unavailable' }, onApprove: jest.fn(), onDeny: jest.fn(), onRetryPreview: jest.fn() }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should explicitly label approval without a preview and require acknowledgment', () => {
    render(<WalletInteraction {...props} />)
    expect(screen.getByRole('button', { name: 'request.transaction_dialog.approve_without_preview' })).toBeDisabled()
  })

  it('should allow the explicit approval after acknowledgment', async () => {
    render(<WalletInteraction {...props} />)
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'request.transaction_dialog.approve_without_preview' }))
    expect(props.onApprove).toHaveBeenCalledTimes(1)
  })

  it('should retry without approving', async () => {
    render(<WalletInteraction {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'request.transaction_dialog.retry_preview' }))
    expect(props.onRetryPreview).toHaveBeenCalledTimes(1)
    expect(props.onApprove).not.toHaveBeenCalled()
  })

  it('should discard the acknowledgment even if retry leaves the preview unavailable', async () => {
    render(<WalletInteraction {...props} />)
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'request.transaction_dialog.retry_preview' }))
    expect(screen.getByRole('button', { name: 'request.transaction_dialog.approve_without_preview' })).toBeDisabled()
  })

  describe('and approval is already processing', () => {
    beforeEach(() => {
      props.isLoading = true
    })

    it('should disable retry', () => {
      render(<WalletInteraction {...props} />)
      expect(screen.getByRole('button', { name: 'request.transaction_dialog.retry_preview' })).toBeDisabled()
    })
  })
})

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

  beforeEach(() => {
    onDeny = jest.fn()
    onApprove = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and a ready simulation is provided', () => {
    it('should render the asset-change summary on the first screen', () => {
      render(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'ready', result: successResult }}
          userAddress={USER}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByText('100 MANA')).toBeInTheDocument()
      expect(screen.getByText('request.transaction_dialog.you_send')).toBeInTheDocument()
    })
  })

  describe('and no simulation is provided', () => {
    it('should render the generic interaction description instead of a summary', () => {
      render(<WalletInteraction requestId="r1" onDeny={onDeny} onApprove={onApprove} />)
      expect(screen.getByText('request.wallet_interaction.description')).toBeInTheDocument()
      expect(screen.queryByText('request.transaction_dialog.you_send')).not.toBeInTheDocument()
    })
  })

  describe('and the simulation is still loading', () => {
    it('should keep the approve button disabled until it resolves', () => {
      render(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'loading' }}
          userAddress={USER}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByTestId('transfer-confirm-button')).toBeDisabled()
    })
  })

  describe('and the request changes after the user ticked the acknowledgment', () => {
    let onApprove: jest.Mock
    let onDeny: jest.Mock

    beforeEach(() => {
      onApprove = jest.fn()
      onDeny = jest.fn()
    })

    it('should clear the tick and disable approval for the new request in the same render', async () => {
      const { rerender } = render(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'ready', result: successResult }}
          userAddress={USER}
          requiresAcknowledgment
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByRole('button', { name: 'common.allow' })).toBeEnabled()
      rerender(
        <WalletInteraction
          requestId="r2"
          isWeb2Wallet
          simulation={{ status: 'ready', result: successResult }}
          userAddress={USER}
          requiresAcknowledgment
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByRole('checkbox')).not.toBeChecked()
      expect(screen.getByRole('button', { name: 'common.allow' })).toBeDisabled()
    })
  })

  describe('and the same request re-simulates to a different preview after the user ticked the acknowledgment', () => {
    let onApprove: jest.Mock
    let onDeny: jest.Mock
    let changedResult: SimulationResponseBody

    beforeEach(() => {
      onApprove = jest.fn()
      onDeny = jest.fn()
      changedResult = {
        ...successResult,
        assetChanges: [{ ...successResult.assetChanges[0], to: '0x000000000000000000000000000000000000dead' }]
      }
    })

    it('should clear the tick because it was given to the previous preview', async () => {
      const { rerender } = render(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'ready', result: successResult }}
          userAddress={USER}
          requiresAcknowledgment
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByRole('button', { name: 'common.allow' })).toBeEnabled()
      rerender(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'ready', result: changedResult }}
          userAddress={USER}
          requiresAcknowledgment
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByRole('checkbox')).not.toBeChecked()
      expect(screen.getByRole('button', { name: 'common.allow' })).toBeDisabled()
    })
  })

  describe('and a high-risk acknowledgment is required', () => {
    it('should keep approval disabled until the acknowledgment is checked', async () => {
      render(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'ready', result: successResult }}
          userAddress={USER}
          requiresAcknowledgment
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByTestId('transfer-confirm-button')).toBeDisabled()
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByTestId('transfer-confirm-button')).not.toBeDisabled()
    })
  })

  describe('and the transaction is relayed as a meta-transaction', () => {
    it('should show the gas-covered note inline instead of a separate confirm dialog', () => {
      render(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'ready', result: successResult }}
          userAddress={USER}
          gasCovered
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByText('request.transaction_dialog.gas_covered')).toBeInTheDocument()
    })
  })

  describe('and the user pays their own gas', () => {
    it('should show the transaction cost and balance inline', () => {
      render(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'ready', result: successResult }}
          userAddress={USER}
          transactionCost={BigInt('2500000000000000')}
          balance={BigInt('1500000000000000000')}
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByText(/request.transaction_dialog.transaction_cost/)).toBeInTheDocument()
      expect(screen.getByText(/request.transaction_dialog.your_balance/)).toBeInTheDocument()
    })
  })

  describe('and clicking allow with a summary present', () => {
    it('should approve directly without opening a confirm dialog', async () => {
      render(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'ready', result: successResult }}
          userAddress={USER}
          gasCovered
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      await userEvent.click(screen.getByTestId('transfer-confirm-button'))
      expect(onApprove).toHaveBeenCalledTimes(1)
    })
  })

  describe('and the simulation preview is unavailable', () => {
    it('should warn that the preview is unavailable', () => {
      render(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'unavailable' }}
          userAddress={USER}
          requiresAcknowledgment
          gasCovered
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByTestId('preview-unavailable-warning')).toBeInTheDocument()
    })

    it('should word the acknowledgment for the unavailable preview rather than the generic risk copy', () => {
      render(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'unavailable' }}
          userAddress={USER}
          requiresAcknowledgment
          gasCovered
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByText('request.wallet_interaction.acknowledge_preview_unavailable')).toBeInTheDocument()
    })

    it('should keep approval disabled until the unavailable preview is acknowledged', async () => {
      render(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'unavailable' }}
          userAddress={USER}
          requiresAcknowledgment
          gasCovered
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
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
      render(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'ready', result: emptyResult }}
          userAddress={USER}
          requiresAcknowledgment
          gasCovered
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByText('request.transaction_dialog.acknowledge_no_visible_effects')).toBeInTheDocument()
    })
  })

  describe('and the review replaced one invalidated by a network change', () => {
    it('should tell the user why the page reloaded, on the summary screen', () => {
      render(
        <WalletInteraction
          requestId="r1"
          isWeb2Wallet
          simulation={{ status: 'ready', result: successResult }}
          userAddress={USER}
          reviewRestarted
          onDeny={onDeny}
          onApprove={onApprove}
        />
      )
      expect(screen.getByTestId('review-restarted-notice')).toHaveTextContent('request.wallet_interaction.review_restarted_notice')
    })

    it('should tell the user why the page reloaded, on the classic screen', () => {
      render(<WalletInteraction requestId="r1" reviewRestarted onDeny={onDeny} onApprove={onApprove} />)
      expect(screen.getByTestId('review-restarted-notice')).toBeInTheDocument()
    })
  })

  describe('and the review is the first one for the request', () => {
    it('should not show the restart notice', () => {
      render(<WalletInteraction requestId="r1" onDeny={onDeny} onApprove={onApprove} />)
      expect(screen.queryByTestId('review-restarted-notice')).not.toBeInTheDocument()
    })
  })
})
