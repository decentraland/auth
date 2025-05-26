import { extractRedirectToFromSearchParameters, extractReferrerFromSearchParameters } from './locations'

describe('locations', () => {
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

    describe('when redirectTo decoding fails', () => {
      it('returns home path', () => {
        searchParams = new URLSearchParams('redirectTo=invalid%')
        expect(extractRedirectToFromSearchParameters(searchParams)).toBe('/')
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
      referrer = 'https://example.com'
      stateData = {
        customData: JSON.stringify({ referrer })
      }
      encodedState = btoa(JSON.stringify(stateData))
      stateReferrer = 'https://from-state.com'
      directReferrer = 'https://direct.com'
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

    describe('when referrer contains special characters', () => {
      it('returns decoded referrer with special characters', () => {
        const specialReferrer = 'https://example.com?param=value&other=123'
        searchParams = new URLSearchParams(`referrer=${encodeURIComponent(specialReferrer)}`)
        expect(extractReferrerFromSearchParameters(searchParams)).toBe(specialReferrer)
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
})
