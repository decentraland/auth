import { PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts'
import { ContractData, ContractName, EIPProvider, getContract } from 'decentraland-transactions'
import { DifferentSenderError } from './errors'
import { sendMetaTransactionWithSigner } from './sendMetaTransactionWithSigner'

describe('when submitting a meta-transaction from a reviewed signer', () => {
  let account: PrivateKeyAccount
  let otherAccount: PrivateKeyAccount
  let signingAccount: PrivateKeyAccount
  let expectedSigner: string
  let activeAccounts: string[]
  let provider: EIPProvider
  let networkProvider: EIPProvider
  let walletRequest: jest.Mock
  let networkRequest: jest.Mock
  let relayFetch: jest.SpyInstance
  let contract: ContractData
  let data: string
  let submit: () => Promise<string>

  beforeEach(() => {
    account = privateKeyToAccount('0x0000000000000000000000000000000000000000000000000000000000000001')
    otherAccount = privateKeyToAccount('0x0000000000000000000000000000000000000000000000000000000000000002')
    signingAccount = account
    expectedSigner = account.address
    activeAccounts = [account.address]
    walletRequest = jest.fn().mockImplementation(async ({ method, params }) => {
      if (method === 'eth_accounts') return activeAccounts
      if (method === 'eth_getCode') return '0x'
      if (method === 'eth_signTypedData_v4') return signingAccount.signTypedData(JSON.parse(params[1]))
      throw new Error('Unexpected wallet method')
    })
    networkRequest = jest.fn().mockResolvedValue('0x0')
    provider = { request: walletRequest }
    networkProvider = { request: networkRequest }
    contract = getContract(ContractName.MANAToken, 137)
    data = '0x12345678'
    relayFetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true, txHash: '0xtesthash' }) } as Response)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    submit = () =>
      sendMetaTransactionWithSigner(expectedSigner, provider, networkProvider, data, contract, { serverURL: 'https://relay.invalid' })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should relay a signature from the reviewed account', async () => {
    await expect(submit()).resolves.toBe('0xtesthash')
    expect(relayFetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(relayFetch.mock.calls[0][1].body).transactionData.from).toBe(account.address)
  })

  it('should pass the reviewed signer explicitly to the wallet', async () => {
    await submit()
    expect(walletRequest).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      id: expect.any(Number),
      method: 'eth_signTypedData_v4',
      params: [account.address, expect.any(String)]
    })
  })

  describe('and the account uses a different address casing', () => {
    beforeEach(() => {
      activeAccounts = [account.address.toLowerCase()]
    })

    it('should accept the same signer', async () => {
      await expect(submit()).resolves.toBe('0xtesthash')
    })
  })

  describe('and the active account changed before library account discovery', () => {
    beforeEach(() => {
      activeAccounts = [otherAccount.address]
    })

    it('should reject without signing or relaying', async () => {
      await expect(submit()).rejects.toBeInstanceOf(DifferentSenderError)
      expect(walletRequest).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'eth_signTypedData_v4' }))
      expect(relayFetch).not.toHaveBeenCalled()
    })

    it('should not let the library account-lookup fallback bypass a detected mismatch', async () => {
      await expect(submit()).rejects.toBeInstanceOf(DifferentSenderError)
      expect(walletRequest).toHaveBeenCalledTimes(1)
    })
  })

  describe('and the wallet disconnects', () => {
    beforeEach(() => {
      activeAccounts = []
    })

    it('should reject without relaying', async () => {
      await expect(submit()).rejects.toBeInstanceOf(DifferentSenderError)
      expect(relayFetch).not.toHaveBeenCalled()
    })
  })

  describe('and the active account changes while reading the nonce', () => {
    beforeEach(() => {
      networkRequest.mockImplementationOnce(async () => {
        activeAccounts = [otherAccount.address]
        return '0x0'
      })
    })

    it('should reject before asking for a signature', async () => {
      await expect(submit()).rejects.toBeInstanceOf(DifferentSenderError)
      expect(walletRequest).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'eth_signTypedData_v4' }))
      expect(relayFetch).not.toHaveBeenCalled()
    })
  })

  describe('and the wallet signs with a different key despite reporting the reviewed account', () => {
    beforeEach(() => {
      signingAccount = otherAccount
    })

    it('should reject the signature before it reaches the relay', async () => {
      await expect(submit()).rejects.toBeInstanceOf(DifferentSenderError)
      expect(relayFetch).not.toHaveBeenCalled()
    })
  })

  describe('and the account changes while the signature prompt is open', () => {
    beforeEach(() => {
      walletRequest.mockImplementation(async ({ method, params }) => {
        if (method === 'eth_accounts') return activeAccounts
        if (method === 'eth_getCode') return '0x'
        if (method === 'eth_signTypedData_v4') {
          activeAccounts = [otherAccount.address]
          return account.signTypedData(JSON.parse(params[1]))
        }
        throw new Error('Unexpected wallet method')
      })
    })

    it('should not relay even a valid signature after an account switch', async () => {
      await expect(submit()).rejects.toBeInstanceOf(DifferentSenderError)
      expect(relayFetch).not.toHaveBeenCalled()
    })
  })
})
