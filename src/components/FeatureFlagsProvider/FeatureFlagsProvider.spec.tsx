import { useContext } from 'react'
import { render, waitFor } from '@testing-library/react'
import { config } from '../../modules/config'
import { FeatureFlagsProvider } from './FeatureFlagsProvider'
import { FeatureFlagsContext, FeatureFlagsKeys } from './FeatureFlagsProvider.types'

jest.mock('../../modules/config', () => ({
  config: {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'FEATURE_FLAGS_URL') return 'https://feature-flags.test'
      if (key === 'FEATURE_FLAGS_INTERVAL') return '60000'
      return ''
    })
  }
}))

const mockFetch = jest.fn()

beforeAll(() => {
  globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch
})

afterAll(() => {
  // @ts-expect-error reset
  delete globalThis.fetch
})

beforeEach(() => {
  mockFetch.mockReset()
  ;(config.get as jest.Mock).mockClear()
})

const FlagsProbe = () => {
  const ctx = useContext(FeatureFlagsContext)
  return (
    <div>
      <span data-testid="initialized">{String(ctx.initialized)}</span>
      <span data-testid="flag-onboarding">{String(ctx.flags[FeatureFlagsKeys.ONBOARDING_TO_EXPLORER])}</span>
    </div>
  )
}

describe('when the initial feature-flags fetch succeeds', () => {
  beforeEach(() => {
    mockFetch.mockImplementation(async () => ({
      json: async () => ({ flags: { [FeatureFlagsKeys.ONBOARDING_TO_EXPLORER]: true }, variants: {} })
    }))
  })

  it('should expose the flag as enabled in the context', async () => {
    const { getByTestId } = render(
      <FeatureFlagsProvider>
        <FlagsProbe />
      </FeatureFlagsProvider>
    )

    await waitFor(() => {
      expect(getByTestId('initialized').textContent).toBe('true')
    })
    expect(getByTestId('flag-onboarding').textContent).toBe('true')
  })
})

describe('when the initial feature-flags fetch fails', () => {
  beforeEach(() => {
    mockFetch.mockRejectedValue(new Error('network down'))
  })

  it('should mark initialized=true with empty flags so the app doesnt hang', async () => {
    const { getByTestId } = render(
      <FeatureFlagsProvider>
        <FlagsProbe />
      </FeatureFlagsProvider>
    )

    await waitFor(() => {
      expect(getByTestId('initialized').textContent).toBe('true')
    })
    expect(getByTestId('flag-onboarding').textContent).toBe('undefined')
  })
})
