import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ContractName, ErrorCode, MetaTransactionError, getContract, sendMetaTransaction } from 'decentraland-transactions'
import { buildMetaTransactionSimulationPayload } from './metaTransactionSimulation'
import { resolveMetaTransactionTypedData } from './metaTransactionTypedData'
import { assertSignatureParamsAreCanonical } from './signMethodGuard'

// Compatibility guard for the MetaTransaction checks: every Decentraland contract that executes
// meta-transactions must keep producing, through decentraland-transactions itself, a signature
// request the auth site accepts. The library is driven for real up to the moment it asks the
// wallet to sign — which is where a dapp's request reaches the auth site — and the captured
// request is run through the recover guard and the resolver.

const METHOD = 'eth_signTypedData_v4'
const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
// Registry entries for per-collection proxies carry no address; the auth site clones them with the
// target collection, so this does the same.
const COLLECTION_ADDRESS = '0xfef5c99885c3036e591b6e6db52482891834a5f4'
// transfer(address,uint256) with padded arguments.
const CALLDATA = `0xa9059cbb${'00'.repeat(12)}${'ab'.repeat(20)}${'00'.repeat(31)}01`
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
    return [{ name, chainId, calldataField, contract: { ...contract, address: contract.address || COLLECTION_ADDRESS } }]
  })
)

describe('when decentraland-transactions builds a meta-transaction request', () => {
  it('should find both meta-transaction schemas in the contract registry, or these checks prove nothing', () => {
    expect(new Set(META_TRANSACTION_CONTRACTS.map(entry => entry.calldataField))).toEqual(new Set(['functionSignature', 'functionData']))
  })

  describe.each(META_TRANSACTION_CONTRACTS)('for $name on chain $chainId', ({ chainId, calldataField, contract }) => {
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
        await sendMetaTransaction(connectedProvider, networkProvider, CALLDATA, contract, { serverURL: 'http://relayer.example' })
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
        calldata: CALLDATA,
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
        data: `${CALLDATA}${USER.slice(2)}`,
        value: '0'
      })
    })
  })
})
