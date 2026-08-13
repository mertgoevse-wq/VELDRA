# Android Build Cycle Skill

**Purpose:** Complete Android sync and Gradle build verification  
**Author:** VELDRA Core Team  
**Version:** 1.0.0  
**License:** MIT  
**Last Updated:** 2026-08-13

## Description

Executes the complete Android build cycle: Vite web build, Capacitor sync, and Gradle debug APK compilation. Verifies that Android-facing changes work end-to-end on the native platform.

## When to Use

Invoke this skill:
- After changes to UI/components (verify mobile rendering)
- After changes to Android-specific adapters (`app/lib/adapters/`, `runtime-mode.ts`)
- After changes to Capacitor configuration
- Before pushing Android-related PRs
- When debugging Android-specific issues

## Prerequisites

- Node.js ≥ 18.18
- pnpm installed
- Android SDK configured
- Java JDK 21 (for Gradle)
- Capacitor dependencies installed

## What It Does

Runs these commands in sequence:

1. **Web Build**
   ```bash
   pnpm run android:webbuild
   ```
   Builds the Vite SPA targeting Android WebView. Uses `vite.android.config.ts`.

2. **Capacitor Sync**
   ```bash
   npx cap sync android
   ```
   Copies web assets to `android/app/src/main/assets/public/`, updates native dependencies.

3. **Gradle Debug Build**
   ```bash
   cd android && ./gradlew assembleDebug
   ```
   Compiles native Android code, generates `app-debug.apk`.

## Expected Output

### Success
```
✅ Web Build: Completed in 28.3s
   - Generated 245 chunks
   - Total size: 3.2 MB

✅ Capacitor Sync: Android synced
   - Copied web assets
   - Updated plugins

✅ Gradle Build: BUILD SUCCESSFUL in 1m 38s
   - APK: android/app/build/outputs/apk/debug/app-debug.apk
   - Size: 12.4 MB
   - Min SDK: 23 (Android 6.0)
   - Target SDK: 35 (Android 15)

Android build cycle complete. APK ready for installation.
```

### Failure (Example)
```
✅ Web Build: Completed
✅ Capacitor Sync: Completed
❌ Gradle Build: FAILED

FAILURE: Build failed with an exception.

* What went wrong:
Execution failed for task ':app:mergeDebugResources'.
> A failure occurred while executing com.android.build.gradle.internal.tasks.Workers$ActionFacade

Error: Duplicate resource found...

⏸️  Fix Gradle errors, then retry.
```

## Environment Requirements

### Memory
Gradle build requires ~4-6 GB RAM. Set in `gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx4g
```

### Disk Space
- Web build artifacts: ~20 MB
- Android build artifacts: ~500 MB (first build)
- APK output: ~10-15 MB

## Platform-Specific Notes

### Termux (ARM64 Linux)
Works, but slower than native desktop due to emulation. Gradle daemon may hit memory limits—use `--no-daemon` flag if needed:
```bash
cd android && ./gradlew assembleDebug --no-daemon
```

### macOS/Linux
Full support. Ensure Android SDK `ANDROID_HOME` environment variable set.

### Windows
Use `gradlew.bat` instead of `./gradlew`. Path separators may differ.

## Configuration

### Build Variants
```
--release    # Build release APK (requires signing config)
--bundle     # Build AAB instead of APK
--clean      # Clean before build
```

### Gradle Options
```
--offline    # Use cached dependencies only
--no-daemon  # Don't use Gradle daemon (lower memory)
--stacktrace # Show full stacktrace on error
```

## Output Artifacts

After successful build:

| File | Location | Purpose |
|------|----------|---------|
| `app-debug.apk` | `android/app/build/outputs/apk/debug/` | Installable APK |
| `index.html` | `android/app/src/main/assets/public/` | Web entry point |
| `assets/` | `android/app/src/main/assets/public/assets/` | Images, fonts, etc. |
| `build-report.txt` | `android/` | Detailed build log |

## Installation on Device

After build succeeds:
```bash
# Via ADB
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or open in Android Studio
cd android && studio .
```

## Troubleshooting

### Build Error: "SDK location not found"
Set `ANDROID_HOME`:
```bash
export ANDROID_HOME=/path/to/Android/sdk
```

### Build Error: "Java version mismatch"
Gradle requires JDK 21. Check:
```bash
java -version  # Should show 21.x
```

### Build Error: "Out of memory"
Increase Gradle memory in `android/gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx6g
```

### Capacitor Sync Warning: "Plugin not found"
Reinstall Capacitor dependencies:
```bash
pnpm install @capacitor/core @capacitor/android
```

## Performance

Typical execution time:
- Web build: ~25-35 seconds
- Capacitor sync: ~3-5 seconds
- Gradle build (incremental): ~1-2 minutes
- Gradle build (clean): ~3-5 minutes

**Total:** ~2-3 minutes (incremental), ~4-6 minutes (clean)

## Examples

### Basic Usage
```
/android-cycle
```

### Clean Build
```
/android-cycle --clean
```

### Release Build (Requires Signing)
```
/android-cycle --release
```

### Offline Mode (No Network)
```
/android-cycle --offline
```

## Integration with VELDRA Workflow

This skill is invoked:
- Manually via `/android-cycle`
- After Android-facing changes (before commit)
- In CI/CD pipeline (GitHub Actions)
- During release preparation

## Related Skills

- `/verify-build` — Web-only verification (faster)
- `/architecture-check` — Validate Android adapter usage
- `/veldra-mobile-qa` agent — Mobile UI/UX review

## Known Limitations

1. **No Emulator Launch** — This skill builds APK but doesn't install or launch it. Use ADB separately.
2. **No Device Testing** — Build success ≠ runtime success. Test on real device.
3. **No iOS Build** — iOS requires separate workflow (not yet implemented).

## Maintenance

Update this skill when:
- Android SDK version upgraded
- Gradle version changed
- Capacitor major version updated
- New Android-specific build steps added

## Source

Maintained at: `.claude/skills/android-cycle/SKILL.md`

Implementation references:
- `vite.android.config.ts` — Android-specific Vite config
- `capacitor.config.ts` — Capacitor platform config
- `android/app/build.gradle` — Gradle build configuration
- `package.json` scripts: `android:*`
