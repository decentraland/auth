import { AuthIdentity } from '@dcl/crypto'
import signedFetch from 'decentraland-crypto-fetch'
import { config } from '../../../modules/config'
import { AuthorizedChargeResult, fetchAuthorizedCharge, verifyAuthorizedCharge } from './authorizedCharge'

// eslint-disable-next-line @typescript-eslint/naming-convention -- the ES-module interop flag is named by the spec
jest.mock('decentraland-crypto-fetch', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('../../../modules/config', () => ({ config: { get: jest.fn() } }))

const mockSignedFetch = signedFetch as unknown as jest.Mock
const mockConfigGet = config.get as unknown as jest.Mock

const SALT = `0x${'a1'.repeat(32)}`
const IDENTITY = { ephemeralIdentity: {}, expiration: new Date(), authChain: [] } as unknown as AuthIdentity
const CREDITS_SERVER_URL = 'https://credits.example.org'

/** A fetch Response as this module reads one: a status, and a body it takes as text (see readTextWithCap). */
const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    body: undefined,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
  }) as unknown as Response

const found = (charge: { cents: number; lines?: number; status?: string }): AuthorizedChargeResult => ({
  status: 'found',
  charge: { cents: charge.cents, lines: charge.lines ?? 1, status: charge.status ?? 'pending' }
})

// The real listing the decoder is pinned against: 7 credits, which the ledger accounts for as 70 cents.
const SEVEN_CREDITS_IN_CENTS = 70n

describe('when checking what a credits purchase actually charges the buyer', () => {
  describe('and the ledger charges exactly what the signed trade is worth', () => {
    it('should let the purchase be priced on screen', () => {
      expect(verifyAuthorizedCharge(found({ cents: 70 }), SEVEN_CREDITS_IN_CENTS)).toBe('verified')
    })
  })

  describe('and the authorization is for more than the item costs', () => {
    it('should refuse to price it — this is the whole reason the check exists', () => {
      // A credit authorized for 100 credits, spent on the 7-credit trade on screen. Every structural check
      // passes: the cap covers it, nothing comes out of the wallet, one credit, one trade. Only the ledger
      // knows that consuming this salt settles a 1000-cent intent.
      expect(verifyAuthorizedCharge(found({ cents: 1000 }), SEVEN_CREDITS_IN_CENTS)).toBe('mismatch')
    })
  })

  describe('and the authorization is for less than the item costs', () => {
    it('should refuse to price it as well', () => {
      expect(verifyAuthorizedCharge(found({ cents: 60 }), SEVEN_CREDITS_IN_CENTS)).toBe('mismatch')
    })
  })

  describe('and the charge differs by a single cent', () => {
    it('should refuse to price it: the screen states a number, not an approximation', () => {
      expect(verifyAuthorizedCharge(found({ cents: 71 }), SEVEN_CREDITS_IN_CENTS)).toBe('mismatch')
    })
  })

  describe('and the salt pays for more than one line of a checkout', () => {
    it('should refuse to price it, whatever the total comes to', () => {
      // Settlement takes every line sharing the salt at once. Even a total that happens to match the one
      // item on screen is a group this screen cannot describe.
      expect(verifyAuthorizedCharge(found({ cents: 70, lines: 2 }), SEVEN_CREDITS_IN_CENTS)).toBe('grouped')
      expect(verifyAuthorizedCharge(found({ cents: 210, lines: 3 }), SEVEN_CREDITS_IN_CENTS)).toBe('grouped')
    })
  })

  describe('and the authorization is no longer pending', () => {
    it('should refuse to price a settled one', () => {
      expect(verifyAuthorizedCharge(found({ cents: 70, status: 'settled' }), SEVEN_CREDITS_IN_CENTS)).toBe('not_pending')
    })

    it('should refuse to price a released one', () => {
      expect(verifyAuthorizedCharge(found({ cents: 70, status: 'expired' }), SEVEN_CREDITS_IN_CENTS)).toBe('not_pending')
    })
  })

  describe('and the credits ledger knows no such authorization for this buyer', () => {
    it('should refuse to price it', () => {
      expect(verifyAuthorizedCharge({ status: 'not_found' }, SEVEN_CREDITS_IN_CENTS)).toBe('not_found')
    })
  })

  describe('and the credits ledger could not be reached', () => {
    it('should refuse to price it rather than fall back to the trade price', () => {
      // The trade price is a true statement about the item and a false one about the balance. An outage is
      // not permission to show it.
      expect(verifyAuthorizedCharge({ status: 'unavailable' }, SEVEN_CREDITS_IN_CENTS)).toBe('unavailable')
    })
  })
})

describe('when asking the credits ledger what a signed credit charges', () => {
  beforeEach(() => {
    mockConfigGet.mockReturnValue(CREDITS_SERVER_URL)
    mockSignedFetch.mockResolvedValue(jsonResponse(200, { salt: SALT, usdCents: 70, lines: 1, status: 'pending' }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should ask for that salt, signed as the buyer', async () => {
    await fetchAuthorizedCharge(SALT, IDENTITY)

    expect(mockSignedFetch).toHaveBeenCalledWith(
      `${CREDITS_SERVER_URL}/credits/authorize/${SALT}`,
      expect.objectContaining({ method: 'GET', identity: IDENTITY })
    )
  })

  it('should bound the request in time rather than hold the review open', async () => {
    await fetchAuthorizedCharge(SALT, IDENTITY)

    expect(mockSignedFetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('should read the charge, the line count and the status out of the body', async () => {
    mockSignedFetch.mockResolvedValue(jsonResponse(200, { salt: SALT, usdCents: 400, lines: 3, status: 'settled' }))

    await expect(fetchAuthorizedCharge(SALT, IDENTITY)).resolves.toEqual({
      status: 'found',
      charge: { cents: 400, lines: 3, status: 'settled' }
    })
  })

  describe('and the ledger knows no such authorization', () => {
    it('should report that as a verdict rather than as an outage', async () => {
      mockSignedFetch.mockResolvedValue(jsonResponse(404, { error: 'No authorization for that credit' }))

      await expect(fetchAuthorizedCharge(SALT, IDENTITY)).resolves.toEqual({ status: 'not_found' })
    })
  })

  describe('and the service answers with anything else', () => {
    it.each([500, 502, 401, 400])('should learn nothing from a %s', async status => {
      mockSignedFetch.mockResolvedValue(jsonResponse(status, { error: 'nope' }))

      await expect(fetchAuthorizedCharge(SALT, IDENTITY)).resolves.toEqual({ status: 'unavailable' })
    })
  })

  describe('and the request never completes', () => {
    it('should learn nothing when it times out or is refused', async () => {
      mockSignedFetch.mockRejectedValue(new Error('The operation was aborted'))

      await expect(fetchAuthorizedCharge(SALT, IDENTITY)).resolves.toEqual({ status: 'unavailable' })
    })
  })

  describe('and the body is not one this page understands', () => {
    const cases: Array<[string, unknown]> = [
      ['it is not JSON', 'not json at all'],
      ['it is not an object', JSON.stringify([1, 2, 3])],
      ['the charge is missing', { lines: 1, status: 'pending' }],
      ['the charge is a string', { usdCents: '70', lines: 1, status: 'pending' }],
      ['the charge is fractional', { usdCents: 70.5, lines: 1, status: 'pending' }],
      ['the charge is negative', { usdCents: -70, lines: 1, status: 'pending' }],
      ['the line count is missing', { usdCents: 70, status: 'pending' }],
      ['the line count is zero', { usdCents: 70, lines: 0, status: 'pending' }],
      ['the status is missing', { usdCents: 70, lines: 1 }],
      ['the status is not a string', { usdCents: 70, lines: 1, status: 3 }]
    ]

    it.each(cases)('should learn nothing when %s', async (_name, body) => {
      mockSignedFetch.mockResolvedValue(jsonResponse(200, body))

      await expect(fetchAuthorizedCharge(SALT, IDENTITY)).resolves.toEqual({ status: 'unavailable' })
    })

    it('should learn nothing from a charge JSON has already rounded', async () => {
      // Past 2^53 the parsed number is no longer the ledger's bigint, and comparing it as one would compare
      // against an approximation. Number.isInteger would wave this through; isSafeInteger is the point.
      mockSignedFetch.mockResolvedValue(jsonResponse(200, { usdCents: Number.MAX_SAFE_INTEGER + 2, lines: 1, status: 'pending' }))

      await expect(fetchAuthorizedCharge(SALT, IDENTITY)).resolves.toEqual({ status: 'unavailable' })
    })
  })

  describe('and the site has no credits server configured', () => {
    it('should learn nothing, and ask nobody', async () => {
      mockConfigGet.mockReturnValue('')

      await expect(fetchAuthorizedCharge(SALT, IDENTITY)).resolves.toEqual({ status: 'unavailable' })
      expect(mockSignedFetch).not.toHaveBeenCalled()
    })
  })
})
