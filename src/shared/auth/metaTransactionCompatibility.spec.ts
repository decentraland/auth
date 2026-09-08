import { AbiFunction, encodeFunctionData } from 'viem'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ContractName, ErrorCode, MetaTransactionError, getContract, sendMetaTransaction } from 'decentraland-transactions'
import { RequestClassification, classifyRequest } from '../../components/Pages/RequestPage/classifyRequest'
import { ContractResolution, getCollectionContract, getKnownDecentralandContract } from './decentralandContracts'
import { buildMetaTransactionSimulationPayload } from './metaTransactionSimulation'
import { resolveMetaTransactionTypedData } from './metaTransactionTypedData'
import { assertSignatureParamsAreCanonical } from './signMethodGuard'

// Compatibility guard for the MetaTransaction checks: every Decentraland contract that executes
// meta-transactions must keep producing, through decentraland-transactions itself, a signature
// request the auth site accepts and classifies as a Decentraland meta-transaction. The library is
// driven for real up to the moment it asks the wallet to sign — which is where a dapp's request
// reaches the auth site — and the captured request is run through the recover guard, the resolver
// and the classifier. If the strict rules ever reject a legitimate payload, this fails first.

const METHOD = 'eth_signTypedData_v4'
const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
// Registry entries for per-collection proxies carry no address; the auth site clones them with the
// target collection, so this does the same.
const COLLECTION_ADDRESS = '0xfef5c99885c3036e591b6e6db52482891834a5f4'
const NONCE = 7
const STOP_MESSAGE = 'stop before relaying'

type ConnectedProvider = Parameters<typeof sendMetaTransaction>[0]
type ContractData = ReturnType<typeof getContract>
type RpcRequest = { method: string; params?: unknown[] }
type MetaTransactionContract = {
  name: ContractName
  chainId: ChainId
  calldataField: 'functionSignature' | 'functionData'
  contract: ContractData
  /** A call the contract's own ABI decodes: the first argument-less, non-payable function. */
  calldata: string
  functionName: string
}

/** Every registry contract on a meta-transaction chain whose ABI can execute meta-transactions. */
const META_TRANSACTION_CONTRACTS: MetaTransactionContract[] = [ChainId.MATIC_MAINNET, ChainId.MATIC_AMOY].flatMap(chainId =>
  Object.values(ContractName).flatMap(name => {
    let contract: ContractData
    try {
      contract = getContract(name, chainId)
    } catch {
      return []
    }
    const executeMetaTransaction = contract.abi.find((element: { name?: string }) => element.name === 'executeMetaTransaction') as
      | { inputs?: Array<{ name?: string }> }
      | undefined
    if (!executeMetaTransaction) {
      return []
    }
    const calldataField = executeMetaTransaction.inputs?.some((input: { name?: string }) => input.name === '_functionData')
      ? 'functionData'
      : 'functionSignature'
    const decodable = contract.abi.find(
      (element: { type?: string; inputs?: unknown[]; stateMutability?: string }) =>
        element.type === 'function' && element.inputs?.length === 0 && element.stateMutability !== 'payable'
    ) as AbiFunction | undefined
    if (!decodable) {
      throw new Error(`No argument-less function to build a decodable call for ${name} on chain ${chainId}`)
    }
    return [
      {
        name,
        chainId,
        calldataField,
        contract: { ...contract, address: contract.address || COLLECTION_ADDRESS },
        calldata: encodeFunctionData({ abi: [decodable], functionName: decodable.name }),
        functionName: decodable.name
      }
    ]
  })
)

describe('when decentraland-transactions builds a meta-transaction request', () => {
  it('should find both meta-transaction schemas in the contract registry, or these checks prove nothing', () => {
    expect(new Set(META_TRANSACTION_CONTRACTS.map(entry => entry.calldataField))).toEqual(new Set(['functionSignature', 'functionData']))
  })

  describe.each(META_TRANSACTION_CONTRACTS)(
    'for $name on chain $chainId',
    ({ chainId, calldataField, contract, calldata, functionName }) => {
      let signParams: unknown[] | undefined
      let failure: unknown

      beforeEach(async () => {
        signParams = undefined
        failure = undefined
        const connectedProvider = {
          request: async ({ method, params }: RpcRequest) => {
            switch (method) {
              case 'eth_requestAccounts':
                return [USER]
              case 'eth_getCode':
                return '0x'
              case 'eth_signTypedData_v4':
                // This is the request a dapp hands to the auth site. Stop here, before the relay.
                signParams = params
                throw new MetaTransactionError(STOP_MESSAGE, ErrorCode.USER_DENIED)
              default:
                throw new Error(`Unexpected wallet request: ${method}`)
            }
          }
        } as unknown as ConnectedProvider
        const networkProvider = {
          request: async ({ method }: RpcRequest) => {
            if (method === 'eth_call') {
              return `0x${NONCE.toString(16).padStart(64, '0')}`
            }
            throw new Error(`Unexpected network request: ${method}`)
          }
        } as unknown as ConnectedProvider

        try {
          await sendMetaTransaction(connectedProvider, networkProvider, calldata, contract, { serverURL: 'http://relayer.example' })
        } catch (error) {
          failure = error
        }
      })

      it('should reach the wallet signature step before stopping', () => {
        expect(failure).toEqual(expect.objectContaining({ message: STOP_MESSAGE }))
      })

      it('should ask the wallet to sign typed data as [signer, typed data]', () => {
        expect(signParams).toEqual([USER, expect.any(String)])
      })

      it('should pass the recover guard', () => {
        expect(() => assertSignatureParamsAreCanonical(METHOD, signParams, USER)).not.toThrow()
      })

      it('should resolve to the exact call being relayed', () => {
        expect(resolveMetaTransactionTypedData(JSON.parse((signParams as string[])[1]), METHOD)).toEqual({
          calldataField,
          calldata,
          from: USER,
          verifyingContract: contract.address,
          chainId
        })
      })

      it('should preview the contract calling itself with the signer appended, as executeMetaTransaction will', () => {
        const resolved = resolveMetaTransactionTypedData(JSON.parse((signParams as string[])[1]), METHOD)
        expect(buildMetaTransactionSimulationPayload(resolved.chainId, resolved.verifyingContract, resolved.calldata, USER)).toEqual({
          chainId,
          from: contract.address,
          to: contract.address,
          data: `${calldata}${USER.slice(2)}`,
          value: '0'
        })
      })

      describe('and the captured request is classified', () => {
        let classification: RequestClassification

        beforeEach(async () => {
          // Registry contracts resolve statically; the collection resolves the way the page resolves one a
          // collection factory deployed.
          const resolveContract = async (address: string, chain: number): Promise<ContractResolution> => {
            const known = getKnownDecentralandContract(address, chain)
            if (known) return { status: 'found', contract: known }
            const collection = getCollectionContract(address, chain)
            return address.toLowerCase() === COLLECTION_ADDRESS && collection
              ? { status: 'found', contract: collection }
              : { status: 'not_found' }
          }
          classification = await classifyRequest(
            { sender: USER, expiration: '', method: METHOD, params: signParams },
            { signerAddress: USER, connectedChainId: chainId, metaTransactionChainId: chainId, resolveContract }
          )
        })

        it('should classify it as a Decentraland meta-transaction with the relayed call decoded', () => {
          expect(classification).toEqual(
            expect.objectContaining({
              kind: 'dcl_meta_transaction',
              calldata,
              chainId,
              contract: expect.objectContaining({ address: contract.address.toLowerCase(), calldataField }),
              call: expect.objectContaining({ functionName, payable: false })
            })
          )
        })
      })
    }
  )
})
