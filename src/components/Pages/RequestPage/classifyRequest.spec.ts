/* eslint-disable @typescript-eslint/naming-convention -- EIP-712 type names (EIP712Domain, MetaTransaction, Permit) are fixed by the standard and the contracts */
import { encodeFunctionData, getAddress, stringToHex } from 'viem'
import { ContractName, DOMAIN_TYPE, META_TRANSACTION_TYPE, OFFCHAIN_META_TRANSACTION_TYPE, getContract } from 'decentraland-transactions'
import {
  ContractLookupUnavailableError,
  ContractResolution,
  KnownContract,
  RecoverResponse,
  getCollectionContract,
  getKnownDecentralandContract,
  getMetaTransactionSalt
} from '../../../shared/auth'
import { ClassificationContext, RequestClassification, classifyRequest, getPayloadFingerprint } from './classifyRequest'

const POLYGON = 137
const ETHEREUM = 1
const AMOY = 80002
const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
const RECIPIENT = '0x1234567890abcdef1234567890abcdef12345678'
const UNKNOWN_CONTRACT = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const COLLECTION_ADDRESS = '0xfef5c99885c3036e591b6e6db52482891834a5f4'

const polygonMana = getKnownDecentralandContract(getContract(ContractName.MANAToken, POLYGON).address, POLYGON)!
const ethereumMana = getKnownDecentralandContract(getContract(ContractName.MANAToken, ETHEREUM).address, ETHEREUM)!
const polygonBid = getKnownDecentralandContract(getContract(ContractName.BidV2, POLYGON).address, POLYGON)!
const collection = getCollectionContract(COLLECTION_ADDRESS, POLYGON)!

const found = (contract: KnownContract): ContractResolution => ({ status: 'found', contract })
const notFound: ContractResolution = { status: 'not_found' }
const unavailable: ContractResolution = { status: 'unavailable' }

const transferCalldata = encodeFunctionData({ abi: polygonMana.abi, functionName: 'transfer', args: [RECIPIENT, 1000n] })
const approveCalldata = encodeFunctionData({ abi: polygonMana.abi, functionName: 'approve', args: [RECIPIENT, 1000n] })

const transactionRequest = (transaction: Record<string, unknown>): RecoverResponse => ({
  sender: USER,
  expiration: '2100-01-01T00:00:00.000Z',
  method: 'eth_sendTransaction',
  params: [transaction]
})

const typedDataRequest = (typedData: unknown, method = 'eth_signTypedData_v4'): RecoverResponse => ({
  sender: USER,
  expiration: '2100-01-01T00:00:00.000Z',
  method,
  params: [USER, typeof typedData === 'string' ? typedData : JSON.stringify(typedData)]
})

const personalSignRequest = (message: string): RecoverResponse => ({
  sender: USER,
  expiration: '2100-01-01T00:00:00.000Z',
  method: 'personal_sign',
  params: [message, USER]
})

const buildMetaTransaction = (contract: KnownContract, calldata: string, chainId = POLYGON) => ({
  types: { EIP712Domain: DOMAIN_TYPE, MetaTransaction: META_TRANSACTION_TYPE },
  domain: {
    name: contract.domainName,
    version: contract.domainVersion,
    verifyingContract: contract.address,
    salt: getMetaTransactionSalt(chainId)
  },
  primaryType: 'MetaTransaction',
  message: { nonce: 1, from: USER, functionSignature: calldata }
})

describe('when classifying a request', () => {
  let resolveContract: jest.Mock
  let context: ClassificationContext
  let classification: RequestClassification

  beforeEach(() => {
    resolveContract = jest.fn()
    context = { signerAddress: USER, connectedChainId: POLYGON, metaTransactionChainId: POLYGON, resolveContract }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and it is a transaction', () => {
    describe('and the target is a Decentraland contract on the meta-transaction chain that supports meta-transactions', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        context.connectedChainId = ETHEREUM
        classification = await classifyRequest(
          transactionRequest({ to: polygonMana.address, data: approveCalldata, value: '0x0' }),
          context
        )
      })

      it('should classify it as a relayed Decentraland transaction on the meta-transaction chain', () => {
        expect(classification).toEqual(
          expect.objectContaining({
            kind: 'dcl_transaction',
            relayed: true,
            chainId: POLYGON,
            branded: null,
            call: expect.objectContaining({ functionName: 'approve' })
          })
        )
      })

      it('should only resolve the target on the meta-transaction chain', () => {
        expect(resolveContract).toHaveBeenCalledTimes(1)
        expect(resolveContract).toHaveBeenCalledWith(polygonMana.address, POLYGON)
      })
    })

    describe('and the call is a relayed MANA transfer', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        classification = await classifyRequest(
          transactionRequest({ to: polygonMana.address, data: transferCalldata, value: '0x0' }),
          context
        )
      })

      it('should mark it as a tip', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'dcl_transaction', branded: 'tip' }))
      })
    })

    describe('and the call is a transfer on a verified collection', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(collection))
        const data = encodeFunctionData({ abi: collection.abi, functionName: 'safeTransferFrom', args: [USER, RECIPIENT, 7n] })
        classification = await classifyRequest(transactionRequest({ to: COLLECTION_ADDRESS, data, value: '0x0' }), context)
      })

      it('should mark it as a gift candidate', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'dcl_transaction', relayed: true, branded: 'gift_candidate' }))
      })
    })

    describe('and the Decentraland call carries a value', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        classification = await classifyRequest(
          transactionRequest({ to: polygonMana.address, data: approveCalldata, value: '0x1' }),
          context
        )
      })

      it('should classify it as an unknown transaction on the connected chain', () => {
        expect(classification).toEqual({
          kind: 'unknown_transaction',
          to: polygonMana.address,
          data: approveCalldata,
          value: '0x1',
          chainId: POLYGON,
          reason: 'value_attached'
        })
      })
    })

    describe('and the Decentraland call is executeMetaTransaction', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const data = encodeFunctionData({
          abi: polygonMana.abi,
          functionName: 'executeMetaTransaction',
          args: [USER, transferCalldata, `0x${'11'.repeat(32)}`, `0x${'22'.repeat(32)}`, 27]
        })
        classification = await classifyRequest(transactionRequest({ to: polygonMana.address, data, value: '0x0' }), context)
      })

      it('should classify it as an unknown transaction because the call is payable', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_transaction', reason: 'payable_call' }))
      })
    })

    describe('and the calldata does not decode against the Decentraland ABI', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        classification = await classifyRequest(
          transactionRequest({ to: polygonMana.address, data: `${approveCalldata}00`, value: '0x0' }),
          context
        )
      })

      it('should classify it as an unknown transaction', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_transaction', reason: 'undecodable_call' }))
      })
    })

    describe('and the target is a Decentraland contract on the meta-transaction chain without meta-transaction support', () => {
      let data: string

      beforeEach(() => {
        const readOnly = polygonBid.abi.find(
          item => item.type === 'function' && item.inputs.length === 0 && item.stateMutability !== 'payable'
        )!
        data = encodeFunctionData({ abi: [readOnly], functionName: (readOnly as { name: string }).name })
      })

      describe('and the wallet is on that chain', () => {
        beforeEach(async () => {
          resolveContract.mockResolvedValueOnce(found(polygonBid))
          classification = await classifyRequest(transactionRequest({ to: polygonBid.address, data, value: '0x0' }), context)
        })

        it('should classify it as a plain Decentraland transaction on the connected chain', () => {
          expect(classification).toEqual(expect.objectContaining({ kind: 'dcl_transaction', relayed: false, chainId: POLYGON }))
        })
      })

      describe('and the wallet is on another chain', () => {
        beforeEach(async () => {
          resolveContract.mockResolvedValueOnce(found(polygonBid)).mockResolvedValueOnce(notFound)
          context.connectedChainId = ETHEREUM
          classification = await classifyRequest(transactionRequest({ to: polygonBid.address, data, value: '0x0' }), context)
        })

        it('should classify it as an unknown transaction on the connected chain', () => {
          expect(classification).toEqual(
            expect.objectContaining({ kind: 'unknown_transaction', chainId: ETHEREUM, reason: 'unknown_contract' })
          )
        })

        it('should resolve the target on the connected chain after the meta-transaction chain', () => {
          expect(resolveContract).toHaveBeenNthCalledWith(2, polygonBid.address, ETHEREUM)
        })
      })
    })

    describe('and the target is a Decentraland contract on the connected chain only', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(notFound).mockResolvedValueOnce(found(ethereumMana))
        context.connectedChainId = ETHEREUM
        const data = encodeFunctionData({ abi: ethereumMana.abi, functionName: 'approve', args: [RECIPIENT, 1000n] })
        classification = await classifyRequest(transactionRequest({ to: ethereumMana.address, data, value: '0x0' }), context)
      })

      it('should classify it as a plain Decentraland transaction on that chain', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'dcl_transaction', relayed: false, chainId: ETHEREUM }))
      })
    })

    describe('and the target is not a Decentraland contract anywhere', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(notFound).mockResolvedValueOnce(notFound)
        context.connectedChainId = ETHEREUM
        classification = await classifyRequest(transactionRequest({ to: UNKNOWN_CONTRACT, data: approveCalldata, value: '0x0' }), context)
      })

      it('should classify it as an unknown transaction on the connected chain', () => {
        expect(classification).toEqual({
          kind: 'unknown_transaction',
          to: UNKNOWN_CONTRACT,
          data: approveCalldata,
          value: '0x0',
          chainId: ETHEREUM,
          reason: 'unknown_contract'
        })
      })
    })

    describe('and the collection lookup could not answer', () => {
      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(unavailable)
      })

      it('should throw a contract lookup unavailable error instead of classifying', async () => {
        await expect(
          classifyRequest(transactionRequest({ to: COLLECTION_ADDRESS, data: approveCalldata, value: '0x0' }), context)
        ).rejects.toBeInstanceOf(ContractLookupUnavailableError)
      })
    })

    describe('and the transaction carries no calldata', () => {
      describe('and the recipient is another account', () => {
        beforeEach(async () => {
          classification = await classifyRequest(transactionRequest({ to: RECIPIENT, value: '0xde0b6b3a7640000' }), context)
        })

        it('should classify it as a native transfer on the connected chain', () => {
          expect(classification).toEqual({
            kind: 'native_transfer',
            to: RECIPIENT,
            value: '0xde0b6b3a7640000',
            chainId: POLYGON,
            toSelf: false
          })
        })

        it('should not resolve any contract', () => {
          expect(resolveContract).not.toHaveBeenCalled()
        })
      })

      describe('and the recipient is the signer in another casing', () => {
        beforeEach(async () => {
          classification = await classifyRequest(transactionRequest({ to: getAddress(USER), value: '1000' }), context)
        })

        it('should flag the transfer as a self-send with the value normalized to hex', () => {
          expect(classification).toEqual(expect.objectContaining({ kind: 'native_transfer', toSelf: true, value: '0x3e8' }))
        })
      })
    })
  })

  describe('and it is typed data', () => {
    describe('and it is the MetaTransaction decentraland-transactions builds for a Decentraland contract', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        classification = await classifyRequest(typedDataRequest(buildMetaTransaction(polygonMana, transferCalldata)), context)
      })

      it('should classify it as a Decentraland meta-transaction with the decoded call', () => {
        expect(classification).toEqual(
          expect.objectContaining({
            kind: 'dcl_meta_transaction',
            contract: polygonMana,
            calldata: transferCalldata,
            chainId: POLYGON,
            call: expect.objectContaining({ functionName: 'transfer', payable: false })
          })
        )
      })

      it('should keep the typed data string verbatim as the raw payload', () => {
        expect(classification).toEqual(
          expect.objectContaining({ raw: JSON.stringify(buildMetaTransaction(polygonMana, transferCalldata)) })
        )
      })
    })

    describe('and the typed data arrives as an object instead of a JSON string', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const request = typedDataRequest(buildMetaTransaction(polygonMana, transferCalldata))
        request.params = [USER, buildMetaTransaction(polygonMana, transferCalldata)]
        classification = await classifyRequest(request, context)
      })

      it('should classify it the same way', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'dcl_meta_transaction' }))
      })
    })

    describe('and the method is eth_signTypedData_v3', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        classification = await classifyRequest(
          typedDataRequest(buildMetaTransaction(polygonMana, transferCalldata), 'eth_signTypedData_v3'),
          context
        )
      })

      it('should classify it as a Decentraland meta-transaction', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'dcl_meta_transaction' }))
      })
    })

    describe('and the message carries a field the struct does not declare', () => {
      beforeEach(async () => {
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        classification = await classifyRequest(
          typedDataRequest({ ...typedData, message: { ...typedData.message, functionData: approveCalldata } }),
          context
        )
      })

      it('should classify it as an unknown meta-transaction rather than reject it', () => {
        expect(classification).toEqual(
          expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'malformed', verifyingContract: polygonMana.address })
        )
      })
    })

    describe('and the domain names another chain', () => {
      beforeEach(async () => {
        classification = await classifyRequest(typedDataRequest(buildMetaTransaction(polygonMana, transferCalldata, AMOY)), context)
      })

      it('should classify it as an unknown meta-transaction', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'other_chain', chainId: AMOY }))
      })
    })

    describe('and the message is for another account', () => {
      beforeEach(async () => {
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        classification = await classifyRequest(
          typedDataRequest({ ...typedData, message: { ...typedData.message, from: RECIPIENT } }),
          context
        )
      })

      it('should classify it as an unknown meta-transaction', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'from_mismatch' }))
      })
    })

    describe('and the verifying contract is not a Decentraland contract', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(notFound)
        const typedData = buildMetaTransaction({ ...polygonMana, address: UNKNOWN_CONTRACT }, transferCalldata)
        classification = await classifyRequest(typedDataRequest(typedData), context)
      })

      it('should classify it as an unknown meta-transaction', () => {
        expect(classification).toEqual(
          expect.objectContaining({
            kind: 'unknown_meta_transaction',
            reason: 'unknown_contract',
            verifyingContract: UNKNOWN_CONTRACT,
            chainId: POLYGON
          })
        )
      })
    })

    describe('and the collection lookup could not answer', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(unavailable)
        classification = await classifyRequest(typedDataRequest(buildMetaTransaction(collection, transferCalldata)), context)
      })

      it('should classify it as an unknown meta-transaction rather than throw', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'lookup_unavailable' }))
      })
    })

    describe('and the verifying contract cannot execute meta-transactions', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonBid))
        classification = await classifyRequest(typedDataRequest(buildMetaTransaction(polygonBid, transferCalldata)), context)
      })

      it('should classify it as an unknown meta-transaction', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'no_meta_transaction_support' }))
      })
    })

    describe('and the struct uses the functionData field against a contract that executes functionSignature', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        classification = await classifyRequest(
          typedDataRequest({
            ...typedData,
            types: { ...typedData.types, MetaTransaction: OFFCHAIN_META_TRANSACTION_TYPE },
            message: { nonce: 1, from: USER, functionData: transferCalldata }
          }),
          context
        )
      })

      it('should classify it as an unknown meta-transaction', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'calldata_field_mismatch' }))
      })
    })

    describe('and the domain carries chainId instead of the salt', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        classification = await classifyRequest(
          typedDataRequest({
            ...typedData,
            types: {
              ...typedData.types,
              EIP712Domain: DOMAIN_TYPE.map(field => (field.name === 'salt' ? { name: 'chainId', type: 'uint256' } : field))
            },
            domain: {
              name: polygonMana.domainName,
              version: polygonMana.domainVersion,
              verifyingContract: polygonMana.address,
              chainId: POLYGON
            }
          }),
          context
        )
      })

      it('should classify it as an unknown meta-transaction', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'domain_mismatch' }))
      })
    })

    describe('and the domain name is not the one the contract hashes', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        classification = await classifyRequest(
          typedDataRequest({ ...typedData, domain: { ...typedData.domain, name: 'Not MANA' } }),
          context
        )
      })

      it('should classify it as an unknown meta-transaction', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'domain_mismatch' }))
      })
    })

    describe('and the domain struct is declared in another order', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        classification = await classifyRequest(
          typedDataRequest({ ...typedData, types: { ...typedData.types, EIP712Domain: [...DOMAIN_TYPE].reverse() } }),
          context
        )
      })

      it('should classify it as an unknown meta-transaction', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'domain_mismatch' }))
      })
    })

    describe('and the domain struct is absent', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        classification = await classifyRequest(
          typedDataRequest({ ...typedData, types: { MetaTransaction: META_TRANSACTION_TYPE } }),
          context
        )
      })

      it('should still classify it as a Decentraland meta-transaction', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'dcl_meta_transaction' }))
      })
    })

    describe('and the inner call is executeMetaTransaction', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const nested = encodeFunctionData({
          abi: polygonMana.abi,
          functionName: 'executeMetaTransaction',
          args: [RECIPIENT, transferCalldata, `0x${'11'.repeat(32)}`, `0x${'22'.repeat(32)}`, 27]
        })
        classification = await classifyRequest(typedDataRequest(buildMetaTransaction(polygonMana, nested)), context)
      })

      it('should classify it as an unknown meta-transaction', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'payable_call' }))
      })
    })

    describe('and the inner call does not decode against the contract ABI', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        classification = await classifyRequest(typedDataRequest(buildMetaTransaction(polygonMana, `0xdeadbeef${'00'.repeat(32)}`)), context)
      })

      it('should classify it as an unknown meta-transaction', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'undecodable_call' }))
      })
    })

    describe('and the primary type is not MetaTransaction', () => {
      let raw: string

      beforeEach(async () => {
        raw = JSON.stringify({
          types: { Permit: [{ name: 'owner', type: 'address' }] },
          domain: { name: 'USD Coin', chainId: POLYGON, verifyingContract: UNKNOWN_CONTRACT },
          primaryType: 'Permit',
          message: { owner: USER }
        })
        classification = await classifyRequest(typedDataRequest(raw), context)
      })

      it('should classify it as unknown typed data with the raw string', () => {
        expect(classification).toEqual({ kind: 'unknown_typed_data', typedData: JSON.parse(raw), raw })
      })

      it('should not resolve any contract', () => {
        expect(resolveContract).not.toHaveBeenCalled()
      })
    })
  })

  describe('and it is a personal_sign', () => {
    describe('and the message is hex-encoded text', () => {
      beforeEach(async () => {
        classification = await classifyRequest(personalSignRequest(stringToHex('Hello, world').toUpperCase().replace('0X', '0X')), context)
      })

      it('should decode the text and keep the bytes lowercased', () => {
        expect(classification).toEqual({ kind: 'personal_sign', text: 'Hello, world', hex: stringToHex('Hello, world') })
      })
    })

    describe('and the message is plain text', () => {
      beforeEach(async () => {
        classification = await classifyRequest(personalSignRequest('Sign in to Example\nNonce: 12345'), context)
      })

      it('should keep the text and encode the bytes the wallet signs', () => {
        expect(classification).toEqual({
          kind: 'personal_sign',
          text: 'Sign in to Example\nNonce: 12345',
          hex: stringToHex('Sign in to Example\nNonce: 12345')
        })
      })
    })

    describe('and the message is a 32-byte digest', () => {
      let digest: string

      beforeEach(async () => {
        digest = `0x${'9f'.repeat(32)}`
        classification = await classifyRequest(personalSignRequest(digest), context)
      })

      it('should expose the bytes without a readable text', () => {
        expect(classification).toEqual({ kind: 'personal_sign', text: null, hex: digest })
      })
    })

    describe('and the text contains a bidi override character', () => {
      beforeEach(async () => {
        classification = await classifyRequest(personalSignRequest('Send 1 MANA to ‮0xabc'), context)
      })

      it('should treat the message as unreadable', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'personal_sign', text: null }))
      })
    })
  })

  describe('and the method is not one the page handles', () => {
    it('should throw', async () => {
      await expect(classifyRequest({ sender: USER, expiration: '', method: 'eth_sign', params: [] }, context)).rejects.toThrow(
        'not supported'
      )
    })
  })
})

describe('when fingerprinting a classification', () => {
  let context: ClassificationContext

  beforeEach(() => {
    context = { signerAddress: USER, connectedChainId: POLYGON, metaTransactionChainId: POLYGON, resolveContract: jest.fn() }
  })

  describe('and two transactions differ only in the casing of their target', () => {
    let first: RequestClassification
    let second: RequestClassification

    beforeEach(async () => {
      first = await classifyRequest(transactionRequest({ to: RECIPIENT, value: '0x1' }), context)
      second = await classifyRequest(transactionRequest({ to: getAddress(RECIPIENT), value: '0x1' }), context)
    })

    it('should produce the same fingerprint', () => {
      expect(getPayloadFingerprint(first)).toBe(getPayloadFingerprint(second))
    })
  })

  describe('and two transactions differ in value', () => {
    let first: RequestClassification
    let second: RequestClassification

    beforeEach(async () => {
      first = await classifyRequest(transactionRequest({ to: RECIPIENT, value: '0x1' }), context)
      second = await classifyRequest(transactionRequest({ to: RECIPIENT, value: '0x2' }), context)
    })

    it('should produce different fingerprints', () => {
      expect(getPayloadFingerprint(first)).not.toBe(getPayloadFingerprint(second))
    })
  })

  describe('and the request is a personal_sign', () => {
    let classification: RequestClassification

    beforeEach(async () => {
      classification = await classifyRequest(personalSignRequest('hello'), context)
    })

    it('should fingerprint the bytes being signed', () => {
      expect(getPayloadFingerprint(classification)).toBe(stringToHex('hello'))
    })
  })
})
