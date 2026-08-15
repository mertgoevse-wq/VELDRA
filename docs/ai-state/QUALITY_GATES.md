# VELDRA — Quality Gates

Run after a coherent implementation block, not after every edit.

```bash
npm run typecheck        # tsc --noEmit
npm run lint              # eslint (must be 0 errors; 2 known warnings OK)
npm test                  # vitest run — 413 passing as of 2026-08-15 (product integration
                           # round, Phase 5); run this, don't just cite a stale count from
                           # a doc (see DECISIONS.md/current-session.md 2026-08-15: 9
                           # pre-existing failures across 2 files were sitting undiscovered
                           # before that round)
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
