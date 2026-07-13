import { BrowserRouter } from 'react-router-dom'
import { renderHook, waitFor } from '@testing-library/react'
import { ConnectionOptionType } from '../components/Connection'
import { useAutoLogin } from './useAutoLogin'

// Mock window.location
const mockSearchParams = (params: string) => {
  Object.defineProperty(window, 'location', {
    value: {
      search: params,
      pathname: '/login'
    },
    writable: true
  })
}

const wrapper = ({ children }: { children: React.ReactNode }) => <BrowserRouter>{children}</BrowserRouter>

describe('useAutoLogin', () => {
  let mockOnConnect: jest.Mock

  beforeEach(() => {
    mockOnConnect = jest.fn()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('when no loginMethod is provided', () => {
    beforeEach(() => {
      mockSearchParams('')
    })

    it('should not trigger auto-login', () => {
      const { result } = renderHook(
        () =>
          useAutoLogin({
            isReady: true,
            onConnect: mockOnConnect
          }),
        { wrapper }
      )

      jest.advanceTimersByTime(200)

      expect(result.current.loginMethod).toBeNull()
      expect(result.current.resolvedConnectionOption).toBeNull()
      expect(mockOnConnect).not.toHaveBeenCalled()
    })
  })

  describe('when loginMethod=email is provided', () => {
    beforeEach(() => {
      mockSearchParams('?loginMethod=email')
    })

    it('should resolve to EMAIL', () => {
      const { result } = renderHook(
        () =>
          useAutoLogin({
            isReady: true,
            onConnect: mockOnConnect
          }),
        { wrapper }
      )

      expect(result.current.loginMethod).toBe('email')
      expect(result.current.resolvedConnectionOption).toBe(ConnectionOptionType.EMAIL)
    })

    it('should trigger auto-login when ready', async () => {
      renderHook(
        () =>
          useAutoLogin({
            isReady: true,
            onConnect: mockOnConnect
          }),
        { wrapper }
      )

      jest.advanceTimersByTime(200)

      await waitFor(() => {
        expect(mockOnConnect).toHaveBeenCalledWith(ConnectionOptionType.EMAIL)
      })
    })

    it('should not trigger auto-login when not ready', () => {
      renderHook(
        () =>
          useAutoLogin({
            isReady: false,
            onConnect: mockOnConnect
          }),
        { wrapper }
      )

      jest.advanceTimersByTime(200)

      expect(mockOnConnect).not.toHaveBeenCalled()
    })
  })

  describe('when an invalid loginMethod is provided', () => {
    beforeEach(() => {
      mockSearchParams('?loginMethod=invalid')
    })

    it('should not trigger auto-login', () => {
      const { result } = renderHook(
        () =>
          useAutoLogin({
            isReady: true,
            onConnect: mockOnConnect
          }),
        { wrapper }
      )

      jest.advanceTimersByTime(200)

      expect(result.current.loginMethod).toBeNull()
      expect(result.current.resolvedConnectionOption).toBeNull()
      expect(mockOnConnect).not.toHaveBeenCalled()
    })
  })

  describe('when loginMethod=metamask is provided', () => {
    beforeEach(() => {
      mockSearchParams('?loginMethod=metamask')
    })

    it('should resolve to METAMASK', () => {
      const { result } = renderHook(
        () =>
          useAutoLogin({
            isReady: true,
            onConnect: mockOnConnect
          }),
        { wrapper }
      )

      expect(result.current.loginMethod).toBe('metamask')
      expect(result.current.resolvedConnectionOption).toBe(ConnectionOptionType.METAMASK)
    })
  })

  describe('when loginMethod=google is provided', () => {
    beforeEach(() => {
      mockSearchParams('?loginMethod=google')
    })

    it('should resolve to GOOGLE', () => {
      const { result } = renderHook(
        () =>
          useAutoLogin({
            isReady: true,
            onConnect: mockOnConnect
          }),
        { wrapper }
      )

      expect(result.current.loginMethod).toBe('google')
      expect(result.current.resolvedConnectionOption).toBe(ConnectionOptionType.GOOGLE)
    })
  })

  describe('when loginMethod=discord is provided', () => {
    beforeEach(() => {
      mockSearchParams('?loginMethod=discord')
    })

    it('should resolve to DISCORD', () => {
      const { result } = renderHook(
        () =>
          useAutoLogin({
            isReady: true,
            onConnect: mockOnConnect
          }),
        { wrapper }
      )

      expect(result.current.loginMethod).toBe('discord')
      expect(result.current.resolvedConnectionOption).toBe(ConnectionOptionType.DISCORD)
    })
  })

  describe('when loginMethod=walletconnect is provided', () => {
    beforeEach(() => {
      mockSearchParams('?loginMethod=walletconnect')
    })

    it('should resolve to WALLET_CONNECT', () => {
      const { result } = renderHook(
        () =>
          useAutoLogin({
            isReady: true,
            onConnect: mockOnConnect
          }),
        { wrapper }
      )

      expect(result.current.loginMethod).toBe('walletconnect')
      expect(result.current.resolvedConnectionOption).toBe(ConnectionOptionType.WALLET_CONNECT)
    })
  })

  describe('when loginMethod is case-insensitive', () => {
    beforeEach(() => {
      mockSearchParams('?loginMethod=MetaMask')
    })

    it('should handle uppercase loginMethod', () => {
      const { result } = renderHook(
        () =>
          useAutoLogin({
            isReady: true,
            onConnect: mockOnConnect
          }),
        { wrapper }
      )

      expect(result.current.loginMethod).toBe('metamask')
      expect(result.current.resolvedConnectionOption).toBe(ConnectionOptionType.METAMASK)
    })
  })

  describe('when the effect re-runs after cleanup but before the scheduled timer fires', () => {
    let firstOnConnect: jest.Mock
    let secondOnConnect: jest.Mock

    beforeEach(() => {
      mockSearchParams('?loginMethod=email')
      firstOnConnect = jest.fn()
      secondOnConnect = jest.fn()
    })

    it('should still trigger auto-login exactly once with the latest onConnect', async () => {
      const { rerender } = renderHook(
        ({ onConnect }: { onConnect: jest.Mock }) =>
          useAutoLogin({
            isReady: true,
            onConnect
          }),
        { wrapper, initialProps: { onConnect: firstOnConnect } }
      )

      // Advance less than the 100ms delay so the scheduled timer has not fired yet
      jest.advanceTimersByTime(50)

      // Re-run the effect with a new onConnect reference (simulates onConnect being
      // recreated when the connection provider resolves identity). The cleanup cancels
      // the pending timer before it fires.
      rerender({ onConnect: secondOnConnect })

      jest.advanceTimersByTime(200)

      await waitFor(() => {
        expect(secondOnConnect).toHaveBeenCalledWith(ConnectionOptionType.EMAIL)
      })
      expect(secondOnConnect).toHaveBeenCalledTimes(1)
      expect(firstOnConnect).not.toHaveBeenCalled()
    })
  })
})
