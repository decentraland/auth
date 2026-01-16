# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Decentraland Auth UI - The authentication/authorization interface for the Decentraland metaverse platform. This React application handles user login, wallet connection, avatar setup, and request signing for decentraland.org/auth.

## Common Commands

```bash
npm start          # Start Vite dev server
npm run build      # TypeScript check + Vite production build
npm test           # Run Jest tests
npm test -- --watch                    # Run tests in watch mode
npm test -- path/to/file.spec.ts       # Run a single test file
npm run test:coverage                  # Run tests with coverage
npm run lint       # ESLint check
npm run fix:code   # Auto-fix linting issues
```

## Architecture

### Routes (src/main.tsx)
All routes are prefixed with `/auth`:
- `/login` - Wallet/provider selection (LoginPage)
- `/callback` - OAuth callback handler (CallbackPage)
- `/requests/:requestId` - Sign requests from dApps (RequestPage)
- `/setup` - Initial setup flow (SetupPage)
- `/avatar-setup` - Avatar customization (AvatarSetupPage)

### Key Directories
- `src/components/Pages/` - Page-level React components
- `src/components/Connection/` - Wallet connection UI components
- `src/hooks/` - Custom React hooks (auth flow, analytics, signing)
- `src/shared/auth/` - Auth server HTTP/WebSocket clients
- `src/shared/connection/` - Wallet connection logic
- `src/modules/config/` - Environment-based configuration (dev/stg/prod)
- `src/modules/analytics/` - Segment and Sentry integration

### Configuration System
Uses `@dcl/ui-env` with environment configs in `src/modules/config/env/`:
- `dev.json`, `stg.json`, `prod.json`
- Environment selected via `VITE_REACT_APP_DCL_DEFAULT_ENV`

### Authentication Flow
1. User connects wallet via `decentraland-connect`
2. Auth server communication through `src/shared/auth/httpClient.ts`
3. Request signing uses `decentraland-crypto-fetch` for signed requests
4. WebSocket client (`wsClient.ts`) for real-time request updates

### UI Framework
- Uses both `decentraland-ui` and `decentraland-ui2` component libraries
- Dark theme via `DclThemeProvider` from decentraland-ui2
- Semantic UI CSS for base styling

## Testing

Jest with jsdom environment. Tests use `@testing-library/react`.
- Test setup files in `src/tests/`
- Uses SWC for fast TypeScript transformation
- CSS modules mocked with `identity-obj-proxy`
