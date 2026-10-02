/* eslint-disable @typescript-eslint/naming-convention */
import { getSegmentProxy } from './proxy'

describe('when resolving the segment first party proxy', () => {
  let consoleWarn: jest.SpyInstance

  beforeEach(() => {
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarn.mockRestore()
  })

  describe('and nothing is configured', () => {
    it('should return an empty proxy so analytics stays on segment hosts', () => {
      expect(getSegmentProxy(undefined, undefined)).toEqual({})
    })

    it('should treat empty strings the same way', () => {
      expect(getSegmentProxy('', '')).toEqual({})
    })
  })

  describe('and both the cdn url and the api host are configured', () => {
    it('should return the cdn origin and the api host as the segment destination settings', () => {
      expect(getSegmentProxy('https://evs.example.org', 'api.example.org/v1')).toEqual({
        cdnUrl: 'https://evs.example.org',
        loadOptions: { integrations: { 'Segment.io': { apiHost: 'api.example.org/v1' } } }
      })
    })
  })

  describe('and the cdn url carries a path and a trailing slash', () => {
    it('should keep only the origin, analytics.js appends its own paths', () => {
      expect(getSegmentProxy('https://evs.example.org/some/path/', undefined)).toEqual({ cdnUrl: 'https://evs.example.org' })
    })
  })

  describe('and only the api host is configured', () => {
    it('should return just the load options', () => {
      expect(getSegmentProxy(undefined, 'api.example.org/v1')).toEqual({
        loadOptions: { integrations: { 'Segment.io': { apiHost: 'api.example.org/v1' } } }
      })
    })
  })

  describe('and the api host carries a protocol or a trailing slash', () => {
    it.each([
      ['a protocol', 'https://api.example.org/v1'],
      ['a trailing slash', 'api.example.org/v1/']
    ])('should strip %s, analytics.js prepends the protocol and appends the method path', (_case, apiHost) => {
      expect(getSegmentProxy(undefined, apiHost).loadOptions).toEqual({
        integrations: { 'Segment.io': { apiHost: 'api.example.org/v1' } }
      })
    })
  })

  describe('and a value is not usable', () => {
    it.each([
      ['a cdn url that is not served over https', 'http://evs.example.org', undefined],
      ['a cdn url that is not a url', 'not a url', undefined],
      ['an api host that is not served over https', undefined, 'http://api.example.org/v1'],
      ['an api host that is not a url', undefined, 'https://[']
    ])('should drop %s with a warning and keep segment own hosts', (_case, cdnUrl, apiHost) => {
      expect(getSegmentProxy(cdnUrl, apiHost)).toEqual({})
      expect(consoleWarn).toHaveBeenCalled()
    })

    it('should drop only the unusable one and keep the other', () => {
      expect(getSegmentProxy('http://evs.example.org', 'api.example.org/v1')).toEqual({
        loadOptions: { integrations: { 'Segment.io': { apiHost: 'api.example.org/v1' } } }
      })
    })
  })
})
