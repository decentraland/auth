import { render, screen } from '@testing-library/react'
import { ContractName, getContract } from 'decentraland-transactions'
import { KnownContractNotice } from './KnownContractNotice'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string, options: { network: string }) => `${key} ${options.network}` })
}))

describe('when identifying a transaction target', () => {
  let address: string | undefined
  let chainId: number | undefined

  beforeEach(() => {
    address = getContract(ContractName.MANAToken, 137).address
    chainId = 137
  })

  it('should identify a published Decentraland deployment on its execution network', () => {
    render(<KnownContractNotice address={address} chainId={chainId} />)
    expect(screen.getByRole('alert')).toHaveTextContent('request.transaction_dialog.known_contract Polygon')
  })

  const unmatched: { condition: string; override: { address?: string; chainId?: number } }[] = [
    { condition: 'different network', override: { chainId: 1 } },
    { condition: 'missing network', override: { chainId: undefined } },
    { condition: 'unknown address', override: { address: '0x1234567890abcdef1234567890abcdef12345678' } },
    { condition: 'missing address', override: { address: undefined } },
    { condition: 'empty address', override: { address: '' } }
  ]

  describe.each(unmatched)('and the target has a $condition', ({ override }) => {
    it('should make no claim about Decentraland provenance', () => {
      render(<KnownContractNotice address={address} chainId={chainId} {...override} />)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
