import { PropsWithChildren } from 'react'
import { EventEmitter } from 'events'
import { act, renderHook, waitFor } from '@testing-library/react'
import { AuthIdentity } from '@dcl/crypto'
import { ProviderType } from '@dcl/schemas'
import { ConnectionData, getCurrentConnectionData } from './connection'
import { ConnectionProvider, useCurrentConnectionData } from './ConnectionProvider'
import { getIdentitySignature } from './identity'

jest.mock('./connection')
jest.mock('./identity')
jest.mock('decentraland-connect', () => ({ connection: { tryPreviousConnection: jest.fn() } }))

const wrapper = ({ children }: PropsWithChildren) => <ConnectionProvider>{children}</ConnectionProvider>

type ConnectionHook = ReturnType<typeof renderHook<ReturnType<typeof useCurrentConnectionData>, unknown>>

describe('when connection work overlaps a newer session', () => {
  let provider: EventEmitter
  let connectionData: ConnectionData
  let identity: AuthIdentity
  let resolveIdentity: (identity: AuthIdentity) => void
  let hook: ConnectionHook
  let pending: Promise<AuthIdentity>

  beforeEach(() => {
    provider = new EventEmitter()
    identity = { ephemeralIdentity: {}, expiration: new Date(), authChain: [] } as unknown as AuthIdentity
    connectionData = {
      account: '0x1111111111111111111111111111111111111111',
      identity,
      provider: provider as unknown as ConnectionData['provider'],
      providerType: ProviderType.INJECTED,
      chainId: 1
    }
    jest.mocked(getIdentitySignature).mockReturnValueOnce(
      new Promise(resolve => {
        resolveIdentity = resolve
      })
    )
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the current wallet has a pending identity signature', () => {
    beforeEach(async () => {
      jest.mocked(getCurrentConnectionData).mockResolvedValueOnce(connectionData)
      hook = renderHook(() => useCurrentConnectionData(), { wrapper })
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
      act(() => {
        pending = hook.result.current.getIdentitySignature(connectionData)
      })
    })

    describe.each([
      ['accountsChanged', ['0x2222222222222222222222222222222222222222']],
      ['accountsChanged', []],
      ['disconnect', []]
    ])('and the provider emits %s with %j', (event, accounts) => {
      beforeEach(() => {
        act(() => {
          provider.emit(event, accounts)
        })
      })

      it('should reject the stale identity and preserve the latest connection', async () => {
        await act(async () => {
          resolveIdentity(identity)
          await expect(pending).rejects.toThrow('Connection changed while creating identity')
        })
        expect(hook.result.current.account).toBe(accounts[0])
      })
    })

    describe('and a newer login completes first', () => {
      let newerConnection: ConnectionData
      let newerIdentity: AuthIdentity

      beforeEach(async () => {
        newerIdentity = { ...identity, authChain: [] }
        newerConnection = { ...connectionData, account: '0x2222222222222222222222222222222222222222' }
        jest.mocked(getIdentitySignature).mockResolvedValueOnce(newerIdentity)
        await act(async () => {
          await hook.result.current.getIdentitySignature(newerConnection)
        })
      })

      it('should retain the newer login and reject the older identity', async () => {
        await act(async () => {
          resolveIdentity(identity)
          await expect(pending).rejects.toThrow('Connection changed while creating identity')
        })
        expect(hook.result.current.account).toBe(newerConnection.account)
        expect(hook.result.current.identity).toBe(newerIdentity)
      })
    })

    describe('and the same account connects through a replacement provider', () => {
      let replacement: ConnectionData

      beforeEach(async () => {
        replacement = { ...connectionData, provider: new EventEmitter() as unknown as ConnectionData['provider'] }
        jest.mocked(getIdentitySignature).mockResolvedValueOnce(identity)
        await act(async () => {
          await hook.result.current.getIdentitySignature(replacement)
        })
      })

      it('should keep the replacement provider and reject the obsolete operation', async () => {
        await act(async () => {
          resolveIdentity(identity)
          await expect(pending).rejects.toThrow('Connection changed while creating identity')
        })
        expect(hook.result.current.provider).toBe(replacement.provider)
      })
    })

    describe('and a second caller requests the same account and provider', () => {
      let second: Promise<AuthIdentity>

      beforeEach(() => {
        act(() => {
          second = hook.result.current.getIdentitySignature(connectionData)
        })
      })

      it('should share one signature and return the identity to both callers', async () => {
        await act(async () => {
          resolveIdentity(identity)
          await expect(Promise.all([pending, second])).resolves.toEqual([identity, identity])
        })
        expect(getIdentitySignature).toHaveBeenCalledTimes(1)
      })
    })

    describe('and the old provider disconnects during a replacement login', () => {
      let replacement: ConnectionData
      let resolveReplacement: (identity: AuthIdentity) => void
      let rejectReplacement: (error: Error) => void
      let replacementPending: Promise<AuthIdentity>

      beforeEach(() => {
        replacement = { ...connectionData, provider: new EventEmitter() as unknown as ConnectionData['provider'] }
        jest.mocked(getIdentitySignature).mockReturnValueOnce(
          new Promise((resolve, reject) => {
            resolveReplacement = resolve
            rejectReplacement = reject
          })
        )
        act(() => {
          replacementPending = hook.result.current.getIdentitySignature(replacement)
        })
        act(() => {
          provider.emit('disconnect')
        })
      })

      describe('and the replacement signature fails', () => {
        let failure: Error

        beforeEach(() => {
          failure = new Error('User rejected signature')
        })

        it('should leave the connection disconnected', async () => {
          await act(async () => {
            rejectReplacement(failure)
            await expect(replacementPending).rejects.toBe(failure)
            resolveIdentity(identity)
            await expect(pending).rejects.toThrow('Connection changed while creating identity')
          })
          expect(hook.result.current.account).toBeUndefined()
          expect(hook.result.current.provider).toBeUndefined()
          expect(hook.result.current.identity).toBeUndefined()
        })
      })

      it('should complete the new login and reject only the old operation', async () => {
        await act(async () => {
          resolveReplacement(identity)
          await expect(replacementPending).resolves.toBe(identity)
          resolveIdentity(identity)
          await expect(pending).rejects.toThrow('Connection changed while creating identity')
        })
        expect(hook.result.current.provider).toBe(replacement.provider)
      })
    })

    describe('and an old provider callback runs after the replacement commits', () => {
      let replacement: ConnectionData
      let oldDisconnect: (...args: unknown[]) => void

      beforeEach(async () => {
        oldDisconnect = provider.listeners('disconnect')[0] as (...args: unknown[]) => void
        replacement = { ...connectionData, provider: new EventEmitter() as unknown as ConnectionData['provider'] }
        jest.mocked(getIdentitySignature).mockResolvedValueOnce(identity)
        await act(async () => {
          await hook.result.current.getIdentitySignature(replacement)
        })
      })

      it('should leave the new login valid after the obsolete callback', async () => {
        act(() => {
          oldDisconnect()
        })
        expect(jest.mocked(getIdentitySignature).mock.calls[1][3]).not.toThrow()
        expect(hook.result.current.provider).toBe(replacement.provider)
        await act(async () => {
          resolveIdentity(identity)
          await expect(pending).rejects.toThrow('Connection changed while creating identity')
        })
      })
    })

    describe('and the wallet repeats the current account', () => {
      beforeEach(() => {
        act(() => {
          provider.emit('accountsChanged', [connectionData.account.toUpperCase()])
        })
      })

      it('should complete the identity operation normally', async () => {
        await act(async () => {
          resolveIdentity(identity)
          await expect(pending).resolves.toBe(identity)
        })
        expect(hook.result.current.identity).toBe(identity)
      })
    })

    describe('and the wallet changes chain during the signature', () => {
      beforeEach(() => {
        act(() => {
          provider.emit('chainChanged', '0x89')
        })
      })

      it('should retain the new chain after completing the identity', async () => {
        await act(async () => {
          resolveIdentity(identity)
          await pending
        })
        expect(hook.result.current.chainId).toBe(137)
      })
    })

    describe('and the provider unmounts', () => {
      beforeEach(() => {
        hook.unmount()
      })

      it('should reject the obsolete result and release its listeners', async () => {
        resolveIdentity(identity)
        await expect(pending).rejects.toThrow('Connection changed while creating identity')
        expect(provider.listenerCount('accountsChanged')).toBe(0)
        expect(provider.listenerCount('disconnect')).toBe(0)
      })
    })
  })

  describe('and startup restoration is still pending', () => {
    let resolveRestore: (data: ConnectionData | null) => void

    beforeEach(() => {
      jest.mocked(getCurrentConnectionData).mockReturnValueOnce(
        new Promise(resolve => {
          resolveRestore = resolve
        })
      )
      hook = renderHook(() => useCurrentConnectionData(), { wrapper })
      act(() => {
        pending = hook.result.current.getIdentitySignature(connectionData)
      })
    })

    it('should preserve a newly completed login after the older restore finishes', async () => {
      await act(async () => {
        resolveIdentity(identity)
        await pending
      })
      await act(async () => {
        resolveRestore(null)
      })
      expect(hook.result.current.account).toBe(connectionData.account)
    })

    describe('and the new provider changes accounts during its first signature', () => {
      beforeEach(() => {
        act(() => {
          provider.emit('accountsChanged', [])
        })
      })

      it('should reject the identity before installing the new provider', async () => {
        await act(async () => {
          resolveIdentity(identity)
          await expect(pending).rejects.toThrow('Connection changed while creating identity')
          resolveRestore(null)
        })
        expect(hook.result.current.provider).toBeUndefined()
      })
    })
  })
})
