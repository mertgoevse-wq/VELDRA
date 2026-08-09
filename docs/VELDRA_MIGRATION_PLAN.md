# VELDRA Rebrand & Migration Plan

**Status:** Phase-1 inventory complete  
**Inventory date:** 2026-08-09  
**Baseline:** `main` at `fc1cfb6` (`docs: add android device test plan`)  
**Safety branch:** `backup/pre-veldra-rebrand-20260809`

**Confirmed identity decisions:** canonical GitHub repository `mertgoevse-wq/VELDRA`; Android namespace/application ID `com.veldra.app`; SSH is the intended push transport. The target repository currently responds `Repository not found`, so pushes remain blocked until it exists and the local key has access.

## 1. Verified baseline

This repository is an Android-first adaptation of `bolt.diy`, not yet an independent VELDRA product. The current implementation combines:

- Remix/Vite web application and Cloudflare-oriented server routes.
- Capacitor Android SPA build with a native Android project.
- Electron desktop packaging and a real Electron update flow.
- Runtime adapter layers for WebContainer, Android fallback, and remote execution.
- IndexedDB-backed Android workspace persistence.
- Remote Runtime file synchronization, allowlisted command profiles, live preview status, and remote Git workflow wiring.
- A provider registry with 22 provider implementations, including a real `@ai-sdk/amazon-bedrock` provider.
- An Android LLM API bridge client/design, but no production Android bridge backend or production chat wiring.

The repository has no `CLAUDE.md`, `.claude/agents`, `.claude/skills`, `AGENTS.md`, or installed project-specific skill instructions. `PROJECT.md` is the applicable repository-maintainer guidance.

## 2. Implemented vs specified vs open

| Area | Implemented | Specified/scaffolded | Open |
|---|---|---|---|
| Web/desktop application | Yes | — | Product identity still inherited from upstream |
| Android shell and debug APK pipeline | Yes | — | Release signing and device validation remain open |
| Android local file persistence | Yes | — | Native file picker/export remains open |
| Remote Runtime files/commands/preview/Git | MVP implemented | — | Production hardening and non-dry-run Git push remain open |
| Provider registry | Yes | — | Capability metadata and catalog governance are incomplete |
| Amazon Bedrock requests | Real provider implementation | Credential contract | Current static IDs/catalog accuracy and test coverage need work |
| Android LLM bridge | Client scaffold and API contract | Yes | Backend implementation and chat/model-selector wiring |
| Model updates | In-memory dynamic provider caching | — | Signed/versioned catalog manifest, validation, rollback |
| App updates | Electron startup + four-hour checks | — | VELDRA repository/release target and platform parity |
| Agents/skills/subagents | No dedicated product architecture found | Mentioned in product goal only | Provider-agnostic orchestration model |
| Budget/entitlement/routing | No product-level implementation found | Mentioned in product goal only | Requires explicit product/backend design |

## 3. Rebrand search matrix

### 3.1 Must review as product branding

These references should be migrated to VELDRA or to a deliberate compatibility constant:

- Root/package metadata: `package.json`, `wrangler.toml`, Docker image/target names, Electron metadata.
- App and platform labels: `android-index.html`, `capacitor.config.ts`, Android `strings.xml`, Android namespace/application ID, Electron `productName` and `appId`.
- User-visible copy: Android shell/settings, chat examples, route titles/descriptions, export/event-log labels, bug-report text, Git commit author labels.
- Repository-facing docs: `README.md`, `BRANDING.md`, `README_ANDROID.md`, `CURRENT_STATUS.md`, `BUILD_REPORT.md`, `TODO_NEXT.md`, `PORTING_REPORT.md`, `docs/**`, issue templates, workflow messages.
- Release/update targets: `electron-update.yml`, `app/lib/api/updates.ts`, `scripts/update.sh`, workflow repository links.
- Product assets: existing Bolt logos, favicons, social previews, desktop icons, Android launcher/splash resources, and generated copies in build output.
- External product URLs and GitHub repository defaults where VELDRA owns the destination.

### 3.2 Must preserve or handle deliberately

Do **not** blindly replace these:

- `LICENSE` copyright and attribution for StackBlitz/bolt.diy.
- Third-party package names, upstream URLs required for attribution, support links, and external provider URLs.
- `@bolt`/`bolt` technical namespaces only where they are library/API contracts rather than product identity.
- CSS design-token namespace `--bolt-elements-*` and UnoCSS `bolt` collection until a compatibility-safe token migration is planned.
- `.bolt` template/project conventions and `boltArtifact` protocol tags, which may be file-format or upstream compatibility contracts.
- Existing `bolt_*` local-storage/IndexedDB keys, prompt metadata markers, environment variables, Docker/Worker names, and export formats until each is classified as a compatibility contract or migrated with an explicit alias/version.
- `LICENSE`, any `NOTICE.md`/third-party notice files, copyright headers, attribution links, and upstream-logo provenance records; these are legal obligations or attribution surfaces, not disposable product copy.
- Historical commit messages and changelog entries.
- Generated/cache artifacts such as `vite.config.ts.timestamp-*.mjs`; they should be regenerated or excluded, not hand-edited.
- Original upstream logos when retained solely for attribution and licensing; replace only genuine product-facing assets.

### 3.3 Existing assets requiring visual inspection

- `public/logo.svg`, `public/logo-dark.png`, `public/logo-dark-styled.png`, `public/logo-light.png`, `public/logo-light-styled.png`.
- `public/favicon.svg`, `public/favicon.ico`, `public/apple-touch-icon*.png`, `public/social_preview_index.jpg`.
- `public/bolt-diy-android-*.svg`.
- `assets/icons/icon.icns`, `assets/icons/icon.ico`, `assets/icons/icon.png`.
- Android `mipmap-*`, `drawable-*`, launcher foreground/background, and splash resources.
- Provider icons under `public/icons/` are provider branding and should not be changed.

Asset work must first distinguish upstream attribution assets from app identity assets. VELDRA assets should use an original visual system and should not imitate or claim upstream logos.

## 4. Migration phases

### Phase A — Baseline and identity contract

1. Keep the current backup branch and clean `main` baseline.
2. Confirmed canonical VELDRA repository URL/owner: `git@github.com:mertgoevse-wq/VELDRA.git`; release channels still require private-repository setup and access.
3. Define canonical names:
   - Product: `VELDRA`
   - Repository/package slug: `veldra`
   - Android display name: `VELDRA`
   - Android namespace/application ID: `com.veldra.app`
   - Stable storage keys: preserve old keys and add a migration layer rather than silently losing user data.
4. Add a small identity/constants boundary so future UI, update, and diagnostics code does not hard-code product strings.

### Phase B — Branding and metadata slice

1. Replace user-visible product branding and product-owned links in small batches.
2. Create original VELDRA SVG logo, favicon, social preview, desktop icon source, Android launcher icon, and splash source; derive platform assets from those sources where tooling permits. Record asset provenance, license status, source inputs, generation commands, and visual verification.
3. Update Capacitor app label and Android resources; keep display-name rebranding separate from any package/application-ID migration.
4. Keep upstream attribution and MIT notices visible in docs and about/legal surfaces.
5. The requested new Android package identity is approved for the independent VELDRA app path. It is a separate install/release identity and must not be presented as a seamless upgrade of the old package.

### Phase C — Compatibility-safe identifiers

1. Separate product identifiers from technical compatibility identifiers.
2. Keep `bolt-elements-*`, `.bolt`, and `boltArtifact` until a versioned compatibility migration exists.
3. Add storage-key aliases/migrations for existing `bolt_*` local state.
4. Change Android namespace/application ID only with an explicit migration path. A new application ID installs as a separate app and cannot receive updates from the old package automatically; evaluate signing identity, Play Store continuity, legacy package coexistence, and local-data migration before scheduling that release.
5. Change GitHub remote/release ownership only after the canonical VELDRA repository exists and SSH access is available. The configured target is `git@github.com:mertgoevse-wq/VELDRA.git`; do not push until the probe succeeds.

### Phase D — Provider-neutral model capability contract

1. Extend `ModelInfo` with optional, provider-neutral capability metadata:
   - context and output limits;
   - reasoning/thinking availability and supported effort levels;
   - tool calling, vision/image, audio, structured output, and code suitability;
   - speed/cost/rate-limit/region/status/use-case metadata.
2. Keep provider adapters responsible for translating provider-native metadata into this contract.
3. Add safe provider-native effort/reasoning parameters to request options without exposing hidden chain-of-thought.
4. Replace brittle global regex reasoning detection with capability-aware behavior and provider adapters; retain conservative fallbacks.
5. Add catalog freshness/source/version metadata and tests.

### Phase E — Catalog and update architecture

1. Keep dynamic provider discovery where reliable; use static lists only as validated fallbacks.
2. Introduce a versioned catalog manifest schema with provider/model IDs, source, generated-at, minimum app version, schema version, and integrity metadata.
3. Validate schema, IDs, limits, provider ownership, trusted source, replay/downgrade rules, and signature/key-rotation policy before activation.
4. Store last-known-good catalog and atomically activate new catalogs; reject invalid updates and roll back to the previous valid version. Keep app binary update trust and model-catalog update trust as separate channels.
5. Add startup and background checks through a platform-neutral update service. Frequency can later be entitlement-configured, but no premium/developer bypass should be invented without backend authority.
6. Keep app binary updates separate from model-catalog updates.
7. Do not build a fake backend: use a local/static manifest first and document the future real endpoint contract.

### Phase F — Bedrock verification and integration

1. Verify current Bedrock model IDs and inference-profile requirements against AWS documentation before changing the catalog, including region availability, Marketplace/access prerequisites, and SDK compatibility.
2. Review the current JSON credential configuration and support credentials through server environment/secret bindings only; never bundle them in Android assets or commit them.
3. Keep Bedrock behind the same provider interface as every other provider.
4. Add no-credential tests for config parsing and provider selection; live requests require explicitly supplied credentials and an opt-in integration test.
5. Document region/access prerequisites and model availability caveats.

### Phase G — Android API bridge and orchestration

1. Implement the separately authenticated Android API backend only when deployment infrastructure and auth ownership are defined.
2. Wire models/chat/enhance through the backend client with cancellation, streaming, size limits, and clear not-configured UX.
3. Design agent/skill/subagent orchestration as provider-neutral server-side capabilities.
4. Add routing, budget, entitlement, and local/network/Android execution providers only behind explicit contracts and security boundaries.

## 5. Required decision gates

### Gate 1 — Android package identity

Decision: use the new `com.veldra.app` namespace/application ID. This creates a new Android application identity and prevents seamless upgrades from already-installed `com.mertgoevse.boltdiyandroid` packages. Treat VELDRA as a separate app/release line and evaluate signing identity, Play Store continuity, legacy package coexistence, and local-data migration before distribution.

### Gate 2 — Canonical GitHub/release destination

Decision: use `mertgoevse-wq/VELDRA` as a private repository and SSH transport (`git@github.com:mertgoevse-wq/VELDRA.git`). The target was probed and returned `Repository not found`; the remote may be configured locally, but pushing remains blocked until the private repository exists and the SSH key is authorized. Update checks and public links must be migrated only after that access gate passes.

### Gate 3 — Native asset generation

SVG sources can be authored in-repository. PNG/ICO/ICNS and Android density assets should be generated with an available, reproducible toolchain and verified by build checks; no binary placeholder should be committed.

## 6. Acceptance criteria

### 6.1 Plan slice

- The repository baseline, instruction inventory, architecture comparison, rebrand matrix, asset inventory, decision gates, and phased migration plan are documented.
- The planning commit remains preserved; later implementation slices are independently reviewable and reversible.
- The document passes `git diff --check` and receives a focused review.

### 6.2 First rebrand milestone

**Current slice:** product/build metadata and the Android package identity have been migrated to VELDRA; asset and broad documentation migration remain separate follow-up slices.

- No product-facing Bolt identity remains in VELDRA-owned metadata, titles, labels, docs, links, or app assets except explicitly marked attribution/compatibility references.
- Upstream license, copyright, attribution, external dependency names, and required compatibility contracts remain intact.
- Existing Android local storage is readable after the branding update.
- Web, Android SPA, Electron, remote-runtime, typecheck, lint, tests, and builds pass where the environment supports them.
- `git diff --check` is clean.
- Every meaningful slice has a focused commit and is pushed without force-push.
- Update targets are explicit and do not silently poll upstream bolt.diy as if it were VELDRA.
