import { renderHook } from '@testing-library/react'
import { ConnectionOptionType, SignInOptionsMode } from '../components/Connection/Connection.types'
import { useWalletOptions } from './useWalletOptions'

declare global {
  interface Window {
    ethereum?: { isMetaMask?: boolean }
  }
}

describe('when using the useWalletOptions hook', () => {
  let originalEthereum: { isMetaMask?: boolean } | undefined

  beforeEach(() => {
    originalEthereum = window.ethereum
  })

  afterEach(() => {
    window.ethereum = originalEthereum
  })

  describe('when signInOptionsMode is FULL', () => {
    it('should return the secondary option as the first wallet option and the first extra option as the second wallet option', () => {
      const connectionOptions = {
        primary: ConnectionOptionType.EMAIL,
        secondary: ConnectionOptionType.METAMASK,
        extraOptions: [ConnectionOptionType.GOOGLE, ConnectionOptionType.APPLE]
      }

      const { result } = renderHook(() =>
        useWalletOptions({
          connectionOptions,
          signInOptionsMode: SignInOptionsMode.FULL
        })
      )

      expect(result.current.firstWalletOption).toBe(ConnectionOptionType.METAMASK)
      expect(result.current.secondWalletOption).toBe(ConnectionOptionType.GOOGLE)
      expect(result.current.remainingWalletOptions).toEqual([ConnectionOptionType.APPLE])
    })

    it('should return undefined for all wallet options when no connection options are provided', () => {
      const { result } = renderHook(() =>
        useWalletOptions({
          connectionOptions: undefined,
          signInOptionsMode: SignInOptionsMode.FULL
        })
      )

      expect(result.current.firstWalletOption).toBeUndefined()
      expect(result.current.secondWalletOption).toBeUndefined()
      expect(result.current.remainingWalletOptions).toBeUndefined()
    })
  })

  describe('when signInOptionsMode is TWO', () => {
    describe('and the Ethereum provider exists', () => {
      beforeEach(() => {
        window.ethereum = { isMetaMask: true }
      })

      it('should return Google as the first wallet option and MetaMask as the second wallet option', () => {
        const connectionOptions = {
          primary: ConnectionOptionType.EMAIL,
          secondary: ConnectionOptionType.METAMASK,
          extraOptions: [
            ConnectionOptionType.GOOGLE,
            ConnectionOptionType.APPLE,
            ConnectionOptionType.DISCORD,
            ConnectionOptionType.FORTMATIC
          ]
        }

        const { result } = renderHook(() =>
          useWalletOptions({
            connectionOptions,
            signInOptionsMode: SignInOptionsMode.TWO
          })
        )

        expect(result.current.firstWalletOption).toBe(ConnectionOptionType.GOOGLE)
        expect(result.current.secondWalletOption).toBe(ConnectionOptionType.METAMASK)
        expect(result.current.remainingWalletOptions).toEqual([
          ConnectionOptionType.APPLE,
          ConnectionOptionType.DISCORD,
          ConnectionOptionType.FORTMATIC
        ])
      })

      it('should return Google as the first wallet option and undefined as the second when MetaMask is not in the available options', () => {
        const connectionOptions = {
          primary: ConnectionOptionType.EMAIL,
          secondary: ConnectionOptionType.GOOGLE,
          extraOptions: [ConnectionOptionType.APPLE, ConnectionOptionType.DISCORD]
        }

        const { result } = renderHook(() =>
          useWalletOptions({
            connectionOptions,
            signInOptionsMode: SignInOptionsMode.TWO
          })
        )

        expect(result.current.firstWalletOption).toBe(ConnectionOptionType.GOOGLE)
        expect(result.current.secondWalletOption).toBeUndefined()
        expect(result.current.remainingWalletOptions).toEqual([ConnectionOptionType.APPLE, ConnectionOptionType.DISCORD])
      })
    })

    describe('and the Ethereum provider does not exist', () => {
      beforeEach(() => {
        window.ethereum = undefined
      })

      it('should return Google as the first wallet option and move MetaMask to the remaining options', () => {
        const connectionOptions = {
          primary: ConnectionOptionType.EMAIL,
          secondary: ConnectionOptionType.METAMASK,
          extraOptions: [ConnectionOptionType.GOOGLE, ConnectionOptionType.APPLE, ConnectionOptionType.DISCORD]
        }

        const { result } = renderHook(() =>
          useWalletOptions({
            connectionOptions,
            signInOptionsMode: SignInOptionsMode.TWO
          })
        )

        expect(result.current.firstWalletOption).toBe(ConnectionOptionType.GOOGLE)
        expect(result.current.secondWalletOption).toBeUndefined()
        expect(result.current.remainingWalletOptions).toEqual([
          ConnectionOptionType.METAMASK,
          ConnectionOptionType.APPLE,
          ConnectionOptionType.DISCORD
        ])
      })
    })
  })

  describe('when signInOptionsMode is ONE', () => {
    describe('and the Ethereum provider exists', () => {
      beforeEach(() => {
        window.ethereum = { isMetaMask: true }
      })

      it('should return MetaMask as the first wallet option and undefined as the second wallet option', () => {
        const connectionOptions = {
          primary: ConnectionOptionType.EMAIL,
          secondary: ConnectionOptionType.METAMASK,
          extraOptions: [ConnectionOptionType.GOOGLE, ConnectionOptionType.APPLE, ConnectionOptionType.DISCORD]
        }

        const { result } = renderHook(() =>
          useWalletOptions({
            connectionOptions,
            signInOptionsMode: SignInOptionsMode.ONE
          })
        )

        expect(result.current.firstWalletOption).toBe(ConnectionOptionType.METAMASK)
        expect(result.current.secondWalletOption).toBeUndefined()
        expect(result.current.remainingWalletOptions).toEqual([
          ConnectionOptionType.GOOGLE,
          ConnectionOptionType.APPLE,
          ConnectionOptionType.DISCORD
        ])
      })

      it('should return undefined for both wallet options when MetaMask is not in the available options', () => {
        const connectionOptions = {
          primary: ConnectionOptionType.EMAIL,
          secondary: ConnectionOptionType.GOOGLE,
          extraOptions: [ConnectionOptionType.APPLE, ConnectionOptionType.DISCORD]
        }

        const { result } = renderHook(() =>
          useWalletOptions({
            connectionOptions,
            signInOptionsMode: SignInOptionsMode.ONE
          })
        )

        expect(result.current.firstWalletOption).toBeUndefined()
        expect(result.current.secondWalletOption).toBeUndefined()
        expect(result.current.remainingWalletOptions).toEqual([
          ConnectionOptionType.GOOGLE,
          ConnectionOptionType.APPLE,
          ConnectionOptionType.DISCORD
        ])
      })
    })

    describe('and the Ethereum provider does not exist', () => {
      beforeEach(() => {
        window.ethereum = undefined
      })

      it('should return undefined for both wallet options and move all options to remaining with Google first and MetaMask second', () => {
        const connectionOptions = {
          primary: ConnectionOptionType.EMAIL,
          secondary: ConnectionOptionType.METAMASK,
          extraOptions: [
            ConnectionOptionType.GOOGLE,
            ConnectionOptionType.APPLE,
            ConnectionOptionType.DISCORD,
            ConnectionOptionType.FORTMATIC
          ]
        }

        const { result } = renderHook(() =>
          useWalletOptions({
            connectionOptions,
            signInOptionsMode: SignInOptionsMode.ONE
          })
        )

        expect(result.current.firstWalletOption).toBeUndefined()
        expect(result.current.secondWalletOption).toBeUndefined()
        expect(result.current.remainingWalletOptions).toEqual([
          ConnectionOptionType.GOOGLE,
          ConnectionOptionType.METAMASK,
          ConnectionOptionType.APPLE,
          ConnectionOptionType.DISCORD,
          ConnectionOptionType.FORTMATIC
        ])
      })

      it('should return undefined for both wallet options and move all options to remaining with MetaMask first when Google is not available', () => {
        const connectionOptions = {
          primary: ConnectionOptionType.EMAIL,
          secondary: ConnectionOptionType.METAMASK,
          extraOptions: [ConnectionOptionType.APPLE, ConnectionOptionType.DISCORD]
        }

        const { result } = renderHook(() =>
          useWalletOptions({
            connectionOptions,
            signInOptionsMode: SignInOptionsMode.ONE
          })
        )

        expect(result.current.firstWalletOption).toBeUndefined()
        expect(result.current.secondWalletOption).toBeUndefined()
        expect(result.current.remainingWalletOptions).toEqual([
          ConnectionOptionType.METAMASK,
          ConnectionOptionType.APPLE,
          ConnectionOptionType.DISCORD
        ])
      })

      it('should return undefined for both wallet options and move all options to remaining with Google first when MetaMask is not available', () => {
        const connectionOptions = {
          primary: ConnectionOptionType.EMAIL,
          secondary: ConnectionOptionType.GOOGLE,
          extraOptions: [ConnectionOptionType.APPLE, ConnectionOptionType.DISCORD]
        }

        const { result } = renderHook(() =>
          useWalletOptions({
            connectionOptions,
            signInOptionsMode: SignInOptionsMode.ONE
          })
        )

        expect(result.current.firstWalletOption).toBeUndefined()
        expect(result.current.secondWalletOption).toBeUndefined()
        expect(result.current.remainingWalletOptions).toEqual([
          ConnectionOptionType.GOOGLE,
          ConnectionOptionType.APPLE,
          ConnectionOptionType.DISCORD
        ])
      })
    })
  })

  describe('when the connection options change', () => {
    it('should recalculate the wallet options based on the new connection options', () => {
      const initialOptions = {
        primary: ConnectionOptionType.EMAIL,
        secondary: ConnectionOptionType.METAMASK,
        extraOptions: [ConnectionOptionType.GOOGLE]
      }

      const { result, rerender } = renderHook(
        ({ connectionOptions }) =>
          useWalletOptions({
            connectionOptions,
            signInOptionsMode: SignInOptionsMode.FULL
          }),
        { initialProps: { connectionOptions: initialOptions } }
      )

      expect(result.current.firstWalletOption).toBe(ConnectionOptionType.METAMASK)

      const updatedOptions = {
        primary: ConnectionOptionType.EMAIL,
        secondary: ConnectionOptionType.GOOGLE,
        extraOptions: [ConnectionOptionType.METAMASK]
      }

      rerender({ connectionOptions: updatedOptions })

      expect(result.current.firstWalletOption).toBe(ConnectionOptionType.GOOGLE)
    })
  })

  describe('when the signInOptionsMode changes', () => {
    beforeEach(() => {
      window.ethereum = { isMetaMask: true }
    })

    it('should recalculate the wallet options when signInOptionsMode changes from FULL to ONE', () => {
      const connectionOptions = {
        primary: ConnectionOptionType.EMAIL,
        secondary: ConnectionOptionType.METAMASK,
        extraOptions: [ConnectionOptionType.GOOGLE]
      }

      const { result, rerender } = renderHook(
        ({ signInOptionsMode }) =>
          useWalletOptions({
            connectionOptions,
            signInOptionsMode
          }),
        { initialProps: { signInOptionsMode: SignInOptionsMode.FULL } }
      )

      expect(result.current.firstWalletOption).toBe(ConnectionOptionType.METAMASK)
      expect(result.current.secondWalletOption).toBe(ConnectionOptionType.GOOGLE)

      rerender({ signInOptionsMode: SignInOptionsMode.ONE })

      expect(result.current.firstWalletOption).toBe(ConnectionOptionType.METAMASK)
      expect(result.current.secondWalletOption).toBeUndefined()
    })

    it('should recalculate the wallet options when signInOptionsMode changes from ONE to TWO', () => {
      const connectionOptions = {
        primary: ConnectionOptionType.EMAIL,
        secondary: ConnectionOptionType.METAMASK,
        extraOptions: [ConnectionOptionType.GOOGLE, ConnectionOptionType.APPLE]
      }

      const { result, rerender } = renderHook(
        ({ signInOptionsMode }) =>
          useWalletOptions({
            connectionOptions,
            signInOptionsMode
          }),
        { initialProps: { signInOptionsMode: SignInOptionsMode.ONE } }
      )

      expect(result.current.firstWalletOption).toBe(ConnectionOptionType.METAMASK)
      expect(result.current.secondWalletOption).toBeUndefined()

      rerender({ signInOptionsMode: SignInOptionsMode.TWO })

      expect(result.current.firstWalletOption).toBe(ConnectionOptionType.GOOGLE)
      expect(result.current.secondWalletOption).toBe(ConnectionOptionType.METAMASK)
    })
  })
})
