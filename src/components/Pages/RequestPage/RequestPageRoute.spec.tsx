import { useEffect } from 'react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestPageRoute } from './RequestPageRoute'

const mountSpy = jest.fn()

jest.mock('./RequestPage', () => ({
  RequestPage: () => {
    useEffect(() => {
      mountSpy()
    }, [])
    return <div data-testid="request-page" />
  }
}))

const NavigateTo = ({ requestId }: { requestId: string }) => {
  const navigate = useNavigate()
  return (
    <button data-testid="navigate" onClick={() => navigate(`/requests/${requestId}`)}>
      navigate
    </button>
  )
}

describe('when rendering the request route', () => {
  afterEach(() => {
    mountSpy.mockReset()
  })

  describe('and the request id in the route changes', () => {
    beforeEach(() => {
      render(
        <MemoryRouter initialEntries={['/requests/first']}>
          <Routes>
            <Route
              path="/requests/:requestId"
              element={
                <>
                  <RequestPageRoute />
                  <NavigateTo requestId="second" />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      )
    })

    it('should mount a fresh page for the new id instead of re-rendering the previous instance', async () => {
      expect(mountSpy).toHaveBeenCalledTimes(1)
      await userEvent.click(screen.getByTestId('navigate'))
      expect(screen.getByTestId('request-page')).toBeInTheDocument()
      expect(mountSpy).toHaveBeenCalledTimes(2)
    })
  })
})
