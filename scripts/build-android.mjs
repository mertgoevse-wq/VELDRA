#!/usr/bin/env node

/**
 * Build script for Android: ensures build/client/index.html is generated correctly
 * and properly serves the Remix web app to Capacitor.
 *
 * Usage:
 *   npm run build:android
 *   npm run android:sync
 *   npm run android:build
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BUILD_CLIENT = path.join(ROOT, 'build', 'client');

console.log('\n[Android Build] Starting...');

// Step 1: Run the Android-specific Vite build (no Remix server deps)
// (stale-test-process cleanup + heap cap both live in the `android:webbuild` npm script itself
// -- a `preandroid:webbuild` hook and NODE_OPTIONS respectively -- so every path that invokes it,
// including this one, gets them for free without duplicating the logic here.)
console.log('\n[Build] Running Android Vite build...');
const buildResult = spawnSync('npm', ['run', 'android:webbuild'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
});

if (buildResult.status !== 0) {
  console.error('\n[Error] Android web build failed');
  process.exit(1);
}

// Step 2: Verify build/client exists
if (!fs.existsSync(BUILD_CLIENT)) {
  console.error(`\n[Error] build/client does not exist at ${BUILD_CLIENT}`);
  process.exit(1);
}

console.log(`✅ build/client directory created at ${BUILD_CLIENT}`);

// Step 3: Check that build/client/index.html exists
const indexHtml = path.join(BUILD_CLIENT, 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error(`\n[Error] build/client/index.html not found at ${indexHtml}`);
  console.error('\nThe Remix Vite build should have generated this file.');
  console.error('Check that:');
  console.error('  1. Remix is configured correctly in remix.config.js');
  console.error('  2. vite.config.ts is not overriding the build output');
  console.error('  3. app/root.tsx exports a default component');
  process.exit(1);
}

console.log(`✅ build/client/index.html exists (${fs.statSync(indexHtml).size} bytes)`);

// Step 4: List build artifacts
const buildContents = fs.readdirSync(BUILD_CLIENT);
console.log(`\n[Build Contents] ${buildContents.length} items:`);
buildContents.slice(0, 10).forEach((item) => {
  const fullPath = path.join(BUILD_CLIENT, item);
  const isDir = fs.statSync(fullPath).isDirectory();
  console.log(`  ${isDir ? '[DIR]' : '[FILE]'} ${item}`);
});
if (buildContents.length > 10) {
  console.log(`  ... and ${buildContents.length - 10} more items`);
}

// Step 5: Verify key assets exist
const requiredAssets = ['index.html', 'assets'];
const missingAssets = requiredAssets.filter((asset) => !buildContents.includes(asset));

if (missingAssets.length > 0) {
  console.warn(`\n⚠️  Missing expected assets: ${missingAssets.join(', ')}`);
  console.warn('The Android build may not display correctly.');
} else {
  console.log('✅ All expected assets present');
}

console.log('\n[Android Build] Complete!');
console.log('\nNext steps:');
console.log('  1. npm run android:sync  (sync assets to Android)');
console.log('  2. npm run android:open  (open Android Studio)');
console.log('  3. Build and run in Android Studio or npm run android:build');
console.log('');
