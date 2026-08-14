# VELDRA Session Checkpoint — 2026-08-14

## Latest Commit

```
b591106 feat(android): auto-start static preview when index.html is available
```

## APK

```
android/app/build/outputs/apk/debug/app-debug.apk (22 MB)
```

## Environment

- Platform: ARM64 proot-Debian (Termux)
- Node: 22.23.2
- Java: OpenJDK 21.0.12
- Android SDK: /opt/android-sdk (platforms;android-35, build-tools;34.0.0)
- AAPT2: qemu-x86_64-static wrapper at /opt/aapt2-wrapper/aapt2
- ADB: not available

## Build Commands (working)

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-arm64
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk

# Web build
NODE_OPTIONS='--max-old-space-size=4096' npx vite build --config vite.android.config.ts
# Sync
./node_modules/.bin/cap sync android
# APK
cd android && ./gradlew assembleDebug --no-daemon
```

## Completed Work (this and previous session)

### Android UX
- Inline splash screen before React mounts
- Non-blocking Google Fonts loading
- Connection status banner (yellow when no backend)
- Auto-navigate to Preview tab when AI writes index.html
- Auto-start static blob-URL preview on Capacitor (no manual button)
- Haptic feedback on bottom-nav tab switch
- Template badge (dismissable) shows active template

### Template System
- 8 templates: AI Chat, Code Workspace, Agent Workspace, Model Lab, Prompt Studio, Project Overview, Terminal Focus, Monitoring
- Template selection wires to workspace layout (`workspaceLayoutStore`)
- AndroidShell tab switches on template apply (`panelToTab()`)
- Template picker on mobile welcome screen

### Skin System (11 skins)
- Complete per-skin token coverage: typography, spacing, radius, shadows, backdrop-blur, borders, motions, component geometry
- Skins: veldra (default), glass, liquidglass, spatial, neomorphism, claymorphism, skeuomorphism, minimalism, maximalism, brutalism, obsidian
- Visual preview swatches in settings skin picker
- New tokens: --veldra-font-size-base, --veldra-font-weight-*, --veldra-btn-*, --veldra-input-radius, --veldra-card-padding, --veldra-accent

### Build Activity Feed
- `buildActivityStore` (nanostores) tracks AI activity phases
- `BuildActivityFeed` component: collapsible list with phase icons, elapsed time, expandable details
- `useBuildActivity` hook: emits Planning → Generating phases on streaming start/end
- ActionRunner emits Writing/Running/Building/Previewing per action type
- Displayed above streaming indicator in Messages.client.tsx

### Design System
- `src/design-system/tokens.ts` — TypeScript token vocabulary
- `src/skins/skin-previews.ts` — preview metadata per skin
- `src/templates/index.ts` — template definitions (also at `app/lib/templates.ts`)
- `app/lib/stores/template.ts` — activeTemplateStore
- `app/lib/stores/workspaceLayout.ts` — computed layout from template

### Performance
- Chat.client chunk: 1,943KB → 1,480KB (chunk splitting)
- vendor-shiki (9.3MB) is lazy-loaded with workbench
- Circular chunk dependency fixed

## Bundle Chunks (current)
| Chunk | Size |
|-------|------|
| vendor-shiki | 9,329KB (lazy w/ workbench) |
| app-workbench | 1,579KB |
| Chat.client | 1,483KB |
| vendor-codemirror | 764KB |
| vendor-markdown | 403KB |
| vendor-ui (framer+radix) | 379KB |
| android-index CSS | 378KB |

## Quality Gates

| Gate | Status |
|------|--------|
| TypeScript (tsc --noEmit) | 0 errors |
| ESLint | 0 errors, 2 pre-existing warnings |
| Vite Android build | Success |
| Capacitor sync | Success |
| Gradle assembleDebug | BUILD SUCCESSFUL |
| APK exists | Yes (22 MB) |

## Remaining Work (prioritized)

### P1 — Core Functionality
1. Checkpoint-based workflow visualization (Planning → Generating → Preview flow with richer UI)
2. Model selector accessibility on Android (currently nested in collapsed ChatBox)
3. Better empty states in Preview tab when no project loaded
4. Wire BuildActivityFeed more granularly (per-file activity events)

### P1 — Product Polish
5. Desktop skin token coverage for Sidebar, Header, EditorPanel (mostly done via shortcuts)
6. `--veldra-btn-*` tokens applied to actual Button component
7. Improve WelcomeHero to better communicate VELDRA capabilities

### P2 — Architecture
8. Orchestrator Phase 2 (approval/policy UI wiring)
9. Remote Runtime connectivity test from Android
10. Amazon Bedrock provider abstraction design
11. Entitlement model foundation (free/premium)

### P3 — Branding / Cleanup
12. Rename remaining `bolt-diy-` identifiers to `veldra-`
13. Audit user-facing strings for bolt/stackblitz references
14. Remove/update mobile.scss bolt.diy reference comments

## Architecture Notes

- Android SPA: MemoryRouter, entry: `src/android-main.tsx`
- Skin system: `data-skin` on `<html>`, tokens in `app/styles/variables.scss`
- Dual orchestration: legacy SubagentService (default) + VeldraOrchestratorHost (feature-flagged)
- State: Nanostores (skinStore, themeStore, runtimeModeStore, workbenchStore, activeTemplateStore, buildActivityStore)
- Preview: static blob-URL for Android, WebContainer/Remote Runtime for desktop
- Build: Vite SPA → Capacitor sync → Gradle APK
