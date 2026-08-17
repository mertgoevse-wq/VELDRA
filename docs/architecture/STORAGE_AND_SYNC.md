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

## Multi-device sync — what the three-way merge actually enables today

The mandate's target topology is `Galaxy ↕ OnePlus ↕ cloud/backend ↕ desktop`, built on the
real three-way merge (`app/lib/sync/three-way-merge.ts`), not a replacement for it.

**Identity separation, confirmed against real code, not just intent**: project identity
(`app/lib/identity/project.ts`), device identity (`app/lib/identity/device.ts`), and user
identity (would live in the Supabase Auth `auth.users` table from
`docs/architecture/ENTITLEMENT_AND_SECURITY.md` §3.5 once that's deployed — does not exist
today, so "user identity" is currently undefined, not merely unused) are three genuinely
separate types today, matching the mandate's explicit requirement. There is no fourth
"session identity" concept yet — with no sign-in flow, there is no session to be distinct
from a device. Chat identity (`getCurrentChatId()`) remains the practical stand-in for
project identity (see "Project identity" above), a pre-existing, honestly-documented
simplification this doc already covers — not new to this update.

**A real, if manual, multi-device path exists today**: any two devices (e.g. a Galaxy phone
and a desktop browser) configured in Settings → Runtime Mode to point at the *same*
self-hosted Remote Runtime server URL already sync through it, each running its own
three-way merge independently. This works for the same reason `git` does across independent
clones: each device keeps its *own* local last-known-common-state snapshot
(`androidFallbackStorage.ts`, per-project, per-device — IndexedDB is inherently per-browser-
profile/per-device, never shared) and compares *its own* base/local/remote triple on every
sync, so two devices don't need to coordinate with each other directly, only with the one
shared server each of them talks to. This was not previously stated anywhere as a multi-
device capability — it falls directly out of Block 1's three-way merge plus Remote Runtime
already being a real shared server, not a new mechanism built for this doc.

**What that path does NOT give you, honestly**:
- **No conflict visibility UI.** `computeThreeWaySyncPlan()`'s output (which files are
  genuine two-sided conflicts vs. safe fast-forwards) is computed correctly, but nothing in
  the Workbench surfaces it to a user beyond the existing generic `SyncState` status —
  `'conflict'` is a real, reachable value, not a UI to review *which* files conflict or
  choose a resolution.
- **Deletion propagation** follows whatever `three-way-merge.ts`'s own plan says (a file
  deleted on one side and unchanged on the other propagates as a delete; a file deleted on
  one side and *edited* on the other is a real conflict, not a silent delete) — this is
  correct per the merge algorithm, but again has no UI to confirm before it applies.
- **Rename handling is path-identity only** — the merge algorithm has no rename-detection
  heuristic (comparing content across differently-named paths); a rename looks like a
  delete-plus-create to the algorithm, same as `git diff` without `-M` would see it. Not a
  bug, a scope boundary worth stating so nobody assumes smarter rename tracking exists.
- **Requires a self-hosted Remote Runtime server reachable from both devices** — there is no
  managed, VELDRA-operated sync backend today. §3.5's Supabase entitlement backend is a
  *different* system (auth/entitlement, not file sync) and was not built to also host file
  sync — conflating the two would be a real architecture mistake for a future session to
  avoid, not a shortcut to take.

## Threat model — current reality, stated plainly

**No encryption at rest exists anywhere in this codebase today**, despite a real,
correctly-implemented WebCrypto module (`app/lib/crypto.ts`, AES-GCM via
`crypto.subtle` — a real, authenticated primitive, not hand-rolled) existing in the
tree. It is **not imported by anything** (verified: zero call sites). This is not a
claim of "encrypted storage, just not wired up everywhere" — it means every credential
and every project file this app persists today is plaintext, full stop.

`crypto.ts` was switched from AES-CBC to AES-GCM this round (still zero call sites —
this is a correctness fix to code that was already unused, not new wiring). AES-CBC has
no integrity check: tampered ciphertext decrypts silently into garbage plaintext instead
of failing, which matters once this module is actually protecting secrets. AES-GCM is
authenticated — `decrypt()` now throws on any tampering, verified by
`app/lib/crypto.spec.ts`'s round-trip/tamper/wrong-key tests (new this round, the
module's first test coverage). The `getKey()` shape was re-confirmed as the *correct*
one to eventually wrap with a platform keystore: it takes a raw key handle and does pure
AES-GCM encrypt/decrypt, with no key generation or key persistence of its own — that
separation of concerns (Keystore generates/holds a non-extractable hardware-backed key;
this module only uses a key it's handed) is exactly the shape a Keystore integration
needs, so nothing about `crypto.ts` itself blocks that follow-up.

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

**Re-audited this round (2026-08-17)** — still zero call sites into `crypto.ts` (unchanged),
plus additional plaintext locations found beyond the list above: the LLM provider API keys are
*also* in a plaintext, non-`HttpOnly` cookie (`APIKeyManager.tsx`'s `Cookies.set('apiKeys', ...)`,
readable via `document.cookie`), not only the `localStorage` copy; GitLab/Netlify/Vercel/Supabase
tokens follow the same plaintext `localStorage` pattern as GitHub; and the Android-specific
`bolt_android_api_backend_token` (`app/lib/android-api/backend-config.ts`) is plaintext in the
WebView's `localStorage` with no Keystore protection — this last one is the single highest-value
target for the Keystore plugin described below, since it's Android-only and already isolated
behind one small module. Settings' "export settings" feature (`importExportService.ts`) also
bundles every one of these plaintext secrets into a single downloadable file today — worth
revisiting (redact known secret keys, or export only once these are encrypted at rest) once the
Keystore work below lands, not before. None of this changes the threat model or the fix already
scoped below — it confirms the same gap, with more precise coverage.

**What this means concretely**: anyone with access to the browser profile/WebView
storage (a shared device, a device-backup tool, a browser extension with storage
permissions) can read every API key, the Remote Runtime token, the GitHub token, and
every project file, in full. Network transport for Remote Runtime is whatever the
configured `remoteRuntimeUrl` scheme is — HTTPS if the user configures an `https://`
URL, otherwise plaintext HTTP; the client does not enforce a scheme.

**Do not claim end-to-end encryption anywhere in product copy or documentation** until
this changes. If/when it does, the natural shape (not built this block, noted for
whoever picks this up): use `crypto.ts`'s AES-GCM helpers to encrypt
localStorage/IndexedDB values at rest, with the raw AES key itself sourced from a
platform-backed keystore — **not** a user passphrase (nothing in this app's UX today
prompts for one, and inventing that flow just to protect API keys the user typed in
anyway would be a worse experience for no real gain over device-lock-screen-level
protection). Concretely, on Android: a Capacitor secure-storage plugin backed by
`EncryptedSharedPreferences`/Android Keystore (none is a dependency today — confirmed by
audit; this is a real new native dependency to add, not configuration of something
already present) generates and holds a non-extractable hardware-backed AES key, and
`crypto.ts` wraps it for the actual encrypt/decrypt calls — the division of labor
`getKey()`'s shape already assumes. On desktop/web, where no OS keystore is reachable
from a browser, the honest fallback is: encrypt with a key derived from the browser's
own storage-partition isolation (i.e., accept that a compromised browser profile is a
compromised secret store, same as today) rather than fabricate an equivalent guarantee
Web platforms can't actually provide — do not claim Keystore-equivalent protection on
desktop/web.

**Recovery behavior once this is wired up** (document before shipping, so a lost key
isn't a surprise): a hardware-backed Keystore key cannot be exported or backed up by
design. App reinstall, keystore reset, or restoring `localStorage`/IndexedDB onto a
different device from a backup all mean the encrypted blobs become **permanently
unreadable** — there is no recovery path, by construction. For the specific data this
threat model covers (provider API keys, OAuth tokens, the Remote Runtime token), that's
an acceptable tradeoff: all of it is either re-typeable by the user or re-obtainable via
re-authenticating, never the *only* copy of something irreplaceable. Project file
content should **not** be encrypted under this same non-recoverable key for exactly that
reason — losing a project's only copy to a keystore reset would be a real data-loss bug,
not an acceptable security tradeoff; project files should stay in the sync/backup path
(`RemoteWorkspaceSync.ts`'s three-way merge, or a future cloud provider) rather than
behind a device-bound, non-recoverable key. That work is genuinely separate from the
storage-provider abstraction this doc otherwise covers and was not attempted here.

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
