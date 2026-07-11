import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SimulationResponseBody } from '../../../../../shared/auth'
import { SimulationState } from '../../types'
import { SimulationSummary } from './SimulationSummary'

// Echo the key, and append any interpolation values so they appear in the DOM for assertions.
jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string | number>) => (opts ? `${key} ${Object.values(opts).join(' ')}` : key)
  })
}))

const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'

const emptyResult = (overrides: Partial<SimulationResponseBody> = {}): SimulationResponseBody => ({
  status: 'success',
  assetChanges: [],
  approvalChanges: [],
  balanceChanges: [],
  events: [],
  ...overrides
})

describe('when rendering the SimulationSummary', () => {
  let simulation: SimulationState

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the simulation is idle', () => {
    beforeEach(() => {
      simulation = { status: 'idle' }
    })

    it('should render nothing', () => {
      const { container } = render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('and the simulation is loading', () => {
    beforeEach(() => {
      simulation = { status: 'loading' }
    })

    it('should render a busy skeleton placeholder', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByLabelText('request.transaction_dialog.simulation_loading')).toHaveAttribute('aria-busy', 'true')
    })
  })

  describe('and the simulation is unavailable', () => {
    beforeEach(() => {
      simulation = { status: 'unavailable' }
    })

    it('should render the details-unavailable notice', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('request.transaction_dialog.details_unavailable')).toBeInTheDocument()
    })

    it('should still render the gas footer so the user sees gas before approving', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} gas={{ covered: true, cost: '0', balance: '0' }} />)
      expect(screen.getByText('request.transaction_dialog.gas_covered')).toBeInTheDocument()
    })
  })

  describe('and the simulation is loading with a gas footer', () => {
    beforeEach(() => {
      simulation = { status: 'loading' }
    })

    it('should not render the gas footer yet (the gas-covered state may be unresolved while loading)', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} gas={{ covered: false, cost: '0.0025', balance: '1.5' }} />)
      expect(screen.queryByText(/transaction_cost/)).not.toBeInTheDocument()
    })
  })

  describe('and the simulation succeeded with transfers and an unlimited approval', () => {
    beforeEach(() => {
      const result: SimulationResponseBody = {
        status: 'success',
        assetChanges: [
          {
            type: 'transfer',
            standard: 'erc20',
            from: USER,
            to: '0x1234567890abcdef1234567890abcdef12345678',
            amount: '100',
            rawAmount: '100000000000000000000',
            tokenId: null,
            contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
            symbol: 'MANA',
            name: 'Decentraland MANA',
            decimals: 18,
            logoUrl: null,
            dollarValue: null
          },
          {
            type: 'transfer',
            standard: 'erc721',
            from: '0x1234567890abcdef1234567890abcdef12345678',
            to: USER,
            amount: null,
            rawAmount: null,
            tokenId: '512',
            contractAddress: '0xfef5c99885c3036e591b6e6db52482891834a5f4',
            symbol: 'WEAR',
            name: 'Fancy Hat',
            decimals: null,
            logoUrl: null,
            dollarValue: null
          }
        ],
        approvalChanges: [
          {
            kind: 'approval',
            standard: 'erc20',
            owner: USER,
            spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            amount: null,
            rawAmount: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
            isUnlimited: true,
            tokenId: null,
            approved: null,
            contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
            symbol: 'MANA',
            name: 'Decentraland MANA'
          }
        ],
        balanceChanges: [],
        events: []
      }
      simulation = { status: 'ready', result }
    })

    it('should render the sent asset amount and symbol', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('100 MANA')).toBeInTheDocument()
    })

    it('should render the received NFT with its name and token id', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('Fancy Hat #512')).toBeInTheDocument()
    })

    it('should render the you-send section title', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('request.transaction_dialog.you_send')).toBeInTheDocument()
    })

    it('should render the approvals section', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('request.transaction_dialog.approvals_title')).toBeInTheDocument()
    })
  })

  describe('and the simulation reports the transaction would revert', () => {
    beforeEach(() => {
      simulation = {
        status: 'ready',
        result: {
          status: 'reverted',
          error: 'ERC20: transfer amount exceeds balance',
          assetChanges: [],
          approvalChanges: [],
          balanceChanges: [],
          events: []
        }
      }
    })

    it('should render the revert warning title', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('request.transaction_dialog.revert_title')).toBeInTheDocument()
    })
  })

  describe('and an asset transfer carries a dollar value', () => {
    beforeEach(() => {
      const result = emptyResult({
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
            dollarValue: '42.00'
          }
        ]
      })
      simulation = { status: 'ready', result }
    })

    it('should render the USD value next to the amount', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('≈ $42.00')).toBeInTheDocument()
    })
  })

  describe('and an asset is minted to the user', () => {
    beforeEach(() => {
      const result = emptyResult({
        assetChanges: [
          {
            type: 'mint',
            standard: 'erc721',
            from: null,
            to: USER,
            amount: null,
            rawAmount: null,
            tokenId: '512',
            contractAddress: '0xfef5c99885c3036e591b6e6db52482891834a5f4',
            symbol: 'WEAR',
            name: 'Fancy Hat',
            decimals: null,
            logoUrl: null,
            dollarValue: null
          }
        ]
      })
      simulation = { status: 'ready', result }
    })

    it('should label the row as minted', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('request.transaction_dialog.minted')).toBeInTheDocument()
    })
  })

  describe('and an asset change involves neither the user as sender nor recipient', () => {
    beforeEach(() => {
      const result = emptyResult({
        assetChanges: [
          {
            type: 'transfer',
            standard: 'erc20',
            from: '0x1111111111111111111111111111111111111111',
            to: '0x2222222222222222222222222222222222222222',
            amount: '5',
            rawAmount: '5000000000000000000',
            tokenId: null,
            contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
            symbol: 'MANA',
            name: 'Decentraland MANA',
            decimals: 18,
            logoUrl: null,
            dollarValue: null
          }
        ]
      })
      simulation = { status: 'ready', result }
    })

    it('should not present the third-party movement as sent or received', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.queryByText('request.transaction_dialog.you_send')).not.toBeInTheDocument()
      expect(screen.queryByText('request.transaction_dialog.you_receive')).not.toBeInTheDocument()
      expect(screen.getByText('request.transaction_dialog.no_changes')).toBeInTheDocument()
    })
  })

  describe('and an ApprovalForAll is revoked', () => {
    beforeEach(() => {
      const result = emptyResult({
        approvalChanges: [
          {
            kind: 'approvalForAll',
            standard: 'erc721',
            owner: USER,
            spender: '0x9999999999999999999999999999999999999999',
            amount: null,
            rawAmount: null,
            isUnlimited: false,
            tokenId: null,
            approved: false,
            contractAddress: '0x1111111111111111111111111111111111111111',
            symbol: null,
            name: 'Old Collection'
          }
        ]
      })
      simulation = { status: 'ready', result }
    })

    it('should render the revoke copy rather than a grant', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText(/approval_access_revoked/)).toBeInTheDocument()
    })
  })

  describe('and an ERC721 single-token approval is granted', () => {
    beforeEach(() => {
      const result = emptyResult({
        approvalChanges: [
          {
            kind: 'approval',
            standard: 'erc721',
            owner: USER,
            spender: '0x1234567890abcdef1234567890abcdef12345678',
            amount: null,
            rawAmount: null,
            isUnlimited: false,
            tokenId: '7',
            approved: null,
            contractAddress: '0xfef5c99885c3036e591b6e6db52482891834a5f4',
            symbol: null,
            name: 'Fancy Wearables'
          }
        ]
      })
      simulation = { status: 'ready', result }
    })

    it('should render the single-token approval copy', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText(/approval_can_transfer_token/)).toBeInTheDocument()
    })
  })

  describe('and there is a net dollar balance change for the user', () => {
    beforeEach(() => {
      simulation = { status: 'ready', result: emptyResult({ balanceChanges: [{ address: USER, dollarValue: '-38.00' }] }) }
    })

    it('should render the signed net change', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('-$38.00')).toBeInTheDocument()
    })
  })

  describe('and the net dollar value has a very large integer part', () => {
    beforeEach(() => {
      // Number(...) would round this past ~15 significant digits; the string-based formatter must not.
      simulation = { status: 'ready', result: emptyResult({ balanceChanges: [{ address: USER, dollarValue: '1234567890123456.789' }] }) }
    })

    it('should render the exact grouped amount without precision loss', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('+$1,234,567,890,123,456.79')).toBeInTheDocument()
    })
  })

  describe('and the net dollar value is in scientific notation', () => {
    beforeEach(() => {
      simulation = { status: 'ready', result: emptyResult({ balanceChanges: [{ address: USER, dollarValue: '1e-8' }] }) }
    })

    it('should still render it via the numeric fallback rather than dropping it', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('+$0.00')).toBeInTheDocument()
    })
  })

  describe('and a tiny negative net value rounds to zero', () => {
    beforeEach(() => {
      simulation = { status: 'ready', result: emptyResult({ balanceChanges: [{ address: USER, dollarValue: '-0.001' }] }) }
    })

    it('should not render it as a negative amount', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('+$0.00')).toBeInTheDocument()
      expect(screen.queryByText('-$0.00')).not.toBeInTheDocument()
    })
  })

  describe('and the transaction moves no assets and grants no approvals', () => {
    beforeEach(() => {
      simulation = { status: 'ready', result: emptyResult() }
    })

    it('should render the no-changes note', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('request.transaction_dialog.no_changes')).toBeInTheDocument()
    })
  })

  describe('and there are decoded events', () => {
    beforeEach(() => {
      simulation = {
        status: 'ready',
        result: emptyResult({ events: [{ name: 'Transfer', address: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942' }] })
      }
    })

    it('should hide the events until the technical-details toggle is clicked', async () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.queryByTestId('simulation-events')).not.toBeInTheDocument()
      await userEvent.click(screen.getByText('request.transaction_dialog.technical_details'))
      expect(screen.getByTestId('simulation-events')).toBeInTheDocument()
    })

    it('should reflect the open state on the toggle for assistive tech', async () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      const toggle = screen.getByRole('button')
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await userEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('and there are more events than the display cap', () => {
    beforeEach(() => {
      const events = Array.from({ length: 150 }, (_, index) => ({
        name: `Event${index}`,
        address: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942'
      }))
      simulation = { status: 'ready', result: emptyResult({ events }) }
    })

    it('should cap the rendered event rows at the defensive maximum', async () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      await userEvent.click(screen.getByText('request.transaction_dialog.technical_details'))
      expect(screen.getByTestId('simulation-events').children).toHaveLength(100)
    })
  })

  describe('and a counterparty has a resolved profile name', () => {
    beforeEach(() => {
      simulation = {
        status: 'ready',
        result: emptyResult({
          assetChanges: [
            {
              type: 'transfer',
              standard: 'erc20',
              from: USER,
              to: '0x1234567890abcdef1234567890abcdef12345678',
              amount: '1',
              rawAmount: '1',
              tokenId: null,
              contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
              symbol: 'MANA',
              name: 'MANA',
              decimals: 18,
              logoUrl: null,
              dollarValue: null
            }
          ]
        })
      }
    })

    it('should show the profile name instead of the address', () => {
      const recipient = '0x1234567890abcdef1234567890abcdef12345678'
      render(<SimulationSummary simulation={simulation} userAddress={USER} profiles={{ [recipient]: 'CoolCreator' }} />)
      expect(screen.getByText(/CoolCreator/)).toBeInTheDocument()
    })
  })

  describe('and a chain id is provided for explorer links', () => {
    beforeEach(() => {
      simulation = {
        status: 'ready',
        result: emptyResult({
          assetChanges: [
            {
              type: 'transfer',
              standard: 'erc20',
              from: USER,
              to: '0x1234567890abcdef1234567890abcdef12345678',
              amount: '1',
              rawAmount: '1',
              tokenId: null,
              contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
              symbol: 'MANA',
              name: 'MANA',
              decimals: 18,
              logoUrl: null,
              dollarValue: null
            }
          ]
        })
      }
    })

    it('should link the counterparty address to the correct block explorer', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} chainId={137} />)
      const link = screen.getByRole('link', { name: /0x1234/ })
      expect(link).toHaveAttribute('href', 'https://polygonscan.com/address/0x1234567890abcdef1234567890abcdef12345678')
    })

    it('should open explorer links in a new tab safely', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} chainId={137} />)
      const link = screen.getByRole('link', { name: /0x1234/ })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('should render plain text when the chain is unknown', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} chainId={999999} />)
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    it('should show a verified badge for recognized Decentraland contracts', () => {
      const recipient = '0x1234567890abcdef1234567890abcdef12345678'
      render(<SimulationSummary simulation={simulation} userAddress={USER} chainId={137} verifiedContracts={[recipient]} />)
      expect(screen.getByText('✓ Decentraland')).toBeInTheDocument()
    })
  })

  describe('and an unlimited approval is granted', () => {
    beforeEach(() => {
      simulation = {
        status: 'ready',
        result: emptyResult({
          approvalChanges: [
            {
              kind: 'approval',
              standard: 'erc20',
              owner: USER,
              spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              amount: null,
              rawAmount: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
              isUnlimited: true,
              tokenId: null,
              approved: null,
              contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
              symbol: 'MANA',
              name: 'MANA'
            }
          ]
        })
      }
    })

    it('should flag the high-risk approval with a warning icon', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('⚠')).toBeInTheDocument()
    })
  })

  describe('and a supported chain id is provided', () => {
    beforeEach(() => {
      simulation = { status: 'ready', result: emptyResult({ balanceChanges: [{ address: USER, dollarValue: '-1' }] }) }
    })

    it('should show the human-readable network name', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} chainId={137} />)
      expect(screen.getByText(/Polygon/)).toBeInTheDocument()
    })
  })

  describe('and a large token amount is transferred', () => {
    beforeEach(() => {
      simulation = {
        status: 'ready',
        result: emptyResult({
          assetChanges: [
            {
              type: 'transfer',
              standard: 'erc20',
              from: USER,
              to: '0x1234567890abcdef1234567890abcdef12345678',
              amount: '1000000.5',
              rawAmount: '1000000500000000000000000',
              tokenId: null,
              contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
              symbol: 'MANA',
              name: 'MANA',
              decimals: 18,
              logoUrl: null,
              dollarValue: null
            }
          ]
        })
      }
    })

    it('should group the amount with thousands separators', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('1,000,000.5 MANA')).toBeInTheDocument()
    })
  })

  describe('and a transfer has no decimals-applied amount', () => {
    beforeEach(() => {
      simulation = {
        status: 'ready',
        result: emptyResult({
          assetChanges: [
            {
              type: 'transfer',
              standard: 'erc20',
              from: USER,
              to: '0x1234567890abcdef1234567890abcdef12345678',
              amount: null,
              rawAmount: '1000000000000000000',
              tokenId: null,
              contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
              symbol: 'TKN',
              name: 'Token',
              decimals: 18,
              logoUrl: null,
              dollarValue: null
            }
          ]
        })
      }
    })

    it('should show the symbol without the base-unit rawAmount', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('TKN')).toBeInTheDocument()
      expect(screen.queryByText(/1000000000000000000|1,000,000,000,000,000,000/)).not.toBeInTheDocument()
    })
  })

  describe('and a finite approval has no decimals-applied amount', () => {
    beforeEach(() => {
      simulation = {
        status: 'ready',
        result: emptyResult({
          approvalChanges: [
            {
              kind: 'approval',
              standard: 'erc20',
              owner: USER,
              spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
              amount: null,
              rawAmount: '5000000',
              isUnlimited: false,
              tokenId: null,
              approved: null,
              contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
              symbol: 'USDC',
              name: 'USD Coin'
            }
          ]
        })
      }
    })

    it('should state the permission without a base-unit figure', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText(/approval_can_spend_symbol/)).toBeInTheDocument()
      expect(screen.queryByText(/5000000/)).not.toBeInTheDocument()
    })
  })

  describe('and a gas footer is provided', () => {
    beforeEach(() => {
      simulation = { status: 'ready', result: emptyResult({}) }
    })

    it('should render the gas-covered note grouped inside the summary', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} gas={{ covered: true, cost: '0', balance: '0' }} />)
      expect(screen.getByText(/gas_covered/)).toBeInTheDocument()
    })

    it('should render the transaction cost when the user pays gas', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} gas={{ covered: false, cost: '0.0025', balance: '1.5' }} />)
      expect(screen.getByText(/transaction_cost 0.0025/)).toBeInTheDocument()
    })
  })

  describe('and no gas footer is provided', () => {
    beforeEach(() => {
      simulation = { status: 'ready', result: emptyResult({}) }
    })

    it('should not render any gas note (signature previews are gasless)', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.queryByText(/gas_covered|transaction_cost/)).not.toBeInTheDocument()
    })
  })

  describe('and the net balance-change address is checksummed', () => {
    beforeEach(() => {
      simulation = {
        status: 'ready',
        result: emptyResult({ balanceChanges: [{ address: USER.toUpperCase().replace('0X', '0x'), dollarValue: '-10' }] })
      }
    })

    it('should still render the net change (address compared case-insensitively)', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('-$10.00')).toBeInTheDocument()
    })
  })
})
