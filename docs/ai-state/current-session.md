# VELDRA — Current Session Handoff

Read this first, then CURRENT_STATE.md / ANDROID_STATE.md / ROADMAP.md / DECISIONS.md
for detail. This file is a pointer, not a duplicate — keep it short.

## Where things stand
Branch `claude/veldra-android-recovery-85j8ws`. Three blocks of Android recovery work
done so far (see git log for exact commits):
1. Fixed the fallback-banner/workbench-toolbar overlap (the original bug screenshot's
   most visible symptom).
2. Live preview reactivity + multi-file resolution, Android touch/layering audit fixes,
   partial skin-token wiring, this ai-state/ system.
3. **Found and fixed two pre-existing, more severe bugs** via this session's first-ever
   real screenshot verification (headless Chromium against the actual production
   Android build): an app-crashing chunk-splitting bug, and the Workbench panel
   rendering full-screen on top of every tab regardless of state. See CURRENT_STATE.md
   for full detail — this second bug is almost certainly the real explanation for the
   original screenshot's "editor area dominates the screen" complaint.

## What's next (highest value, not yet started)
- Real device / APK build+install — blocked on Android SDK in this environment.
- `AndroidSettingsPanel.tsx`/`GitHubSyncPanel.tsx` hardcoded-color cleanup (skin tokens).
- Service-Worker-backed virtual-FS preview (real live dev-server-less multi-file preview,
  beyond the current blob-URL resolver).
- Template system: verify template selection actually changes workspace composition.

## How to verify without a device
See "How to screenshot-verify" in CURRENT_STATE.md — `vite preview` serves the exact
static output Capacitor ships, and a headless Chromium (Playwright, pre-installed in
this environment at `/opt/pw-browsers`) can screenshot/click it at a Pixel 7 viewport.
Use this before claiming any Android UI change is fixed — two of this session's bugs
were invisible from source code alone.
