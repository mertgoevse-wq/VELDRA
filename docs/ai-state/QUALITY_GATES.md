# VELDRA — Quality Gates

Run after a coherent implementation block, not after every edit.

```bash
npm run typecheck        # tsc --noEmit
npm run lint              # eslint (must be 0 errors; 2 known warnings OK)
npm test                  # vitest run — 501 passing as of 2026-08-16 (multi-file
                           # consistency audit round); run this yourself, don't just cite
                           # a stale count from a doc (see DECISIONS.md/current-session.md
                           # 2026-08-15: 9 pre-existing failures across 2 files were
                           # sitting undiscovered before that round). Note:
                           # app/lib/languages/capabilities.spec.ts's CodeMirror-resolution
                           # test can hit its default 5000ms timeout under full-suite
                           # parallel load (passes in ~1.7s standalone) -- a pre-existing
                           # flake, not a regression, if you see it fail in the full run.
npm run build:android     # Android SPA/Vite build
npx cap sync android      # sync web build into the Capacitor Android project
cd android && ./gradlew assembleDebug   # requires ANDROID_HOME — often unavailable in agent containers
```

## Environment notes
- `npm install` requires `--legacy-peer-deps` (unrelated pre-existing
  `wrangler`/`@remix-run/dev` peer conflict — not something to "fix" as
  part of Android work).
- **The project's actual package manager is pnpm** (`pnpm-lock.yaml` is
  committed and the pre-commit hook hard-requires `pnpm` on `PATH`), even
  though most day-to-day commands in this doc use `npm`/`npx` — that
  works for typecheck/lint/test/dev, but the pre-commit hook itself will
  fail with "pnpm not found" if it's missing. If you only have `npm` in a
  fresh container: `npm install -g pnpm` then `pnpm install --frozen-lockfile`
  (do this before your first commit attempt, not after a failed one — it
  takes ~2 minutes). A prior version of this note claimed "no committed
  lockfile" — that was wrong even at the time; ignore it if you see it
  cited elsewhere.
- Mixing an `npm install`-built `node_modules` with the committed
  `pnpm-lock.yaml`'s pinned versions produces real prettier-version drift
  (whitespace/quote-style only) — this is what the "lint:fix is safe"
  guidance above is about. Running `pnpm install --frozen-lockfile` once
  per environment avoids ever hitting it.
- Pre-commit hook (`.husky/pre-commit`) runs `pnpm typecheck` then
  `pnpm lint` project-wide (not scoped to staged files) — expect it to
  fail if ANY file in the repo has an error, not just yours.
- **Component-level (`.tsx`) tests now work** (2026-08-15, product-integration
  round, Phase 3) — `vite.config.ts`'s `plugins` array previously always used
  `remixVitePlugin()`, even under Vitest, which has no real dev-server/HTML
  page to inject its Fast-Refresh "preamble" into; importing ANY real `.tsx`
  component from a spec file threw `Remix Vite plugin can't detect preamble`
  (confirmed: no test in this codebase had ever imported a real component
  file before this fix). Fixed by swapping to plain `@vitejs/plugin-react`
  when `config.mode === 'test'`, following the exact same conditional
  pattern already used for `remixCloudflareDevProxy()` one line above.
  `ApprovalRequestWidget.spec.tsx` is the first real component-render test
  in the codebase (full `@testing-library/react` `render()`/`fireEvent`) —
  use it as the reference pattern for future component tests, including
  `// @vitest-environment jsdom` at the top of the file and importing
  `'@testing-library/jest-dom/vitest'` for the extended matchers (no global
  setup file registers them). Three more gotchas found writing Phase 4's
  `SubagentActivityWidget.spec.tsx` (full detail in `DECISIONS.md`'s Phase 4
  entry): import hooks from their own file, not the `~/lib/hooks` barrel
  (an unrelated hook's transitive import crashes under Vitest); a
  `matchMedia` mock needs both `addEventListener`/`removeEventListener` AND
  the legacy `addListener`/`removeListener` (framer-motion's own internal
  reduced-motion check uses the legacy pair); and `nanostore.listen()` only
  fires for changes made after subscribing, so render a store-watching
  component before seeding the store, not after.
- **Two more component-test gotchas** (2026-08-16, real end-to-end creation-loop round):
  - `import.meta.hot?.data.x` (only `.hot` optional-chained, not `.data`) throws under
    Vitest + `@vitejs/plugin-react` the first time a `.tsx` spec transitively imports
    something that pattern touches (`~/lib/webcontainer/index.ts`, or any of
    `files.ts`/`editor.ts`/`terminal.ts`/`workbench.ts`) — `import.meta.hot` is truthy
    there but `.data` isn't. Already fixed everywhere in the codebase (`?.data?.`
    throughout); if you see this error again from a NEW file, apply the same fix rather
    than mocking around it.
  - Rendering `TerminalTabs` (or anything using `react-resizable-panels`' `<Panel>`)
    fails with `"Panel size not found"` / `"must be rendered within a PanelGroup"` in
    jsdom — it needs real `ResizeObserver`-driven layout measurement jsdom can't provide,
    and a `ResizeObserver` stub alone isn't enough. Don't chase this: if the component you
    actually need to test doesn't itself depend on `Panel`, export it separately and
    render it standalone (see `RemoteCommandPanel.spec.tsx` for the pattern — it's a
    child of `TerminalTabs` with zero `Panel` dependency of its own).
  - Testing real IndexedDB-backed persistence (`androidFallbackStorage.ts` and anything
    that calls it, e.g. `RemoteWorkspaceSync.pushLocalWorkspaceToRemote`) needs the
    `fake-indexeddb` devDependency (`import 'fake-indexeddb/auto'` at the very top of the
    spec file) — jsdom has no native IndexedDB. See `creation-loop-e2e.spec.ts`.
