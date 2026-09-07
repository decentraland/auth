import { Hex, isAddress, verifyTypedData } from 'viem'
import { Configuration, ContractData, EIPProvider, Provider, sendMetaTransaction } from 'decentraland-transactions'
import { DifferentSenderError } from './errors'

/**
 * Bind the relay library's account discovery and signing to the account that reviewed the call.
 * The library discovers the account again internally, so a check before calling it is insufficient.
 * A private provider facade keeps every account lookup pinned and validates the returned signature
 * before it can reach the relay. It does not mutate the shared wallet provider.
 */
export async function sendMetaTransactionWithSigner(
  expectedSigner: string,
  provider: EIPProvider,
  networkProvider: Provider,
  data: string,
  contract: ContractData,
  configuration: Partial<Configuration>
): Promise<string> {
  if (!isAddress(expectedSigner)) throw new Error('Invalid reviewed signer')
  let signerError: DifferentSenderError | undefined

  const assertExpectedSigner = (address: unknown): void => {
    if (typeof address !== 'string' || address.toLowerCase() !== expectedSigner.toLowerCase()) {
      signerError = new DifferentSenderError(typeof address === 'string' ? address : '', expectedSigner)
      throw signerError
    }
  }

  const assertActiveSigner = async (): Promise<void> => {
    // Latch mismatches: the library retries failed eth_requestAccounts with eth_accounts.
    if (signerError) throw signerError
    const accounts: unknown = await provider.request({ method: 'eth_accounts', params: [] })
    assertExpectedSigner(Array.isArray(accounts) ? accounts[0] : undefined)
  }

  const boundProvider: EIPProvider = {
    request: async args => {
      if (signerError) throw signerError
      if (args.method === 'eth_accounts' || args.method === 'eth_requestAccounts') {
        await assertActiveSigner()
        return [expectedSigner]
      }
      if (args.method === 'eth_signTypedData_v4') {
        assertExpectedSigner(args.params?.[0])
        if (typeof args.params?.[1] !== 'string') throw new Error('Invalid meta-transaction signing payload')
        const typedData = JSON.parse(args.params[1]) as Omit<Parameters<typeof verifyTypedData>[0], 'address' | 'signature'>
        assertExpectedSigner((typedData.message as { from?: unknown })?.from)
        await assertActiveSigner()
        const signature: unknown = await provider.request(args)
        // A provider may switch accounts while its signing prompt is open, or ignore the explicit
        // signer parameter. Verify cryptographic ownership rather than trusting that parameter.
        if (
          typeof signature !== 'string' ||
          !(await verifyTypedData({ ...typedData, address: expectedSigner, signature: signature as Hex }).catch(() => false))
        ) {
          signerError = new DifferentSenderError('unverified signature', expectedSigner)
          throw signerError
        }
        await assertActiveSigner()
        return signature
      }
      return provider.request(args)
    }
  }

  try {
    return await sendMetaTransaction(boundProvider, networkProvider, data, contract, configuration)
  } catch (error) {
    // The library wraps provider errors. Preserve the mismatch so Auth can restart account review
    // without reporting a user rejection or consuming the request.
    throw signerError ?? error
  }
}
