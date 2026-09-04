import {
  buildRequestPageUrl,
  extractRedirectToFromSearchParameters,
  extractReferrerFromSearchParameters,
  getAuthRequestId,
  isBridgeOnlyEnabled,
  isDeepLinkFlowEnabled,
  isValidUuidV4,
  locations,
  parseStateCustomData
} from './locations'

const encodeState = (customData: unknown): string => btoa(JSON.stringify({ customData: JSON.stringify(customData) }))

describe('locations', () => {
  describe('login', () => {
    describe('when using legacy signature', () => {
      it('returns /login when no params', () => {
        expect(locations.login()).toBe('/login')
      })

      it('returns /login with redirectTo', () => {
        expect(locations.login('/dashboard')).toBe('/login?redirectTo=%2Fdashboard')
      })

      it('returns /login with redirectTo and referrer', () => {
        const result = locations.login('/dashboard', '0x123')
        expect(result).toBe('/login?redirectTo=%2Fdashboard&referrer=0x123')
      })
    })

    describe('when using new options signature', () => {
      it('returns /login with loginMethod email', () => {
        expect(locations.login({ loginMethod: 'email' })).toBe('/login?loginMethod=email')
      })

      it('returns /login with loginMethod and redirectTo', () => {
        const result = locations.login({
          redirectTo: '/play',
          loginMethod: 'email'
        })
        expect(result).toBe('/login?redirectTo=%2Fplay&loginMethod=email')
      })

      it('returns /login with all options', () => {
        const result = locations.login({
          redirectTo: '/play',
          referrer: '0x123',
          loginMethod: 'email'
        })
        expect(result).toBe('/login?redirectTo=%2Fplay&referrer=0x123&loginMethod=email')
      })
    })
  })

  describe('loginWithEmail', () => {
    it('returns email login URL without params', () => {
      expect(locations.loginWithEmail()).toBe('/login?loginMethod=email')
    })

    it('returns email login URL with redirectTo', () => {
      expect(locations.loginWithEmail('/play')).toBe('/login?redirectTo=%2Fplay&loginMethod=email')
    })

    it('returns email login URL with all params', () => {
      const result = locations.loginWithEmail('/play', '0x123')
      expect(result).toBe('/login?redirectTo=%2Fplay&referrer=0x123&loginMethod=email')
    })
  })

  describe('when extracting redirectTo from search parameters', () => {
    let searchParams: URLSearchParams
    let redirectTo: string
    let stateData: { customData: string }
    let encodedState: string
    let stateRedirectTo: string
    let directRedirectTo: string

    beforeEach(() => {
      searchParams = new URLSearchParams()
      redirectTo = '/dashboard'
      stateData = {
        customData: JSON.stringify({ redirectTo })
      }
      encodedState = btoa(JSON.stringify(stateData))
      stateRedirectTo = '/from-state'
      directRedirectTo = '/direct'
    })

    describe('when no redirectTo is provided', () => {
      it('returns home path', () => {
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe('/')
      })
    })

    describe('when redirectTo is provided directly', () => {
      it('returns decoded path', () => {
        searchParams = new URLSearchParams(`redirectTo=${encodeURIComponent(redirectTo)}`)
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe(redirectTo)
      })
    })

    describe('when redirectTo contains special characters', () => {
      it('returns decoded path with special characters', () => {
        const specialRedirectTo = '/dashboard?param=value&other=123'
        searchParams = new URLSearchParams(`redirectTo=${encodeURIComponent(specialRedirectTo)}`)
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe(specialRedirectTo)
      })
    })

    describe('when redirectTo is provided in state parameter', () => {
      it('returns path from state', () => {
        searchParams = new URLSearchParams(`state=${encodedState}`)
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe(redirectTo)
      })
    })

    describe('when redirectTo is provided in both state and direct parameter', () => {
      it('returns state parameter value', () => {
        stateData = {
          customData: JSON.stringify({ redirectTo: stateRedirectTo })
        }
        encodedState = btoa(JSON.stringify(stateData))
        searchParams = new URLSearchParams(`state=${encodedState}&redirectTo=${encodeURIComponent(directRedirectTo)}`)
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe(stateRedirectTo)
      })
    })

    describe('when redirectTo contains a nested percent-encoded value', () => {
      it('does not double-decode it', () => {
        // URLSearchParams.get already decodes once; a second decode would corrupt foo%2Fbar → foo/bar.
        const target = 'https://decentraland.org/play?realm=foo%2Fbar'
        searchParams = new URLSearchParams(`redirectTo=${encodeURIComponent(target)}`)
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe(target)
      })
    })

    describe('when redirectTo contains a literal percent sign', () => {
      it('returns it as-is instead of falling back to home', () => {
        searchParams = new URLSearchParams('redirectTo=invalid%')
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe('invalid%')
      })
    })

    describe('when state parameter is invalid base64', () => {
      it('returns home path', () => {
        searchParams = new URLSearchParams('state=invalid-base64')
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe('/')
      })
    })

    describe('when state parameter contains malformed JSON', () => {
      it('returns home path', () => {
        searchParams = new URLSearchParams('state=eyJjdXN0b21EYXRhIjoiaW52YWxpZCJ9')
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe('/')
      })
    })
  })

  describe('when extracting referrer from search parameters', () => {
    let searchParams: URLSearchParams
    let referrer: string
    let stateData: { customData: string }
    let encodedState: string
    let stateReferrer: string
    let directReferrer: string

    beforeEach(() => {
      searchParams = new URLSearchParams()
      referrer = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      stateData = {
        customData: JSON.stringify({ referrer })
      }
      encodedState = btoa(JSON.stringify(stateData))
      stateReferrer = '0x123f681646d4a755815f9cb19e1accc6a1d88f53'
      directReferrer = '0x456f681646d4a755815f9cb19e1accc6a1d88f53'
    })

    describe('when no referrer is provided', () => {
      it('returns null', () => {
        expect(extractReferrerFromSearchParameters(searchParams)).toBeNull()
      })
    })

    describe('when referrer is provided directly', () => {
      it('returns referrer value', () => {
        searchParams = new URLSearchParams(`referrer=${encodeURIComponent(referrer)}`)
        expect(extractReferrerFromSearchParameters(searchParams)).toBe(referrer)
      })
    })

    describe('when referrer is invalid', () => {
      it('returns null for invalid address', () => {
        const invalidReferrer = '0xinvalid'
        searchParams = new URLSearchParams(`referrer=${encodeURIComponent(invalidReferrer)}`)
        expect(extractReferrerFromSearchParameters(searchParams)).toBeNull()
      })
    })

    describe('when referrer is provided in state parameter', () => {
      it('returns referrer from state', () => {
        searchParams = new URLSearchParams(`state=${encodedState}`)
        expect(extractReferrerFromSearchParameters(searchParams)).toBe(referrer)
      })
    })

    describe('when referrer is provided in both state and direct parameter', () => {
      it('returns state parameter value', () => {
        stateData = {
          customData: JSON.stringify({ referrer: stateReferrer })
        }
        encodedState = btoa(JSON.stringify(stateData))
        searchParams = new URLSearchParams(`state=${encodedState}&referrer=${encodeURIComponent(directReferrer)}`)
        expect(extractReferrerFromSearchParameters(searchParams)).toBe(stateReferrer)
      })
    })

    describe('when state parameter is invalid base64', () => {
      it('returns null', () => {
        searchParams = new URLSearchParams('state=invalid-base64')
        expect(extractReferrerFromSearchParameters(searchParams)).toBeNull()
      })
    })

    describe('when state parameter contains malformed JSON', () => {
      it('returns null', () => {
        searchParams = new URLSearchParams('state=eyJjdXN0b21EYXRhIjoiaW52YWxpZCJ9')
        expect(extractReferrerFromSearchParameters(searchParams)).toBeNull()
      })
    })

    describe('when state parameter does not contain referrer', () => {
      it('returns null', () => {
        stateData = {
          customData: JSON.stringify({ otherField: 'value' })
        }
        encodedState = btoa(JSON.stringify(stateData))
        searchParams = new URLSearchParams(`state=${encodedState}`)
        expect(extractReferrerFromSearchParameters(searchParams)).toBeNull()
      })
    })
  })

  describe('when checking if bridgeOnly is enabled', () => {
    let searchParams: URLSearchParams

    describe('and the bridgeOnly param is set to "true"', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('bridgeOnly=true')
      })

      it('should return true', () => {
        expect(isBridgeOnlyEnabled(searchParams)).toBe(true)
      })
    })

    describe('and the bridgeOnly param is set to "true" with different casing', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('bridgeOnly=TRUE')
      })

      it('should return true', () => {
        expect(isBridgeOnlyEnabled(searchParams)).toBe(true)
      })
    })

    describe('and the bridgeOnly param is set to "false"', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('bridgeOnly=false')
      })

      it('should return false', () => {
        expect(isBridgeOnlyEnabled(searchParams)).toBe(false)
      })
    })

    describe('and the bridgeOnly param is set to a non-boolean value', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('bridgeOnly=1')
      })

      it('should return false', () => {
        expect(isBridgeOnlyEnabled(searchParams)).toBe(false)
      })
    })

    describe('and the bridgeOnly param is present as a bare flag without an equals sign', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('bridgeOnly')
      })

      it('should return true', () => {
        expect(isBridgeOnlyEnabled(searchParams)).toBe(true)
      })
    })

    describe('and the bridgeOnly param is present with an empty value', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('bridgeOnly=')
      })

      it('should return true', () => {
        expect(isBridgeOnlyEnabled(searchParams)).toBe(true)
      })
    })

    describe('and the bridgeOnly param is not present', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('targetConfigId=default')
      })

      it('should return false', () => {
        expect(isBridgeOnlyEnabled(searchParams)).toBe(false)
      })
    })
  })

  describe('when getting the authRequestId', () => {
    let searchParams: URLSearchParams

    describe('and the authRequestId param is present', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('authRequestId=abc-123')
      })

      it('should return its value verbatim', () => {
        expect(getAuthRequestId(searchParams)).toBe('abc-123')
      })
    })

    describe('and the authRequestId param is present with a value needing decoding', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('authRequestId=a%2Fb%20c')
      })

      it('should return the decoded value', () => {
        expect(getAuthRequestId(searchParams)).toBe('a/b c')
      })
    })

    describe('and the authRequestId param is not present', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('targetConfigId=default')
      })

      it('should return null', () => {
        expect(getAuthRequestId(searchParams)).toBeNull()
      })
    })
  })

  describe('when checking if the deep-link flow is enabled', () => {
    let searchParams: URLSearchParams

    describe('and the flow param is set to "deeplink"', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('flow=deeplink')
      })

      it('should return true', () => {
        expect(isDeepLinkFlowEnabled(searchParams)).toBe(true)
      })
    })

    describe('and the flow param is set to "deeplink" with different casing', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('flow=DeepLink')
      })

      it('should return true', () => {
        expect(isDeepLinkFlowEnabled(searchParams)).toBe(true)
      })
    })

    describe('and the flow param is set to a different value', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('flow=other')
      })

      it('should return false', () => {
        expect(isDeepLinkFlowEnabled(searchParams)).toBe(false)
      })
    })

    describe('and the flow param is present as a bare flag without a value', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('flow')
      })

      it('should return false', () => {
        expect(isDeepLinkFlowEnabled(searchParams)).toBe(false)
      })
    })

    describe('and the flow param is not present', () => {
      beforeEach(() => {
        searchParams = new URLSearchParams('targetConfigId=default')
      })

      it('should return false', () => {
        expect(isDeepLinkFlowEnabled(searchParams)).toBe(false)
      })
    })
  })

  describe('when validating a UUID v4', () => {
    describe('and the value is a canonical lowercase UUID v4', () => {
      it('should return true', () => {
        expect(isValidUuidV4('123e4567-e89b-42d3-a456-426614174000')).toBe(true)
      })
    })

    describe('and the value is an uppercase UUID v4', () => {
      it('should return true (case-insensitive)', () => {
        expect(isValidUuidV4('123E4567-E89B-42D3-A456-426614174000')).toBe(true)
      })
    })

    describe('and the value is a non-v4 UUID (wrong version digit)', () => {
      it('should return false', () => {
        expect(isValidUuidV4('123e4567-e89b-12d3-a456-426614174000')).toBe(false)
      })
    })

    describe('and the value has an invalid variant digit', () => {
      it('should return false', () => {
        expect(isValidUuidV4('123e4567-e89b-42d3-c456-426614174000')).toBe(false)
      })
    })

    describe('and the value is not a UUID at all', () => {
      it('should return false', () => {
        expect(isValidUuidV4('client-login')).toBe(false)
      })
    })

    describe('and a valid UUID is surrounded by whitespace', () => {
      it('should return false', () => {
        expect(isValidUuidV4(' 123e4567-e89b-42d3-a456-426614174000 ')).toBe(false)
      })
    })

    describe('and a valid UUID is followed by a trailing newline', () => {
      // Guards against a regex anchor bypass: JS `$` without the multiline flag must not match
      // before a trailing "\n". The id is forwarded to the native client, so this must be strict.
      it('should return false', () => {
        expect(isValidUuidV4('123e4567-e89b-42d3-a456-426614174000\n')).toBe(false)
      })
    })

    describe('and the value is an empty string', () => {
      it('should return false', () => {
        expect(isValidUuidV4('')).toBe(false)
      })
    })
  })

  describe('when building the request page url', () => {
    describe('and an authRequestId is provided', () => {
      it('should append it url-encoded alongside the other preserved params', () => {
        expect(buildRequestPageUrl('request-id', 'default', { isDeepLinkFlow: true, isBridgeOnly: true, authRequestId: 'a/b c' })).toBe(
          '/auth/requests/request-id?targetConfigId=default&flow=deeplink&bridgeOnly=true&authRequestId=a%2Fb%20c'
        )
      })
    })

    describe('and no authRequestId is provided', () => {
      it('should not append the authRequestId param', () => {
        expect(buildRequestPageUrl('request-id', 'default')).toBe('/auth/requests/request-id?targetConfigId=default')
      })
    })

    describe('and a referrer is provided', () => {
      it('should append it url-encoded so it survives the login round-trip', () => {
        expect(buildRequestPageUrl('request-id', 'default', { referrer: '0x24e5f44999c151f08609f8e27b2238c773c4d020' })).toBe(
          '/auth/requests/request-id?targetConfigId=default&referrer=0x24e5f44999c151f08609f8e27b2238c773c4d020'
        )
      })
    })

    describe('and no referrer is provided', () => {
      it('should not append the referrer param', () => {
        expect(buildRequestPageUrl('request-id', 'default')).not.toContain('referrer')
      })
    })
  })
})

describe('parseStateCustomData', () => {
  describe('when the state is missing', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an empty string', '']
    ])('should return null for %s', (_label, state) => {
      expect(parseStateCustomData(state)).toBeNull()
    })
  })

  describe('when the state is not valid base64', () => {
    it('should return null instead of throwing', () => {
      expect(parseStateCustomData('not-valid-base64!!')).toBeNull()
    })
  })

  describe('when the decoded state is not JSON', () => {
    it('should return null', () => {
      expect(parseStateCustomData(btoa('this is not json'))).toBeNull()
    })
  })

  describe('when the outer JSON has no customData string to parse', () => {
    it('should return null', () => {
      expect(parseStateCustomData(btoa(JSON.stringify({ somethingElse: 1 })))).toBeNull()
    })
  })

  describe('when customData decodes to a non-object', () => {
    it.each([
      ['a number', 5],
      ['a string', 'hello'],
      ['null', null]
    ])('should return null for %s', (_label, value) => {
      expect(parseStateCustomData(encodeState(value))).toBeNull()
    })
  })

  describe('when customData is a well-formed object', () => {
    it('should return the parsed object', () => {
      expect(parseStateCustomData(encodeState({ redirectTo: '/play', referrer: '0xabc' }))).toEqual({
        redirectTo: '/play',
        referrer: '0xabc'
      })
    })
  })

  describe('when customData is a deeply nested object', () => {
    it('should parse it without throwing', () => {
      let nested: Record<string, unknown> = { leaf: true }
      for (let depth = 0; depth < 50; depth++) {
        nested = { child: nested }
      }
      expect(() => parseStateCustomData(encodeState(nested))).not.toThrow()
    })
  })
})
