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

### Running Tests

```bash
npm test
```

### Test Structure

Test files are located in `src/tests/`, using the `*.test.ts` naming convention.

## AI Agent Context

For detailed AI Agent context, see [docs/ai-agent-context.md](docs/ai-agent-context.md).

---
