import { pad, toFunctionSelector } from 'viem'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ContractName, getContract } from 'decentraland-transactions'
import { KnownContract, decodeKnownContractCall, getKnownDecentralandContract } from '../../../shared/auth'
import { CreditsRecognition, USD_WEI_PER_CREDIT, recognizeCreditsPurchase, toCredits } from './creditsPurchase'
import {
  ACCEPT_SELECTOR,
  BUYER,
  COLLECTION,
  EXPLORER_GOLDEN_ARGS,
  EXPLORER_GOLDEN_USE_CREDITS,
  FAR_FUTURE,
  POLYGON,
  REAL_LISTING_CREDITS,
  REAL_LISTING_ITEM_ID,
  REAL_LISTING_PRICE_USD_WEI,
  SELLER,
  UseCreditsArgs,
  ZERO_BYTES32,
  buildTrade,
  buildUseCreditsArgs,
  encodeAccept,
  encodeUseCredits,
  manaContract,
  marketplaceContract
} from './TestViewPage/creditsPurchaseVectors'

const creditsManager = getKnownDecentralandContract(getContract(ContractName.CreditsManager, POLYGON).address, POLYGON) as KnownContract
const NOW_SECONDS = 1_760_000_000

/** Recognizes the payload the way the page does: decoded against the CreditsManager ABI, then read. */
const recognize = (calldata: string, { signerAddress = BUYER, contract = creditsManager, chainId = POLYGON } = {}): CreditsRecognition => {
  const call = decodeKnownContractCall(contract, calldata)
  if (!call) throw new Error('the fixture does not decode against the contract ABI')
  return recognizeCreditsPurchase(contract, call, { signerAddress, chainId, nowSeconds: NOW_SECONDS })
}

const recognizeArgs = (args: UseCreditsArgs, options?: Parameters<typeof recognize>[1]) => recognize(encodeUseCredits(args), options)

/** The reason a payload was refused, for the table-driven cases below. */
const reasonOf = (recognition: CreditsRecognition): string =>
  recognition.status === 'unsupported' ? recognition.reason : recognition.status

describe('when reading a credits purchase out of a useCredits call', () => {
  describe('and the payload is the Explorer golden vector', () => {
    it('should encode to the exact bytes the Explorer signs', () => {
      expect(encodeUseCredits(EXPLORER_GOLDEN_ARGS).toLowerCase()).toBe(EXPLORER_GOLDEN_USE_CREDITS.toLowerCase())
    })

    it('should decode into the nested accept call through both contract ABIs', () => {
      const call = decodeKnownContractCall(creditsManager, EXPLORER_GOLDEN_USE_CREDITS)
      expect(call?.functionName).toBe('useCredits')
      const args = call?.args[0] as { externalCall: { selector: string; data: string } }
      expect(args.externalCall.selector).toBe(ACCEPT_SELECTOR)
      const marketplace = getKnownDecentralandContract(marketplaceContract.address, POLYGON) as KnownContract
      const accept = decodeKnownContractCall(marketplace, `${args.externalCall.selector}${args.externalCall.data.slice(2)}`)
      expect(accept?.functionName).toBe('accept')
      expect(Array.isArray(accept?.args[0]) && (accept?.args[0] as unknown[]).length).toBe(1)
    })

    it('should not be summarized as a purchase: it spends the buyer own MANA and carries an external check', () => {
      expect(reasonOf(recognize(EXPLORER_GOLDEN_USE_CREDITS))).toBe('own_wallet_spend')
    })
  })

  describe('and the payload is a real single-item credits purchase', () => {
    it('should be recognized', () => {
      const recognition = recognizeArgs(buildUseCreditsArgs())
      expect(recognition.status).toBe('recognized')
    })

    it('should price it from the signed USD-pegged amount alone, matching the catalogue', () => {
      const recognition = recognizeArgs(buildUseCreditsArgs())
      if (recognition.status !== 'recognized') throw new Error(reasonOf(recognition))
      expect(recognition.purchase.priceUsdWei).toBe(REAL_LISTING_PRICE_USD_WEI)
      expect(recognition.purchase.credits).toBe(REAL_LISTING_CREDITS)
    })

    it('should name the item, the recipient, the seller and every contract from the payload', () => {
      const recognition = recognizeArgs(buildUseCreditsArgs())
      if (recognition.status !== 'recognized') throw new Error(reasonOf(recognition))
      const { purchase } = recognition
      expect(purchase.asset).toEqual({ kind: 'collection_item', contractAddress: COLLECTION, itemId: REAL_LISTING_ITEM_ID })
      expect(purchase.recipient).toBe(BUYER.toLowerCase())
      expect(purchase.seller).toBe(SELLER.toLowerCase())
      expect(purchase.paymentBeneficiary).toBe(SELLER.toLowerCase())
      expect(purchase.paymentTokenAddress).toBe(manaContract.address.toLowerCase())
      expect(purchase.marketplaceAddress).toBe(marketplaceContract.address.toLowerCase())
      expect(purchase.marketplaceName).toBe(ContractName.OffChainMarketplaceV2)
      expect(purchase.creditsManagerAddress).toBe(creditsManager.address)
    })

    it('should keep the MANA cap as MANA and never as the credits price', () => {
      const recognition = recognizeArgs(buildUseCreditsArgs({ maxCreditedValue: 5_000_000_000_000_000_000n }))
      if (recognition.status !== 'recognized') throw new Error(reasonOf(recognition))
      expect(recognition.purchase.maxCreditedValueWei).toBe(5_000_000_000_000_000_000n)
      expect(recognition.purchase.credits).toBe(REAL_LISTING_CREDITS)
    })

    it('should recognize a secondary listing of an ERC-721 token', () => {
      const trade = buildTrade({
        sent: [{ assetType: 3n, contractAddress: COLLECTION, value: 4242n, beneficiary: BUYER, extra: '0x' }]
      })
      const recognition = recognizeArgs(buildUseCreditsArgs({ trades: [trade] }))
      if (recognition.status !== 'recognized') throw new Error(reasonOf(recognition))
      expect(recognition.purchase.asset).toEqual({ kind: 'erc721', contractAddress: COLLECTION, tokenId: '4242' })
    })

    it('should settle through the previous off-chain marketplace deployment as well', () => {
      const previous = getContract(ContractName.OffChainMarketplace, POLYGON)
      const recognition = recognizeArgs(buildUseCreditsArgs({ target: previous.address }))
      if (recognition.status !== 'recognized') throw new Error(reasonOf(recognition))
      expect(recognition.purchase.marketplaceName).toBe(ContractName.OffChainMarketplace)
    })
  })

  describe('and the request is not a credits purchase', () => {
    it('should be unrelated for another Decentraland contract', () => {
      const mana = getKnownDecentralandContract(manaContract.address, POLYGON) as KnownContract
      const call = { functionName: 'transfer', args: [], payable: false, forwardsCall: false }
      expect(recognizeCreditsPurchase(mana, call, { signerAddress: BUYER, chainId: POLYGON, nowSeconds: NOW_SECONDS })).toEqual({
        status: 'unrelated'
      })
    })

    it('should be unsupported for another CreditsManager function', () => {
      const call = { functionName: 'revokeCredit', args: ['0x'], payable: false, forwardsCall: false }
      expect(recognizeCreditsPurchase(creditsManager, call, { signerAddress: BUYER, chainId: POLYGON, nowSeconds: NOW_SECONDS })).toEqual({
        status: 'unsupported',
        reason: 'not_use_credits'
      })
    })
  })

  describe('and the payload deviates from the supported purchase', () => {
    const cases: Array<[string, () => UseCreditsArgs, string]> = [
      ['the buyer also spends MANA from their own wallet', () => buildUseCreditsArgs({ maxUncreditedValue: 1n }), 'own_wallet_spend'],
      [
        'a custom external-call signature authorizes the call instead of the allowlist',
        () => buildUseCreditsArgs({ customExternalCallSignature: `0x${'aa'.repeat(65)}` }),
        'custom_external_call'
      ],
      [
        'more than one credit is spent',
        () =>
          buildUseCreditsArgs({
            credits: [
              { value: 1n, expiresAt: FAR_FUTURE, salt: ZERO_BYTES32 },
              { value: 2n, expiresAt: FAR_FUTURE, salt: ZERO_BYTES32 }
            ],
            creditsSignatures: [`0x${'cd'.repeat(65)}`, `0x${'ce'.repeat(65)}`]
          }),
        'credit_count'
      ],
      ['no credit is spent', () => buildUseCreditsArgs({ credits: [], creditsSignatures: [] }), 'credit_count'],
      [
        'the credit has expired',
        () => buildUseCreditsArgs({ credits: [{ value: 1n, expiresAt: BigInt(NOW_SECONDS - 1), salt: ZERO_BYTES32 }] }),
        'expired'
      ],
      ['the external call has expired', () => buildUseCreditsArgs({ externalCall: { expiresAt: BigInt(NOW_SECONDS - 1) } }), 'expired'],
      [
        'the listing has expired',
        () => buildUseCreditsArgs({ trades: [buildTrade({ checks: { expiration: BigInt(NOW_SECONDS - 1) } as never })] }),
        'expired'
      ],
      [
        'the listing is not effective yet',
        () => buildUseCreditsArgs({ trades: [buildTrade({ checks: { effective: BigInt(NOW_SECONDS + 1) } as never })] }),
        'expired'
      ],
      [
        'the external call targets a contract that is not a Decentraland marketplace',
        () => buildUseCreditsArgs({ target: '0x1111111111111111111111111111111111111111' }),
        'not_a_marketplace'
      ],
      [
        'the external call targets another Decentraland contract',
        () => buildUseCreditsArgs({ target: getContract(ContractName.CollectionStore, POLYGON).address }),
        'not_a_marketplace'
      ],
      [
        'the external call is not an accept',
        () => buildUseCreditsArgs({ selector: toFunctionSelector('acceptWithCoupon((address,bytes,((uint256)))[],(uint256)[])') }),
        'not_an_accept'
      ],
      [
        'the accept payload carries trailing bytes',
        () =>
          buildUseCreditsArgs({
            externalCall: { data: `${encodeAccept([buildTrade()])}00` }
          }),
        'not_an_accept'
      ],
      ['more than one trade is accepted', () => buildUseCreditsArgs({ trades: [buildTrade(), buildTrade()] }), 'multiple_trades'],
      [
        'the trade is gated by an allowlist root',
        () => buildUseCreditsArgs({ trades: [buildTrade({ checks: { allowedRoot: pad('0x01', { size: 32 }) } as never })] }),
        'gated_trade'
      ],
      [
        'the trade carries an external check',
        () =>
          buildUseCreditsArgs({
            trades: [
              buildTrade({
                checks: {
                  externalChecks: [
                    { contractAddress: '0x1111111111111111111111111111111111111111', selector: '0xdeadbeef', value: '0x', required: true }
                  ]
                } as never
              })
            ]
          }),
        'external_checks'
      ],
      [
        'the trade sends more than one asset',
        () =>
          buildUseCreditsArgs({
            trades: [
              buildTrade({
                sent: [
                  { assetType: 4n, contractAddress: COLLECTION, value: 0n, beneficiary: BUYER, extra: '0x' },
                  { assetType: 4n, contractAddress: COLLECTION, value: 1n, beneficiary: BUYER, extra: '0x' }
                ]
              })
            ]
          }),
        'multiple_assets'
      ],
      [
        'the asset is a token type the purchase screen does not describe',
        () =>
          buildUseCreditsArgs({
            trades: [buildTrade({ sent: [{ assetType: 1n, contractAddress: COLLECTION, value: 1n, beneficiary: BUYER, extra: '0x' }] })]
          }),
        'asset_type'
      ],
      [
        'the asset carries extra bytes for its own contract',
        () =>
          buildUseCreditsArgs({
            trades: [buildTrade({ sent: [{ assetType: 4n, contractAddress: COLLECTION, value: 0n, beneficiary: BUYER, extra: '0xdead' }] })]
          }),
        'asset_type'
      ],
      [
        'the item is delivered to another account',
        () =>
          buildUseCreditsArgs({
            trades: [
              buildTrade({
                sent: [
                  {
                    assetType: 4n,
                    contractAddress: COLLECTION,
                    value: 0n,
                    beneficiary: '0x1111111111111111111111111111111111111111',
                    extra: '0x'
                  }
                ]
              })
            ]
          }),
        'another_recipient'
      ],
      [
        'the price is denominated in MANA rather than pegged to USD',
        () =>
          buildUseCreditsArgs({
            trades: [
              buildTrade({
                received: [{ assetType: 1n, contractAddress: manaContract.address, value: 10n ** 18n, beneficiary: SELLER, extra: '0x' }]
              })
            ]
          }),
        'price_asset_type'
      ],
      [
        'the payment is taken in a token that is not the chain MANA',
        () =>
          buildUseCreditsArgs({
            trades: [
              buildTrade({
                received: [
                  {
                    assetType: 2n,
                    contractAddress: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
                    value: REAL_LISTING_PRICE_USD_WEI,
                    beneficiary: SELLER,
                    extra: '0x'
                  }
                ]
              })
            ]
          }),
        'payment_token'
      ],
      [
        'the trade has no price',
        () =>
          buildUseCreditsArgs({
            trades: [
              buildTrade({
                received: [{ assetType: 2n, contractAddress: manaContract.address, value: 0n, beneficiary: SELLER, extra: '0x' }]
              })
            ]
          }),
        'no_price'
      ],
      [
        'the trade receives more than one payment',
        () =>
          buildUseCreditsArgs({
            trades: [
              buildTrade({
                received: [
                  {
                    assetType: 2n,
                    contractAddress: manaContract.address,
                    value: REAL_LISTING_PRICE_USD_WEI,
                    beneficiary: SELLER,
                    extra: '0x'
                  },
                  { assetType: 2n, contractAddress: manaContract.address, value: 1n, beneficiary: SELLER, extra: '0x' }
                ]
              })
            ]
          }),
        'multiple_assets'
      ]
    ]

    it.each(cases)('should refuse to summarize it when %s', (_name, build, reason) => {
      expect(reasonOf(recognizeArgs(build()))).toBe(reason)
    })
  })

  describe('and the reviewing account is not the one the purchase delivers to', () => {
    it('should refuse to summarize it', () => {
      expect(reasonOf(recognizeArgs(buildUseCreditsArgs(), { signerAddress: '0x1111111111111111111111111111111111111111' }))).toBe(
        'another_recipient'
      )
    })
  })

  describe('and the chain is one the marketplace is not deployed on', () => {
    it('should refuse to summarize it rather than resolving the target elsewhere', () => {
      expect(reasonOf(recognizeArgs(buildUseCreditsArgs(), { chainId: ChainId.ETHEREUM_MAINNET }))).toBe('not_a_marketplace')
    })
  })

  describe('and the decoded arguments are not the shape a decode produces', () => {
    it('should refuse to summarize it instead of throwing', () => {
      const call = { functionName: 'useCredits', args: [null], payable: false, forwardsCall: false }
      expect(recognizeCreditsPurchase(creditsManager, call, { signerAddress: BUYER, chainId: POLYGON, nowSeconds: NOW_SECONDS })).toEqual({
        status: 'unsupported',
        reason: 'malformed_arguments'
      })
    })

    it('should refuse a reader that throws rather than letting it reach the page', () => {
      const exploding = {
        functionName: 'useCredits',
        args: [
          {
            get customExternalCallSignature() {
              throw new Error('boom')
            }
          }
        ],
        payable: false,
        forwardsCall: false
      }
      expect(
        recognizeCreditsPurchase(creditsManager, exploding, { signerAddress: BUYER, chainId: POLYGON, nowSeconds: NOW_SECONDS })
      ).toEqual({ status: 'unsupported', reason: 'malformed_arguments' })
    })
  })
})

describe('when converting a signed USD-pegged price into credits', () => {
  it('should charge one credit for every ten cents, rounding up', () => {
    expect(toCredits(USD_WEI_PER_CREDIT)).toBe(1n)
    expect(toCredits(USD_WEI_PER_CREDIT + 1n)).toBe(2n)
    expect(toCredits(REAL_LISTING_PRICE_USD_WEI)).toBe(7n)
    expect(toCredits(2_510_000_000_000_000_000n)).toBe(26n)
  })

  it('should stay exact for amounts no floating-point number could hold', () => {
    // 1.2345…e29 USD wei is 1234567890123.4567… credits; a double would have lost the fractional part
    // that makes the difference between rounding up and not.
    expect(toCredits(123_456_789_012_345_678_901_234_567_890n)).toBe(1_234_567_890_124n)
  })
})
