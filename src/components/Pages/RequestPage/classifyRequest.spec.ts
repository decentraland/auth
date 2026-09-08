/* eslint-disable @typescript-eslint/naming-convention -- EIP-712 type names (EIP712Domain, MetaTransaction, Permit) are fixed by the standard and the contracts */
import { encodeFunctionData, getAddress, stringToHex } from 'viem'
import { ContractName, DOMAIN_TYPE, META_TRANSACTION_TYPE, OFFCHAIN_META_TRANSACTION_TYPE, getContract } from 'decentraland-transactions'
import {
  ContractLookupUnavailableError,
  ContractResolution,
  KnownContract,
  MalformedSignatureRequestError,
  MalformedTransactionRequestError,
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
    context = {
      signerAddress: USER,
      connectedChainId: POLYGON,
      metaTransactionChainId: POLYGON,
      resolveContract,
      isAddressWithoutCode: jest.fn()
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and it is a transaction', () => {
    describe('and the target is a Decentraland contract on the meta-transaction chain that supports meta-transactions', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(notFound).mockResolvedValueOnce(found(polygonMana))
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

      it('should resolve the target on the connected chain before the meta-transaction chain', () => {
        expect(resolveContract).toHaveBeenNthCalledWith(1, polygonMana.address, ETHEREUM)
        expect(resolveContract).toHaveBeenNthCalledWith(2, polygonMana.address, POLYGON)
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
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        request = transactionRequest({ to: polygonMana.address, data: approveCalldata, value: '0x1' })
      })

      it('should refuse it because a Decentraland call never carries one', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow(MalformedTransactionRequestError)
      })

      it('should say why', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('cannot carry a value')
      })
    })

    describe('and the Decentraland call is executeMetaTransaction', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const data = encodeFunctionData({
          abi: polygonMana.abi,
          functionName: 'executeMetaTransaction',
          args: [USER, transferCalldata, `0x${'11'.repeat(32)}`, `0x${'22'.repeat(32)}`, 27]
        })
        request = transactionRequest({ to: polygonMana.address, data, value: '0x0' })
      })

      it('should refuse it because the call forwards another call', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('forwards another call')
      })
    })

    describe('and the Decentraland call is a non-payable forwarder', () => {
      let request: RecoverResponse

      beforeEach(() => {
        const manager = getKnownDecentralandContract(getContract(ContractName.CollectionManager, POLYGON).address, POLYGON)!
        resolveContract.mockResolvedValueOnce(found(manager))
        const data = encodeFunctionData({
          abi: manager.abi,
          functionName: 'manageCollection',
          args: [RECIPIENT, COLLECTION_ADDRESS, approveCalldata]
        })
        request = transactionRequest({ to: manager.address, data, value: '0x0' })
      })

      it('should refuse it because the decoded arguments do not say what runs', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow(
          'manageCollection on the Decentraland CollectionManager contract forwards another call'
        )
      })
    })

    describe('and the calldata does not decode against the Decentraland ABI', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        request = transactionRequest({ to: polygonMana.address, data: `${approveCalldata}00`, value: '0x0' })
      })

      it('should refuse it rather than show it as a call to an unknown contract', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow(MalformedTransactionRequestError)
      })

      it('should name the contract the calldata does not fit', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('is not a call the Decentraland MANAToken contract declares')
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
          resolveContract.mockResolvedValueOnce(notFound).mockResolvedValueOnce(found(polygonBid))
          context.connectedChainId = ETHEREUM
          classification = await classifyRequest(transactionRequest({ to: polygonBid.address, data, value: '0x0' }), context)
        })

        it('should classify it as an unknown transaction on the connected chain', () => {
          expect(classification).toEqual(
            expect.objectContaining({ kind: 'unknown_transaction', chainId: ETHEREUM, reason: 'unknown_contract' })
          )
        })

        it('should resolve the target on the connected chain before the meta-transaction chain', () => {
          expect(resolveContract).toHaveBeenNthCalledWith(1, polygonBid.address, ETHEREUM)
        })
      })
    })

    describe('and the target is a Decentraland contract on the connected chain', () => {
      beforeEach(async () => {
        resolveContract.mockResolvedValueOnce(found(ethereumMana))
        context.connectedChainId = ETHEREUM
        const data = encodeFunctionData({ abi: ethereumMana.abi, functionName: 'approve', args: [RECIPIENT, 1000n] })
        classification = await classifyRequest(transactionRequest({ to: ethereumMana.address, data, value: '0x0' }), context)
      })

      it('should classify it as a plain Decentraland transaction on that chain', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'dcl_transaction', relayed: false, chainId: ETHEREUM }))
      })

      it('should not ask the meta-transaction chain, so the same address there can never re-target the send', () => {
        expect(resolveContract).toHaveBeenCalledTimes(1)
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

    describe('and the connected-chain lookup could not answer', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(unavailable)
        context.connectedChainId = ETHEREUM
        request = transactionRequest({ to: UNKNOWN_CONTRACT, data: approveCalldata, value: '0x0' })
      })

      it('should throw a contract lookup unavailable error rather than treat the target as unknown', async () => {
        await expect(classifyRequest(request, context)).rejects.toBeInstanceOf(ContractLookupUnavailableError)
      })
    })

    describe('and the collection lookup could not answer', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(unavailable)
        request = transactionRequest({ to: COLLECTION_ADDRESS, data: approveCalldata, value: '0x0' })
      })

      it('should throw a contract lookup unavailable error instead of classifying', async () => {
        await expect(classifyRequest(request, context)).rejects.toBeInstanceOf(ContractLookupUnavailableError)
      })
    })

    describe('and the transaction carries no calldata', () => {
      describe('and the recipient is another account', () => {
        beforeEach(async () => {
          jest.mocked(context.isAddressWithoutCode).mockResolvedValueOnce(true)
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

        it('should check the recipient code on the connected chain', () => {
          expect(context.isAddressWithoutCode).toHaveBeenCalledWith(RECIPIENT, POLYGON)
        })
      })

      describe('and the recipient is the signer in another casing', () => {
        beforeEach(async () => {
          jest.mocked(context.isAddressWithoutCode).mockResolvedValueOnce(true)
          classification = await classifyRequest(transactionRequest({ to: getAddress(USER), value: '1000' }), context)
        })

        it('should flag the transfer as a self-send with the value normalized to hex', () => {
          expect(classification).toEqual(expect.objectContaining({ kind: 'native_transfer', toSelf: true, value: '0x3e8' }))
        })
      })

      describe.each(['0x0', '0xde0b6b3a7640000'])('and the recipient has code with value %s', value => {
        beforeEach(async () => {
          context.connectedChainId = ETHEREUM
          jest.mocked(context.isAddressWithoutCode).mockResolvedValueOnce(false)
          classification = await classifyRequest(transactionRequest({ to: RECIPIENT, data: '0x', value }), context)
        })

        it('should retain the unknown-contract review on the execution chain', () => {
          expect(classification).toEqual({
            kind: 'unknown_transaction',
            to: RECIPIENT,
            data: '0x',
            value,
            chainId: ETHEREUM,
            reason: 'unverified_recipient'
          })
        })

        it('should inspect the connected chain even though the relay chain differs', () => {
          expect(context.isAddressWithoutCode).toHaveBeenCalledWith(RECIPIENT, ETHEREUM)
        })
      })

      describe('and the signer has delegated code', () => {
        beforeEach(async () => {
          jest.mocked(context.isAddressWithoutCode).mockResolvedValueOnce(false)
          classification = await classifyRequest(transactionRequest({ to: USER, data: '0x', value: '0x0' }), context)
        })

        it('should retain the unknown-contract warnings even for a self-send', () => {
          expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_transaction', reason: 'unverified_recipient' }))
        })
      })

      describe('and the recipient code lookup fails', () => {
        beforeEach(async () => {
          jest.mocked(context.isAddressWithoutCode).mockRejectedValueOnce(new Error('RPC unavailable'))
          classification = await classifyRequest(transactionRequest({ to: RECIPIENT, value: '0x0' }), context)
        })

        it('should offer the unknown-contract review instead of a simple transfer', () => {
          expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_transaction', reason: 'unverified_recipient' }))
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

      it('should hand the wallet the JSON of the parsed typed data as the raw payload', () => {
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

    describe('and the typed data string gives a message field twice', () => {
      let raw: string

      beforeEach(async () => {
        raw = '{"types":{"Permit":[]},"domain":{},"primaryType":"Permit","message":{"owner":"0xgood","owner":"0xevil"}}'
        classification = await classifyRequest(typedDataRequest(raw), context)
      })

      it('should hand the wallet the JSON of what was parsed, with the field once and the value a wallet keeps', () => {
        expect(classification).toEqual(
          expect.objectContaining({
            kind: 'unknown_typed_data',
            raw: '{"types":{"Permit":[]},"domain":{},"primaryType":"Permit","message":{"owner":"0xevil"}}'
          })
        )
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
      let request: RecoverResponse

      beforeEach(() => {
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        request = typedDataRequest({ ...typedData, message: { ...typedData.message, functionData: approveCalldata } })
      })

      describe('and the contract is a Decentraland one', () => {
        beforeEach(() => {
          resolveContract.mockResolvedValueOnce(found(polygonMana))
        })

        it('should refuse it because the signature would still verify on that contract', async () => {
          await expect(classifyRequest(request, context)).rejects.toThrow(MalformedSignatureRequestError)
        })
      })

      describe('and the contract is not a Decentraland one', () => {
        beforeEach(async () => {
          resolveContract.mockResolvedValueOnce(notFound)
          classification = await classifyRequest(request, context)
        })

        it('should classify it as an unknown meta-transaction naming the claimed contract', () => {
          expect(classification).toEqual(
            expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'malformed', verifyingContract: polygonMana.address })
          )
        })
      })
    })

    describe('and the types carry a struct the MetaTransaction does not reach', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        request = typedDataRequest({ ...typedData, types: { ...typedData.types, Note: [{ name: 'text', type: 'string' }] } })
      })

      it('should refuse it because the extra struct is unsigned text riding along', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('carries more than the MetaTransaction')
      })
    })

    describe('and the typed data carries a top-level field EIP-712 does not define', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        request = typedDataRequest({ ...buildMetaTransaction(polygonMana, transferCalldata), note: 'You pay nothing' })
      })

      it('should refuse it', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('carries more than the MetaTransaction')
      })
    })

    describe('and the domain names a verifying contract that is not an address', () => {
      beforeEach(async () => {
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        classification = await classifyRequest(
          typedDataRequest({ ...typedData, domain: { ...typedData.domain, verifyingContract: 'Decentraland' } }),
          context
        )
      })

      it('should classify it as an unknown meta-transaction without a target rather than show the text as the contract', () => {
        expect(classification).toEqual(
          expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'malformed', verifyingContract: null })
        )
      })

      it('should not resolve any contract', () => {
        expect(resolveContract).not.toHaveBeenCalled()
      })
    })

    describe('and the domain names another chain', () => {
      let request: RecoverResponse

      beforeEach(() => {
        request = typedDataRequest(buildMetaTransaction(polygonMana, transferCalldata, AMOY))
      })

      describe('and the contract is a Decentraland one on the relay chain', () => {
        beforeEach(() => {
          resolveContract.mockResolvedValueOnce(notFound).mockResolvedValueOnce(found(polygonMana))
        })

        it('should refuse it', async () => {
          await expect(classifyRequest(request, context)).rejects.toThrow('does not relay meta-transactions on chain 80002')
        })

        it('should look the contract up on the named chain and then on the relay chain', async () => {
          await classifyRequest(request, context).catch(() => undefined)
          expect(resolveContract).toHaveBeenNthCalledWith(1, polygonMana.address, AMOY)
          expect(resolveContract).toHaveBeenNthCalledWith(2, polygonMana.address, POLYGON)
        })
      })

      describe('and the contract is not a Decentraland one on either chain', () => {
        beforeEach(async () => {
          resolveContract.mockResolvedValue(notFound)
          classification = await classifyRequest(request, context)
        })

        it('should classify it as an unknown meta-transaction on that chain', () => {
          expect(classification).toEqual(
            expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'other_chain', chainId: AMOY })
          )
        })
      })
    })

    describe('and it is the MetaTransaction the SDK builds for a Decentraland contract on a chain the relay does not serve', () => {
      let request: RecoverResponse

      beforeEach(() => {
        const ethereumRentals = getKnownDecentralandContract(getContract(ContractName.Rentals, ETHEREUM).address, ETHEREUM)!
        resolveContract.mockResolvedValueOnce(found(ethereumRentals))
        request = typedDataRequest(buildMetaTransaction(ethereumRentals, transferCalldata, ETHEREUM))
      })

      it('should refuse it rather than show it as a signature for a contract Decentraland does not recognize', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('does not relay meta-transactions on chain 1')
      })

      it('should recognize the contract on the chain the domain names', async () => {
        await classifyRequest(request, context).catch(() => undefined)
        expect(resolveContract).toHaveBeenNthCalledWith(1, getContract(ContractName.Rentals, ETHEREUM).address.toLowerCase(), ETHEREUM)
      })
    })

    describe('and the message is for another account', () => {
      let request: RecoverResponse

      beforeEach(() => {
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        request = typedDataRequest({ ...typedData, message: { ...typedData.message, from: RECIPIENT } })
      })

      describe('and the contract is a Decentraland one', () => {
        beforeEach(() => {
          resolveContract.mockResolvedValueOnce(found(polygonMana))
        })

        it('should refuse it', async () => {
          await expect(classifyRequest(request, context)).rejects.toThrow('is for another account')
        })
      })

      describe('and the contract is not a Decentraland one', () => {
        beforeEach(async () => {
          resolveContract.mockResolvedValueOnce(notFound)
          classification = await classifyRequest(request, context)
        })

        it('should classify it as an unknown meta-transaction', () => {
          expect(classification).toEqual(expect.objectContaining({ kind: 'unknown_meta_transaction', reason: 'from_mismatch' }))
        })
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
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(unavailable)
        request = typedDataRequest(buildMetaTransaction(collection, transferCalldata))
      })

      it('should throw a contract lookup unavailable error rather than review a signature it cannot place', async () => {
        await expect(classifyRequest(request, context)).rejects.toBeInstanceOf(ContractLookupUnavailableError)
      })
    })

    describe('and the verifying contract cannot execute meta-transactions', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(found(polygonBid))
        request = typedDataRequest(buildMetaTransaction(polygonBid, transferCalldata))
      })

      it('should refuse it', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('does not execute meta-transactions')
      })
    })

    describe('and the struct uses the functionData field against a contract that executes functionSignature', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        request = typedDataRequest({
          ...typedData,
          types: { ...typedData.types, MetaTransaction: OFFCHAIN_META_TRANSACTION_TYPE },
          message: { nonce: 1, from: USER, functionData: transferCalldata }
        })
      })

      it('should refuse it', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('struct is not the one the contract hashes')
      })
    })

    describe('and the domain carries chainId instead of the salt', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        request = typedDataRequest({
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
        })
      })

      it('should refuse it', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('domain is not the one the contract hashes')
      })
    })

    describe('and the domain name is not the one the contract hashes', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        request = typedDataRequest({ ...typedData, domain: { ...typedData.domain, name: 'Not MANA' } })
      })

      it('should refuse it', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('domain is not the one the contract hashes')
      })
    })

    describe('and the domain struct is declared in another order', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        request = typedDataRequest({ ...typedData, types: { ...typedData.types, EIP712Domain: [...DOMAIN_TYPE].reverse() } })
      })

      it('should refuse it', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('domain is not the one the contract hashes')
      })
    })

    describe('and the domain struct is absent', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const typedData = buildMetaTransaction(polygonMana, transferCalldata)
        request = typedDataRequest({ ...typedData, types: { MetaTransaction: META_TRANSACTION_TYPE } })
      })

      it('should refuse it because wallets disagree on the digest of an undeclared domain struct', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('does not declare its domain struct')
      })
    })

    describe('and the inner call is executeMetaTransaction', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        const nested = encodeFunctionData({
          abi: polygonMana.abi,
          functionName: 'executeMetaTransaction',
          args: [RECIPIENT, transferCalldata, `0x${'11'.repeat(32)}`, `0x${'22'.repeat(32)}`, 27]
        })
        request = typedDataRequest(buildMetaTransaction(polygonMana, nested))
      })

      it('should refuse it because the call forwards another call', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('forwards another call')
      })
    })

    describe('and the inner call does not decode against the contract ABI', () => {
      let request: RecoverResponse

      beforeEach(() => {
        resolveContract.mockResolvedValueOnce(found(polygonMana))
        request = typedDataRequest(buildMetaTransaction(polygonMana, `0xdeadbeef${'00'.repeat(32)}`))
      })

      it('should refuse it rather than show it as a signature for an unknown contract', async () => {
        await expect(classifyRequest(request, context)).rejects.toThrow('is not a call the Decentraland MANAToken contract declares')
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
        classification = await classifyRequest(personalSignRequest(`0x${stringToHex('Hello, world').slice(2).toUpperCase()}`), context)
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

    describe('and the message is hex with an uppercase 0X prefix', () => {
      let message: string

      beforeEach(async () => {
        message = `0X${stringToHex('Hello, world').slice(2)}`
        classification = await classifyRequest(personalSignRequest(message), context)
      })

      it('should treat it as text, since a wallet signs a 0X-prefixed string as its characters', () => {
        expect(classification).toEqual({ kind: 'personal_sign', text: message, hex: stringToHex(message) })
      })
    })

    describe('and the message is the bare 0x prefix', () => {
      beforeEach(async () => {
        classification = await classifyRequest(personalSignRequest('0x'), context)
      })

      it('should treat it as the text "0x" rather than as empty bytes', () => {
        expect(classification).toEqual({ kind: 'personal_sign', text: '0x', hex: stringToHex('0x') })
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
        classification = await classifyRequest(personalSignRequest('Send 1 MANA to \u202e0xabc'), context)
      })

      it('should treat the message as unreadable', () => {
        expect(classification).toEqual(expect.objectContaining({ kind: 'personal_sign', text: null }))
      })
    })
  })

  describe('and the method is not one the page handles', () => {
    let request: RecoverResponse

    beforeEach(() => {
      request = { sender: USER, expiration: '', method: 'eth_sign', params: [] }
    })

    it('should throw an unsupported method error', async () => {
      await expect(classifyRequest(request, context)).rejects.toThrow('not supported')
    })
  })
})

describe('when fingerprinting a classification', () => {
  let context: ClassificationContext

  beforeEach(() => {
    context = {
      signerAddress: USER,
      connectedChainId: POLYGON,
      metaTransactionChainId: POLYGON,
      resolveContract: jest.fn(),
      isAddressWithoutCode: jest.fn()
    }
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
