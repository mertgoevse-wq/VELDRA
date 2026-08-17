# VELDRA — Current State

Last updated: 2026-08-17
Branch: `integration/veldra-bedrock-plus-claude-web`
HEAD: `5245a6b` (HEAD == origin, verified after every commit below)

**Note on labels**: this entry deliberately carries no new "Block N" number of its own -- per
this round's mandate, only the existing mandate block labels (Block 11, Block 4+5, Block 1,
Block 3, Block 6, Block 9+10, Block 13+14, Block 15+18) are used below, referenced by name where
each applies. This file's own prior "Block 14"/"Block 13"/etc. sequence (below) is a separate,
pre-existing internal numbering for this doc's own rounds, not touched or extended here.

## 2026-08-17 — Live Preview/Terminal fixes, Android icon/branding, media foundation, backend scaffold, verified current-HEAD APK

Continuation of the same autonomous mandate. Ten focused commits (`7ddffe6` through `5245a6b`),
each independently typechecked/linted/tested/pushed with `HEAD == origin` verified after every
one. A 7-agent parallel read-only discovery workflow (Live Preview, Terminal, remaining visual
screens, media foundation, entitlement/encryption, build/OOM, docs staleness -- each required to
cite file:line evidence) ran before any code was touched, so every fix below traces to a real,
verified finding, not a guess.

**Block 9+10 (visual identity) -- real fixes, not a full redesign, because most of the surface
was already correctly branded.** The audit found Header.tsx, WelcomeHero.client.tsx,
SplashScreen.tsx, and the favicon set already used real VELDRA marks -- no redesign needed there.
Two genuine gaps were found and fixed: (1) the Android adaptive launcher icon and native splash
graphic (`drawable/veldra_launcher_foreground.xml`, reused by `veldra_splash.xml`) were a literal
lightning-bolt silhouette left over from bolt.diy, just renamed with a `veldra_` prefix -- never
actually redrawn. Replaced with a real VELDRA "V" glyph; regenerated all five legacy pre-API26
mipmap PNG fallbacks via the project's existing `sharp` dependency (no new tooling installed);
deleted two confirmed-dead orphaned icon resources found in the process. (2) Genuine leftover
"bolt"/"BOLT DIY" user-visible strings: Settings > Data tab export filenames, the Debug Log
download's filename and file-content header, and the GitHub/GitLab deploy dialogs' default
untitled-project name -- all renamed to `veldra-*`/VELDRA. A dead `bolt` CSS class with zero
matching selector was also removed.

**Live Preview (absolute priority per the mandate) -- 6 real bugs closed**, all with file:line
evidence from the audit: (1) `onFileSave`'s "refresh previews after save" called a dead,
never-subscribed `PreviewsStore` singleton -- always a no-op; now delegates through
`workbenchStore.refreshAllPreviews()`, the store Preview.tsx actually reads. (2) A real
WebContainer `session-lost` event was silently dropped -- added a `sessionLost` atom, surfaced as
a genuine "disconnected" banner instead of a fake "still live" state. (3) The only "rebuilding"
signal that existed (`PreviewInfo.ready`) was computed but never read by any component -- now
drives a real "Rebuilding..." banner. (4) `rebuildStaticPreview()` silently no-op'd when
`index.html` disappeared (e.g. a project switch), leaving the *previous* project's static preview
on screen -- now resets state in that case. (5) Manually stopping a remote dev server via
Terminal's Stop button never told Preview, unlike starting one -- added the missing
`triggerRemotePreviewRefresh()` call. (6) `remote-runtime/src/commands.ts` applied the same
5-minute command timeout to `npm run dev`/`pnpm run dev` as to one-shot install/build -- a real
dev server was SIGTERM'd after 5 minutes regardless of activity; dev-server profiles are now
exempt.

**Terminal -- 2 more real bugs, plus the security boundary re-verified (not reopened) as genuinely
enforced twice**, server-side (a fixed 6-command allowlist, `shell:false`, no LLM text ever
reaches a shell string) and mirrored client-side. Bugs: `showRemoteCommandPanel`'s gating missed
"remote mode selected on a desktop where WebContainer is also available," letting real (silently
non-functional) `<Terminal>` tabs render instead of the safe panel -- simplified to gate on
`mode === 'remote'` alone. `RemoteSandboxProcess.output`'s `ReadableStream` captured its
controller only inside `start()`, so live stdout/stderr pushed after construction was never
delivered -- currently dormant (no live caller reaches it yet) but fixed via a proper push/close
handle.

**Block 13+14 (media foundation) -- the foundation types plus one real, working feature, not a
speculative persistence layer.** `app/lib/media/types.ts`: Asset/AnimationPreset type contract,
deliberately with no new IndexedDB store yet (the one real "save a generated asset" call site,
ImageStudioTab.tsx, still bypasses any such layer entirely -- confirmed by audit; adding storage
plumbing with no caller would be speculative infrastructure). `app/lib/media/pixelMorph/`: a real
canvas-based pixel-dissolve text engine (deterministic particle-pool state machine, 6 new tests)
implementing the mandate's "text -> dissolve -> pool -> reform" spec, wired into the home
greeting's rotating line via a new reusable `PixelMorphText` component (DPR-aware, pauses on
`visibilitychange`, real `prefers-reduced-motion` + low-end-device fallback to plain text, screen-
reader-accessible via an `aria-live` text mirror).

**Backend/entitlement (extends Block 4+5) -- Supabase Free selected after an evidence-based
comparison** against Cloudflare Workers+D1 and Firebase Spark (Firebase Spark's Cloud Functions
block all outbound network calls, a hard blocker for Play Billing verification; D1 has no RLS).
Wrote the real, undeployed contract: `supabase/migrations/0001_entitlements.sql` (RLS-enforced,
no client-reachable write path), `supabase/functions/entitlement/index.ts` (the Edge Function,
zero new deps added to package.json), `app/lib/entitlement/serverEntitlementClient.ts` (+6 tests
against a mocked fetch). Not deployed (no Supabase account/CLI access here) and not wired into the
live app (no sign-in flow exists yet) -- both stated plainly in
`docs/architecture/ENTITLEMENT_AND_SECURITY.md` §3.5, not implied otherwise.

**Storage encryption -- `app/lib/crypto.ts` switched AES-CBC to AES-GCM** (authenticated;
tampered ciphertext now fails loudly instead of decrypting to garbage), plus a related
`byteOffset`-assumption fragility fix in `decrypt()`. First test coverage this module has ever
had (4 tests, including a real tamper-detection test). `getKey()`'s shape reconfirmed as already
correct for a future Android Keystore wrap. `docs/architecture/STORAGE_AND_SYNC.md`'s threat model
now documents the concrete Keystore wiring shape and, explicitly, the recovery model (a
hardware-backed key is non-exportable by design -- acceptable for re-typeable credentials, NOT
acceptable for project file content).

**Multi-device sync doc** extended (not replaced) to document what the existing three-way merge
already enables: two devices pointed at the same self-hosted Remote Runtime server already sync
through it today, each running an independent three-way merge -- a real capability that existed
structurally but was never written down until now.

**Build/OOM -- root-caused and fixed with real measurements, not guesses.** The audit found the
actual live cause of "OOM late in long sessions": ~700MB+ RSS held by orphaned `vitest` worker
pools from earlier ad-hoc test runs in the same session (one detached from its own
`timeout | tail` wrapper). Added a `preandroid:webbuild` npm pre-hook (cross-platform-safe, covers
every real entry point -- `build-apk.mjs`, `build-android.mjs`, and a bare `npm run
android:webbuild` alike) to clear those before the memory-heavy step. Then empirically measured
the actual heap requirement rather than guessing: 896MB and 2048MB (this container's own
unconstrained V8 default) both produced clean, catchable `heap out of memory` errors at
increasing points in the build (transform phase, then Rollup chunk-rendering); 3072MB succeeded
end to end. `android:webbuild`'s `NODE_OPTIONS` is now set to the smallest value actually observed
to work.

**Current-HEAD APK -- genuinely built and verified this round, not the stale `a0489b6` artifact.**
Full pipeline run for real: `npm run android:webbuild` (8m4s, 4987 modules) → `npx cap sync
android` → `./gradlew assembleDebug` (`ANDROID_HOME=/opt/android-sdk`) → `BUILD SUCCESSFUL in
21s` (second run, mostly cached after a config fix; first full run was 2m3s). Verified:
- Path: `android/app/build/outputs/apk/debug/app-debug.apk`
- Size: 19,952,671 bytes
- SHA256: `5e82078f5a05e8f87bb2dc0f76a5db6734bb7e0b7b9b3e0887feca794e9d4da9`
- `applicationId com.veldra.app`, `versionCode 1`, `versionName "1.0"` (read from
  `android/app/build.gradle`, the same source Gradle itself built from -- `aapt dump badging`
  failed with `Illegal instruction`/SIGILL on this ARM64/proot host, a real toolchain-architecture
  limitation of this container, not worked around by faking the output)
- Built against commit `8d174ec` (one commit before this file's own final HEAD, `5245a6b` --
  the only difference between them is the `NODE_OPTIONS` value in the build script itself, zero
  effect on the compiled app bundle, so this APK accurately represents current HEAD's real
  behavior)

**Explicitly, honestly, NOT done this round** (do not describe as complete): no `adb`/physical-
device install or launch (no device attached to this container -- BUILD VERIFIED and CURRENT-HEAD
APK VERIFIED are both real and true; REAL DEVICE VERIFIED and VISUAL DEVICE VERIFIED are not, and
must not be conflated with the above). No browser tooling was available this session, so no
screenshot-based visual verification of any UI change (icon fix, branding fixes, pixel-morph
greeting) was possible -- all verified via direct code/asset inspection and the automated test
suite only.

**Tests**: 576/576 passing (80 files) — up from 560 at the start of this round (16 new: 4
crypto.spec.ts, 6 engine.spec.ts, 6 serverEntitlementClient.spec.ts). Typecheck clean throughout.
Lint clean throughout (same 2 pre-existing warnings as before this round, confirmed unchanged).

## Block 14 (2026-08-16) — three-way sync, model registry, Android release hardening

Continuation of the same autonomous mandate, picking up after Block 13. Covers five of
the mandate's own block labels (kept distinct here since they're a different numbering
scheme than this file's own sequential rounds): Block 1 (real three-way sync), Block 6
(APK build verification), Block 3 (security gate), Block 11 (model registry), and Block
4+5 (premium/entitlement/APK-hardening architecture). Five commits, `3f85ebf` through
`5790813`, each independently typechecked/linted/tested/pushed with `HEAD == origin`
verified after every one -- see each commit message for full detail; this entry
summarizes what changed and why, not a duplicate of the commit log.

**Block 1 -- real three-way sync (`app/lib/sync/three-way-merge.ts`, new).** Replaced
`RemoteWorkspaceSync.ts`'s naive two-way diff (push overwrote remote blindly; pull
treated *any* local/remote divergence as a conflict, even a safe fast-forward) with a
deterministic three-way merge against a persisted last-known-common-state snapshot
(`androidFallbackStorage.ts`, DB v1->v2, per-project, cleared on workspace reset). Push
now reads remote state first and won't clobber a file that changed remotely since the
last sync. 17 new unit tests for the merge engine itself; rippled into 3 other spec
files that had mocked the old blind-push behavior, now using realistic stateful fakes.

**Block 6 -- APK verification.** Rebuilt and verified the debug APK against the then-
current HEAD (`a0489b6`): 22,216,894 bytes, real build succeeded in 2m43s. Corrected a
stale `QUALITY_GATES.md` claim that `gradlew assembleDebug` needs an unavailable
`ANDROID_HOME` in agent containers -- it doesn't; the SDK is at `/opt/android-sdk` and
works fine here. **This specific verified APK is now stale again** -- see the "current
build status" note at the end of this entry for what's true as of `5790813`.

**Block 3 -- security gate.** Bounded git-history scan (all 1,900 commits) for
`sk-ant-`/`AIza`/`ghp_`/PEM-header/Slack-token patterns. Only `ghp_` had hits, all
confirmed placeholder text in docs/test fixtures (`ghp_xxxx...`, `ghp_ABCDEF...`), not
real secrets. Tree scan already clean from an earlier round. No remediation needed.

**Block 11 -- provider-neutral model registry (`2e19ceb`, `fe78376`).** Found and
fixed real, live defects, not just added infrastructure:
`app/utils/constants.ts`'s `DEFAULT_MODEL` was `'claude-3-5-sonnet-latest'` -- not a real
Anthropic model id (no `-latest` alias scheme exists) -- and was the default for every
new chat plus every server-side fallback; fixed to `claude-sonnet-5`.
`anthropic.ts`'s 3 hardcoded "essential fallback" models included
`claude-3-5-sonnet-20241022`, retired 2025-10-28; replaced with the current
Opus/Sonnet/Haiku tier. Fixed `getDynamicModels()` misreading the live API's
`max_tokens` field (the output-token cap) as the context window -- correct field is
`max_input_tokens`. Added `ModelInfo.status` (`'deprecated' | 'retired'`) with a single
`excludeRetired()` choke point in `manager.ts` so a retired model can never reach the
picker UI again. Also closed a real UI gap: `ModelSelector.tsx` had a fallback effect for
an invalid *provider* selection but none for an invalid *model* selection (a stale/retired
model name just rendered "Select model" literally) -- added the missing effect. New test
coverage where there was none: `manager.spec.ts` (LLMManager had zero tests -- provider
registration, the duplicate-name-skip branch, static/dynamic merge, retired-model
exclusion) and `ModelSelector.spec.tsx` (first test file for this component).

**Block 4+5 -- premium/auth/entitlement + APK hardening (`a45c284`, `5790813`).** A
discovery audit established real ground truth first: VELDRA has no backend server of any
kind today (confirmed by direct code search), so real server-side entitlement
enforcement isn't buildable in-repo right now -- `entitlement.ts`/`stores/entitlement.ts`
already correctly self-document as client-side/UI-only. Wrote
`docs/architecture/ENTITLEMENT_AND_SECURITY.md`: current-state audit, the target
Auth -> Session -> Device-Trust -> Server-Entitlement architecture with a concrete
phase-in order, and an honest accounting of what APK hardening can and can't do for a
WebView-hosted app. Fixed a real dormant bug the same audit found: two independent,
un-synced `entitlementTierStore` atoms existed (`stores/entitlement.ts` -- the one the
orchestrator actually reads -- and `dev/developer-mode.ts`, its own separate copy);
unified to one shared store. Separately, real Android release-build hardening, verified
by actually building both variants (not just editing files -- this caught two real bugs
along the way: an XML comment containing `--`, invalid per spec, and a manifest-merger
conflict against a bundled Cordova plugin's own manifest, both fixed and reverified):
`capacitor.config.ts`'s three dev-only flags (cleartext HTTP, mixed content, WebView
remote-debugging bridge) were applying unconditionally to every build including release --
now gated by a `VELDRA_ANDROID_DEBUG_BUILD` env var `build-apk.mjs` sets only for debug
builds. `AndroidManifest.xml`/`network_security_config.xml` hardened
(`usesCleartextTraffic`/`allowBackup` both to `false` for release), with a real
per-variant override at `android/app/src/debug/` restoring the permissive values for
debug builds only (Android's standard source-set overlay, not an env-var hack, since
these are static XML files `cap sync` doesn't touch). `build.gradle`: `minifyEnabled true`
+ `shrinkResources true` for release (R8 now actually runs -- verified: 12.8MB unsigned
release APK vs. 22.2MB unminified debug), plus real `signingConfigs.release` scaffolding
reading a gitignored `keystore.properties` (doesn't exist yet -- release still builds
unsigned until one is added, no regression from before).

### Current build status (as of `5790813`)

The Block 6 APK above (`a0489b6`, 22,216,894 bytes) predates all of Block 1/11/4+5 and
must not be cited as verifying current HEAD. A fresh end-to-end rebuild was attempted
multiple times this round and hit a real, reproducible constraint, not a fixable bug:
**the Vite web-asset build (`android:webbuild`) OOM'd three times in a row** late in this
session, after succeeding earlier in the same session -- consistent with this container's
memory filling up over a very long-running session rather than anything wrong with the
build itself or this round's code changes. What *is* independently verified for the
Android-hardening changes specifically: both `assembleDebug` and `assembleRelease`
compiled successfully at the Gradle/native level (confirmed via a placeholder web
payload, isolating the native/manifest/gradle-signing logic from the memory-heavy JS
bundling step) -- so the manifest merge, R8 minification, and signing-config plumbing are
structurally verified even though a full installable artifact wasn't produced this round.
Full JS/TS verification (typecheck, lint, 560/560 tests) passed at every commit above,
independent of the Android build. **Next session with more headroom should**: run
`npm run android:apk:debug` fresh (no code changes needed, just retry when memory allows)
and confirm the resulting APK still launches correctly on/off a real device.

## Block 13 (2026-08-16) — unified the two duplicate GitHub connection stores

Closes a real bug flagged (but deliberately deferred) in an earlier dead-code sweep this
session: `app/lib/stores/github.ts` and `app/lib/stores/githubConnection.ts` were two
independent in-memory atoms both backing GitHub connection state, reading/writing the
same `github_connection` localStorage key but never syncing with each other in a live
session.

A full call-site survey (run before touching anything, per the mandate's "prove the
blast radius" instruction) found the real picture was narrower and safer to fix than
initially assumed: `github.ts`'s own "server-OAuth" functions
(`initializeGitHubConnection`/`fetchGitHubStatsViaAPI`) had **zero callers anywhere** --
the real, live desktop behavior was always `useGitHubConnection.ts`'s own inline
client-PAT fetch logic, nearly identical to `githubConnectionStore.connect()` in the
other file. Fixed by rewriting `useGitHubConnection.ts` into a thin wrapper over
`githubConnectionStore` (the more complete implementation -- uses the shared
`gitHubApiService`, already has `connect`/`disconnect`/`fetchStats`/`updateTokenType`)
instead of a second parallel implementation. `github.ts` was then fully dead (its only
caller was the file just rewritten) and deleted outright. `GitHubTab.tsx`, the hook's
only consumer, needed zero changes -- the public `ConnectionState`/
`UseGitHubConnectionReturn` interface is unchanged.

New test coverage where none existed before (`useGitHubConnection.spec.ts`): proves
connecting through the hook is visible to a *separate* reader of the shared store (the
same access pattern `GitHubSyncPanel.tsx` uses) -- the actual bug this fixes, made into a
regression test, not just asserted in prose.

529 → 533 tests. Typecheck clean. Lint clean.

## Block 12 (2026-08-16) — StorageProvider hardening: exists/getMetadata/rename, and a real gap closed

Extended the `StorageProvider` contract (`app/lib/storage/types.ts`) with `exists()`,
`getMetadata()`, and `rename()`, plus a new `capabilities.rename` flag -- following the
same honesty pattern `capabilities.delete`/`conflictDetection` already established.
`LocalStorageProvider` genuinely supports rename (composed from its own real
read+write+delete primitives, atomic via one `saveAndroidFallbackWorkspace()` call).
`RemoteRuntimeProvider` genuinely does NOT (`capabilities.rename: false`) -- Remote
Runtime has no rename primitive server-side, and this provider's write/delete both
re-sync the whole local workspace rather than targeting one path, so there's no
well-defined "old path" to remove independent of local state; the method rejects with a
clear error rather than faking a composed rename that would silently desync.

**Real gap found and fixed in the same pass, not left for later**: `LocalStorageProvider`
was still ignoring its own `project` parameter (`_project`, unused) and always operating
on `getCurrentProjectId()`'s default, even though `androidFallbackStorage.ts` gained real
per-project isolation earlier this session. Its own file header even still claimed "no
per-project scoping today" -- stale the moment the isolation migration landed. Fixed:
every method now passes `project.id` through explicitly, so the adapter genuinely
respects whichever `ProjectIdentity` it's called with rather than silently defaulting to
whatever the current URL happens to be. New test proves this at the adapter layer
specifically (not just the underlying store).

`local-provider.spec.ts`'s existing tests also had a real test-isolation bug this
surfaced: `beforeEach` reset the DEFAULT project's storage while the tests themselves
used a project ID of `'any-project'` -- harmless before this fix (the adapter ignored
`project` anyway, so both always hit the same default-project storage), but would have
silently leaked state between tests once the adapter started respecting `project.id`.
Fixed alongside.

521 → 529 tests (8 new StorageProvider tests). Typecheck clean. Lint clean.

## Block 11 (2026-08-16) — real project identity + per-project Android storage isolation, with migration

Full detail: `docs/architecture/STORAGE_AND_SYNC.md` (updated). Summary:

- **`app/lib/identity/project.ts`** (new): `getCurrentProjectId()`/`getCurrentProject()`,
  kept structurally distinct from chat identity even though today it derives from
  `getCurrentChatId()` -- the mandate explicitly required not conflating the two at the
  type level just because that's the only real mapping that exists yet. Only this one
  function's body needs to change when a real project-grouping feature is built.
- **`androidFallbackStorage.ts`**: real per-project workspace isolation. Was one single
  global IndexedDB record (`key: 'workspace'`) shared by every chat; now keyed
  `workspace:{projectId}`, one real record per project. Migration is deterministic (a
  persisted marker, not timing): the first project to load after upgrade inherits any
  pre-existing legacy global data; every other/new project starts genuinely empty, never
  re-claiming already-migrated data. The legacy record is never deleted (append-only --
  if anything about the migration goes wrong, the original data is untouched and
  recoverable). `resetAndroidFallbackStorage()` now scopes to one project (was a
  whole-database wipe -- resetting "my workspace" no longer nukes every other project).
  Repurposed a previously-vestigial `activeWorkspace` session field (hardcoded to the
  literal string `'default'` everywhere, never read) to genuinely track it.
- **Real bug found and fixed while writing the migration tests**: `openDb()` opened a
  brand-new `IDBDatabase` connection on every single call and never closed any of them --
  a real, unbounded connection leak (present before this round too, just never exercised
  by a test that opened/closed the database repeatedly in one process until now). Fixed
  by caching a single long-lived connection, the standard IndexedDB usage pattern, rather
  than open-per-call-and-forget.
- All 10 existing call sites (`files.ts`, `workbench.ts`, `RemoteWorkspaceSync.ts`,
  `local-provider.ts`, `android-adapter.ts`, 3 Settings components) needed zero changes --
  the new `projectId` parameter defaults to `getCurrentProjectId()`, so existing callers
  keep working unchanged while genuinely getting per-project storage.
- New tests: `project.spec.ts` (first coverage for project identity), 4 new tests in
  `androidFallbackStorage.spec.ts` covering isolation, migration (including the
  "second project must NOT also inherit legacy data" case), and scoped reset.

## Block 10 (2026-08-16)
Branch: `integration/veldra-bedrock-plus-claude-web`

## Block 10 (2026-08-16) — evidence-based dead-code/dependency sweep

Per the mandate's explicit "prove deadness, don't blind-delete" rule: ran an
investigation pass first, verified every finding myself with independent greps before
removing anything. Removed, all confirmed zero references anywhere in `app/`,
`remote-runtime/`, or config files (not just "few grep hits" — genuinely zero):

- npm dependencies: `@phosphor-icons/react`, `react-beautiful-dnd` (+
  `@types/react-beautiful-dnd`), `jose`, `@tanstack/react-virtual`,
  `@radix-ui/react-progress`. (`@heroicons/react` was a false-positive candidate —
  looked unused on a naive `from '@heroicons/react'` grep, but is genuinely imported via
  a subpath, `@heroicons/react/24/outline`; correctly left alone.) Real duplicate-purpose
  pairs confirmed: `react-dnd`(+backends) is the live drag-and-drop library,
  `react-beautiful-dnd` was fully dead; `react-window` is the live virtualization
  library (used in `Dialog.tsx`), `@tanstack/react-virtual` was fully dead.
- `TEST_WORKBENCH_CONFIG` export (`app/lib/stores/workbench-config.ts`) — zero
  references anywhere, including its own tests (despite the name).

**Found but deliberately NOT fixed this block**: `app/lib/stores/github.ts` (desktop,
server-OAuth-proxied) and `app/lib/stores/githubConnection.ts` (Android, client-side PAT
entry) are real duplicate state — both read/write the same `github_connection`
localStorage key but keep independent in-memory atoms with no cross-sync, so a live
session can't see the other's connect/disconnect reactively. Not merged: they're two
genuinely different auth models (server-side-only token vs. client-supplied token), and
collapsing them is a product decision, not a mechanical fix. See ROADMAP.md P2.

514/514 tests (unchanged — this block removed dead code, added none), typecheck clean,
lint clean.

## Block 9 (2026-08-16) — multi-device/project sync foundation (interfaces + honest threat model, not a cloud platform)

Full detail: `docs/architecture/STORAGE_AND_SYNC.md`. Summary: added a `StorageProvider`
interface (`app/lib/storage/types.ts`) reconciling the three incompatible file-shape types
already in the codebase (`PersistedDirent`, `Dirent`, `RemoteFileItem`), with two real
adapters wrapping already-proven logic (`RemoteRuntimeProvider` over
`RemoteRuntimeClient`/`RemoteWorkspaceSync.ts`, `LocalStorageProvider` over
`androidFallbackStorage.ts`) — neither reimplements file I/O. Added device identity
(`app/lib/identity/device.ts`, `crypto.randomUUID()`-backed, plaintext localStorage,
nothing sends it anywhere today) since none existed before and the mandate required
separating device identity from project identity explicitly.

Two survey agents (run before implementing, per the mandate's evidence-first rule)
established the honest baseline this design had to be grounded in, not idealized against:
no stable "project" identity exists separate from a chat; Android fallback storage is
one single global workspace shared by every chat (not per-project); no device identity
existed; every credential (Remote Runtime token, provider API keys, GitHub token) is
stored in plaintext localStorage, with the GitHub token ALSO duplicated in a plaintext
cookie; a real WebCrypto AES-CBC module (`app/lib/crypto.ts`) exists but is imported by
nothing. All of this is written up plainly in the new doc rather than glossed over.

Deliberately not built, per the mandate's "no fake cloud integrations" rule: any GitHub/
Google Drive/iCloud `StorageProvider` implementation (no OAuth flow or conflict-resolution
UI exists yet to back one honestly), encryption at rest, or real per-project isolation for
`androidFallbackStorage.ts` (a genuinely separate, larger migration).

514/514 tests (was 501), typecheck clean, lint clean.

## Block 8 (2026-08-16)
Branch: `integration/veldra-bedrock-plus-claude-web` (single active branch — the
`claude/veldra-android-recovery-85j8ws` branch referenced below was cherry-picked in;
work directly on `integration/...` from here on, no new branches)

## Block 8 (2026-08-16) — multi-file consistency audit: one critical data-loss bug fixed, delete propagation closed

Deep audit of the file lifecycle (editor → workbenchStore.files → FilesStore → IndexedDB
persistence → RemoteWorkspaceSync → Remote Runtime → Preview), run via two parallel
investigation agents plus direct code tracing. Two real, previously-undiscovered bugs
fixed, both with zero prior test coverage:

1. **Critical, real data loss**: `Workbench.client.tsx`'s `useEffect(() =>
   workbenchStore.setDocuments(files), [files])` re-runs on EVERY change to
   `workbenchStore.files` — including a completely unrelated file. `EditorStore
   .setDocuments` rebuilt every open document's `value` unconditionally from the
   persisted `dirent.content`, so a user's in-progress unsaved edit in file A was
   silently reverted whenever ANY file changed anywhere (e.g. an agent writing file B
   in the background), while `unsavedFiles` kept claiming A was still "modified" —
   doubly misleading. Fixed: `setDocuments(files, unsavedFiles)` now preserves the
   in-memory `value` for any path present in `unsavedFiles`, and `WorkbenchStore
   .setDocuments` threads its own `unsavedFiles` through. `editor.spec.ts` (new, first
   test coverage for `EditorStore`) and `workbench.spec.ts` (new, first for
   `WorkbenchStore`) prove the fix on the real singleton wiring, plus prove externally-
   changed files the user HASN'T touched still refresh normally (no regression).
2. **Delete never propagated to Remote Runtime**: `pushLocalWorkspaceToRemote` only
   ever sent the file-write map; the server's `PUT /files` had no delete capability at
   all (`RemoteRuntimeClient.syncFiles` was pure overwrite). A file deleted locally
   stayed on the remote workspace forever. Compounding it, `pullRemoteWorkspaceToLocal`
   could silently resurrect that same locally-deleted file — its merge only skipped a
   remote file when local content *differed*, and a deleted file has no local content
   to differ from. Fixed end-to-end, real server change included (this repo does
   contain the actual `remote-runtime/` server, not just a client stub):
   `remote-runtime/src/files.ts`'s new `deleteWorkspaceFiles()` (path-traversal-safe,
   idempotent), wired into `PUT /workspace/:id/files` via an optional `deletedPaths`
   field; `RemoteRuntimeClient.syncFiles(files, deletedPaths?)` sends it;
   `pushLocalWorkspaceToRemote` now passes `deletedPaths` through; `pullRemoteWorkspaceToLocal`
   now records deleted-but-still-remote files as an honest conflict instead of
   resurrecting them. New tests: `remote-runtime/src/files.spec.ts` (real filesystem,
   same convention as `security.spec.ts`), `RemoteWorkspaceSync.spec.ts` (new — first
   coverage for this file — real fake-indexeddb-backed round-trip, only the HTTP
   client spied).

Also fixed the same round: a real stale-response race in `Preview.tsx`'s
`refreshRemotePreview` (two overlapping refreshes — e.g. a manual click landing while
the agent-start signal also fires one — had no ordering guard, so an older, slower
response could resolve after a newer one and clobber state back to stale data). Fixed
with a request-ID guard; regression test added to `Preview.spec.tsx`.

Investigated and deliberately NOT changed (real findings, low enough
confidence/severity/exposure to defer rather than fix speculatively): (a) file
**rename** does not exist as a feature anywhere in the codebase (no bug, just
unbuilt — the only way to "rename" today is delete + agent recreates under a new
path); (b) `files.ts`'s chat-ID-switch `MutationObserver` only reloads file-lock
state, not `files`/`deletedPaths`/`modifiedFiles` — flagged, not confirmed as an
actual bug, not traced further; (c) two concurrently-active `ActionRunner` instances
(one per artifact) have no cross-runner write-ordering guarantee for the same file
path — real gap, but the normal chat pipeline processes one artifact at a time, so
practical exposure looks low; not fixed without a concrete reproduction.

501/501 tests (was 489 at block start), typecheck clean, lint clean.
`app/lib/languages/capabilities.spec.ts`'s CodeMirror-resolution test is pre-existing-flaky
under full-suite parallel load (hits its default 5000ms timeout under contention; passes in
~1.7s standalone) — unrelated to this block, not touched, noted here so a future run isn't
mistaken for a regression.

## Block 7 (2026-08-16) — real end-to-end creation-loop proof, Live Preview hardening, Terminal/Preview state consistency

**Honest gap this block closed**: every prior round proved the Remote Runtime build/start
bridge piece-by-piece (action-runner.ts's sync/build/start unit tests, the Preview refresh
signal's own unit test) but nothing had ever stitched them into one proof that the actual
product loop — a user prompt turning into real files, a real remote dev server, and a real
rendered preview — works end-to-end. `app/lib/runtime/creation-loop-e2e.spec.ts` (new) now
does exactly that through genuine wiring: `workbenchStore.addArtifact()`'s real
`ActionRunner`, real `FilesStore.saveFile`, the real (unmocked)
`RemoteWorkspaceSync.pushLocalWorkspaceToRemote`, and a real `fake-indexeddb`-backed
`androidFallbackStorage` round-trip (new devDependency — this environment has no native
IndexedDB, matching the WebContainer boundary Node can't provide either). Only the Remote
Runtime HTTP server and WebContainer are mocked. Proves: file action → real workbench file
content → real sync carrying that exact content → real `npm run dev` → real Preview signal
→ real rendered iframe with the real URL → a second edit → re-sync carries the *new* content
→ signal fires again. A second test proves a real build failure is represented honestly
end-to-end (failed action state, no Preview signal, Preview still shows "Unavailable").

`Preview.tsx` had **zero** test coverage before this block (confirmed by search — first
`.spec.tsx` for this file ever). `Preview.spec.tsx` (new, 7 tests) proves it never invents
success: not-configured, running-with-no-URL-yet (never fabricates a URL), failed, network
disconnect, agent-triggered refresh, config cleared mid-session.

Terminal/Preview state consistency gap found and fixed: `TerminalTabs.tsx`'s
`RemoteCommandPanel` (the manual "Terminal Unavailable" fallback UI on Remote Runtime,
distinct from the agent's own start path) never told Preview when the user manually ran
`npm run dev`, nor when a running command exited/crashed — Preview stayed stale until a
manual refresh click. Fixed symmetrically: `triggerRemotePreviewRefresh()` now fires on a
successful manual dev-server start AND on any command exit event. `RemoteCommandPanel`
exported from `TerminalTabs.tsx` and tested in isolation (4 new tests) — rendering the full
`TerminalTabs`/`Panel` tree hit a genuine jsdom limitation (`react-resizable-panels` needs
real `ResizeObserver`-driven layout measurement jsdom doesn't provide); `RemoteCommandPanel`
itself has no dependency on the `Panel` tree, so isolating it is strictly better, not a
workaround.

Real bug found and fixed while writing the first `.tsx` component test that transitively
imports `~/lib/webcontainer`: `import.meta.hot?.data.x` was unguarded (`?.` only covered
`.hot`, not `.data`) across `files.ts`/`editor.ts`/`terminal.ts`/`workbench.ts`/
`webcontainer/index.ts`. Confirmed to actually throw under Vitest + `@vitejs/plugin-react`
(where `import.meta.hot` is truthy but `.data` isn't) — any such environment would have
crashed the whole app at module load. Fixed with consistent `?.data?.` chaining everywhere.

489/489 tests (was 476), typecheck clean, lint clean. Commits: `fa04fef`, `95f9b13`.

## Block 6 (2026-08-16) — real visual verification, Android production build was fully broken

**Correction to this doc's own "What's working" section below (block 3, unchanged since
2026-08-15)**: "App boots without crashing" was true when written but had gone stale --
the Android production build had been completely broken (permanent splash screen, never
rendered) since some point after block 3, and nobody had re-run a real
build+screenshot check since, so it went undetected through several rounds of code-only
verification (typecheck/lint/test, which a Vite chunk-splitting bug doesn't touch). Found
and fixed via this block's first real Android build+screenshot pass since block 3 --
environment now has a working headless Chromium (`playwright install-deps chromium`
resolved a missing `libatk-1.0.so.0` system library that blocked every earlier attempt
this session). Root cause and fix: commit `0daefef` -- four cross-chunk circular-reference
crashes found in sequence (`ai/mcp-stdio`'s node:child_process import broke the build
outright first, fixed separately as `e08e61e`; then three distinct "reading X before
initialization" React/CodeMirror crashes chasing different `manualChunks` boundaries).
Consolidated `vite.android.config.ts`'s manual chunking to one shared chunk for
everything React-adjacent, keeping only `vendor-shiki` split (confirmed safe, no React
dependency). Verified via real screenshot: welcome screen renders correctly (Guided
Build, provider/model selectors, composer, honest "Android Fallback Mode" banner). See
`DECISIONS.md`'s 2026-08-16 entry for the full crash-by-crash trail.

## Block 5 (2026-08-15) — core product + runtime foundation, session-crash recovery round

A prior session landed the real orchestrator runtime (WorkflowRun state machine, typed
events, real ApprovalPort/PolicyGate/RunStore — see `git log` commit `57f9029` and
`DECISIONS.md`) then crashed before documenting it or finishing the mandate. Recovered
from `git log`, not docs (none existed yet for that work). This block: wired
`spawnSubagentWithOrchestrator()` — the only call site reachable from a live chat
request — through the real `runWorkflow()` driver instead of bypassing it, and fixed a
real approval-deadlock bug found while doing so (FREE tier's zero-cost budget would have
hung the call forever on an unanswerable approval). See `current-session.md` and
`DECISIONS.md` for full detail. No visual/UI work this block; no UI exists yet that could
consume any of this (still gated behind `VELDRA_USE_ORCHESTRATOR`, off by default).
Typecheck/lint (scoped)/test (395/395) verified; no headless browser used or needed since
nothing user-visible changed.

## Block 4 (2026-08-15) — product evolution pass, no headless browser this block

No Chromium/Playwright binary was available in this container (a fresh `npx playwright
install chromium` timed out after 90s) — unlike block 3 below, this block's verification
is typecheck/lint/build plus direct code reading and cross-referencing actual call sites,
NOT visual/screenshot confirmation. Flagging this explicitly rather than silently
skipping it. A future session with browser access should visually confirm:

- Android: selecting the "Code Workspace" or "Project Overview" template now seeds real
  Vite+React starter files (previously only switched tabs).
- Android: the bottom nav no longer disagrees with the Workbench panel's actual visibility
  when it's opened by an artifact-link click or AI file streaming (was: nav says "Chat",
  screen shows Files).
- `UserMessage` renders identically regardless of whether the AI SDK gave it string or
  array content (previously: different alignment, avatar presence, image ordering).
- `SubagentActivityWidget` actually appears in the chat when a subagent is running.

What changed (see `DECISIONS.md`'s 2026-08-15 section and git log for full detail):
deterministic starter-code seeding for Android's project-shaped templates
(`app/lib/templates.ts`, `Chat.client.tsx`, `BaseChat.tsx`); the `activeTab`/
`showWorkbench` state-truth fix (`AndroidShell.tsx`); `UserMessage.tsx` layout
unification; a further hardcoded-hex-to-design-token sweep (`Preview.tsx`,
`Workbench.client.tsx`, `ToolInvocations.tsx`, `SupabaseConnection.tsx`). Orchestrator
UI and unifying desktop's `/git`-route starter import were investigated and explicitly
deferred — see `DECISIONS.md` for why.

## What's working (verified in block 3 via real headless-Chromium screenshots + clicks
against the actual production `build/client` output, served with `vite preview`)
- App boots without crashing and renders the Chat/Files/Preview/Settings tabs correctly.
- Bottom-nav tab switching actually shows/hides the right content (was broken, see below).
- Chat welcome screen (`WelcomeHero.client.tsx` + "Guided Build" flow) renders and is
  interactive: expands to show Platform/Visual style/Integrations fields.
- New-chat button, Settings panel (Runtime Mode card, Android API Backend card) render
  correctly.
- Preview tab's "Live Preview Unavailable" empty state renders correctly (expected in
  android-fallback mode with no configured Remote Runtime).
- `tsc` / `eslint` clean (2 pre-existing warnings). `build:android` + `cap sync android` clean.

## Critical bugs found + fixed this block (both pre-existing, NOT introduced by prior
session's banner fix — found via first-ever real screenshot verification in this repo)
1. **App-crashing production bug**: `vite.android.config.ts`'s `manualChunks` put
   `react`/`react-dom` in an isolated `vendor-react` chunk while `vendor-ai`
   (`@ai-sdk/react`'s `useChat`) and `vendor-ui` (framer-motion/Radix) — both of which
   need React — were separate chunks. Rollup's cross-chunk reference resolution created
   a circular reference where `vendor-ai` read its React binding through `vendor-ui`
   before it was initialized: `Cannot read properties of undefined (reading 'useState')`,
   thrown on every single load, 100% reproducible, full white-screen crash. Fixed by
   merging all React-consuming vendor libs into one `vendor-react` chunk.
2. **Workbench always full-screen regardless of active tab**: `android.css`'s Workbench
   override forced `left: 0 !important; right: 0 !important` unconditionally on the
   Workbench panel. That overrides the component's own `left-0` (open) / `left-[100%]`
   (closed) toggle classes with `!important`, so the Code/Diff/Preview/Export toolbar and
   Files button rendered on top of the Chat tab at all times, regardless of
   `workbenchStore.showWorkbench`. This is almost certainly the actual cause of the
   original bug screenshot's "large unused editor area dominates the screen" / "Files
   control in wrong layer" symptoms — predates this session entirely. Fixed by removing
   the `left`/`right` override and letting the component's own classes govern it (Android
   already forces `w-full` via `isSmallViewport`, so `left:0`+`width:100%` reaches the
   right edge naturally when open).

## Fixed in earlier blocks this session (still valid, not re-verified visually until now
but confirmed still working in this block's screenshots)
- `AndroidFallbackBanner` moved from `fixed`/`z-50` to normal flex flow (no longer
  escapes safe-area padding or floats over the Workbench).
- Back button now closes the chat-history drawer instead of exiting the app.
- 3 full-screen modals (GitCloneButton, BranchSelector, LoadingOverlay) raised from
  `z-50` to the shared `z-max` scale (were under `.mobile-bottom-nav`'s `z-index:100`).
- Copy-code button and other hover-only affordances forced visible on Android (no
  `:hover` in WebView).
- 3 undersized close buttons bumped to 44px touch targets.
- Static live preview: multi-file relative-reference resolution + debounced
  auto-regeneration on file edits (`app/lib/preview/staticPreviewBundle.ts`).
- `.android-card`/`.android-mode-badge`/5 button radii wired to `--veldra-radius-*`.

## Known blockers
- No Android SDK in this container (`ANDROID_HOME` unset) — `gradlew assembleDebug`
  resolves all deps fine, fails only at the SDK-location check. Real APK build and
  on-device testing need an environment with the SDK, or the user's own setup.
- Visual verification this block used headless Chromium (Playwright + the environment's
  pre-installed browser) against the actual production `build/client` output via
  `vite preview --config vite.android.config.ts`, at a Pixel 7 viewport/UA — this is
  the same static assets Capacitor ships into the WebView, so it's a strong proxy, but
  it is not a real device/WebView and cannot catch WebView-specific quirks (Capacitor
  plugin bridges, Android-specific touch/keyboard behavior, hardware back button).

## Architecture entry points (don't re-derive these)
- Android shell root: `app/components/mobile/AndroidShell.tsx`
- Android-only CSS overrides: `app/styles/android.css`
- Android Vite config (manualChunks, entry): `vite.android.config.ts`
- z-index scale (canonical): `app/styles/z-index.scss`
- Runtime mode (webcontainer / android-fallback / remote): `app/lib/stores/runtime-mode.ts`
- Skin store: `app/lib/stores/skin.ts` (`data-skin` attribute on `<html>`)
- Preview: `app/components/workbench/Preview.tsx`, `app/lib/preview/staticPreviewBundle.ts`
- Welcome/home screen: `app/components/chat/WelcomeHero.client.tsx`
- Orchestrator (feature-flagged, off by default): `app/lib/orchestrator/`

## How to screenshot-verify the Android build yourself (no device needed)
```bash
npm run build:android
npx vite preview --config vite.android.config.ts --port 5183 &
# then Playwright/chromium at devices['Pixel 7'], navigate to http://localhost:5183/
```
This serves the exact static output Capacitor bundles into the APK.
