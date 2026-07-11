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

    it('should render the loading message', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('request.transaction_dialog.simulation_loading')).toBeInTheDocument()
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
})
