# VELDRA — Legal & Provenance

**Slice 1, Loop 21, 2026-08-11.** This document exists so that "where did this come from, and what does that require of us" is answerable by reading one file, not by re-deriving it from memory each time. It supersedes nothing — `LICENSE`, `NOTICE.md`, and `BRANDING.md` remain the binding legal texts; this file is the audit trail and reasoning behind them, cross-referencing the verified data from Loop 20's `project/research/VELDRA-ARCHITECTURE-RESEARCH.md` §0.5 rather than re-deriving it.

**Ground rule applied throughout**: "commercially permitted," "no attribution required," and "no license obligation" are three different claims. Each row below states only what was actually verified, not what would be convenient.

---

## 1. Upstream base — bolt.diy

| | |
|---|---|
| **Source** | `stackblitz-labs/bolt.diy`, GitHub |
| **License** | MIT (verified: `LICENSE` file present in upstream, retained verbatim in this repo's own `LICENSE`) |
| **Usage** | Full-codebase fork; this repo's `app/` directory started as an unmodified copy |
| **Attribution requirement** | **Required** — MIT requires the copyright notice and license text to be retained in copies. Done via `LICENSE` (root) + `NOTICE.md` |
| **Commercial restriction** | **None.** MIT permits commercial use, modification, and closed-source distribution of derivative work, provided attribution is retained |
| **Action** | KEEP attribution (legally required, already correct). See §4 for what "already correct" was verified against |

**Verified diff, this loop's basis of fact** (method: shallow-cloned upstream at its current HEAD `2e254ac1` and diffed file paths + content against this repo's `app/` tree — see architecture research §0.5 for full method): of 483 files in VELDRA's `app/` (390 in upstream), **306 are byte-identical**, **84 are modified**, **93 are VELDRA-only new files**, **0 have been removed**. Top-level directories that exist only in VELDRA and not in upstream at all: `studio/`, `android/`, `project/`.

---

## 2. Categorization of Bolt/StackBlitz-related material (Section B)

Every Bolt/StackBlitz-touching element in the codebase falls into exactly one of these seven categories. This is the full inventory, not a sample — each category's grep was re-run this loop to confirm current counts, not assumed from memory.

### 2.1 Legally necessary attribution — **KEEP, do not touch**

| Item | Location | Why it must stay |
|---|---|---|
| MIT license text | `LICENSE` | The license itself |
| Copyright/attribution notice | `NOTICE.md` | States the Android-port copyright and the bolt.diy/StackBlitz origin, as MIT requires |
| `package.json` contributors field | `package.json:250-251` — `"name": "StackBlitz Labs and bolt.diy contributors"`, `"url": "https://github.com/stackblitz-labs/bolt.diy"` | Standard, low-visibility MIT attribution field |
| File-level copyright headers | `app/lib/hooks/StickToBottom.tsx:3`, `app/lib/hooks/useStickToBottom.tsx:3` — `Copyright (c) StackBlitz. All rights reserved.` | These two files are genuinely StackBlitz-authored code (not bolt.diy-community code); the header is the actual, correct copyright holder, not boilerplate to strip |

**Decision: KEEP all four, unconditionally.** Removing any of these would violate the MIT license's attribution requirement, not "clean up branding."

### 2.2 Technical protocol/API compatibility — **KEEP, RENAME only with a real migration plan**

| Item | Location (file count) | What it actually is | Risk of touching it |
|---|---|---|---|
| `boltAction`/`boltArtifact` XML-ish tags | 25 files reference `boltAction`/`boltArtifact`/`BoltAction`/`BoltArtifact` identifiers | The literal tag names the LLM's own system prompt instructs the model to emit (`<boltArtifact>`/`<boltAction>`), parsed by `message-parser.ts`/`action-runner.ts`. This is a live wire protocol between the system prompt and the parser, not a display string | **High** — renaming requires simultaneously changing every system prompt variant, the streaming parser, the action runner, and every test fixture that asserts on this exact tag shape, with a real risk of silently breaking in-flight parsing if the prompt and parser drift out of sync during a partial rename |
| `MODIFICATIONS_TAG_NAME = 'bolt_file_modifications'` | 3 files (`app/utils/constants.ts` + 2 consumers) | The tag name used to represent file-diff summaries injected into the conversation, matched by the parser the same way | Same category, smaller surface — lower risk than the above but still a live parser contract, not cosmetic |
| `editorOrigin` defaulting to `https://stackblitz.com` | `app/routes/webcontainer.connect.$id.tsx:5` | A `@webcontainer/api` embedding-protocol route (lets an external editor origin connect to a WebContainer session via postMessage) — the default value is a StackBlitz product URL, inherited from upstream's own use case of embedding in stackblitz.com | **Low** — isolated route, not reachable from VELDRA's own UI, only matters if something external calls it with a matching `editorOrigin`. See §3 for the recommended action (this one has a low-risk fix, unlike the two above) |

**Decision: KEEP `boltAction`/`boltArtifact`/`bolt_file_modifications` as-is.** These are internal protocol identifiers never rendered to a user (verified in Loop 19's audit — grep found zero user-facing occurrences of "Bolt" outside this category and the CSS-token category below). A rename is possible in principle but is a coordinated, multi-file, parser-and-prompt-simultaneous change with real regression risk for zero user-visible benefit — explicitly the kind of change the mandate's own "nicht funktionierende Architektur zerstören" warns against. Not scheduled this loop; flagged as a deliberate, documented non-action, not an oversight.

### 2.3 Internal historical identifiers — **KEEP (systemic), too large to rename safely**

| Item | Scope | Assessment |
|---|---|---|
| `bolt-elements-*` CSS custom-property design tokens | **146 files** reference `bolt-elements-*` classes/variables | This is the entire color-token system (`app/styles/variables.scss`'s ~80 variables, consumed via UnoCSS utility classes like `text-bolt-elements-textPrimary`) that Loop 19's own theme/skin architecture (`data-skin`, Obsidian) is already built on top of. Renaming the prefix would mean touching 146 files' class names simultaneously with zero functional change — pure churn, real regression risk (a single missed occurrence silently breaks styling), for a string that is never visible to a user (it's a CSS custom-property name, not UI text) |
| `attachBoltTerminal`, `escapeBoltTags`, `escapeBoltAActionTags` and similar internal function/variable names | `app/lib/stores/terminal.ts`, `app/lib/stores/workbench.ts`, `app/utils/projectCommands.ts`, `app/components/workbench/terminal/TerminalTabs.tsx`, `app/components/git/GitUrlImport.client.tsx`, `app/components/chat/GitCloneButton.tsx`, `app/utils/folderImport.ts` | Internal helper names tied to the same protocol tags in §2.2 — same reasoning applies |

**Decision: KEEP.** These are the internal implementation vocabulary of a working system, not branding. A rename is possible as a dedicated, isolated refactor slice in the future (mechanical, high file-count, needs full test-suite re-verification) but is explicitly **not** part of this loop's de-Bolting work, which targets user-visible identity per the mandate's own Section D ("Alle für Benutzer sichtbaren Begriffe müssen VELDRA sein... Technische Protokollnamen nur dann ändern, wenn es sicher möglich ist").

### 2.4 User-visible Bolt branding remnants — **VERIFIED CLEAN, nothing found**

Re-ran the same grep methodology from Loop 19 this loop (not trusted from memory): zero occurrences of "Bolt" as user-facing text anywhere in `app/` outside the categories above. The one previously-found issue — a naive "How can Bolt help you today?" → "How can VELDRA help you today?" word-swap — was already replaced with an original line ("What do you want to build today?") in Loop 19. No further action needed; this loop confirms the prior work holds, it does not repeat it.

### 2.5 Unnecessary Bolt-specific architecture — **one item found, low-risk fix scheduled**

`app/routes/webcontainer.connect.$id.tsx`'s default `editorOrigin` value of `'https://stackblitz.com'` (§2.2 above) was the one genuine case of "this exists because upstream needed it for their own product, and VELDRA doesn't have an equivalent use case." **Investigating it turned up a real, independent security bug**: `editorOrigin` was read directly from the query string and interpolated unescaped into an inline `<script>` string literal (`editorOrigin: '${editorOrigin}'`) — a single quote in the query param broke out of the string and injected arbitrary JavaScript into the response, a reflected XSS, not a branding issue. **Action, Slice 2, done**: removed the `stackblitz.com` fallback entirely (the route now requires an explicit `editorOrigin`, returning `400` without one), added strict origin validation (`new URL(value).origin === value`, http/https only — rejects any path/query/fragment/credentials smuggled into the parameter), and switched the embed to `JSON.stringify()` instead of raw string interpolation so the value can never break out of the script context regardless of what's in it. No internal VELDRA code calls this route (grep-confirmed) — it only matters if an external page embeds a VELDRA WebContainer session, and now does so safely or not at all.

No other "unnecessary Bolt-specific architecture" was found — the rest of the upstream feature surface (WebContainer execution, the chat/artifact pipeline, provider abstraction) is genuinely load-bearing VELDRA product functionality, not Bolt-specific dead weight.

### 2.6 Dead code — **not newly found this loop; prior findings stand**

Loop 8 already removed dead/fake `AndroidApiClient` methods; Loop 13 removed dead CSS in `diff-view.css`; Loop 15 hid dead terminal-tab controls. No new dead-code instances were found in this loop's Bolt-focused grep pass — a broader, non-Bolt-specific dead-code sweep is a separate concern (mandate Section AO), not part of this legal/provenance audit.

### 2.7 Real VELDRA original work — **the 93 new files + the 84 modified files**

Concentrated in (new-file counts from the verified diff in §1): `app/lib/orchestrator/` (13), `app/lib/modules/` (14), `app/lib/stores/` (10), `app/components/mobile/` (8), `app/lib/execution/` (7), `app/lib/adapters/` (6), `app/lib/.server/` (4), `app/lib/dev/` (3), `app/lib/android-api/` (3), Android-specific routes (`app/routes/api.android.*.ts` ×4, `android._index.tsx`, `api.update-manifest.ts`, `api.image.ts`), plus the entirety of `studio/`, `android/`, and `project/` (directories that don't exist in upstream at all). This is VELDRA's actual product surface — the orchestrator core, capability registry, execution/sandbox abstraction, Android shell, and internal documentation — and is the growing majority of what makes VELDRA a distinct product rather than a reskin.

---

## 3. Dependency license audit (Section C)

**Method**: `pnpm licenses list --prod` against the full production dependency tree (~1,500 packages), grepped for `gpl|agpl|sspl|bsl|business source|commons clause|unlicensed|unknown|proprietary|no license|copyleft` (re-run this loop, not reused from memory, to catch anything added since Loop 20).

| Package | License | Usage | Attribution requirement | Commercial restriction | Action |
|---|---|---|---|---|---|
| `jszip` | Dual `(MIT OR GPL-3.0-or-later)` | ZIP archive handling (project export/import) | MIT's standard attribution if MIT terms are elected | **None**, provided VELDRA elects the MIT branch of the dual license (which it does implicitly by not modifying/redistributing jszip itself under GPL terms) | KEEP — used under MIT, no action needed |
| `atomically` | Package.json declares no `license` field (pnpm reports "Unknown") | Atomic file writes (transitive dependency) | MIT's standard attribution | **None** | KEEP — verified by reading the package's own on-disk `license` file, which reads "The MIT License (MIT)"; the "Unknown" report is a metadata gap in the upstream package, not an actual licensing ambiguity |
| `stubborn-fs` | Same as above | Same as above | Same as above | Same as above | KEEP — same verification method, same conclusion |
| Everything else in the ~1,500-package production tree | MIT / Apache-2.0 / BSD (2- and 3-clause) / 0BSD / Unlicense / MPL-2.0 / CC0 / AFL | Various | Standard for each license family; none require source disclosure of VELDRA's own code | **None found** | No GPL/AGPL/SSPL/BSL/copyleft license was found anywhere in the current production dependency tree |

**Conclusion**: the current dependency tree carries **zero commercial-use blockers**. This is a snapshot of the tree as installed this loop — re-run `pnpm licenses list --prod` after any dependency addition, don't assume this table stays accurate indefinitely.

### 3.1 Fonts

VELDRA currently loads **Inter** from Google Fonts (`app/root.tsx:59`, `fonts.googleapis.com/css2?family=Inter`). Inter is SIL Open Font License — free for commercial use, no attribution requirement beyond what the OFL itself asks (retaining the OFL notice if the font file itself is redistributed, which loading from Google Fonts' CDN does not trigger). No other custom font files are currently bundled in the repository. Loop 20's design-system research (`project/research/VELDRA-DESIGN-SYSTEM.md` §3) recommends Space Grotesk (SIL OFL) as a future brand/display font and JetBrains Mono (Apache 2.0) as a future code font — both unambiguously free for commercial use if/when adopted; that recommendation is unchanged by this audit, just cross-referenced here.

### 3.2 Icons

VELDRA's icon system is UnoCSS `presetIcons` consuming the Phosphor (`@iconify-json/ph`) and svg-spinners (`@iconify-json/svg-spinners`) icon collections, both listed in the dependency audit above under their respective open licenses (Phosphor Icons is MIT-licensed; svg-spinners is MIT-licensed) — no separate action needed beyond what's already covered in §3's dependency table.

### 3.3 Brand image assets

The 7 assets under `public/assets/brand/` (`veldra-app-icon.jpg`, `veldra-brand-background.jpg`, `veldra-favicon.jpg`, `veldra-github-banner.jpg`, `veldra-hero-art.jpg`, `veldra-logo-master.jpg`, `veldra-social-preview.jpg`) are original commissioned/generated VELDRA assets supplied directly by the product owner, not sourced from any third party — no license audit applicable, VELDRA owns them outright. Documented in `BRANDING.md`.

### 3.4 External code snippets / copied implementations

No evidence of hand-copied third-party code snippets was found beyond the disclosed bolt.diy fork base itself (§1) — the 84 "modified" files are adaptations of upstream bolt.diy code (already covered by the MIT attribution in §1), not new copy-pasted material from elsewhere. If a future loop hand-ports an algorithm or snippet from one of the repository candidates in `project/research/VELDRA-REPOSITORY-CANDIDATES.md`, it must get its own row in this document at that time, with the specific source repo, license, and exact scope of what was copied — this document doesn't currently need such a row because nothing like that has happened yet.

### 3.5 Repository candidates from Loop 20

`project/research/VELDRA-REPOSITORY-CANDIDATES.md` already contains full LICENSE/SOURCE/USAGE/ATTRIBUTION/COMMERCIAL-RESTRICTION detail for ~50 candidate repositories across 18 categories — not duplicated here. That document's own top-line summary already flags the clear red flags (Skyvern, Essentia/essentia.js — both AGPL-3.0; madmom's bundled models — CC-BY-NC-SA) and the clean high-value candidates (Context7, Repomix, Stagehand, VoltAgent, promptfoo, PR-Agent, mem0, BackstopJS, reg-suit — all MIT/Apache-2.0). **None of these has been integrated into VELDRA as of this document** — Loop 20 was research-only, and no Slice in this loop has added a new dependency from that list either. When one is adopted, add a row to §3's table above at that time.

---

## 4. What changed vs. what was already correct

This audit found **no undisclosed or unattributed third-party code**, and **no dependency license blocking commercial use**. Nothing in `LICENSE`, `NOTICE.md`, or `BRANDING.md` needed correction — they were already accurate going into this loop (confirmed by re-verifying, not assumed). The one concrete action item this audit produced is the `stackblitz.com` default-URL fix in §2.5, executed in Slice 2.

## 5. Re-audit trigger

Re-run this audit (or at minimum §3's `pnpm licenses list --prod` grep) whenever: a new dependency is added, a repository candidate from `VELDRA-REPOSITORY-CANDIDATES.md` is actually integrated, or a hand-ported code snippet from any external source is added. Don't treat this document as a one-time artifact.
