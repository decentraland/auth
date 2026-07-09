import { render, screen } from '@testing-library/react'
import { SimulationResponseBody } from '../../../../../shared/auth'
import { SimulationState } from '../../types'
import { SimulationSummary } from './SimulationSummary'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'

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
        ]
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
        result: { status: 'reverted', error: 'ERC20: transfer amount exceeds balance', assetChanges: [], approvalChanges: [] }
      }
    })

    it('should render the revert warning title', () => {
      render(<SimulationSummary simulation={simulation} userAddress={USER} />)
      expect(screen.getByText('request.transaction_dialog.revert_title')).toBeInTheDocument()
    })
  })
})
