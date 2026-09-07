import { render, screen } from '@testing-library/react'
import { TypedDataReviewNode, resolveTypedDataReview } from '../../../../../shared/auth/typedDataReview'
import { TypedDataTree } from './TypedDataTree'

describe('when displaying schema-bound typed data', () => {
  let fields: TypedDataReviewNode[]

  beforeEach(() => {
    fields = resolveTypedDataReview(
      {
        primaryType: 'Order',
        domain: {},
        types: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          Order: [
            { name: 'amounts', type: 'uint256[][]' },
            { name: 'recipients', type: 'address[]' }
          ]
        },
        message: { amounts: [['0x10'], ['20']], recipients: [] }
      },
      'eth_signTypedData_v4'
    ).fields
    render(<TypedDataTree fields={fields} />)
  })

  it('should display the declared field type', () => {
    expect(screen.getByText('amounts (uint256[][]):')).toBeInTheDocument()
  })

  it('should display nested array indices and types', () => {
    expect(screen.getByText('[1] (uint256[]):')).toBeInTheDocument()
  })

  it('should display integers in decimal without losing precision', () => {
    expect(screen.getByText('16')).toBeInTheDocument()
  })

  it('should explicitly display empty arrays', () => {
    expect(screen.getByText('[]')).toBeInTheDocument()
  })
})

describe('when a signed field has a long identifier', () => {
  let longName: string

  beforeEach(() => {
    longName = 'field'.padEnd(300, 'x')
    const { fields } = resolveTypedDataReview(
      {
        primaryType: 'Order',
        domain: {},
        // eslint-disable-next-line @typescript-eslint/naming-convention
        types: { Order: [{ name: longName, type: 'uint8' }] },
        message: { [longName]: 1 }
      },
      'eth_signTypedData_v4'
    )
    render(<TypedDataTree fields={fields} />)
  })

  it('should wrap the key instead of letting it overflow the review', () => {
    expect(screen.getByText(`${longName} (uint8):`)).toHaveStyle({ overflowWrap: 'anywhere', minWidth: 0 })
  })
})
