import { getPersistedMobileAuthRequestId, persistMobileAuthRequestId } from './utils'

const AUTH_REQUEST_ID = '13d31e96-1a1a-48ec-af16-b10c4c982e08'

describe('when persisting the mobile auth request id', () => {
  let authRequestId: string | null
  let result: string | null

  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  describe('and the id is a UUID v4', () => {
    beforeEach(() => {
      authRequestId = AUTH_REQUEST_ID.toUpperCase()
      result = persistMobileAuthRequestId(authRequestId)
    })

    it('should return it lowercased', () => {
      expect(result).toBe(AUTH_REQUEST_ID)
    })

    it('should make it readable afterwards', () => {
      expect(getPersistedMobileAuthRequestId()).toBe(AUTH_REQUEST_ID)
    })
  })

  describe('and the id is not a UUID v4', () => {
    beforeEach(() => {
      persistMobileAuthRequestId(AUTH_REQUEST_ID)
      authRequestId = 'not-a-uuid'
      result = persistMobileAuthRequestId(authRequestId)
    })

    it('should return null', () => {
      expect(result).toBeNull()
    })

    it('should clear the previously stored id', () => {
      expect(getPersistedMobileAuthRequestId()).toBeNull()
    })
  })

  describe('and there is no id', () => {
    beforeEach(() => {
      persistMobileAuthRequestId(AUTH_REQUEST_ID)
      authRequestId = null
      result = persistMobileAuthRequestId(authRequestId)
    })

    it('should clear the previously stored id so it is not reused', () => {
      expect(getPersistedMobileAuthRequestId()).toBeNull()
    })
  })
})

describe('when reading the persisted mobile auth request id', () => {
  let result: string | null

  afterEach(() => {
    sessionStorage.clear()
  })

  describe('and the stored value is not a UUID v4', () => {
    beforeEach(() => {
      sessionStorage.setItem('dcl_mobile_auth_request_id', 'tampered')
      result = getPersistedMobileAuthRequestId()
    })

    it('should return null', () => {
      expect(result).toBeNull()
    })
  })
})
