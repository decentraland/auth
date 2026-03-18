## Fix: Connection state bugs across ConnectionProvider, RequestPage, and DefaultPage

### Why

Several related bugs in how connection state is managed were causing incorrect behavior:

1. **RequestPage re-fetched consumed requests on identity changes** — When `getIdentitySignature` updated the context's `identity`, it triggered RequestPage's main `useEffect` (which had `identity` in its dependency array). If `loadRequest()` was still running, a second invocation raced against the first, causing double request recovery, double profile fetches, and potentially consuming an already-fulfilled request.

2. **DefaultPage had an unnecessary dependency** — The `useEffect` dependency array included `getCurrentConnectionData`, a stable module-level import that never changes, adding noise to the dependency list.

3. **Wallet disconnect left stale `provider`, `providerType`, and `chainId`** — When the wallet emitted `accountsChanged` with an empty array (disconnect), only `account` and `identity` were cleared. Downstream consumers checking `!provider || !providerType` wouldn't detect the disconnected state, leading to inconsistent UI behavior.

4. **Account switch bypassed identity validation** — The `handleAccountsChanged` handler loaded cached identities from localStorage without running `isValidIdentity()`, unlike the identity generation path in `identity.ts`. This meant a corrupted identity (e.g. double-encoded hex keys — the exact bug `isValidIdentity` was designed to catch) would propagate into context unchecked. The same validation was also missing in `getCurrentConnectionData`.

### How

#### 1. Extracted `getCachedIdentity` helper (fixes #4, DRYs up identity retrieval)

The pattern of calling `localStorageGetIdentity(address)` then checking `isValidIdentity()` was duplicated across `identity.ts`, `ConnectionProvider.tsx`, and missing entirely in `connection.ts`. Extracted a single `getCachedIdentity(address)` function in `identity.ts` that encapsulates the localStorage read + structural validation. All three call sites now use it, ensuring corrupted identities are consistently discarded everywhere.

#### 2. Concurrent execution guard for RequestPage's `loadRequest` (fixes #1)

Added an `isProcessingRef` that is set at the start of `loadRequest` and cleared in a `finally` block. The effect checks this ref alongside `TERMINAL_VIEWS` and `hasCompletedRef` before starting a new load.

Removed `identity` from the effect's dependency array since the effect doesn't need to re-run when identity changes — it reads `identityRef.current` instead. The ref is only used inside the effect (for profile redeployment), where reading the latest value is correct because the effect already re-runs when `account` changes. Event callbacks (`onApproveSignInVerification`, `onApproveWalletInteraction`) continue to close over `identity` directly so they stay consistent with the account that initiated the action — using a ref there would risk posting a mismatched identity if the user switches wallets mid-signing.

#### 3. Removed unnecessary dependency in DefaultPage (fixes #2)

Removed `getCurrentConnectionData` from the `useEffect` dependency array — it's a stable module-level import that never changes.

#### 4. Full state cleanup on wallet disconnect (fixes #3)

When `accountsChanged` fires with an empty array, the handler now clears all five state fields (`account`, `identity`, `provider`, `providerType`, `chainId`) instead of just `account` and `identity`.

### Files changed

| File | Change |
|---|---|
| `src/shared/connection/identity.ts` | New `getCachedIdentity` helper, export it |
| `src/shared/connection/ConnectionProvider.tsx` | Use `getCachedIdentity` for account switch, clear all state on disconnect |
| `src/shared/connection/connection.ts` | Use `getCachedIdentity` instead of raw `localStorageGetIdentity` |
| `src/shared/connection/identity.spec.ts` | New `getCachedIdentity` tests covering valid, missing, and invalid identity cases |
| `src/shared/connection/hook.spec.tsx` | Updated account switch tests to use `getCachedIdentity` mock, full state cleanup on disconnect |
| `src/components/Pages/RequestPage/RequestPage.tsx` | Add `isProcessingRef` guard, use `identityRef` only in effect, remove `identity` from effect deps |
| `src/components/Pages/DefaultPage/DefaultPage.tsx` | Remove stale dependency |
| `src/components/Pages/DefaultPage/DefaultPage.spec.tsx` | **New** — tests for redirect paths |
