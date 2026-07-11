# Auth dapp E2E tests

Playwright tests organised into three projects.

## Projects

| Project | Specs | Target | When to run |
|---|---|---|---|
| `local` (default) | everything except `request-types-*` and `magic-google-real-oauth` | local Vite preview on `localhost:5174` (CI=true) or `npm start` (dev) | every PR |
| `real-auth` | `request-types-*.spec.ts` | dev deployment `https://decentraland.zone/auth` + live `auth-api.decentraland.zone` | every PR |
| `real-oauth` | `magic-google-real-oauth.spec.ts` | dev deployment + Google login | nightly |

## Running

```bash
# Default suite (mock-driven, fast)
CI=true npx playwright test --project=local

# Real auth-server (no /v2/requests/** mocking — creates real requests)
SKIP_WEBSERVER=1 npx playwright test --project=real-auth

# Nightly: real OAuth round-trip through Google
SKIP_WEBSERVER=1 E2E_GOOGLE_EMAIL=... E2E_GOOGLE_PASSWORD=... npx playwright test --project=real-oauth
```

`SKIP_WEBSERVER=1` disables Playwright's local Vite webServer for projects that
target the deployed dapp at `decentraland.zone/auth`.

## Required env vars (real-oauth project)

| Var | Purpose | Source |
|---|---|---|
| `E2E_GOOGLE_EMAIL` | Test Google account email | dedicated test account; never a real employee account |
| `E2E_GOOGLE_PASSWORD` | Test Google account password | same |
| `E2E_PERSIST_STORAGE_STATE` (optional) | When set, writes `e2e/.storage/google-session.json` after first successful login | CI job that persists artifacts |

Missing env vars cause the spec to auto-skip (`test.skip`), so it's safe to run
the suite without configuring secrets.

### Provisioning the test Google account

1. Create a dedicated Google account (do NOT reuse a real one).
2. In the Magic dashboard, ensure the staging publishable key has
   `https://decentraland.zone/auth/callback` in its allowed redirect URIs.
3. Add the email/password to CI secrets:
   ```
   gh secret set E2E_GOOGLE_EMAIL --body "<email>"
   gh secret set E2E_GOOGLE_PASSWORD --body "<password>"
   ```

## Known caveats

- **CAPTCHA**: Google occasionally challenges headless Playwright sessions with
  reCAPTCHA. The first run after long inactivity is the riskiest. Wire as a
  nightly job and don't gate PRs on it.
- **`storageState` reuse**: Persist `e2e/.storage/google-session.json` between
  runs to skip Google's email/password steps and avoid bot detection.
- **2FA**: The test Google account must NOT have 2FA enabled or the password
  step will hang.

## Helpers

- `injectMockWallet(context)` — mock Ethereum provider (legacy, fixed `MOCK_WALLET`).
- `injectFullSession(context)` — fresh wallet keypair + real AuthIdentity in
  localStorage; the same identity can be used to sign auth-server payloads.
- `mockApiRoutes(page, options)` — auth-server, profile, feature-flag, segment
  mocks. Skip its `/v2/requests/**` routes via `page.route('**/v2/requests/**',
  route => route.continue())` to mix mocked profile with real auth-server.
- `createAuthServerRequest({ method, params, identity? })` — POST to the real
  auth-server (`auth-api.decentraland.zone/requests`) to obtain a `requestId`
  for `eth_sendTransaction` (auth-chain required) or `dcl_personal_sign`.
- `mockCatalystDeployRoute`, `mockNewsletterRoute`, `mockReferralRoute` —
  setup-page deploy chain.
