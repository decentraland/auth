import { isIgnorableError, isIgnorableErrorMessage } from './ignorableErrors'

describe('ignorableErrors', () => {
  describe('isIgnorableError', () => {
    describe('user rejection patterns', () => {
      const userRejectionMessages = [
        'user rejected action (action="signMessage")',
        'The user rejected the request.',
        'User denied transaction signature',
        'user cancelled the operation',
        'User cancelled the request',
        'rejected the request by user',
        'ACTION_REJECTED: user rejected',
        'User closed the modal without connecting',
        'modal closed by user',
        // Additional user rejection patterns
        'ErrorUnlockingWallet: User cancelled',
        'user rejected methods in session',
        'ha: the user rejected the action',
        'reject session request'
      ]

      it.each(userRejectionMessages)('should identify "%s" as user_initiated', message => {
        const result = isIgnorableError(new Error(message))
        expect(result.isIgnorable).toBe(true)
        expect(result.category).toBe('user_initiated')
      })
    })

    describe('expected state patterns', () => {
      const expectedStateMessages = [
        'The request 6ba7f38a-8dc6-441f-975e-c60cef722a36 was not found',
        'The request abc123 has expired',
        'Request xyz expired at 2024-01-01',
        'Request expired. Please try again.',
        "Magic: user isn't logged in",
        'Skipped remaining OAuth verification steps. User is already logged in.',
        'Missing required data in browser for OAuth',
        "Missing required params in 'authorizationResponseParams'",
        'State parameter mismatches.',
        'access_denied',
        'OAuth verification failed',
        'Expired signature: signature timestamp: 1769053613072',
        'signature has expired',
        // Additional expected state patterns
        'proposal expired',
        'Request already has a response',
        'contract accounts are not supported',
        'record was recently deleted',
        'the request is not recent enough',
        'the request is too far in the future',
        // Auth chain validation failures
        'The sender is different from the sender in the request',
        'The signature is invalid for authority ECDSA_EIP_1654_EPHEMERAL'
      ]

      it.each(expectedStateMessages)('should identify "%s" as expected_state', message => {
        const result = isIgnorableError(new Error(message))
        expect(result.isIgnorable).toBe(true)
        expect(result.category).toBe('expected_state')
      })
    })

    describe('network transient patterns', () => {
      const networkMessages = [
        'Failed to fetch',
        'Failed to fetch (auth-api.decentraland.org)',
        'Connection timeout',
        'Network error occurred',
        'NetworkError when attempting to fetch resource',
        'Timeout exceeded while waiting for response',
        'Load failed for resource',
        // Additional network patterns
        'connection request reset',
        'request timeout',
        'websocket connection failed',
        'publish interrupted',
        'websocket error',
        'subscribing to topic xyz failed'
      ]

      it.each(networkMessages)('should identify "%s" as network_transient', message => {
        const result = isIgnorableError(new Error(message))
        expect(result.isIgnorable).toBe(true)
        expect(result.category).toBe('network_transient')
      })
    })

    describe('wallet session patterns', () => {
      const walletSessionMessages = [
        "No matching key. session topic doesn't exist: abc123",
        "session topic doesn't exist",
        'Session disconnected',
        'Session expired'
      ]

      it.each(walletSessionMessages)('should identify "%s" as wallet_session', message => {
        const result = isIgnorableError(new Error(message))
        expect(result.isIgnorable).toBe(true)
        expect(result.category).toBe('wallet_session')
      })
    })

    describe('browser environment patterns', () => {
      const browserEnvironmentMessages = [
        "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
        'The node to be removed is not a child of this node',
        "Failed to execute 'writeText' on 'Clipboard': Write permission denied.",
        'Clipboard access denied',
        'The object can not be found here.',
        'MosTriggerCloseWebviewModal is not defined',
        'Current network gas price 2284715824096 exceeds max gas price allowed 800000000000',
        'exceeds max gas allowed',
        "undefined is not an object (evaluating 'this.getProvider(r).setDefaultChain')",
        'AppKit is not initialized',
        // AppKit race condition errors - getProvider returns undefined
        "undefined is not an object (evaluating 'this.getProvider(s).request')",
        "Cannot read properties of undefined (reading 'request')"
      ]

      it.each(browserEnvironmentMessages)('should identify "%s" as browser_environment', message => {
        const result = isIgnorableError(new Error(message))
        expect(result.isIgnorable).toBe(true)
        expect(result.category).toBe('browser_environment')
      })
    })

    describe('noise patterns', () => {
      const noiseMessages = ['<unknown>', 'handleError', 'Pl', 'error: test', 'Error: test']

      it.each(noiseMessages)('should identify "%s" as noise', message => {
        const result = isIgnorableError(new Error(message))
        expect(result.isIgnorable).toBe(true)
        expect(result.category).toBe('noise')
      })
    })

    describe('when validating Category 1 errors from Sentry export', () => {
      const sentryCategory1Errors = [
        'The request UUID was not found',
        "Magic: user isn't logged in",
        'user rejected action',
        "No matching key. session topic doesn't exist",
        'User closed the modal without connecting',
        'Skipped remaining OAuth verification steps'
      ]

      it.each(sentryCategory1Errors)('should filter Sentry error: "%s"', message => {
        const result = isIgnorableError({ message })
        expect(result.isIgnorable).toBe(true)
      })
    })

    describe('when error message is similar but NOT ignorable', () => {
      const falsePositiveCandidates = [
        'Request failed: user data corrupted', // contains "request" but isn't expired
        'Network configuration invalid', // contains "network" but isn't transient
        'User authentication failed', // contains "user" but isn't a rejection
        'Session data corrupted', // contains "session" but isn't expected state
        'GraphQL node user not found', // contains "node" but isn't DOM error
        'setDefaultChain requires valid chainId' // contains "setDefaultChain" but isn't Safari evaluation error
      ]

      it.each(falsePositiveCandidates)('should NOT filter "%s"', message => {
        const result = isIgnorableError(new Error(message))
        expect(result.isIgnorable).toBe(false)
      })
    })

    describe('non-ignorable errors', () => {
      const realErrors = [
        'Error invoking post: Method not found',
        'Internal server error',
        'Unexpected token in JSON',
        'Maximum call stack size exceeded',
        'TypeError: Cannot read properties of null'
      ]

      it.each(realErrors)('should NOT identify "%s" as ignorable', message => {
        const result = isIgnorableError(new Error(message))
        expect(result.isIgnorable).toBe(false)
        expect(result.category).toBeUndefined()
      })
    })

    describe('error input types', () => {
      it('should handle Error objects', () => {
        const result = isIgnorableError(new Error('user rejected'))
        expect(result.isIgnorable).toBe(true)
      })

      it('should handle string errors', () => {
        const result = isIgnorableError('user rejected')
        expect(result.isIgnorable).toBe(true)
      })

      it('should handle objects with message property', () => {
        const result = isIgnorableError({ message: 'user rejected' })
        expect(result.isIgnorable).toBe(true)
      })

      it('should return false for null', () => {
        const result = isIgnorableError(null)
        expect(result.isIgnorable).toBe(false)
      })

      it('should return false for undefined', () => {
        const result = isIgnorableError(undefined)
        expect(result.isIgnorable).toBe(false)
      })

      it('should return false for objects without message', () => {
        const result = isIgnorableError({ code: 123 })
        expect(result.isIgnorable).toBe(false)
      })
    })
  })

  describe('isIgnorableErrorMessage', () => {
    it('should return true for ignorable messages', () => {
      expect(isIgnorableErrorMessage('user rejected the request')).toBe(true)
    })

    it('should return false for non-ignorable messages', () => {
      expect(isIgnorableErrorMessage('Internal server error')).toBe(false)
    })
  })
})
