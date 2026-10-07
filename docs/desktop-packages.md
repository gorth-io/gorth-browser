# Desktop package integration

- tRPC v11 runs through the isolated preload's `desktop:rpc` channel, not a network listener.
  Main validates the owning window, main frame, renderer URL and bounded request, then
  calls the existing session and tab-group services. Procedures use shared Zod schemas;
  unexpected errors do not expose stack traces to the renderer.
- `@trpc/tanstack-react-query` shares the application's QueryClient. Session loading
  is cached for startup, including React StrictMode's repeated effects.
  The installed classic `@trpc/react-query` integration is intentionally not used.
- TanStack Router resolves internal pages with memory history. Electron still owns
  browser-tab navigation, external websites and persisted sessions.
- The history page uses TanStack Table v9 sorting, search and TanStack Virtual
  when there are more than 50 filtered rows. History link actions are preserved.
- Ranger controls inactivity timers; numeric inputs remain available for precise values.
  Changes commit on release so dragging does not flood persistence.

Existing IPC for native views, lifecycle events, synchronous shutdown flush,
downloads and authentication remains in place. This is not a wholesale IPC migration.
`components/ui` is unchanged; application-specific controls live in `components/custom`.

Validation: `pnpm test:rpc`, `pnpm test:desktop-packages`,
`pnpm exec tsc --noEmit`, and renderer/main/preload builds.
The native test uses temporary profile data, not the user's browser database.
