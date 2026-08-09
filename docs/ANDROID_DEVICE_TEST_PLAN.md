# Android Device Testing & Smoke-Test Plan

This document provides step-by-step instructions for installing, testing, and debugging **VELDRA** on physical devices (specifically optimized for the Samsung Galaxy A56 on Android 15).

---

## 1. Installation & Setup Guide

### How to Build the APK Locally
To compile the debug APK package on your local computer:
```bash
npm run android:apk:debug
```
*Note: This script compiles the Vite production SPA client, syncs resources into the Capacitor native project directories, and launches the local Gradle daemon to build the debug package.*

- **APK File Output Path:** `android/app/build/outputs/apk/debug/app-debug.apk`

---

### How to Build the APK from GitHub Actions
If you prefer to build using CI pipelines:
1. Go to the repository on GitHub: `https://github.com/mertgoevse-wq/VELDRA`.
2. Navigate to the **Actions** tab.
3. Select the **Android Debug APK** workflow from the left sidebar.
4. Click the **Run workflow** dropdown on the right side and click the green **Run workflow** button.
5. Wait for the run to complete (~3-4 minutes).
6. Under the **Artifacts** section at the bottom of the run summary page, click **veldra-android-debug-apk** to download the compiled ZIP file containing `app-debug.apk`.

---

### How to Install the APK on Android
1. **Transfer the APK to your phone:** Connect your device via USB (or send via Google Drive, Telegram, or email).
2. **Enable Unknown Sources:**
   - Open your Android file manager (e.g. *My Files* on Samsung).
   - Tap the `app-debug.apk` file.
   - If prompted with a security warning, tap **Settings** and toggle **Allow from this source**.
3. **Install:** Tap **Install** and wait for the installer to finish.
4. **Google Play Protect Block:** If a popup says "Blocked by Play Protect", tap **Install anyway**.

---

### How to Uninstall/Reinstall Cleanly
To ensure no cached assets or corrupt databases persist across builds:
1. On your device's home screen or apps drawer, tap and hold the **VELDRA** icon.
2. Select **Uninstall** (or tap the `i` App Info icon and tap **Uninstall**).
3. Confirm the uninstallation.
4. Copy the new APK to your phone and install it normally.

---

### How to Clear App Storage
If the app gets stuck or you want to reset all user databases:
1. Long-press the **VELDRA** icon and select **App info** (or go to Settings → Apps → VELDRA).
2. Tap **Storage**.
3. Tap **Clear data** (which deletes all local database entries, IndexedDB workspaces, and saved preferences) and **Clear cache**.
4. Reopen the app to start from a clean state.

---

## 2. On-Device Smoke-Test Checklist

Run these tests step-by-step to verify the app's core functions:

### A. App Launch & Boot
- [ ] **Launch:** The app boots up quickly when tapping the launcher icon.
- [ ] **No Blank Screens:** The interface renders immediately; there is no infinite white/black screen.
- [ ] **No Immediate Crash:** The application remains open and doesn't trigger "app stopped" dialogs.
- [ ] **Icon/Name Check:** Launcher label reads **VELDRA** and branding/logo displays correctly.
- [ ] **Version Indicator:** Settings tab → About shows `v1.0.0 (Debug build)` with correct compilation date.

### B. Navigation & Basic UI
- [ ] **Chat Navigation:** The Chat tab opens and displays the primary AI chat interface.
- [ ] **Settings Navigation:** Tapping the Settings tab opens the Android Fallback Settings Panel.
- [ ] **Tab Bar Responsiveness:** Navigating back and forth between Chat and Settings works smoothly.
- [ ] **Back Button Safety:** Pressing the Android physical back button does not exit the app abruptly or clear the current workspace.

### C. Local Persistence (IndexedDB)
- [ ] **File Modification:** Create or write a file in the workspace (via chat code generation or the editor if supported).
- [ ] **Persist Check:** Force-stop/close the app from the Android Recents menu.
- [ ] **Re-launch Verification:** Reopen the app and confirm the workspace files and settings are fully restored.

### D. Remote Runtime Configuration
- [ ] **Server URL:** Enter the computer's LAN IP address (e.g., `http://192.168.1.xxx:8787`).
- [ ] **Auth Token:** Enter the configured security token.
- [ ] **Test Connection:** Tap **Test Connection** and verify that a green success toast/message appears.
- [ ] **Workspace Creation:** Tap **Create Workspace** and confirm a new workspace ID is generated and saved.

### E. Remote File Synchronization
- [ ] **Push Workspace:** Tap **Sync workspace to Remote Runtime** and confirm file counts are uploaded.
- [ ] **Pull Workspace:** Tap **Pull remote files** and confirm files sync down from the server.
- [ ] **Current File Sync:** Verify that editing a file pushes changes to the remote runtime.

### F. Command Execution
- [ ] **Npm Install:** Tap the **npm install** command profile. Confirm that logs stream live inside the terminal console box.
- [ ] **Dev Server:** Run **npm run dev** / **pnpm run dev** profile commands and verify execution.
- [ ] **Output Streams:** Verify standard output and standard error text prints in real-time.
- [ ] **Stop Control:** Tap **Stop Command** and confirm the process is killed successfully.

### G. Live Web Preview
- [ ] **Static Preview:** Open preview and verify the local static index fallback displays.
- [ ] **Remote Preview:** Run a dev server and tap **Refresh Preview**. Verify that the detected LAN preview URL loads.
- [ ] **LAN URL Note:** Verify that the warning box explaining that localhost cannot be used by the phone is visible.

### H. Remote Git Operations
- [ ] **Git Init:** Tap **Git Init** on the GitHub Sync Panel. Confirm git repository initialization output prints in the console.
- [ ] **Git Status:** Tap **Git Status** and confirm the lists of changed files print.
- [ ] **Commit Changes:** Type a commit message (e.g., `test: verification`) and tap **Commit Changes**. Verify the commit hash output.
- [ ] **Push Changes:** Tap **Push to GitHub (Dry-Run)**. Confirm that the console displays the mock dry-run push response, and the warning banner clearly states that push is dry-run/simulation.

---

## 3. Troubleshooting Matrix

| Issue | Potential Cause | Troubleshooting Steps |
|-------|-----------------|-----------------------|
| **Blank Screen** | JavaScript crash or syntax error on unsupported browser engine. | Verify your Android System WebView is updated via Google Play Store. Rebuild assets using `npm run android:webbuild` and run `cap sync`. |
| **Storage Not Saving** | IndexedDB is blocked or quota is exceeded. | Clear app data in phone settings. Verify that `Settings` shows IndexedDB status as "Available". |
| **Remote Runtime Unreachable** | Devices are not on the same Wi-Fi network; firewall is blocking port `8787`. | Confirm both the laptop and phone are on the same Wi-Fi. Add a firewall rule on your computer to allow inbound traffic on TCP port `8787`. Use your computer's LAN IP, not `localhost`. |
| **Phone Cannot Reach Localhost** | The phone resolves `localhost` to its own internal interface. | Configure the Remote Runtime URL in Settings using the laptop's Wi-Fi IP address (e.g. `http://192.168.1.123:8787`). |
| **APK Install Blocked** | Google Play Protect warns against unknown developers. | Tap **Install anyway** or temporarily turn off Play Protect scanning in Google Play Store settings. |
| **Preview Not Loading** | The web application dev server is listening only on `localhost` (127.0.0.1). | Change your Vite configuration or dev script to bind to all network interfaces by adding `--host 0.0.0.0`. |
| **Terminal Commands Not Streaming** | WebSocket protocol mismatch or blocked port. | Verify that WebSockets are reachable. Ensure you are using the correct port and the server is running. |
