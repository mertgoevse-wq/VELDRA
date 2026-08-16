# VELDRA — Storage, Sync & Multi-Device Foundation

Status as of 2026-08-16 (updated in a later round -- see "Update" note below). This is
the design/foundation doc for the storage/sync/identity mandate. It describes what
exists **today** (verified against real code, not aspiration), the interfaces added, and
what deliberately was NOT built.

**Update (later round, same day)**: per-project Android storage isolation, called out
below as an "honest limitation, not fixed this block," IS now real -- see "Project
identity" below for the current state. The original limitation writeup is kept
(struck through in spirit, not literally) so the historical reasoning stays visible.

## The six concerns, defined against real code

The mandate asks for these to be distinguished explicitly. Here is what each one actually
maps to in this codebase today:

| Concern | What it means here | Where it lives today |
|---|---|---|
| **LOCAL STATE** | Files/state that exist only on this device, not yet confirmed anywhere else | `workbenchStore.files` (in-memory) + `androidFallbackStorage.ts` (IndexedDB) |
| **REMOTE STATE** | Files/state as the Remote Runtime server actually has them | Whatever `GET /workspace/:id/files` on the configured Remote Runtime server returns |
| **SYNC STATE** | The last-known relationship between local and remote (idle/syncing/synced/conflict/error) | `RemoteWorkspaceSync.ts`'s `RemoteWorkspaceSyncStatus`; now also exposed generically via `StorageProvider.getSyncState()` |
| **PROJECT STATE** | Which project's files these are | `app/lib/identity/project.ts` + `androidFallbackStorage.ts`'s per-project IndexedDB keys — see "Project identity" below |
| **AUTHENTICATION** | Credentials proving you're allowed to read/write a given backend | Remote Runtime bearer token, GitHub OAuth token — see "Threat model" below |
| **STORAGE PROVIDER** | Which backend is actually being talked to | `app/lib/storage/types.ts`'s `StorageProvider` interface (new this block) |

## Project identity — real per-project isolation now, with a real migration

`app/lib/identity/project.ts` provides `getCurrentProjectId()`/`getCurrentProject()`,
kept structurally distinct from chat identity in the type system even though it derives
from `getCurrentChatId()` (`app/utils/fileLocks.ts`, `/chat/:id` from the URL, falling
back to `'default'`) -- there is still no broader "project" grouping construct than a
chat, so this is the closest real 1:1 mapping that exists. Only this one function needs
to change when a real project-grouping feature is built; no other call site does.

**`androidFallbackStorage.ts` now genuinely isolates storage per project.** It used to
store exactly one global workspace under a fixed key (`'workspace'`), shared by every
chat -- switching chats didn't switch which files you saw. Now every project gets its
own real IndexedDB record (`workspace:{projectId}`). Migration is deterministic (a
persisted session-store marker, not load-order timing): the first project to load after
upgrade inherits any pre-existing legacy global data; every other/new project starts
genuinely empty rather than each re-claiming the same old files. The legacy record is
never deleted -- append-only, so the original data stays recoverable if anything about
the migration path ever needs to be revisited. `LocalStorageProvider`
(`app/lib/storage/providers/local-provider.ts`) automatically inherited real isolation
from this change with zero edits of its own, since it already threaded its `project`
parameter through to `loadAndroidFallbackState`/`saveAndroidFallbackWorkspace` -- it was
only ever a conformance no-op because the underlying storage was global; now that the
underlying storage is real, the adapter's existing plumbing became real too.

Found and fixed while building this: `androidFallbackStorage.ts`'s `openDb()` opened a
brand-new `IDBDatabase` connection on every single call and never closed any of them --
an unbounded connection leak present since this file was written, just never exercised
by a test that opened/closed the database repeatedly in one process until the migration
tests did. Fixed by caching one long-lived connection (the standard IndexedDB usage
pattern) instead of open-per-call-and-forget.

## Device identity — new this block

`app/lib/identity/device.ts` adds a stable per-installation device ID
(`crypto.randomUUID()`, persisted in plaintext `localStorage`, exposed via
`getDeviceId()`/`deviceIdStore`). Nothing in the codebase used any device-identity concept
before this (verified by search). It is deliberately inert today — **nothing sends it
anywhere**. It exists so a future multi-device conflict UI ("this file was also edited on
your phone") has something to build on, without inheriting silent tracking as a side
effect of adding it.

Device identity is intentionally kept separate from project identity (`ProjectIdentity`)
per the mandate's explicit requirement — a project doesn't belong to a device, and a
device can touch many projects.

## The StorageProvider interface

`app/lib/storage/types.ts` defines the contract; two adapters implement it this block,
both wrapping **already-real, already-tested logic** rather than reimplementing file I/O:

- **`RemoteRuntimeProvider`** (`app/lib/storage/providers/remote-runtime-provider.ts`) —
  wraps `RemoteRuntimeClient`/`RemoteWorkspaceSync.ts`. Real capabilities:
  read/write/delete/conflict-detection all `true`, matching this round's delete-propagation
  fix.
- **`LocalStorageProvider`** (`app/lib/storage/providers/local-provider.ts`) — wraps
  `androidFallbackStorage.ts`. `conflictDetection: false` — a single local copy has
  nothing to compare against.

Both are genuinely exercised by tests against real (fake-indexeddb-backed) persistence,
not mocks of VELDRA's own logic — only the Remote Runtime HTTP boundary is spied.

**Deliberately not built this block**: a GitHub-backed provider, Google Drive, iCloud, or
any other cloud storage backend. These require real, separate work (OAuth flows, quota/
rate-limit handling, a genuine conflict-resolution UI beyond a status flag) that doesn't
exist yet in this codebase. Building a provider class that LOOKS like it works but throws
"not implemented" would be worse than not building it — it invites a future caller to
register it in a provider list and silently fail. The interface is the deliverable; a
real GitHub provider is future work once OAuth and a conflict UI exist to back it.

For the curious: `RemoteRuntimeClient` already has `gitStatus`/`gitInit`/`gitCommit`/
`gitPush` — but those run `git` *inside* the Remote Runtime's own workspace directory (a
safe wrapper around local git operations), not a GitHub-as-storage-backend integration.
`GitHubDeploy.client.tsx` is deploy/publish only, not bidirectional project file sync.
Neither is a `StorageProvider` today.

## Threat model — current reality, stated plainly

**No encryption at rest exists anywhere in this codebase today**, despite a real,
correctly-implemented WebCrypto module (`app/lib/crypto.ts`, AES-CBC via
`crypto.subtle` — a real primitive, not hand-rolled) existing in the tree. It is **not
imported by anything** (verified: zero call sites). This is not a claim of "encrypted
storage, just not wired up everywhere" — it means every credential and every project
file this app persists today is plaintext, full stop.

Confirmed plaintext storage locations:
- **Remote Runtime auth token**: `localStorage` (`runtime-mode.ts`,
  `bolt_remote_runtime_auth_token` key).
- **Provider API keys** (OpenAI, Anthropic, etc.): `localStorage`
  (`settings.ts`, `provider_settings` key).
- **GitHub token**: stored **twice**, both plaintext — `localStorage`
  (`github_connection` key, full connection object including the token) **and** a
  plaintext cookie (`githubToken`, `git:github.com`) via `githubConnection.ts`.
- **Project file content**: `androidFallbackStorage.ts`'s IndexedDB store, plaintext.
- **Device ID** (new this block): plaintext `localStorage`. Low sensitivity by design —
  it's a correlation ID, not a credential (see "Device identity" above).

**What this means concretely**: anyone with access to the browser profile/WebView
storage (a shared device, a device-backup tool, a browser extension with storage
permissions) can read every API key, the Remote Runtime token, the GitHub token, and
every project file, in full. Network transport for Remote Runtime is whatever the
configured `remoteRuntimeUrl` scheme is — HTTPS if the user configures an `https://`
URL, otherwise plaintext HTTP; the client does not enforce a scheme.

**Do not claim end-to-end encryption anywhere in product copy or documentation** until
this changes. If/when it does, the natural shape (not built this block, noted for
whoever picks this up): use `crypto.ts`'s existing AES-CBC helpers to encrypt
localStorage/IndexedDB values at rest, keyed by a passphrase or platform keystore-backed
key — never a hardcoded key, never an invented cipher. That work is genuinely separate
from the storage-provider abstraction this block adds and was not attempted here.

## What's still NOT built (explicitly, so it isn't assumed done)

- No real multi-project UI (there's no UI action to switch the active project
  independent of switching chats — the storage layer isolates correctly, but nothing
  user-facing exposes "projects" as their own concept yet).
- No real conflict-resolution UI (the `SyncState` type can report `'conflict'`;
  `RemoteWorkspaceSync.ts` already records conflict details — no UI surfaces them yet).
- No encryption at rest.
- No GitHub/Drive/iCloud provider implementation.
- Remote Runtime workspaces are still not project-scoped (`RemoteRuntimeProvider`'s
  `project` parameter remains conformance-only, same honest caveat as before — the
  Remote Runtime server has no per-project workspace concept; this round's migration
  only touched local Android fallback storage).

## Files added

- `app/lib/identity/device.ts` (+ `.spec.ts`)
- `app/lib/identity/project.ts` (+ `.spec.ts`)
- `app/lib/storage/types.ts`
- `app/lib/storage/providers/remote-runtime-provider.ts` (+ `.spec.ts`)
- `app/lib/storage/providers/local-provider.ts` (+ `.spec.ts`)
