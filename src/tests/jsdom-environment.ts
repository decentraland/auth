import type { EnvironmentContext, JestEnvironmentConfig } from '@jest/environment'
// eslint-disable-next-line @typescript-eslint/naming-convention
import JSDOMEnvironment from 'jest-environment-jsdom'

/**
 * Custom jsdom environment that exposes Node.js built-in Web APIs
 * (fetch, Request, Response, Headers) which jsdom doesn't provide.
 * Required by decentraland-crypto-fetch (imported transitively via @dcl/hooks).
 */
// eslint-disable-next-line import/no-default-export
export default class CustomJSDOMEnvironment extends JSDOMEnvironment {
  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context)

    // Expose Node.js built-in Web APIs to the jsdom global
    if (typeof this.global.Request === 'undefined') {
      this.global.Request = Request
      this.global.Response = Response
      this.global.Headers = Headers
      this.global.fetch = fetch
    }
  }
}
