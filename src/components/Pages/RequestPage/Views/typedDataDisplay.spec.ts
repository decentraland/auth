import { formatTypedDataForDisplay } from './typedDataDisplay'

describe('when formatting typed data for display', () => {
  let formatted: string

  describe('and the typed data is compact JSON', () => {
    beforeEach(() => {
      formatted = formatTypedDataForDisplay('{"primaryType":"Permit","message":{"owner":"0x1"}}')
    })

    it('should pretty-print the structure the wallet reads', () => {
      expect(formatted).toBe('{\n  "primaryType": "Permit",\n  "message": {\n    "owner": "0x1"\n  }\n}')
    })
  })

  describe('and a key is given twice', () => {
    beforeEach(() => {
      formatted = formatTypedDataForDisplay('{"message":{"to":"0xgood","to":"0xevil"}}')
    })

    it('should show the key once with the value the wallet keeps', () => {
      expect(formatted).toBe('{\n  "message": {\n    "to": "0xevil"\n  }\n}')
    })
  })

  describe('and a value carries a right-to-left override', () => {
    beforeEach(() => {
      formatted = formatTypedDataForDisplay('{"to":"0xAAAA‮BBBB"}')
    })

    it('should reveal the override as its escape instead of letting it mirror the line', () => {
      expect(formatted).toBe('{\n  "to": "0xAAAA\\u202eBBBB"\n}')
    })
  })

  describe('and a value carries a zero-width character', () => {
    beforeEach(() => {
      formatted = formatTypedDataForDisplay('{"name":"Decen​traland"}')
    })

    it('should reveal the character as its escape', () => {
      expect(formatted).toBe('{\n  "name": "Decen\\u200btraland"\n}')
    })
  })

  describe('and a value carries a character outside the basic plane that is hidden', () => {
    beforeEach(() => {
      formatted = formatTypedDataForDisplay('{"tag":"a\u{E0041}b"}')
    })

    it('should reveal it as a surrogate pair of escapes', () => {
      expect(formatted).toBe('{\n  "tag": "a\\udb40\\udc41b"\n}')
    })
  })

  describe('and the text is not JSON', () => {
    beforeEach(() => {
      formatted = formatTypedDataForDisplay('not json ‮ at all')
    })

    it('should show the text as sent with hidden characters revealed', () => {
      expect(formatted).toBe('not json \\u202e at all')
    })
  })
})
