import { formatUntrustedLabel, listAddresses } from './text'

describe('when formatting an untrusted label', () => {
  describe.each([
    ['combining grapheme joiner', '\u034f', '\\u034f'],
    ['Hangul filler', '\u115f', '\\u115f'],
    ['variation selector', '\ufe0f', '\\ufe0f'],
    ['supplementary variation selector', '\u{e0100}', '\\udb40\\udd00']
  ])('and it contains a %s', (_name, character, escaped) => {
    let label: string

    beforeEach(() => {
      label = `Item${character}Name`
    })

    it('should reveal the otherwise invisible character', () => {
      expect(formatUntrustedLabel(label)).toBe(`Item${escaped}Name`)
    })
  })

  describe('and it contains visible accents and an emoji', () => {
    let label: string

    beforeEach(() => {
      label = 'Cafe\u0301 \u{1f30e}'
    })

    it('should preserve the readable label', () => {
      expect(formatUntrustedLabel(label)).toBe(label)
    })
  })
})

describe('when listing addresses for a message', () => {
  let addresses: string[]

  describe('and there are three or fewer', () => {
    beforeEach(() => {
      addresses = ['0xa', '0xb', '0xc']
    })

    it('should list them all', () => {
      expect(listAddresses(addresses)).toBe('0xa, 0xb, 0xc')
    })
  })

  describe('and there are more than three', () => {
    beforeEach(() => {
      addresses = ['0xa', '0xb', '0xc', '0xd', '0xe']
    })

    it('should list the first three and count the rest', () => {
      expect(listAddresses(addresses)).toBe('0xa, 0xb, 0xc and 2 more')
    })
  })
})
