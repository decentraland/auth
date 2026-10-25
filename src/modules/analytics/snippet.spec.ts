/* eslint-disable @typescript-eslint/naming-convention */
type SnippetAnalytics = { load: (key: string, options?: unknown) => void; _cdn?: string; _loadOptions?: unknown }

const getSnippetAnalytics = () => (window as unknown as { analytics: SnippetAnalytics }).analytics

const loadedScriptSrc = () => document.head.querySelectorAll('script')[0].getAttribute('src')

describe('when loading analytics.js through the snippet', () => {
  beforeEach(async () => {
    delete (window as unknown as { analytics?: unknown }).analytics
    document.head.replaceChildren(document.createElement('script'))
    await jest.isolateModulesAsync(async () => {
      // @ts-expect-error snippet.ts is a self-executing script, it has no exports for TypeScript to resolve
      await import('./snippet')
    })
  })

  describe('and no first party cdn was configured', () => {
    beforeEach(() => {
      getSnippetAnalytics().load('aWriteKey')
    })

    it('should load the bundle from segment cdn', () => {
      expect(loadedScriptSrc()).toBe('https://cdn.segment.com/analytics.js/v1/aWriteKey/analytics.min.js')
    })
  })

  describe('and a first party cdn was configured', () => {
    beforeEach(() => {
      getSnippetAnalytics()._cdn = 'https://evs.example.org'
      getSnippetAnalytics().load('aWriteKey')
    })

    it('should load the bundle from it', () => {
      expect(loadedScriptSrc()).toBe('https://evs.example.org/analytics.js/v1/aWriteKey/analytics.min.js')
    })
  })

  describe('and load options are given', () => {
    const options = { integrations: { 'Segment.io': { apiHost: 'api.example.org/v1' } } }

    beforeEach(() => {
      getSnippetAnalytics().load('aWriteKey', options)
    })

    it('should keep them for analytics.js to read once it boots', () => {
      expect(getSnippetAnalytics()._loadOptions).toBe(options)
    })
  })
})
