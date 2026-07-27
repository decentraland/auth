/**
 * Canned responses for mocking the auth-server and other APIs
 * during e2e tests.
 */

export const MOCK_WALLET = '0x747c6f502272129bf1ba872a1903045b837ee86c'
export const MOCK_REQUEST_ID = 'e2e-test-request-id-1234'
/** A valid UUID v4 — the client-generated correlation id the deep-link login handoff requires. */
export const DEEP_LINK_REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000'

/** Auth server: GET /v2/requests/:id — recover a wallet signature request */
export const recoverRequestResponse = {
  requestId: MOCK_REQUEST_ID,
  expiration: new Date(Date.now() + 600_000).toISOString(), // 10 min from now
  method: 'personal_sign',
  params: ['Sign this message to prove you own this wallet', MOCK_WALLET]
}

/** Auth server: POST /v2/requests/:id/outcome — successful outcome */
export const outcomeResponse = {
  ok: true
}

/** Auth server: POST /identities — the login handoff that replaced the dcl_personal_sign sign-in */
export const createIdentityResponse = {
  identityId: 'e2e-identity-id'
}

/** Auth server: GET /v2/requests/:id — recover with a DIFFERENT sender than connected wallet */
export const recoverRequestDifferentSenderResponse = {
  requestId: MOCK_REQUEST_ID,
  sender: '0x0000000000000000000000000000000000000001', // doesn't match MOCK_WALLET
  expiration: new Date(Date.now() + 600_000).toISOString(),
  method: 'personal_sign',
  params: ['Sign this message to prove you own this wallet', MOCK_WALLET]
}

/** Auth server: GET /v2/requests/:id — recover with EXPIRED expiration */
export const recoverRequestExpiredResponse = {
  requestId: MOCK_REQUEST_ID,
  expiration: new Date(Date.now() - 60_000).toISOString(), // 1 min in the past
  method: 'personal_sign',
  params: ['Sign this message to prove you own this wallet', MOCK_WALLET]
}

/** Auth server: GET /health — for clock sync check */
export const healthResponse = {
  timestamp: Date.now()
}

/** Auth server: POST /simulations — successful asset-change summary */
export const simulationSuccessResponse = {
  status: 'success',
  assetChanges: [
    {
      type: 'transfer',
      standard: 'erc20',
      from: MOCK_WALLET,
      to: '0x1234567890abcdef1234567890abcdef12345678',
      amount: '100',
      rawAmount: '100000000000000000000',
      tokenId: null,
      contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
      symbol: 'MANA',
      name: 'Decentraland MANA',
      decimals: 18,
      logoUrl: null,
      dollarValue: '42.00'
    }
  ],
  approvalChanges: [],
  balanceChanges: [{ address: MOCK_WALLET, dollarValue: '-42.00' }],
  events: [{ name: 'Transfer', address: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942' }]
}

/** Auth server: POST /simulations — transaction expected to revert */
export const simulationRevertedResponse = {
  status: 'reverted',
  error: 'ERC20: transfer amount exceeds balance',
  assetChanges: [],
  approvalChanges: [],
  balanceChanges: [],
  events: []
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
