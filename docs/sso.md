# Gorth desktop sign-in

Browser: Settings → Get started → Sign in with Gorth / Đăng ký Gorth.
Launcher: Accounts → Đăng nhập Gorth / Đăng ký Gorth.
Both display SSO inside the existing desktop window, never a popup or an external browser.

Both are public native OIDC clients. No client secret belongs in a desktop build.
Set the variables from each project's .env.example in the shell or local Vite
environment file before starting/building it. OAuth configuration is consumed
by main; tokens are not exposed to the renderer.
For distributed builds, supply this public configuration at build time.

Register these exact clients at the Gorth SSO server before using real sign-in:

| Client ID      | Redirect URI                        |
| -------------- | ----------------------------------- |
| gorth-browser  | http://localhost:5501/auth/callback |
| gorth-launcher | http://localhost:5502/auth/callback |

Use token_endpoint_auth_method=none, require_pkce=true (S256),
grant_types=[authorization_code, refresh_token], response_types=[code],
application_type=native, scopes=[openid, profile, email, offline_access].
No wildcard redirect, client secret, Ely provider, or Minecraft token exchange.
Client registration is an SSO administrator operation. On 2026-10-05 both
clients were inserted and verified in the configured SSO database.

The SSO repository now includes these registrations in
`server/database/seeds/oauth-clients.json`. An administrator can run
`pnpm --dir server db:seed:desktop-clients` in the SSO repository after selecting
the intended database. This command inserts missing desktop clients and refuses
to overwrite incompatible existing registrations.

Use `VITE_SSO_OAUTH_CLIENT_ID`, `VITE_SSO_CLIENT_URL`, `VITE_SSO_SERVER_URL`
and `VITE_APP_URL`. The issuer is derived as `<SSO client origin>/auth` and
discovery uses `/auth/.well-known/openid-configuration`; backend communication
uses SSO's existing frontend `/auth` proxy. The redirect is derived as
`<app origin>/auth/callback`. No old GORTH_SSO_* aliases remain.

The embedded flow intercepts the exact registered callback in main. A persistent
Hono callback route also delivers HTTP redirects to that same single-use PKCE
transaction, so a callback arriving over HTTP is not dropped. In development,
Vite's public port forwards domain routes to Hono in main over an OS-local
socket/named pipe; no extra TCP callback port is used. Packaged apps use Hono
on the configured application port for both renderer assets and domain routes.
Vite uses strictPort and binds loopback only. Transaction/cookie names in
`.env.example` are exported names, not credentials; desktop auth continues to
use in-memory transactions and its encrypted vault instead of web cookies.

Like the chat app, sign-in verifies state, nonce, issuer, audience, JWT signature,
expiry, authorized party and token/code hashes when supplied. Desktop uses a
native callback interception and main-process token storage instead of Next.js app cookies.
UserInfo is fetched in main and its subject must match the verified ID token.
Only the necessary profile fields (ID, name, email, username) reach the renderer.

Only a token-free account summary crosses IPC. Tokens use Electron safeStorage
in the application's Gorth userData directory. Startup reads no encrypted vault.
Unlock saved session decrypts the vault explicitly. Fresh sign-in/register skips
decrypting any old vault and opens SSO directly; macOS may still legitimately ask
permission when saving the newly verified session. Denying access preserves existing data and
allows retry. Unlock refreshes an expired session when its refresh token and
configuration match. Sign out clears this app's saved session first, then
attempts revocation of its access and refresh tokens. If SSO is offline, the
local session stays cleared and the UI reports revocation failure. It does not
end the central SSO browser session or other apps. It clears this desktop app's
dedicated SSO cookie/storage partition. Account sign-in does not
implement data sync.

Run `pnpm test:auth` for mocked OIDC and vault/IPC tests. These verify PKCE,
state, JWT validation, userinfo subject, revocation, cancellation, encrypted-vault
retry, startup without decryption, and token-free IPC. They do not prove a live
SSO client registration or a real user login.

## Same-window UI and hooks

`AuthProvider` mounts once at renderer root. `useAuth()` exposes `account`,
`username`, `authenticated`, `loading`, `locked`, `error`, `login`, `register`,
`logout`, `refresh`, `unlock`, `cancel`, and the existing `state/run/busy/ready`
API. `useUser()` and `useAccount()` consume the same public account state.
An opt-in `AuthGuard` can protect UI without blocking general browser use.
Unlocked near-expiry sessions refresh automatically; invalid grants clear the
app identity. Startup never silently decrypts the vault or prompts for Keychain.

Registration uses `prompt=create` like Chat. SSO owns sign-up, OTP, consent and
password-reset forms. The native auth view is sandboxed, has no preload/bridge,
denies permissions/downloads, and allows only configured SSO origins plus the
exact callback. New-window requests always return deny; allowed Gorth links
stay in the same view. Login expires after three minutes, registration after ten.

`pnpm test:auth:embedded` runs isolated hidden Electron smoke tests against local
SSO 3000/8080 using temporary app data. It checks real login/signup form rendering,
sandbox/no bridge, popup denial and cancellation. These passed on 2026-10-05,
alongside mocked PKCE/code exchange/refresh/logout and security regression tests.
No user credentials, SMTP OTP delivery or real account creation were automated.

Launcher startup now shows its window immediately and handles initial renderer
load failures, with bounded retries for the Vite dev server. This does not
suppress macOS security prompts or disable encryption.

## Hono routes and local profile cache

HTTP boundaries are organized as `routes -> controllers -> services`.
`GET /auth/callback` validates the exact origin/path and the active transaction's
state/issuer, consumes it once, and exchanges the authorization code only in main.
No request logger prints callback URLs. `GET /health` exposes only an OK status.
`GET /user/profile` requires a per-run desktop capability and an unlocked, valid
SSO session; the subject is resolved from main state, not a supplied ID.
Foreign Host/Origin requests are rejected. Public identity caching never grants
authentication or access to another cached account.
The narrow preload API `window.electronAPI.auth.profile()` returns this public
cache (or null without a valid session); its per-run capability remains inside
the isolated preload world.

`database/schema.ts` defines `user_profiles` with `sso_user_id` as its primary
key, plus name, username, email, image, email verification, creation/sync times.
Verified login and refresh upsert only these public identity fields, preserving
creation time across email/username changes. Logout retains the profile cache
but removes authentication; no password, OTP, access/refresh/ID token is saved
in this table. Tokens remain in the existing safeStorage-encrypted vault.
The additive SQLite migration preserves existing data and runs on startup.

`services/desktop-server.ts` starts/stops Hono with Electron. Vite and Hono share
one public HTTP origin per app (Browser 5501, Launcher 5502). In dev there is an
internal OS IPC endpoint, not another HTTP port; main alone owns database/vault
access. Packaged Hono binds loopback and serves only built renderer assets.
An occupied public port fails startup rather than silently changing the callback.
Filesystem, process and SQLite APIs still use Electron's Node runtime; Hono
replaces HTTP request handling, not those privileged platform capabilities.

Verification:

- `pnpm test:auth`: signed mock OIDC/PKCE/HTTP callback, vault/IPC and native view guards.
- `pnpm test:server`: additive cache writes, identity-key updates, existing-data preservation, route access guards and callback replay.
- `pnpm test:server:native`: temporary-profile Electron smoke test of packaged assets/API, sandboxed profile access, logged-out cache behavior and same-port Vite/Hono routing.
- `pnpm test:auth:embedded`: live local SSO forms, sandbox, no popups and cancellation.

Actual account credentials, OTP mail delivery and a completed real-user SSO login
remain manual verification; these tests do not create a central SSO user.

## Auth tab and completion

Browser opens SSO in a dedicated browser tab (not an internal-page overlay). Its sandboxed native view uses the regular tab layout, leaving titlebar, draggable chrome and addressbar visible. Switching tabs hides it without canceling the transaction; closing it cancels sign-in. Back returns to `gorth://settings/profile`.

The SSO request carries `redirect=gorth://auth` as the UI return destination. This does not replace the registered loopback `redirect_uri`: PKCE/state and signed ID-token verification still complete before opening the internal success page. The addressbar excludes private OAuth parameters, retaining only the public return destination; session persistence never saves SSO authorization history.

Normal login does not send `prompt=login`: a valid SSO session can resume
authorization instead of looping between the auto-resuming login form and
forced authorization. Registration still sends `prompt=create`.

`gorth://auth` is an internal completion page, not the registered OAuth callback.
The exact HTTP callback on the app port stays unchanged. A successful screen is
marked only after token validation, profile synchronization and encrypted vault
storage; receiving an authorization code alone is not success. Native view URLs
sent to the UI exclude private query parameters, so codes/state do not enter tab
persistence. Cancellation and failed validation never set the completion marker.

After verified completion, the auth tab displays `gorth://auth` for 500 ms and
returns to the real `gorth://settings/profile` settings page. Back returns there
as well, canceling any active transaction. During SSO the regular h-14 browser
addressbar and titlebar remain visible; the native tab starts below the chrome.
Browser SSO cookies use an in-memory partition, while
durable tokens remain protected by safeStorage.

Renderer regression: run `pnpm exec vite build`, then `pnpm test:auth:ui`.
This checks rendered bar/input dimensions, icon-only back, success-only automatic
profile navigation and popup count with a credential-free fixture.
The fixture also renders the real Browser titlebar across SSO → `gorth://auth`
→ profile and checks every internal-page icon. A missing auth icon previously
caused React error #130 to unmount the whole chrome, leaving a blank window with
no draggable region. The icon map is now exhaustive at type-check time and has
a runtime fallback.

Native tab regression: `pnpm test:auth:embedded` checks the live anonymous SSO
login/sign-up forms, `redirect=gorth://auth`, tab bounds below both bars,
draggable chrome, sandbox isolation, no popups and cancellation cleanup.
