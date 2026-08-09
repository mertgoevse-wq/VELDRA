#!/usr/bin/env node

/**
  * build-apk.mjs
  *
  * Node.js script wrapper to run the Gradle wrapper (gradlew/gradlew.bat)
  * cross-platform to compile VELDRA Android APKs.
  */

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(ROOT, 'android');
const APK_PATH = path.join(ANDROID_DIR, 'app/build/outputs/apk/debug/app-debug.apk');

// Parse arguments
const isRelease = process.argv.includes('--release');
const checkPathOnly = process.argv.includes('--path');

if (checkPathOnly) {
  console.log(APK_PATH);
  process.exit(0);
}

console.log(`\n[APK Build] Starting ${isRelease ? 'Release' : 'Debug'} APK Build...`);

// Auto-detect Android Studio JBR/JDK on Windows if system default is Java 8
const isWin = process.platform === 'win32';
if (isWin) {
  const jbrPath = 'C:\\Program Files\\Android\\Android Studio\\jbr';
  const jrePath = 'C:\\Program Files\\Android\\Android Studio\\jre';
  if (fs.existsSync(jbrPath)) {
    process.env.JAVA_HOME = jbrPath;
    console.log(`[APK Build] Automatically set JAVA_HOME to Android Studio JBR: ${jbrPath}`);
  } else if (fs.existsSync(jrePath)) {
    process.env.JAVA_HOME = jrePath;
    console.log(`[APK Build] Automatically set JAVA_HOME to Android Studio JRE: ${jrePath}`);
  } else if (process.env.JAVA_HOME) {
    console.log(`[APK Build] Using existing JAVA_HOME: ${process.env.JAVA_HOME}`);
  } else {
    console.warn(`[APK Build] Warning: Android Studio JBR/JRE not found at default locations, and JAVA_HOME is not set.`);
  }
}

// Auto-detect Android SDK location on Windows if not already defined
if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
  const defaultSdkPath = path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk');
  if (fs.existsSync(defaultSdkPath)) {
    process.env.ANDROID_HOME = defaultSdkPath;
    console.log(`[APK Build] Automatically set ANDROID_HOME to: ${defaultSdkPath}`);
  } else {
    console.warn(`[APK Build] Warning: ANDROID_HOME is not set, and SDK was not found at standard path: ${defaultSdkPath}`);
  }
} else {
  console.log(`[APK Build] Using existing ANDROID_HOME: ${process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT}`);
}

// Step 1: Run Capacitor Sync
console.log('\n[APK Build] Running Capacitor sync...');
const syncResult = spawnSync('npm', ['run', 'android:sync'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
});

if (syncResult.status !== 0) {
  console.error('\n[Error] Capacitor sync failed. Cannot compile APK.');
  process.exit(1);
}

// Step 2: Run Gradle Task
const isWindows = process.platform === 'win32';
const gradlewCmd = isWindows ? 'gradlew.bat' : './gradlew';
const gradleTask = isRelease ? 'assembleRelease' : 'assembleDebug';

console.log(`\n[APK Build] Executing Gradle task: ${gradleTask} in ${ANDROID_DIR}...`);

const gradleResult = spawnSync(gradlewCmd, [gradleTask], {
  cwd: ANDROID_DIR,
  stdio: 'inherit',
  shell: isWindows, // Require shell for .bat file execution on Windows
});

if (gradleResult.status !== 0) {
  console.error(`\n[Error] Gradle build task failed with exit code: ${gradleResult.status}`);
  if (isRelease) {
    console.warn('\nNote: Release builds usually require configuring Android release keystores & signing configurations in android/app/build.gradle.');
  }
  process.exit(gradleResult.status || 1);
}

console.log('\n[APK Build] Gradle build succeeded!');

if (!isRelease) {
  if (fs.existsSync(APK_PATH)) {
    console.log(`\n🎉 Debug APK generated successfully at:`);
    console.log(`   ${APK_PATH}`);
  } else {
    console.warn(`\n⚠️  Build task finished, but APK file could not be found at: ${APK_PATH}`);
  }
} else {
  console.log(`\n🎉 Release APK generated successfully!`);
}
process.exit(0);
