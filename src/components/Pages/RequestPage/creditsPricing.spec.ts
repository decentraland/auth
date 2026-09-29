import { approximateChargeBounds, approximateCredits, manaWeiToUsdWei } from './creditsPricing'

// The Amoy feed's answer while the MANA-priced screens were built: $0.26960836 per MANA, 8 decimals. It is
// the rate credits-server logged for the three-credit primary sales QA bought on decentraland.zone.
const AMOY_RATE = { rate: 26_960_836n, decimals: 8 }
const MANA = 10n ** 18n

describe('when converting a MANA price into USD at a rate', () => {
  it('should scale by the rate and its decimals, truncating like every other reader of the feed', () => {
    expect(manaWeiToUsdWei(MANA, AMOY_RATE)).toBe(269_608_360_000_000_000n)
  })
})

describe('when working out the approximate credits of a MANA price', () => {
  it('should round up to a whole credit, as the shop quotes and the credits-server charges it', () => {
    // 1.1 MANA is $0.2966, which is 2.97 credits: the buyer pays for three.
    expect(approximateCredits(11n * 10n ** 17n, AMOY_RATE)).toBe(3n)
  })

  it('should not round up a price that is already a whole number of credits', () => {
    // $0.30 exactly, at a rate of $0.30 a MANA.
    expect(approximateCredits(MANA, { rate: 30_000_000n, decimals: 8 })).toBe(3n)
  })

  it('should come to no credits for a price worth less than a USD wei, which no ledger charge can match', () => {
    // Nothing is rounded up out of nothing: such a purchase ends on the generic review, because the smallest
    // charge the ledger can record (one credit) falls outside its bounds.
    expect(approximateCredits(1n, AMOY_RATE)).toBe(0n)
    expect(approximateChargeBounds(1n, AMOY_RATE).maxCents < 10n).toBe(true)
  })
})

describe('when bounding the charge a MANA price may carry on the ledger', () => {
  describe('and the price is the one QA bought on Amoy', () => {
    it('should include the charge the credits-server actually recorded for it', () => {
      // credits-server logged 30 cents for these purchases at this very rate.
      const { minCents, maxCents } = approximateChargeBounds(11n * 10n ** 17n, AMOY_RATE)
      expect(minCents <= 30n && 30n <= maxCents).toBe(true)
    })
  })

  describe('and the rate moved within the tolerance between the quote and the review', () => {
    it('should include a charge quoted 2% cheaper and one quoted 2% dearer', () => {
      // 100 MANA at $0.50 is $50.00 (500 credits). Quoted at ±2%: $49.00 and $51.00.
      const rate = { rate: 50_000_000n, decimals: 8 }
      const { minCents, maxCents } = approximateChargeBounds(100n * MANA, rate)
      expect(minCents).toBe(4_900n)
      expect(maxCents).toBe(5_100n)
    })
  })

  describe('and the charge is for a different price altogether', () => {
    it('should leave out a credit authorized for ten times the item', () => {
      // The case the check exists for: a credit sized for one purchase, spent on a much cheaper item.
      const { maxCents } = approximateChargeBounds(11n * 10n ** 17n, AMOY_RATE)
      expect(300n > maxCents).toBe(true)
    })

    it('should leave out a charge just past the tolerance on either side', () => {
      const rate = { rate: 50_000_000n, decimals: 8 }
      const { minCents, maxCents } = approximateChargeBounds(100n * MANA, rate)
      expect(4_890n < minCents).toBe(true)
      expect(5_110n > maxCents).toBe(true)
    })
  })

  describe('and the price is exactly a whole number of credits at the rate', () => {
    it('should accept that number and one more, which is what the same price quoted after MANA rose is', () => {
      // $0.10 exactly: one credit today, two after any rise at all. Wider than ±2% for a cheap item, on
      // purpose; the screen states the charge itself, not this conversion.
      const { minCents, maxCents } = approximateChargeBounds(MANA, { rate: 10_000_000n, decimals: 8 })
      expect(minCents).toBe(10n)
      expect(maxCents).toBe(20n)
    })
  })

  it('should only ever bound whole credits, which is how the ledger records a charge', () => {
    const { minCents, maxCents } = approximateChargeBounds(123_456_789_012_345_678n, AMOY_RATE)
    expect(minCents % 10n).toBe(0n)
    expect(maxCents % 10n).toBe(0n)
  })
})
