import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAcknowledgment } from './useAcknowledgment'

const Probe = ({ statement }: { statement: string }) => {
  const { acknowledged, setAcknowledged } = useAcknowledgment(statement)
  return (
    <label>
      <input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />
      {acknowledged ? 'acknowledged' : 'pending'}
    </label>
  )
}

describe('when using the acknowledgment hook', () => {
  describe('and nothing has been ticked', () => {
    it('should report the statement as not acknowledged', () => {
      render(<Probe statement="request-1|preview-a" />)
      expect(screen.getByRole('checkbox')).not.toBeChecked()
    })
  })

  describe('and the user ticks the statement', () => {
    it('should report it as acknowledged', async () => {
      render(<Probe statement="request-1|preview-a" />)
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByRole('checkbox')).toBeChecked()
    })
  })

  describe('and the user unticks it', () => {
    it('should report it as not acknowledged again', async () => {
      render(<Probe statement="request-1|preview-a" />)
      await userEvent.click(screen.getByRole('checkbox'))
      await userEvent.click(screen.getByRole('checkbox'))
      expect(screen.getByRole('checkbox')).not.toBeChecked()
    })
  })

  describe('and the statement changes after the tick', () => {
    it('should drop the tick in the same render, since it was given to another statement', async () => {
      const { rerender } = render(<Probe statement="request-1|preview-a" />)
      await userEvent.click(screen.getByRole('checkbox'))
      rerender(<Probe statement="request-1|preview-b" />)
      expect(screen.getByRole('checkbox')).not.toBeChecked()
      expect(screen.getByText('pending')).toBeInTheDocument()
    })
  })
})
