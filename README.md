# Decentraland Auth UI

[![Coverage Status](https://coveralls.io/repos/github/decentraland/auth/badge.svg?branch=main)](https://coveralls.io/github/decentraland/auth?branch=main)

Authentication UI for Decentraland at decentraland.org/auth. Handles wallet-based and email-based login, new user avatar setup, OAuth callback flows, and mobile deep-link authentication.

## Table of Contents

- [Features](#features)
- [Dependencies & Related Services](#dependencies--related-services)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [AI Agent Context](#ai-agent-context)

## Features

- **Wallet Login**: Connect via browser wallet extensions (MetaMask, etc.)
- **Email Login (OTP)**: Passwordless email login via one-time-password flow
- **Avatar Setup**: Guided avatar customization step for new users (`AvatarSetupPage`)
- **OAuth Callback Handling**: Processes login callbacks and redirects users back to origin
- **Mobile Authentication**: Deep-link auth flow for the mobile app (`MobileAuthPage`, `MobileCallbackPage`)
- **Session Transfer**: Transfers existing sessions across contexts
- **Invalid Redirection Guard**: Detects and rejects malformed redirect targets

## Dependencies & Related Services

- **Catalyst / Peer API**: fetches profile data during avatar setup
- **Single Sign-On Client** (`@dcl/single-sign-on-client`): manages cross-domain session sharing
- **Wallet Providers** (`decentraland-connect`): MetaMask, WalletConnect, and other integrations
- **Feature Flags Service**: controls availability of login methods

### What This UI Does NOT Handle

- Account management (account site)
- Profile editing after initial setup (profile site)
- Server-side session storage or token issuance

## Getting Started

### Prerequisites

- Node >=20
- npm

### Installation

```bash
npm install
```

### Configuration

Create a copy of `.env.example` and name it `.env.development`:

```bash
cp .env.example .env.development
```

### Running the UI

```bash
npm run start
```

## Testing

### Unit Tests

```bash
npm test
```

Unit test files live alongside source files using the `*.spec.ts` / `*.spec.tsx` convention.

### E2E Tests (Playwright)

E2E tests live in `e2e/tests/` and cover the full auth flows (Explorer, web, social, OTP, error handling, etc.) using a mock MetaMask provider and intercepted API routes.

**Prerequisites**: the dev server must be running on port 5174 (Playwright starts it automatically via `webServer` config, or reuses an existing one).

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run all E2E tests with browser visible, one at a time
npm run test:e2e:headed

# Run a specific test file
npx playwright test e2e/tests/explorer-metamask-flow.spec.ts

# Run a specific test file headed (see the browser)
npx playwright test e2e/tests/explorer-metamask-flow.spec.ts --headed --workers=1

# Run a single test by name (grep)
npx playwright test -g "new user auto-signs"

# Run a single test by name, headed
npx playwright test -g "new user auto-signs" --headed --workers=1

# Show the HTML report after a run
npx playwright show-report
```

**Tips**:
- `--headed` opens a real browser window so you can watch the test
- `--workers=1` runs tests sequentially (easier to follow visually)
- `-g "text"` filters by test name (partial match)
- Failed tests save screenshots to `test-results/`

## AI Agent Context

For detailed AI Agent context, see [docs/ai-agent-context.md](docs/ai-agent-context.md).

---
