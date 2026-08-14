# VELDRA — Android State

## Shell architecture
```
.android-shell (position:fixed inset:0, flex column, padding-top: safe-area-inset-top)
├─ AndroidFallbackBanner        (in-flow, shrink-0 — fixed this session)
├─ .android-main (flex:1, position:relative)
│   ├─ .android-tab-content (position:absolute inset, per tab: chat/settings)
│   │   └─ chat tab: new-chat / history buttons (absolute, top:12px)
│   └─ Workbench panel (position:absolute inside .android-main since this
│        session's fix — was position:fixed/viewport-relative before)
└─ BottomNav (.mobile-bottom-nav, position:fixed, bottom:0, z-index:100)

Overlays outside flow (by design, per DECISIONS.md rule): ChatHistoryDrawer,
MobileFileTreeDrawer, MobileTerminalDrawer, ToastContainer.
```

## Runtime modes (app/lib/stores/runtime-mode.ts)
- `webcontainer` — desktop/browser only, full Node.js runtime, real dev server + preview.
- `android-fallback` — Android default. No command execution, no dev server.
  Chat + file editing work; AndroidFallbackBanner explains the limitation.
- `remote` — either platform, delegates command execution to a configured
  remote runtime URL.

## Open items (tracked via TaskList, see docs/ai-state/CURRENT_STATE.md)
- `AndroidSettingsPanel.tsx`/`GitHubSyncPanel.tsx` still have raw hex/Tailwind-palette
  colors bypassing skin tokens (audited, sized as its own follow-up — see DESIGN_SYSTEM.md).
- Composer toolbar's "database" icon button (memory/context feature?) visually
  inconsistent with the other 6 icon buttons in the same row (different fill/border
  treatment) — cosmetic, not yet triaged.
- No test harness exists for the Android shell/preview — quality gates are
  tsc/eslint/build/screenshot only, no automated regression coverage.

## Verified working (block 3, via real headless-Chromium screenshots against the
production build, see CURRENT_STATE.md for the two critical bugs found+fixed there)
- Tab switching (Chat/Files/Preview/Settings) via actual bottom-nav clicks.
- Chat welcome screen + Guided Build expandable form (Platform/Visual style/
  Integrations fields) via actual click.
- New-chat button via actual click.
- Settings panel (Runtime Mode, Android API Backend cards).
- Preview tab's empty state.

## Known permanent limitation
- Android WebView cannot run a Node.js WebContainer. Any live-preview or
  dev-server story on Android must go through either a remote runtime
  (already partially wired, see `remote` mode) or a fully static/blob-based
  render path that doesn't need `npm install`/a dev server.
