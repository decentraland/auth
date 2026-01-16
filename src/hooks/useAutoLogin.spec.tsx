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
})
