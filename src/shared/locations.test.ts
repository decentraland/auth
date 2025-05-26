import { extractRedirectToFromSearchParameters, extractReferrerFromSearchParameters } from './locations'

describe('locations', () => {
  describe('when extracting redirectTo from search parameters', () => {
    describe('with valid search parameters', () => {
      it('should return home path when no redirectTo is provided', () => {
        const searchParams = new URLSearchParams()
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe('/')
      })

      it('should decode and return redirectTo when provided directly', () => {
        const redirectTo = '/dashboard'
        const searchParams = new URLSearchParams(`redirectTo=${encodeURIComponent(redirectTo)}`)
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe(redirectTo)
      })

      it('should handle encoded redirectTo with special characters', () => {
        const redirectTo = '/dashboard?param=value&other=123'
        const searchParams = new URLSearchParams(`redirectTo=${encodeURIComponent(redirectTo)}`)
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe(redirectTo)
      })

      it('should extract redirectTo from state parameter when present', () => {
        const redirectTo = '/profile'
        const stateData = {
          customData: JSON.stringify({ redirectTo })
        }
        const encodedState = btoa(JSON.stringify(stateData))
        const searchParams = new URLSearchParams(`state=${encodedState}`)
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe(redirectTo)
      })

      it('should prioritize state parameter over direct redirectTo', () => {
        const stateRedirectTo = '/from-state'
        const directRedirectTo = '/direct'
        const stateData = {
          customData: JSON.stringify({ redirectTo: stateRedirectTo })
        }
        const encodedState = btoa(JSON.stringify(stateData))
        const searchParams = new URLSearchParams(`state=${encodedState}&redirectTo=${encodeURIComponent(directRedirectTo)}`)
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe(stateRedirectTo)
      })
    })

    describe('when handling invalid parameters', () => {
      it('should return home path when redirectTo decoding fails', () => {
        const searchParams = new URLSearchParams('redirectTo=invalid%')
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe('/')
      })

      it('should return home path when state parameter is invalid', () => {
        const searchParams = new URLSearchParams('state=invalid-base64')
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe('/')
      })

      it('should return home path when state JSON is malformed', () => {
        const searchParams = new URLSearchParams('state=eyJjdXN0b21EYXRhIjoiaW52YWxpZCJ9')
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe('/')
      })
    })
  })

  describe('when extracting referrer from search parameters', () => {
    describe('with valid search parameters', () => {
      it('should return null when no referrer is provided', () => {
        const searchParams = new URLSearchParams()
        expect(extractReferrerFromSearchParameters(searchParams)).toBeNull()
      })

      it('should return referrer when provided directly', () => {
        const referrer = 'https://example.com'
        const searchParams = new URLSearchParams(`referrer=${encodeURIComponent(referrer)}`)
        expect(extractReferrerFromSearchParameters(searchParams)).toBe(referrer)
      })

      it('should handle encoded referrer with special characters', () => {
        const referrer = 'https://example.com?param=value&other=123'
        const searchParams = new URLSearchParams(`referrer=${encodeURIComponent(referrer)}`)
        expect(extractReferrerFromSearchParameters(searchParams)).toBe(referrer)
      })

      it('should extract referrer from state parameter when present', () => {
        const referrer = 'https://example.com'
        const stateData = {
          customData: JSON.stringify({ referrer })
        }
        const encodedState = btoa(JSON.stringify(stateData))
        const searchParams = new URLSearchParams(`state=${encodedState}`)
        expect(extractReferrerFromSearchParameters(searchParams)).toBe(referrer)
      })

      it('should prioritize state parameter over direct referrer', () => {
        const stateReferrer = 'https://from-state.com'
        const directReferrer = 'https://direct.com'
        const stateData = {
          customData: JSON.stringify({ referrer: stateReferrer })
        }
        const encodedState = btoa(JSON.stringify(stateData))
        const searchParams = new URLSearchParams(`state=${encodedState}&referrer=${encodeURIComponent(directReferrer)}`)
        expect(extractReferrerFromSearchParameters(searchParams)).toBe(stateReferrer)
      })
    })

    describe('when handling invalid parameters', () => {
      it('should return null when state parameter is invalid', () => {
        const searchParams = new URLSearchParams('state=invalid-base64')
        expect(extractReferrerFromSearchParameters(searchParams)).toBeNull()
      })

      it('should return null when state JSON is malformed', () => {
        const searchParams = new URLSearchParams('state=eyJjdXN0b21EYXRhIjoiaW52YWxpZCJ9')
        expect(extractReferrerFromSearchParameters(searchParams)).toBeNull()
      })

      it('should return null when state customData is missing referrer', () => {
        const stateData = {
          customData: JSON.stringify({ otherField: 'value' })
        }
        const encodedState = btoa(JSON.stringify(stateData))
        const searchParams = new URLSearchParams(`state=${encodedState}`)
        expect(extractReferrerFromSearchParameters(searchParams)).toBeNull()
      })
    })
  })
})
