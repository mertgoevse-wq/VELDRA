import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTemplates } from './selectStarterTemplate';

/**
 * Phase 7 of the product-integration mandate: getTemplates() is the real mechanism behind
 * "user picks a template, gets a real working project" (buildFileSeedArtifactMessage,
 * which it calls, already has its own tests since c998f16's unification round -- this
 * covers the surrounding logic that was still untested: which files get excluded, how a
 * .bolt/ignore file's read-only rules and a .bolt/prompt file's instructions actually reach
 * the LLM, and the not-found case). No test file existed for this module before.
 */

vi.mock('./constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./constants')>();
  return {
    ...actual,
    STARTER_TEMPLATES: [
      {
        name: 'fake-template',
        label: 'Fake Template',
        description: 'A template for testing',
        githubRepo: 'fake-org/fake-template',
      },
    ],
  };
});

describe('getTemplates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null for a template name that is not in STARTER_TEMPLATES', async () => {
    const result = await getTemplates('does-not-exist');

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('excludes .git and .bolt files from the seeded artifact, and keeps real project files', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'config', path: '.git/config', content: 'gitdata' },
        { name: 'ignore', path: '.bolt/ignore', content: '' },
        { name: 'index.ts', path: 'src/index.ts', content: 'console.log("hi")' },
        { name: 'package.json', path: 'package.json', content: '{}' },
      ],
    } as any);

    const result = await getTemplates('fake-template', 'My Project');

    expect(result).not.toBeNull();
    expect(result!.assistantMessage).toContain('src/index.ts');
    expect(result!.assistantMessage).toContain('package.json');
    expect(result!.assistantMessage).not.toContain('.git/config');
    expect(result!.assistantMessage).not.toContain('.bolt/ignore');
  });

  it('surfaces a .bolt/prompt file as real template instructions in userMessage', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'prompt', path: '.bolt/prompt', content: 'Use TypeScript strict mode.' },
        { name: 'index.ts', path: 'src/index.ts', content: 'export {}' },
      ],
    } as any);

    const result = await getTemplates('fake-template');

    expect(result!.userMessage).toContain('TEMPLATE INSTRUCTIONS');
    expect(result!.userMessage).toContain('Use TypeScript strict mode.');
  });

  it('lists real .bolt/ignore-matched files as read-only in userMessage, not silently dropped from the seed', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'ignore', path: '.bolt/ignore', content: 'vendor/**' },
        { name: 'locked.ts', path: 'vendor/locked.ts', content: '// do not touch' },
        { name: 'index.ts', path: 'src/index.ts', content: 'export {}' },
      ],
    } as any);

    const result = await getTemplates('fake-template');

    expect(result!.userMessage).toContain('STRICT FILE ACCESS RULES');
    expect(result!.userMessage).toContain('vendor/locked.ts');

    /*
     * Read-only doesn't mean absent -- the LLM still needs the file's real content to
     * import/reference it, just not modify it (see the userMessage instructions above).
     */
    expect(result!.assistantMessage).toContain('vendor/locked.ts');
    expect(result!.assistantMessage).toContain('// do not touch');
  });

  it('has no TEMPLATE INSTRUCTIONS or STRICT FILE ACCESS RULES sections when the template has neither a prompt nor an ignore file', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ name: 'index.ts', path: 'src/index.ts', content: 'export {}' }],
    } as any);

    const result = await getTemplates('fake-template');

    expect(result!.userMessage).not.toContain('TEMPLATE INSTRUCTIONS');
    expect(result!.userMessage).not.toContain('STRICT FILE ACCESS RULES');
  });
});
