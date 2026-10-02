import { ConnectionOptionType } from '../../components/Connection'
import { consumeLoginMethod, rememberLoginMethod } from './loginMethod'

const STORAGE_KEY = 'dcl_auth_last_login_method'
const AN_HOUR = 60 * 60 * 1000

describe('loginMethod', () => {
  afterEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
  })

  describe('when a method was remembered', () => {
    beforeEach(() => {
      rememberLoginMethod(ConnectionOptionType.METAMASK)
    })

    it('should return it', () => {
      expect(consumeLoginMethod()).toBe(ConnectionOptionType.METAMASK)
    })

    it('should return it only once, so a later login without a click of its own is not attributed to it', () => {
      consumeLoginMethod()
      expect(consumeLoginMethod()).toBeUndefined()
    })
  })

  describe('when nothing was remembered', () => {
    it('should return undefined', () => {
      expect(consumeLoginMethod()).toBeUndefined()
    })
  })

  describe('when remembering without a method', () => {
    it('should store nothing, so an earlier value is not overwritten by a guest login', () => {
      rememberLoginMethod(ConnectionOptionType.GOOGLE)
      rememberLoginMethod(undefined)
      expect(consumeLoginMethod()).toBe(ConnectionOptionType.GOOGLE)
    })
  })

  describe('when the remembered method is older than the TTL', () => {
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(0)
      rememberLoginMethod(ConnectionOptionType.GOOGLE)
      jest.spyOn(Date, 'now').mockReturnValue(AN_HOUR + 1)
    })

    it('should discard it', () => {
      expect(consumeLoginMethod()).toBeUndefined()
    })
  })

  describe('when the remembered method is within the TTL', () => {
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(0)
      rememberLoginMethod(ConnectionOptionType.GOOGLE)
      jest.spyOn(Date, 'now').mockReturnValue(AN_HOUR - 1)
    })

    it('should return it, because a social login round trip can take minutes', () => {
      expect(consumeLoginMethod()).toBe(ConnectionOptionType.GOOGLE)
    })
  })

  describe('when the stored value is not the shape this module writes', () => {
    beforeEach(() => {
      localStorage.setItem(STORAGE_KEY, 'not json')
    })

    it('should return undefined instead of throwing', () => {
      expect(consumeLoginMethod()).toBeUndefined()
    })
  })

  describe('when storage is unavailable', () => {
    beforeEach(() => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
    })

    it('should not throw, because losing the method must never break a login', () => {
      expect(() => rememberLoginMethod(ConnectionOptionType.METAMASK)).not.toThrow()
    })
  })
})
