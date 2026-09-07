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

  describe.each(['different network', 'missing network', 'unknown address', 'missing address', 'empty address'])(
    'and the target has a %s',
    condition => {
      beforeEach(() => {
        switch (condition) {
          case 'different network':
            chainId = 1
            break
          case 'missing network':
            chainId = undefined
            break
          case 'unknown address':
            address = '0x1234567890abcdef1234567890abcdef12345678'
            break
          case 'missing address':
            address = undefined
            break
          case 'empty address':
            address = ''
            break
        }
      })

      it('should make no claim about Decentraland provenance', () => {
        render(<KnownContractNotice address={address} chainId={chainId} />)
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      })
    }
  )
})
