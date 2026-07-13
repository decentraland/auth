import { act, renderHook, waitFor } from '@testing-library/react'
import { useEmailOtp } from './useEmailOtp'

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('../../shared/utils/analytics', () => ({
  trackEvent: jest.fn()
}))

jest.mock('../../shared/utils/errorHandler', () => ({
  handleError: jest.fn((e: unknown) => (e instanceof Error ? e.message : String(e)))
}))

const pasteEvent = (value: string) =>
  ({
    preventDefault: jest.fn(),
    clipboardData: { getData: () => value }
  }) as unknown as React.ClipboardEvent<HTMLInputElement>

describe('useEmailOtp', () => {
  let verify: jest.Mock
  let resend: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    verify = jest.fn()
    resend = jest.fn().mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('when a complete code is pasted', () => {
    it('should verify with the pasted code', async () => {
      verify.mockResolvedValue({ email: 'user@example.com', address: '0xabc' })
      const { result } = renderHook(() => useEmailOtp({ open: true, email: 'user@example.com', verify, resend, onSuccess: jest.fn() }))

      await act(async () => {
        result.current.handleOtpPaste(pasteEvent('123456'))
      })

      await waitFor(() => expect(verify).toHaveBeenCalledWith('user@example.com', '123456'))
    })

    describe('and the component re-rendered with a new onSuccess after mount', () => {
      it('should call the latest onSuccess, not the one captured at mount (no stale closure)', async () => {
        verify.mockResolvedValue({ email: 'user@example.com', address: '0xabc' })
        const onSuccessAtMount = jest.fn()
        const onSuccessLatest = jest.fn()

        const { result, rerender } = renderHook(
          ({ onSuccess }) => useEmailOtp({ open: true, email: 'user@example.com', verify, resend, onSuccess }),
          {
            initialProps: { onSuccess: onSuccessAtMount }
          }
        )

        rerender({ onSuccess: onSuccessLatest })

        await act(async () => {
          result.current.handleOtpPaste(pasteEvent('123456'))
        })

        await waitFor(() => expect(onSuccessLatest).toHaveBeenCalledWith({ email: 'user@example.com', address: '0xabc' }))
        expect(onSuccessAtMount).not.toHaveBeenCalled()
      })
    })
  })

  describe('when an incomplete code is pasted', () => {
    it('should not attempt verification', async () => {
      const { result } = renderHook(() => useEmailOtp({ open: true, email: 'user@example.com', verify, resend, onSuccess: jest.fn() }))

      await act(async () => {
        result.current.handleOtpPaste(pasteEvent('123'))
      })

      expect(verify).not.toHaveBeenCalled()
    })
  })

  describe('when verification fails', () => {
    it('should surface the translated error in the returned error state', async () => {
      verify.mockRejectedValue(new Error('failed to verify'))
      const { result } = renderHook(() => useEmailOtp({ open: true, email: 'user@example.com', verify, resend, onSuccess: jest.fn() }))

      await act(async () => {
        result.current.handleOtpPaste(pasteEvent('123456'))
      })

      await waitFor(() => expect(result.current.error).toBe('email_login_modal.failed_verify'))
      expect(result.current.hasError).toBe(true)
    })
  })
})
