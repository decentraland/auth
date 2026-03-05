import { isEmailValid } from './email'

describe('isEmailValid', () => {
  describe('when the email is valid', () => {
    describe.each([
      ['a simple email', 'user@example.com'],
      ['a plus tag in the local part', 'user+tag@example.com'],
      ['a numeric plus tag', 'pepe+1@gmail.com'],
      ['dots in the local part', 'first.last@example.com'],
      ['a subdomain', 'user@sub.domain.com'],
      ['multiple subdomains', 'user@a.b.c.example.com'],
      ['uppercase letters', 'User@Example.COM'],
      ['digits in the local part', 'user123@example.com'],
      ['an underscore in the local part', 'user_name@example.com'],
      ['a hyphen in the local part', 'user-name@example.com'],
      ['special characters in the local part', "user!#$%&'*+/=?^`{|}~@example.com"],
      ['a single character local part', 'a@example.com'],
      ['a two-letter TLD', 'user@example.co']
    ])('when the email has %s', (_context, email) => {
      it('should return true', () => {
        expect(isEmailValid(email)).toBe(true)
      })
    })
  })

  describe('when the email is invalid', () => {
    describe.each([
      ['an empty string', ''],
      ['no @ symbol', 'not-an-email'],
      ['no local part', '@example.com'],
      ['no domain', 'user@'],
      ['a domain starting with a dot', 'user@.com'],
      ['a domain with no TLD', 'user@com'],
      ['a space in the local part', 'user name@example.com'],
      ['a space in the domain', 'user@exam ple.com'],
      ['no domain after @', 'user@.'],
      ['a trailing dot in the domain', 'user@example.']
    ])('when the email has %s', (_context, email) => {
      it('should return false', () => {
        expect(isEmailValid(email)).toBe(false)
      })
    })
  })
})
