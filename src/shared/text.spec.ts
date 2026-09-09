import { listAddresses } from './text'

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
