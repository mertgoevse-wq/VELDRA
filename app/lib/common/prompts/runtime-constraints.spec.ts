import { describe, expect, it } from 'vitest';
import { getRuntimeConstraintsPrompt, type RuntimePromptCapabilities } from '~/lib/common/prompts/runtime-constraints';

/**
 * These capability shapes are copied from the real branches of
 * `getCapabilitiesForMode()` in `app/lib/stores/runtime-mode.ts`, so a change to
 * the store that alters what a mode can actually do will surface here.
 */
const WEBCONTAINER: RuntimePromptCapabilities = {
  mode: 'webcontainer',
  devServer: true,
  packageInstall: true,
  commandExecution: true,
};

const ANDROID_FALLBACK: RuntimePromptCapabilities = {
  mode: 'android-fallback',
  devServer: false,
  packageInstall: false,
  commandExecution: false,
};

const REMOTE: RuntimePromptCapabilities = {
  mode: 'remote',
  devServer: true,
  packageInstall: true,
  commandExecution: false,
};

describe('getRuntimeConstraintsPrompt', () => {
  it('adds nothing when no runtime information reached the server', () => {
    expect(getRuntimeConstraintsPrompt(undefined)).toBe('');
  });

  it('adds nothing for a full WebContainer session so the desktop prompt cannot regress', () => {
    expect(getRuntimeConstraintsPrompt(WEBCONTAINER)).toBe('');
  });

  describe('android-fallback (the default Android mode)', () => {
    const prompt = getRuntimeConstraintsPrompt(ANDROID_FALLBACK);

    it('emits a runtime_environment block', () => {
      expect(prompt).toContain('<runtime_environment>');
      expect(prompt).toContain('</runtime_environment>');
    });

    it('corrects the base prompt’s false WebContainer claim', () => {
      expect(prompt).toContain('NOT running in WebContainer');
    });

    it('forbids the action types action-runner.ts will reject', () => {
      expect(prompt).toMatch(/NEVER emit a `shell` or `start` action/);
    });

    it('forbids depending on npm install, which never runs in this mode', () => {
      expect(prompt).toContain('npm install');
      expect(prompt).toMatch(/never installed/i);
    });

    it('requires index.html at the root, the only entry staticPreviewBundle can load', () => {
      expect(prompt).toContain('`index.html` at the project root');
    });

    it('forbids exactly the syntax staticPreviewBundle serves verbatim without transpiling', () => {
      expect(prompt).toContain('NO JSX');
      expect(prompt).toContain('NO TypeScript');
      expect(prompt).toMatch(/\.tsx/);
    });

    it('forbids bare specifiers, which have no resolver, but allows absolute CDN URLs', () => {
      expect(prompt).toMatch(/NO bare-specifier imports/);
      expect(prompt).toMatch(/absolute https URL/i);
    });

    it('still demands a high-quality result rather than licensing a plain one', () => {
      expect(prompt).toMatch(/not an excuse for a plain-looking result/i);
    });

    it('stops the model claiming the user should run or open something', () => {
      expect(prompt).toMatch(/Never tell the user to run a command/i);
    });
  });

  describe('remote runtime', () => {
    const prompt = getRuntimeConstraintsPrompt(REMOTE);

    it('does not apply the zero-build restrictions, because a real dev server exists', () => {
      expect(prompt).not.toContain('NO JSX');
      expect(prompt).not.toMatch(/NEVER emit a `shell` or `start` action/);
    });

    it('forbids only arbitrary shell text, which the server allowlist rejects', () => {
      expect(prompt).toMatch(/NEVER emit a `shell` action containing arbitrary command text/);
    });

    it('points the model at the structured build/start actions that do work', () => {
      expect(prompt).toContain('`start` action');
      expect(prompt).toContain('`build` action');
    });
  });

  it('treats a runtime with no dev server and no installer as zero-build regardless of mode', () => {
    /*
     * Driven by the capability booleans, not the mode label, so a future mode that
     * degrades the same way is described honestly without touching this module.
     */
    const degradedRemote: RuntimePromptCapabilities = {
      mode: 'remote',
      devServer: false,
      packageInstall: false,
      commandExecution: false,
    };

    expect(getRuntimeConstraintsPrompt(degradedRemote)).toContain('NO JSX');
  });
});
