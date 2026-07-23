/* eslint-disable @typescript-eslint/no-explicit-any */
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { Container } from './Container'

const mockNavigate = jest.fn()
jest.mock('../../../../hooks/navigation', () => ({
  useNavigateWithSearchParams: () => mockNavigate
}))

const mockDisconnect = jest.fn().mockResolvedValue(undefined)
jest.mock('decentraland-connect', () => ({
  connection: { disconnect: (...args: unknown[]) => mockDisconnect(...args) }
}))

jest.mock('../../../../hooks/targetConfig', () => ({
  useTargetConfig: () => [{ showWearablePreview: false }, 'default']
}))

jest.mock('../../../../shared/connection', () => ({
  useCurrentConnectionData: () => ({ account: null })
}))

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('decentraland-ui2', () => ({
  useMobileMediaQuery: () => false
}))

// Keep the real location helpers so referrer extraction + URL building are exercised end-to-end.
jest.mock('../../../AnimatedBackground', () => ({ AnimatedBackground: () => <div /> }))
jest.mock('../../../CustomWearablePreview', () => ({ CustomWearablePreview: () => <div /> }))

const REFERRER = '0x24e5f44999c151f08609f8e27b2238c773c4d020'

const renderContainer = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/auth/requests/:requestId"
          element={
            <Container requestId="req-1" canChangeAccount>
              <div>child</div>
            </Container>
          }
        />
      </Routes>
    </MemoryRouter>
  )

describe('Container change-account link', () => {
  afterEach(() => jest.clearAllMocks())

  describe('when the request URL carries a referrer', () => {
    it('should preserve the referrer in the login redirectTo', async () => {
      const { getByText } = renderContainer(`/auth/requests/req-1?targetConfigId=default&referrer=${REFERRER}`)

      fireEvent.click(getByText('request_views.container.return_to_login'))

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(`referrer%3D${REFERRER}`))
      })
    })
  })

  describe('when the request URL has no referrer', () => {
    it('should not add a referrer param to the login redirectTo', async () => {
      const { getByText } = renderContainer('/auth/requests/req-1?targetConfigId=default')

      fireEvent.click(getByText('request_views.container.return_to_login'))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled()
      })
      expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('referrer'))
    })
  })
})
