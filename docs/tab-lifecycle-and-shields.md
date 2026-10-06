# Tab lifecycle and Shields

Implemented 2026-10-04. No changes to `components/ui`.

## Foundation fixes

- Each browser window has a stable session id. Tabs, groups, recently closed tabs, window bounds and window preferences are scoped to that id. Legacy rows migrate to `main` without removing data. App quit restores all open windows; deliberately closed secondary windows are not automatically reopened.
- Bookmarks/history are profile-wide. Snapshot saves apply changes against the saving window's baseline instead of replacing the profile's entire dataset. An unchanged, stale window cannot erase another window's changes. Simultaneous edits to the same entry use last-change-wins; this is not live multi-window UI synchronization.
- `window.open`/`target="_blank"` request a new browser tab through chrome. HTTP(S) and recognized internal URLs are allowed, other protocols are rejected. The original tab is left untouched. Arbitrary popup windows, opener scripting and `about:blank` document-writing popups are not supported.
- `memorySaver` drives the real tab lifecycle. `smoothScrolling` drives Chromium's `SmoothScrolling` feature switch on the next full application restart. Extensions and other unrelated placeholder settings remain explicitly unavailable.
- Launcher does not have browser tab snapshots or browser flags. It retains its isolated allowlisted content webview and single-instance policy. `createWindow` now also reuses its one main window, preventing competing writes to its one window-state file.

## Sleeping and archive

Configure `gorth://settings/system`:

- Memory saver defaults to on, after **15 minutes** of inactivity.
- Automatic archive defaults to **off** (0 days); a value of 1–365 days enables it.
- Right-click an inactive website tab for **Sleep tab** / **Archive tab**.
- `gorth://archive` lists archived tabs, with Restore/Delete actions. Restore writes the destination tab to SQLite and removes the archive in one transaction before rendering it.

Sleeping removes the native `WebContentsView` and closes its renderer, as Flow's `tab-lifecycle.ts` does. URL, title, mute state and URL navigation history are retained. Activation recreates the native view and restores navigation history. Inactive unpinned/ungrouped tabs restore lazily at startup.

Active, split/glance companion, pinned, grouped, internal, loading, audible, captured, downloading, playing-media, PiP, pointer-lock and visibly edited-form/contenteditable tabs are protected. If the document safety check fails, no sleep/archive occurs. Checks run every 30 seconds and do not overlap.

This is not a full DOM/JavaScript heap snapshot. Scroll/form/editor state is not serialized; undiscoverable application-only drafts and background tasks may not be detectable. A sleeping tab reloads when activated. Navigation restoration excludes non-HTTP(S) history entries.

## Shields

Configure `gorth://settings/shields`:

- Ads/tracker protection defaults to on.
- Ghostery's **full** prebuilt engine contains EasyList, EasyPrivacy, Peter Lowe, uBlock Origin filtering/privacy/badware/unbreak lists and cookie/annoyance lists, plus scriptlet/redirect resources.
- Network blocking, redirects, supported URL rewrites, CSP and cosmetic/scriptlet filtering are integrated into Electron. Cosmetic IPC is restricted to registered website views and the caller's actual frame URL. Chrome, portals and SSO are not filtered.
- Hostname exceptions (including subdomains), custom network/cosmetic filters, a blocked-request count, manual updates and automatic daily update checks are provided.
- The bundled `assets/shields-engine.bin` supports first-launch/offline protection. Updates are cached atomically in the Browser application-support directory. Failed updates retain the last engine; shutdown cancels pending network work. Full presets may hide cookie/annoyance UI as well as advertisements.
- Turning protection off or adding an exception changes new requests immediately; reload an existing site to remove/apply previously injected cosmetic rules.

This follows Flow's Ghostery integration, not Brave's native Rust engine. It is **not** a promise of parity with Brave/Cốc Cốc or guaranteed YouTube ad removal. Coverage depends on available lists and Electron's request/response integration. Browser fingerprinting defenses, permission prompts, first-party server-inserted advertisements, full HTML response rewriting, regional subscriptions and Web Store extensions are not implemented here.

Filter engine/source: [Ghostery/adblocker](https://github.com/ghostery/adblocker). Brave reference: [brave/adblock-rust](https://github.com/brave/adblock-rust).
Filter source files/resources and their original notices/licenses: [Ghostery filter assets](https://github.com/ghostery/adblocker/tree/master/packages/adblocker/assets). The engine dependency retains its MPL-2.0 license; filter subscriptions retain their respective upstream licenses.

Regenerate the bundled engine after an engine dependency update:

```sh
node scripts/build-shields-engine.mjs
```

## Verification

```sh
pnpm exec tsc --noEmit
pnpm lint
pnpm exec vite build
node scripts/test-browser-foundation.mjs
node scripts/test-lifecycle-native.mjs
node scripts/test-tab-groups.mjs
node scripts/test-downloads.mjs
node scripts/test-shortcuts.mjs
```

Native tests use an isolated temporary application-support directory and a local HTTP server. They verify actual renderer destruction/recreation, preserved Back history, active/pinned/edited-form protection, archive persistence, `target=_blank`, network cancellation, cosmetic hiding, chrome isolation and per-site exceptions. They do not browse your personal profile.
