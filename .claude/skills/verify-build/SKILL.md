# Verify Build Skill

**Purpose:** Run complete build verification pipeline for VELDRA  
**Author:** VELDRA Core Team  
**Version:** 1.0.0  
**License:** MIT  
**Last Updated:** 2026-08-12

## Description

Executes the full verification pipeline before committing changes: TypeScript type-checking, ESLint, unit tests, and production build. Catches regressions early and ensures clean commits.

## When to Use

Invoke this skill:
- Before committing changes (`git commit`)
- After making changes to TypeScript/React code
- Before opening a pull request
- When debugging test or build failures
- As part of CI/CD verification

## Prerequisites

- Node.js ≥ 18.18
- pnpm installed
- Dependencies installed (`pnpm install`)
- Clean working directory (no uncommitted changes that could interfere)

## What It Does

Runs these commands in sequence (stops on first failure):

1. **TypeScript Type Check**
   ```bash
   pnpm typecheck
   ```
   Validates all TypeScript types are correct. No `any` escapes, no missing types.

2. **ESLint**
   ```bash
   pnpm lint
   ```
   Checks code style, unused imports, complexity rules, security patterns.

3. **Unit Tests**
   ```bash
   pnpm test
   ```
   Runs all spec files (`*.spec.ts`, `*.spec.tsx`). VELDRA has 273+ tests.

4. **Production Build**
   ```bash
   pnpm build
   ```
   Verifies Vite production build succeeds (no runtime imports of dev-only code, all chunks valid).

## Expected Output

### Success (All Pass)
```
✅ TypeCheck: Clean (0 errors)
✅ Lint: Clean (0 errors, 0 warnings)
✅ Tests: 273 passed, 0 failed
✅ Build: Completed successfully

All verifications passed. Safe to commit.
```

### Failure (Example)
```
❌ TypeCheck: 3 errors found
   app/lib/services/agentService.ts:45:12 - error TS2345: 
   Argument of type 'string' is not assignable to parameter of type 'AgentId'

⏸️  Remaining checks skipped (fix type errors first)
```

## Environment-Specific Behavior

### Desktop/CI
Runs full pipeline as documented above.

### Android-Specific Build
If Android changes detected (e.g., `capacitor.config.ts`, `android/` modifications), can optionally extend to:
```bash
pnpm android:sync
cd android && ./gradlew assembleDebug
```

(Not included by default—add `--android` flag if needed)

## Error Handling

| Stage | Common Failure | Fix |
|-------|----------------|-----|
| TypeCheck | Missing type import | Add import, fix type annotation |
| Lint | Unused variable | Remove or prefix with `_` |
| Test | Assertion failed | Review test logic, fix implementation |
| Build | Module not found | Check import paths, rebuild |

## Configuration

### Skip Stages (Advanced)
If you need to skip a stage temporarily (not recommended for commits):
```
--skip-typecheck  # Skip TypeScript validation
--skip-lint       # Skip linting
--skip-test       # Skip unit tests
--skip-build      # Skip production build
```

### CI Mode
```
--ci  # Enables strict mode, no interactive prompts
```

## Integration with VELDRA Workflow

This skill is invoked by:
- `.husky/pre-commit` hook (automatic)
- Manual invocation: `/verify-build`
- GitHub Actions CI pipeline
- Pre-push hooks (if configured)

## Exit Codes

- **0** — All verifications passed
- **1** — TypeCheck failed
- **2** — Lint failed
- **3** — Tests failed
- **4** — Build failed

## Performance

Typical execution time:
- TypeCheck: ~8-12 seconds
- Lint: ~4-6 seconds
- Tests: ~15-20 seconds
- Build: ~25-35 seconds

**Total:** ~60-75 seconds for full clean run

(Cached runs are faster—TypeScript incremental, Vite cached build)

## Examples

### Basic Usage
```
/verify-build
```

### With Android Build
```
/verify-build --android
```

### CI Mode (No Color, No Interactivity)
```
/verify-build --ci
```

### Skip Tests (Quick Type/Lint Check Only)
```
/verify-build --skip-test --skip-build
```

## Related Skills

- `/android-cycle` — Full Android sync + Gradle build
- `/architecture-check` — Validate against VELDRA architecture
- `/context-budget` — Estimate context window usage

## Maintenance

Update this skill when:
- New test runners added (e.g., E2E with Playwright)
- Build pipeline changes (new Vite plugins, Remix config)
- Lint rules updated (`.eslintrc` changes)

## Source

This skill is maintained in the VELDRA repository at:
`.claude/skills/verify-build/SKILL.md`

For implementation details, see:
- `package.json` scripts section
- `.husky/pre-commit` hook
- `.github/workflows/` CI definitions
