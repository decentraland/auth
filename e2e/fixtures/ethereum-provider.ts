/**
 * Mock Ethereum provider injected into the browser context.
 * Based on camera-bot-service's implementation, simplified for auth e2e tests.
 *
 * This script is stringified and injected via `context.addInitScript()`.
 * The `WALLET_ADDRESS` placeholder is replaced at injection time.
 */
export function createMockProviderScript(walletAddress: string): string {
  return `
    (function() {
      const WALLET_ADDRESS = '${walletAddress}';
      const CHAIN_ID = '0x1';

      class MockEthereumProvider {
        constructor() {
          this.isMetaMask = true;
          this.isConnected = () => true;
          this.selectedAddress = WALLET_ADDRESS;
          this.chainId = CHAIN_ID;
          this.networkVersion = '1';
          this._events = {};
          this._metamask = { isUnlocked: () => Promise.resolve(true) };
        }

        on(event, handler) {
          if (!this._events[event]) this._events[event] = [];
          this._events[event].push(handler);
          return this;
        }

        removeListener(event, handler) {
          if (this._events[event]) {
            this._events[event] = this._events[event].filter(h => h !== handler);
          }
          return this;
        }

        removeAllListeners(event) {
          if (event) {
            delete this._events[event];
          } else {
            this._events = {};
          }
          return this;
        }

        addListener(event, handler) { return this.on(event, handler); }
        off(event, handler) { return this.removeListener(event, handler); }
        once(event, handler) {
          const wrapped = (...args) => {
            this.removeListener(event, wrapped);
            handler(...args);
          };
          return this.on(event, wrapped);
        }

        emit(event, ...args) {
          if (this._events[event]) {
            this._events[event].forEach(h => h(...args));
          }
        }

        async request({ method, params }) {
          switch (method) {
            case 'eth_requestAccounts':
            case 'eth_accounts':
              return [WALLET_ADDRESS];
            case 'eth_chainId':
              return CHAIN_ID;
            case 'net_version':
              return '1';
            case 'personal_sign':
            case 'eth_sign': {
              // Delegate signing to Playwright via exposed function
              const message = params[0];
              if (typeof window.__e2eSign === 'function') {
                return await window.__e2eSign(message);
              }
              // Fallback: return a dummy signature
              return '0x' + 'ab'.repeat(65);
            }
            case 'wallet_requestPermissions':
              return [{ parentCapability: 'eth_accounts' }];
            case 'wallet_getPermissions':
              return [{ parentCapability: 'eth_accounts' }];
            case 'wallet_switchEthereumChain':
            case 'wallet_addEthereumChain':
              return null;
            case 'eth_blockNumber':
              return '0x1000000';
            case 'eth_getBalance':
              return '0xDE0B6B3A7640000'; // 1 ETH
            case 'eth_estimateGas':
              return '0x5208';
            default:
              return null;
          }
        }

        // Legacy methods
        async enable() {
          return [WALLET_ADDRESS];
        }

        send(methodOrPayload, callbackOrParams) {
          if (typeof methodOrPayload === 'string') {
            return this.request({ method: methodOrPayload, params: callbackOrParams || [] });
          }
          if (typeof callbackOrParams === 'function') {
            this.request({ method: methodOrPayload.method, params: methodOrPayload.params || [] })
              .then(result => callbackOrParams(null, { id: methodOrPayload.id, jsonrpc: '2.0', result }))
              .catch(err => callbackOrParams(err));
          }
        }

        sendAsync(payload, callback) {
          this.request({ method: payload.method, params: payload.params || [] })
            .then(result => callback(null, { id: payload.id, jsonrpc: '2.0', result }))
            .catch(err => callback(err));
        }
      }

      const provider = new MockEthereumProvider();
      window.ethereum = provider;
    })();
  `
}
