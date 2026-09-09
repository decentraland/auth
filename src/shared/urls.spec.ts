import { getHttpsUrl } from './urls'

describe('when reading a third-party URL for an image or a fetch', () => {
  describe('and it is an absolute https URL', () => {
    it('should return it normalized', () => {
      expect(getHttpsUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
    })
  })

  describe('and it uses plain http', () => {
    it('should drop it', () => {
      expect(getHttpsUrl('http://192.168.1.10/a.png')).toBeNull()
    })
  })

  describe('and it uses another scheme', () => {
    it.each(['data:image/png;base64,AAAA', 'javascript:alert(1)', 'ipfs://abc'])('should drop %s', value => {
      expect(getHttpsUrl(value)).toBeNull()
    })
  })

  describe('and it embeds credentials', () => {
    it('should drop it so the browser never sends them from the auth origin', () => {
      expect(getHttpsUrl('https://user:secret@example.com/a.png')).toBeNull()
    })
  })

  describe('and it is relative, empty or not a string', () => {
    it.each(['/a.png', '', 42, null, undefined])('should drop %p', value => {
      expect(getHttpsUrl(value)).toBeNull()
    })
  })
})
