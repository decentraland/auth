import { getConfiguration } from 'decentraland-connect'

const createMagicInstance = async (isTest: boolean) => {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { Magic } = await import('magic-sdk')
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { OAuthExtension } = await import('@magic-ext/oauth2')

  const config = isTest ? getConfiguration().magic_test : getConfiguration().magic
  const MAGIC_KEY = config.apiKey

  return new Magic(MAGIC_KEY, {
    extensions: [new OAuthExtension()]
  })
}

const getMagicApiKey = (isTest: boolean): string => {
  const config = isTest ? getConfiguration().magic_test : getConfiguration().magic
  return config.apiKey
}

// OAuth error code returned in the redirect URL when the user cancels at the provider
const OAUTH_ACCESS_DENIED_ERROR = 'access_denied'

export { createMagicInstance, getMagicApiKey, OAUTH_ACCESS_DENIED_ERROR }
