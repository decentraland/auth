/**
 * Canned responses for mocking the auth-server and other APIs
 * during e2e tests.
 */

export const MOCK_WALLET = '0x747c6f502272129bf1ba872a1903045b837ee86c'
export const MOCK_REQUEST_ID = 'e2e-test-request-id-1234'

/** Auth server: GET /v2/requests/:id — recover a signing request (with verification code) */
export const recoverRequestResponse = {
  requestId: MOCK_REQUEST_ID,
  code: '1234',
  expiration: new Date(Date.now() + 600_000).toISOString(), // 10 min from now
  method: 'dcl_personal_sign',
  params: ['Sign this message to verify your identity']
}

/** Auth server: GET /v2/requests/:id — recover WITHOUT code (new user, no verification needed) */
export const recoverRequestNoCodeResponse = {
  requestId: MOCK_REQUEST_ID,
  expiration: new Date(Date.now() + 600_000).toISOString(),
  method: 'dcl_personal_sign',
  params: ['Sign this message to verify your identity']
}

/** Auth server: POST /v2/requests/:id/outcome — successful outcome */
export const outcomeResponse = {
  ok: true
}

/** Auth server: GET /v2/requests/:id — recover with a DIFFERENT sender than connected wallet */
export const recoverRequestDifferentSenderResponse = {
  requestId: MOCK_REQUEST_ID,
  sender: '0x0000000000000000000000000000000000000001', // doesn't match MOCK_WALLET
  code: '1234',
  expiration: new Date(Date.now() + 600_000).toISOString(),
  method: 'dcl_personal_sign',
  params: ['Sign this message to verify your identity']
}

/** Auth server: GET /v2/requests/:id — recover with EXPIRED expiration */
export const recoverRequestExpiredResponse = {
  requestId: MOCK_REQUEST_ID,
  code: '1234',
  expiration: new Date(Date.now() - 60_000).toISOString(), // 1 min in the past
  method: 'dcl_personal_sign',
  params: ['Sign this message to verify your identity']
}

/** Auth server: GET /health — for clock sync check */
export const healthResponse = {
  timestamp: Date.now()
}

/** Feature flags: dapps.json */
export const featureFlagsResponse = {
  flags: {
    'dapps-onboarding-to-explorer': true,
    'dapps-magic-dev-test': false,
    'dapps-http-auth': false
  },
  variants: {}
}

/** Feature flags: explorer.json */
export const explorerFeatureFlagsResponse = {
  flags: {},
  variants: {}
}

/** Profile: returns empty (new user) */
export const emptyProfileResponse = {
  avatars: []
}

/** Profile: returns existing user */
export const existingProfileResponse = {
  avatars: [
    {
      name: 'TestUser',
      description: '',
      avatar: {
        bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
        eyes: { color: { r: 0.125, g: 0.703, b: 0.964 } },
        hair: { color: { r: 0.234, g: 0.128, b: 0.065 } },
        skin: { color: { r: 0.8, g: 0.608, b: 0.465 } },
        wearables: [],
        snapshots: {}
      }
    }
  ]
}
