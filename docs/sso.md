# Gorth desktop sign-in

Browser: Settings → Get started → Sign in with Gorth.
Launcher: Accounts → Sign in with Gorth.

Both are public native OIDC clients. No client secret belongs in a desktop build.
Set the variables from each project's .env.example in the shell or local Vite
environment file before starting/building it. Only these three public variables
are embedded into the main bundle; they are not exposed to the renderer.
For distributed builds, supply this public configuration at build time.

Register these exact clients at the Gorth SSO server before using real sign-in:

| Client ID | Redirect URI |
| --- | --- |
| gorth-browser | http://127.0.0.1:43822/auth/callback |
| gorth-launcher | http://127.0.0.1:43821/auth/callback |

Use token_endpoint_auth_method=none, require_pkce=true (S256),
grant_types=[authorization_code, refresh_token], response_types=[code],
application_type=native, scopes=[openid, profile, email, offline_access].
No wildcard redirect, client secret, Ely provider, or Minecraft token exchange.
Client registration is an SSO administrator operation; this change does not
modify a running SSO database.

The SSO repository now includes these registrations in
`server/database/seeds/oauth-clients.json`. An administrator can run
`pnpm --dir server db:seed:desktop-clients` in the SSO repository after selecting
the intended database. This command inserts missing desktop clients and refuses
to overwrite incompatible existing registrations. It was not executed as part
of this change. Set VITE_GORTH_SSO_ISSUER to the exact discovery issuer, including
its /auth path when advertised (not merely the login page origin).

Like the chat app, sign-in verifies state, nonce, issuer, audience, JWT signature,
expiry, authorized party and token/code hashes when supplied. Desktop uses a
loopback callback and main-process token storage instead of Next.js HTTP cookies.
UserInfo is fetched in main and its subject must match the verified ID token.
Only the necessary profile fields (ID, name, email, username) reach the renderer.

Only a token-free account summary crosses IPC. Tokens use Electron safeStorage
in the application's Gorth userData directory. Startup reads no encrypted vault.
Unlock saved session / Sign in explicitly accesses the OS keychain; macOS may
legitimately ask permission then. Denying access preserves existing data and
allows retry. Unlock refreshes an expired session when its refresh token and
configuration match. Sign out clears this app's saved session first, then
attempts revocation of its access and refresh tokens. If SSO is offline, the
local session stays cleared and the UI reports revocation failure. It does not
end the central SSO browser session or other apps. Account sign-in does not
implement data sync.

Run `pnpm test:auth` for mocked OIDC and vault/IPC tests. These verify PKCE,
state, JWT validation, userinfo subject, revocation, cancellation, encrypted-vault
retry, startup without decryption, and token-free IPC. They do not prove a live
SSO client registration or a real user login.

Launcher startup now shows its window immediately and handles initial renderer
load failures, with bounded retries for the Vite dev server. This does not
suppress macOS security prompts or disable encryption.
