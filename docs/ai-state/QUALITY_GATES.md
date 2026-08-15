# VELDRA — Quality Gates

Run after a coherent implementation block, not after every edit.

```bash
npm run typecheck        # tsc --noEmit
npm run lint              # eslint (must be 0 errors; 2 known warnings OK)
npm test                  # vitest run — 397 passing as of 2026-08-15 (product integration
                           # round, Phase 1); run this, don't just cite a stale count from
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
- No committed lockfile as of this session — `npm install` pulls the
  latest matching semver range, which can drift prettier/eslint output
  from what was last committed. If the pre-commit hook's project-wide
  `pnpm lint` fails on files you didn't touch, that's this drift, not a
  regression you introduced — `npm run lint:fix` is safe (whitespace-only).
- Pre-commit hook (`.husky/pre-commit`) runs `pnpm typecheck` then
  `pnpm lint` project-wide (not scoped to staged files) — expect it to
  fail if ANY file in the repo has an error, not just yours.
