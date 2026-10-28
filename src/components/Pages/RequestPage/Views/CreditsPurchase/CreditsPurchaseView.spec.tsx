import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Rarity } from '@dcl/schemas'
import { DclThemeProvider, darkTheme } from 'decentraland-ui2'
import type { CreditsPurchase } from '../../creditsPurchase'
import type { CreditsPurchaseData } from '../../types'
import { CreditsPurchaseOutcomeView } from './CreditsPurchaseOutcomeView'
import { CreditsPurchaseView } from './CreditsPurchaseView'
import { CreditsPurchaseViewProps } from './CreditsPurchase.types'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({
    // Values are rendered too, so a test can assert that what the copy interpolates is what reaches it.
    t: (key: string, values?: Record<string, string | number>) => (values ? `${key} ${JSON.stringify(values)}` : key)
  })
}))

// TransferLayout renders the WebGL AnimatedBackground, which jsdom can't run.
jest.mock('../../../../AnimatedBackground', () => ({
  AnimatedBackground: () => null
}))

const BUYER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
const SELLER = '0x5e11e50000000000000000000000000000005e11'
const COLLECTION = '0xd0e9b1e87f94ecedf15db41ddb95f1825d5e3f3f'

const purchase = (overrides: Partial<CreditsPurchase> = {}): CreditsPurchase => ({
  creditsManagerAddress: '0x8b3a40ca1b6f5cafc99d112a4d02e897d1fd8cc5',
  via: 'marketplace',
  settlementAddress: '0xa40b1d129b8906888720686f3a01921ddf37716f',
  settlementName: 'OffChainMarketplaceV2' as CreditsPurchase['settlementName'],
  asset: { kind: 'collection_item', contractAddress: COLLECTION, itemId: '0' },
  recipient: BUYER,
  seller: SELLER,
  paymentBeneficiary: SELLER,
  paymentTokenAddress: '0xa1c57f48f0deb89f569dfbe6e2b7f46d33606fd4',
  price: { kind: 'usd_pegged', usdWei: 700000000000000000n, credits: 7n },
  maxCreditedValueWei: 1000000000000000000n,
  creditSalt: `0x${'ab'.repeat(32)}`,
  tradeExpiresAt: 4102444800n,
  creditExpiresAt: 4102444800n,
  expiresAt: 4102444800n,
  ...overrides
})

const purchaseData = (overrides: Partial<CreditsPurchaseData> = {}): CreditsPurchaseData => ({
  purchase: purchase(),
  pricing: { kind: 'exact', credits: 7n },
  metadata: { imageUrl: 'https://peer.decentraland.org/content/contents/hash', name: 'UpperHead AHL', rarity: Rarity.EPIC },
  ...overrides
})

const renderView = (props: CreditsPurchaseViewProps) =>
  render(
    <DclThemeProvider theme={darkTheme}>
      <CreditsPurchaseView {...props} />
    </DclThemeProvider>
  )

describe('when confirming a credits purchase', () => {
  let props: CreditsPurchaseViewProps
  let onApprove: jest.Mock
  let onDeny: jest.Mock
  let onCallbackAcknowledgedChange: jest.Mock

  beforeEach(() => {
    onApprove = jest.fn()
    onDeny = jest.fn()
    onCallbackAcknowledgedChange = jest.fn()
    props = { purchaseData: purchaseData(), chainId: 137, isLoading: false, onApprove, onDeny, onCallbackAcknowledgedChange }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should state the price in credits, the quantity and the account the item is delivered to', () => {
    renderView(props)

    expect(screen.getByTestId('credits-purchase-price')).toHaveTextContent('credits_purchase.confirm.price {"credits":"7"}')
    expect(screen.getByTestId('credits-purchase-mark')).toBeInTheDocument()
    expect(screen.getByTestId('credits-purchase-quantity')).toHaveTextContent('credits_purchase.confirm.quantity')
    expect(screen.getByTestId('credits-purchase-recipient')).toHaveTextContent(BUYER)
  })

  it('should name the item by the metadata when it was read', () => {
    renderView(props)

    expect(screen.getByTestId('credits-purchase-item-name')).toHaveTextContent('UpperHead AHL')
    expect(screen.queryByTestId('credits-purchase-item-identifiers')).not.toBeInTheDocument()
  })

  describe('and the item cosmetic details could not be read', () => {
    beforeEach(() => {
      props = { ...props, purchaseData: purchaseData({ metadata: null }) }
    })

    it('should name it by the identifiers out of the signed trade, and keep the price', () => {
      renderView(props)

      expect(screen.getByTestId('credits-purchase-item-identifiers')).toHaveTextContent(COLLECTION)
      expect(screen.getByTestId('credits-purchase-price')).toHaveTextContent('{"credits":"7"}')
    })
  })

  it('should show the contracts and the raw amounts in the technical details', () => {
    renderView(props)

    expect(screen.getByTestId('credits-purchase-detail-collection')).toHaveTextContent(COLLECTION)
    expect(screen.getByTestId('credits-purchase-detail-price-usd-wei')).toHaveTextContent('700000000000000000')
    expect(screen.getByTestId('credits-purchase-detail-settlement')).toHaveTextContent('0xa40b1d129b8906888720686f3a01921ddf37716f')
    expect(screen.getByTestId('credits-purchase-detail-seller')).toHaveTextContent(SELLER)
  })

  it('should label the MANA cap as MANA, so it can never read as the credits price', () => {
    renderView(props)

    const cap = screen.getByTestId('credits-purchase-detail-max-credited')
    expect(cap).toHaveTextContent('credits_purchase.details.max_credited_mana')
    expect(cap).toHaveTextContent('MANA')
  })

  describe('and the credit expires before the listing', () => {
    let deadline: bigint

    beforeEach(() => {
      deadline = 1900000000n
      props.purchaseData.purchase = purchase({ creditExpiresAt: deadline, expiresAt: deadline })
      renderView(props)
    })

    it('should show the enforced purchase deadline as the authorization expiry', () => {
      expect(screen.getByTestId('credits-purchase-detail-expires')).toHaveTextContent(new Date(Number(deadline) * 1000).toLocaleString())
    })
  })

  describe('and the page has not cleared the gates for this review', () => {
    beforeEach(() => {
      props = { ...props, approveBlocked: true }
    })

    it('should disable the confirmation while leaving the cancel available', async () => {
      renderView(props)

      expect(screen.getByTestId('transfer-confirm-button')).toBeDisabled()
      await userEvent.click(screen.getByTestId('transfer-cancel-button'))
      expect(onDeny).toHaveBeenCalled()
    })
  })

  describe('and some address the call reaches had no code when it was checked', () => {
    beforeEach(() => {
      props = { ...props, callbackAddresses: [SELLER], callbackAcknowledged: false }
    })

    it('should ask for the delayed-code consent', async () => {
      renderView(props)

      expect(screen.getByTestId('callback-code-warning')).toBeInTheDocument()
      await userEvent.click(screen.getByTestId('credits-purchase-callback-acknowledgment'))
      expect(onCallbackAcknowledgedChange).toHaveBeenCalledWith(true)
    })
  })

  describe('and the approval hands the user to a wallet prompt that is still open', () => {
    let resolveApproval: () => void

    beforeEach(() => {
      onApprove.mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolveApproval = resolve
          })
      )
    })

    it('should show the processing state instead of the buttons while the prompt is open', async () => {
      renderView(props)

      await userEvent.click(screen.getByTestId('transfer-confirm-button'))

      expect(screen.queryByTestId('transfer-confirm-button')).not.toBeInTheDocument()
      expect(screen.getByTestId('credits-purchase-title')).toHaveTextContent('credits_purchase.confirm.processing_title')
      resolveApproval()
    })
  })
})

describe('when a credits purchase review has ended', () => {
  const renderOutcome = (outcome: 'signed' | 'canceled') =>
    render(
      <DclThemeProvider theme={darkTheme}>
        <CreditsPurchaseOutcomeView purchaseData={purchaseData()} outcome={outcome} />
      </DclThemeProvider>
    )

  it('should say the signature was returned, never that the purchase settled', () => {
    renderOutcome('signed')

    expect(screen.getByTestId('credits-purchase-outcome-title')).toHaveTextContent('credits_purchase.signed.title')
    expect(screen.getByTestId('credits-purchase-outcome-description')).toHaveTextContent('credits_purchase.signed.description')
  })

  it('should say nothing was signed when the user refused it', () => {
    renderOutcome('canceled')

    expect(screen.getByTestId('credits-purchase-outcome-title')).toHaveTextContent('credits_purchase.canceled.title')
    expect(screen.getByTestId('credits-purchase-outcome-description')).toHaveTextContent('credits_purchase.canceled.description')
  })

  it('should keep naming the price in credits, with the currency mark', () => {
    renderOutcome('signed')

    expect(screen.getByTestId('credits-purchase-outcome-price')).toHaveTextContent('{"credits":"7"}')
    expect(screen.getByTestId('credits-purchase-outcome-mark')).toBeInTheDocument()
  })
})

describe('when confirming a primary sale priced in MANA', () => {
  const MANA_PRICE_WEI = 1100000000000000000n
  const RATE = { rate: 26960836n, decimals: 8 }
  const manaPriced = (): CreditsPurchaseData =>
    purchaseData({
      purchase: purchase({
        via: 'collection_store',
        settlementAddress: '0x214ffc0f0103735728dc66b61a22e4f163e275ae',
        settlementName: 'CollectionStore' as CreditsPurchase['settlementName'],
        seller: null,
        paymentBeneficiary: null,
        tradeExpiresAt: null,
        price: { kind: 'mana', manaWei: MANA_PRICE_WEI }
      }),
      pricing: { kind: 'converted', credits: 3n, manaWei: MANA_PRICE_WEI, rate: RATE }
    })

  it('should state the verified charge as the price, as a plain number of credits', () => {
    // The number is the ledger's charge, which is what the balance loses; only its relation to the MANA
    // price depends on the day's rate, and the note under it says so.
    renderView({ purchaseData: manaPriced(), onDeny: jest.fn(), onApprove: jest.fn() })
    const price = screen.getByTestId('credits-purchase-price')
    expect(price).toHaveTextContent('credits_purchase.confirm.price {"credits":"3"}')
    expect(price).toHaveAttribute('data-pricing', 'converted')
  })

  it('should say under the price which MANA amount the credits were worked out from', () => {
    renderView({ purchaseData: manaPriced(), onDeny: jest.fn(), onApprove: jest.fn() })
    expect(screen.getByTestId('credits-purchase-price-note')).toHaveTextContent('credits_purchase.confirm.priced_in_mana {"mana":"1.1"}')
  })

  it('should list the signed MANA price, the rate used and the store contract in the details', async () => {
    renderView({ purchaseData: manaPriced(), onDeny: jest.fn(), onApprove: jest.fn() })
    await userEvent.click(screen.getByText('credits_purchase.details.title'))
    expect(screen.getByTestId('credits-purchase-detail-price-mana')).toHaveTextContent('1.1 MANA')
    expect(screen.getByTestId('credits-purchase-detail-mana-usd-rate')).toHaveTextContent('1 MANA = 0.26960836 USD')
    expect(screen.getByTestId('credits-purchase-detail-settlement')).toHaveTextContent('credits_purchase.details.collection_store')
  })

  it('should not list a seller, a payment beneficiary or a trade expiry the store purchase does not have', async () => {
    renderView({ purchaseData: manaPriced(), onDeny: jest.fn(), onApprove: jest.fn() })
    await userEvent.click(screen.getByText('credits_purchase.details.title'))
    expect(screen.queryByTestId('credits-purchase-detail-seller')).not.toBeInTheDocument()
    expect(screen.queryByTestId('credits-purchase-detail-payment-beneficiary')).not.toBeInTheDocument()
    expect(screen.queryByTestId('credits-purchase-detail-trade-expires')).not.toBeInTheDocument()
    expect(screen.queryByTestId('credits-purchase-detail-price-usd-wei')).not.toBeInTheDocument()
    expect(screen.getByTestId('credits-purchase-detail-credit-expires')).toBeInTheDocument()
  })

  it('should state the same charge on the outcome screen, without repeating the note', () => {
    render(
      <DclThemeProvider theme={darkTheme}>
        <CreditsPurchaseOutcomeView purchaseData={manaPriced()} outcome="signed" delivery="delivered" />
      </DclThemeProvider>
    )
    expect(screen.getByTestId('credits-purchase-outcome-price')).toHaveTextContent('credits_purchase.confirm.price {"credits":"3"}')
    expect(screen.queryByTestId('credits-purchase-outcome-price-note')).not.toBeInTheDocument()
  })
})
