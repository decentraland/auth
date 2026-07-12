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
      ok: true,
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

describe('when the initial feature-flags fetch responds with a non-OK status', () => {
  beforeEach(() => {
    // A 5xx that still returns a parseable JSON body must be treated as a failure,
    // not applied as an empty set of flags.
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({ flags: {}, variants: {} }) })
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

describe('when a later poll responds with a non-OK status after a successful initial load', () => {
  beforeEach(() => {
    // Poll fast so the regression is observable within the test.
    ;(config.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'FEATURE_FLAGS_URL') return 'https://feature-flags.test'
      if (key === 'FEATURE_FLAGS_INTERVAL') return '20'
      return ''
    })
    // Initial poll fetches dapps.json + explorer.json successfully with the flag enabled.
    // Every subsequent poll fails with a 5xx that still carries a JSON body.
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ flags: { [FeatureFlagsKeys.ONBOARDING_TO_EXPLORER]: true }, variants: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ flags: {}, variants: {} }) })
      .mockResolvedValue({ ok: false, status: 500, json: async () => ({ flags: {}, variants: {} }) })
  })

  it('should keep the last-known-good flags instead of wiping them to empty', async () => {
    const { getByTestId } = render(
      <FeatureFlagsProvider>
        <FlagsProbe />
      </FeatureFlagsProvider>
    )

    await waitFor(() => {
      expect(getByTestId('flag-onboarding').textContent).toBe('true')
    })

    // Give the polling loop time to run and fail a few times.
    await new Promise(resolve => setTimeout(resolve, 80))

    expect(getByTestId('flag-onboarding').textContent).toBe('true')
  })
})
