# AI Agent Context

**Service Purpose:**

The Auth site (`decentraland.org/auth`) is the centralised authentication and identity service for Decentraland. It handles wallet connection, social login (Google, Discord, Apple, X), email OTP login, OAuth callbacks, new-user avatar setup, and mobile deep-link authentication flows. After successful authentication it redirects users back to the originating Decentraland application via a `redirectTo` query parameter.

**Key Capabilities:**

- Wallet login: MetaMask, WalletConnect, Coinbase Wallet via `decentraland-connect`
- Social login (OAuth2): Google, Discord, Apple, X via Magic SDK (`@magic-ext/oauth2`)
- Email OTP login: passwordless email authentication via Thirdweb SDK
- Guest access: unauthenticated play sessions redirecting to the Explorer
- New-user onboarding: avatar customisation step (`AvatarSetupPage`) with WearablePreview and profile deployment to the Catalyst content server
- Mobile authentication: deep-link flows via `MobileAuthPage` and `MobileCallbackPage` for in-app browser sessions
- Post-login redirection: `redirectTo` query parameter controls where the user lands after auth
- Clock synchronisation check to prevent signature failures (`ClockSyncModal`)
- Referral tracking: `useTrackReferral` hook captures referral source at onboarding
- Onboarding checkpoint tracking via Segment analytics
- Feature flags: `FeatureFlagsProvider` gates features (e.g., sign-in option variants)
- Sentry error tracking; Segment analytics

**Communication Pattern:**

- HTTP REST: auth-server HTTP client (`src/shared/auth/httpClient.ts`) for identity and OTP endpoints
- WebSocket: auth-server WebSocket client (`src/shared/auth/wsClient.ts`) for real-time login confirmation
- Catalyst content server (via `dcl-catalyst-client`) for profile reads and profile entity deployment
- `socket.io-client` for WebSocket transport
- No Redux; state managed locally in React hooks and context

**Technology Stack:**

- Runtime: Node.js 20+
- Language: TypeScript
- Frontend framework: React 18 with Vite 6
- Routing: React Router v6
- State management: local component state + React context (no Redux)
- UI library: `decentraland-ui2`
- Wallet connectivity: `decentraland-connect`, Thirdweb SDK, Magic SDK, `viem`
- Animations: Lottie (lottie-react)
- Internationalisation: `@dcl/hooks` `useTranslation`
- Testing: Jest 29 + `@testing-library/react` + `ts-jest`
- Linting/formatting: ESLint (`@dcl/eslint-config`) + Prettier, Husky pre-commit hooks
- Build: Vite with SWC

**External Dependencies:**

- Auth server (HTTP + WebSocket) — identity, OTP issuance, session management; base URL from `src/modules/config`
- Decentraland Catalyst content server (`PEER_URL`) — profile fetch and deployment via `dcl-catalyst-client`
- Magic SDK (`magic-sdk`, `@magic-ext/oauth2`) — social OAuth2 and email login
- Thirdweb SDK — additional wallet and email OTP connection options
- `@dcl/single-sign-on-client` — SSO identity storage shared across Decentraland dApps
- `@dcl/crypto` — `AuthIdentity` creation and signature verification
- Segment — analytics (`src/modules/analytics/`)
- Sentry (`@sentry/react`) — error monitoring

**Key Concepts:**

- **redirectTo**: The primary flow-control parameter. After any successful login the app redirects to the URL specified in `?redirectTo=`. Logic in `src/hooks/redirection.ts`.
- **loginMethod param**: `?loginMethod=email|metamask|google|...` can be passed to `LoginPage` to auto-trigger a specific connection type without showing the selector UI.
- **AuthFlow**: `useAuthFlow` hook (`src/hooks/useAuthFlow.ts`) encapsulates the post-connection steps: check profile completeness, determine whether avatar setup is needed, and perform the final redirect.
- **AvatarSetupPage**: Shown to new users after first login. Lets the user customise their avatar in a Unity WearablePreview, set a display name and email, and accept terms. Profile is deployed to the Catalyst via `deployProfileFromAvatarShape`.
- **MobileAuthPage / MobileCallbackPage**: Handles wallet and social auth for mobile deep-link sessions. The `provider` URL param pre-selects the connection type and skips the selection UI.
- **CallbackPage**: Handles OAuth return from social providers (Magic SDK). Detects mobile sessions and renders `MobileCallbackPage` accordingly.
- **Onboarding checkpoints**: `trackCheckpoint` in `src/shared/onboarding/trackCheckpoint.ts` sends Segment events at key steps (wallet connected, avatar saved, email set, etc.).
- **Clock sync**: Before wallet signing, the app checks that the user's system clock is within acceptable drift to prevent invalid signatures (`src/shared/utils/clockSync.ts`). A `ClockSyncModal` is shown if drift is detected.
- **Feature flags**: `FeatureFlagsProvider` wraps the app and exposes flags via `FeatureFlagsContext`. Flag keys are in `FeatureFlagsKeys`. Used to control sign-in option layout variants.

**Out of Scope:**

- Account management (wallet balances, MANA bridging, notification settings) — handled by `account` (`account.decentraland.org`)
- Governance proposals and voting — handled by `governance-ui`
- Marketplace browsing — handled by the Marketplace dApp
- In-world Explorer functionality — handled by the Decentraland Explorer

**Project Structure:**

```
src/
  assets/            Images and Lottie animation JSON files
  components/        UI components
    AnimatedBackground/
    Connection/        Wallet/provider selection UI
    ConnectionModal/
    EmailLoginModal/
    FeatureFlagsProvider/
    Intercom/
    Pages/
      AvatarSetupPage/   New-user avatar customisation
      CallbackPage/      OAuth callback handler
      DefaultPage/
      InvalidRedirectionPage/
      LoginPage/         Main login UI with all connection options
      MobileAuthPage/    Mobile deep-link auth
      MobileCallbackPage/
      RequestPage/
      SetupPage/
  hooks/             React hooks (navigation, redirection, analytics, authFlow, autoLogin, etc.)
  modules/           Non-Redux modules: analytics, config, profile, translations
  shared/            Low-level utilities
    auth/            Auth-server HTTP and WebSocket clients + types
    connection/      decentraland-connect helpers
    onboarding/      Checkpoint tracking, stored email helpers
    thirdweb/        Thirdweb client and email auth helpers
    utils/           Clock sync, error handling, Magic SDK helpers
  tests/             Jest test files
```

**Configuration:**

Config uses `@dcl/ui-env` (`src/modules/config/config.ts`). Active environment set via `VITE_REACT_APP_DCL_DEFAULT_ENV`. Key variables:

- `PEER_URL` — Catalyst content server
- `AUTH_URL` — Auth server base URL
- `CHAIN_ID` — Ethereum chain ID
- `SEGMENT_API_KEY` — Analytics key
- `ENVIRONMENT` — Runtime environment label

**Testing:**

Tests run with `npm test` (Jest 29, jsdom environment, `ts-jest`). Test files live in `src/tests/` and as `.spec.ts(x)` files co-located with source (e.g., `src/shared/email.spec.ts`, `src/shared/locations.spec.ts`, `src/hooks/useAutoLogin.spec.tsx`). Coverage via `npm run test:coverage`.
