import { DOMAIN_TYPE, META_TRANSACTION_TYPE, OFFCHAIN_META_TRANSACTION_TYPE } from 'decentraland-transactions'
import { MalformedSignatureRequestError } from './errors'
import { isMetaTransactionTypedData, resolveMetaTransactionTypedData } from './metaTransactionTypedData'

type TypedDataField = { name: string; type: string }
/** A typed-data payload the tests can freely reshape. */
type MutableTypedData = {
  types: Record<string, TypedDataField[]>
  domain: Record<string, unknown>
  primaryType: string
  message: Record<string, unknown>
}

const METHOD = 'eth_signTypedData_v4'
const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
const COLLECTION = '0xfef5c99885c3036e591b6e6db52482891834a5f4'
const MARKETPLACE = '0xa40b1d129b8906888720686f3a01921ddf37716f'
const POLYGON_SALT = '0x0000000000000000000000000000000000000000000000000000000000000089'
// transfer(address,uint256) with padded arguments.
const TRANSFER_CALLDATA = `0xa9059cbb${'00'.repeat(12)}${'ab'.repeat(20)}${'00'.repeat(31)}01`
// accept(...) stand-in: the call a marketplace meta-transaction would execute.
const ACCEPT_CALLDATA = `0xdeadbeef${'00'.repeat(64)}`
// getNonce(address): a read-only call that moves nothing.
const GET_NONCE_CALLDATA = `0x2d0335ab${'00'.repeat(12)}${USER.slice(2)}`

/** A legacy collection meta-transaction, shaped exactly as decentraland-transactions builds it. */
function buildLegacyTypedData(): MutableTypedData {
  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    types: { EIP712Domain: DOMAIN_TYPE, MetaTransaction: META_TRANSACTION_TYPE },
    domain: { name: 'Decentraland Collection', version: '2', verifyingContract: COLLECTION, salt: POLYGON_SALT },
    primaryType: 'MetaTransaction',
    message: { nonce: 0, from: USER, functionSignature: TRANSFER_CALLDATA }
  }
}

/** An off-chain marketplace meta-transaction, shaped exactly as decentraland-transactions builds it. */
function buildOffchainTypedData(): MutableTypedData {
  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    types: { EIP712Domain: DOMAIN_TYPE, MetaTransaction: OFFCHAIN_META_TRANSACTION_TYPE },
    domain: { name: 'DecentralandMarketplacePolygon', version: '1.0.0', verifyingContract: MARKETPLACE, salt: POLYGON_SALT },
    primaryType: 'MetaTransaction',
    message: { nonce: 0, from: USER, functionData: ACCEPT_CALLDATA }
  }
}

describe('isMetaTransactionTypedData', () => {
  describe('when the primary type is MetaTransaction', () => {
    let typedData: Record<string, unknown>

    beforeEach(() => {
      typedData = buildOffchainTypedData()
    })

    it('should return true', () => {
      expect(isMetaTransactionTypedData(typedData)).toBe(true)
    })
  })

  describe('when the primary type is another struct', () => {
    let typedData: Record<string, unknown>

    beforeEach(() => {
      typedData = { ...buildOffchainTypedData(), primaryType: 'Permit' }
    })

    it('should return false', () => {
      expect(isMetaTransactionTypedData(typedData)).toBe(false)
    })
  })

  describe('when the primary type only differs in casing', () => {
    let typedData: Record<string, unknown>

    beforeEach(() => {
      typedData = { ...buildOffchainTypedData(), primaryType: 'metatransaction' }
    })

    it('should return false because the contracts hash the literal type name', () => {
      expect(isMetaTransactionTypedData(typedData)).toBe(false)
    })
  })

  describe('when the value is not an object', () => {
    let typedData: unknown

    beforeEach(() => {
      typedData = 'MetaTransaction'
    })

    it('should return false', () => {
      expect(isMetaTransactionTypedData(typedData)).toBe(false)
    })
  })
})

describe('resolveMetaTransactionTypedData', () => {
  describe('when the typed data is a legacy meta-transaction built like decentraland-transactions does', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildLegacyTypedData()
    })

    it('should resolve the inner call from the functionSignature field with the chain id decoded from the salt', () => {
      expect(resolveMetaTransactionTypedData(typedData, METHOD)).toEqual({
        calldataField: 'functionSignature',
        calldata: TRANSFER_CALLDATA,
        from: USER,
        verifyingContract: COLLECTION,
        chainId: 137
      })
    })
  })

  describe('when the typed data is an off-chain marketplace meta-transaction built like decentraland-transactions does', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
    })

    it('should resolve the inner call from the functionData field', () => {
      expect(resolveMetaTransactionTypedData(typedData, METHOD)).toEqual({
        calldataField: 'functionData',
        calldata: ACCEPT_CALLDATA,
        from: USER,
        verifyingContract: MARKETPLACE,
        chainId: 137
      })
    })
  })

  describe('when the types omit the EIP712Domain struct', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      delete typedData.types.EIP712Domain
    })

    it('should resolve the inner call because the wallet derives the domain struct from the domain fields', () => {
      expect(resolveMetaTransactionTypedData(typedData, METHOD).calldata).toBe(ACCEPT_CALLDATA)
    })
  })

  describe('when the types declare an extra struct the MetaTransaction does not reference', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      typedData.types.Unused = [{ name: 'value', type: 'uint256' }]
    })

    it('should resolve the inner call because an unreferenced struct does not change what is signed', () => {
      expect(resolveMetaTransactionTypedData(typedData, METHOD).calldata).toBe(ACCEPT_CALLDATA)
    })
  })

  describe('when the domain salt and chainId name the same chain', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      typedData.domain.chainId = 137
    })

    it('should resolve that chain', () => {
      expect(resolveMetaTransactionTypedData(typedData, METHOD).chainId).toBe(137)
    })
  })

  describe('when the domain salt and chainId name different chains', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      typedData.domain.chainId = 80002
    })

    it('should throw a MalformedSignatureRequestError instead of picking one', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })

    it('should say the two fields disagree', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow('salt and chainId name different chains')
    })
  })

  describe('when the domain carries a chainId field instead of a salt', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      // A domain without a salt also declares its struct without one; let the wallet derive it.
      delete typedData.types.EIP712Domain
      delete typedData.domain.salt
      typedData.domain.chainId = 80002
    })

    it('should resolve the chain id from the chainId field', () => {
      expect(resolveMetaTransactionTypedData(typedData, METHOD).chainId).toBe(80002)
    })
  })

  describe('when the message carries a second call in a field the struct does not declare', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      typedData.message.functionSignature = GET_NONCE_CALLDATA
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })

    it('should say the message does not match the declared fields', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(
        'The "eth_signTypedData_v4" request parameters are malformed: the MetaTransaction message does not match the fields its struct declares'
      )
    })
  })

  describe('when the struct declares functionSignature but the message only carries functionData', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildLegacyTypedData()
      delete typedData.message.functionSignature
      typedData.message.functionData = ACCEPT_CALLDATA
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the message carries an extra unrelated field', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      typedData.message.memo = 'gift'
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the message lacks a declared field', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      delete typedData.message.nonce
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the struct fields are declared in a different order', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      typedData.types.MetaTransaction = [...OFFCHAIN_META_TRANSACTION_TYPE].reverse()
    })

    it('should throw a MalformedSignatureRequestError because the order changes the struct hash', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the struct declares the calldata with a different type', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      typedData.types.MetaTransaction = [
        { name: 'nonce', type: 'uint256' },
        { name: 'from', type: 'address' },
        { name: 'functionData', type: 'string' }
      ]
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the struct declares an additional field', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      typedData.types.MetaTransaction = [...OFFCHAIN_META_TRANSACTION_TYPE, { name: 'deadline', type: 'uint256' }]
      typedData.message.deadline = 0
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the typed data has no types', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      delete (typedData as Partial<MutableTypedData>).types
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the types do not declare the MetaTransaction struct', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      delete typedData.types.MetaTransaction
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the calldata is shorter than a function selector', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      typedData.message.functionData = '0xdead'
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the calldata ends in half a byte', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      typedData.message.functionData = `${ACCEPT_CALLDATA}f`
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the sender is not an address', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      typedData.message.from = 'not-an-address'
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the domain has no verifying contract', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      delete typedData.domain.verifyingContract
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the domain has neither a salt nor a chainId', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      delete typedData.domain.salt
    })

    it('should throw a MalformedSignatureRequestError because the call cannot be simulated on any chain', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when a declared value cannot be hashed the way the wallet would', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = buildOffchainTypedData()
      typedData.message.nonce = -1
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the primary type is not MetaTransaction', () => {
    let typedData: MutableTypedData

    beforeEach(() => {
      typedData = { ...buildOffchainTypedData(), primaryType: 'Permit' }
    })

    it('should throw a MalformedSignatureRequestError', () => {
      expect(() => resolveMetaTransactionTypedData(typedData, METHOD)).toThrow(MalformedSignatureRequestError)
    })
  })
})
