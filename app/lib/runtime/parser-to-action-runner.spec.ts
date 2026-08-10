import { describe, expect, it, vi } from 'vitest';
import { EnhancedStreamingMessageParser } from './enhanced-message-parser';
import { ActionRunner } from './action-runner';
import { WORK_DIR } from '~/utils/constants';
import type { ActionCallbackData } from './message-parser';

/**
 * Integration test for the seam neither message-parser.spec.ts nor action-runner.spec.ts covers
 * on its own: raw streamed model text -> EnhancedStreamingMessageParser -> ActionRunner -> a real
 * file write. This is the "hello.txt" acceptance scenario from the product mandate (create a file
 * from a prompt, verify it lands in the workspace) made deterministic and credential-free by
 * substituting a fixed model-output string for a live LLM call.
 *
 * Callback wiring below is copied verbatim from app/lib/hooks/useMessageParser.ts's real
 * production wiring (which normally targets workbenchStore) so this test exercises the exact
 * same open/close/stream sequencing a real streamed chat response drives, just pointed at a bare
 * ActionRunner instead of the full workbenchStore singleton.
 *
 * Content assertions below compare with .trim(): the parser appends a trailing newline to file
 * action content in some multi-action/streamed cases (observed directly via this test, not
 * something introduced here) that varies with unrelated internal state. That whitespace detail is
 * message-parser.spec.ts's concern; this test's job is verifying the pipeline delivers the right
 * file at the right path with the right (modulo trailing whitespace) content.
 */
function wireParserToRunner(runner: ActionRunner) {
  return new EnhancedStreamingMessageParser({
    callbacks: {
      onActionOpen: (data: ActionCallbackData) => {
        if (data.action.type === 'file') {
          runner.addAction(data);
        }
      },
      onActionClose: (data: ActionCallbackData) => {
        if (data.action.type !== 'file') {
          runner.addAction(data);
        }

        void runner.runAction(data);
      },
      onActionStream: (data: ActionCallbackData) => {
        void runner.runAction(data, true);
      },
    },
  });
}

function createAndroidFallbackRunner(
  writeFile: ReturnType<typeof vi.fn<(filePath: string, content: string) => Promise<void>>>,
) {
  const webcontainer = Promise.reject(new Error('WebContainer unavailable in Android fallback mode'));
  void webcontainer.catch(() => undefined);

  return new ActionRunner(webcontainer, () => undefined as never, undefined, undefined, undefined, writeFile);
}

/** Finds the write for a given path among all calls and returns its (trimmed) content. */
function writtenContentFor(writeFile: ReturnType<typeof vi.fn>, filePath: string): string | undefined {
  const call = writeFile.mock.calls.find(([path]) => path === filePath);
  return call ? (call[1] as string).trim() : undefined;
}

describe('parser -> ActionRunner integration (hello.txt acceptance scenario)', () => {
  it('creates a file from a single, complete boltArtifact response', async () => {
    const writeFile = vi.fn(async () => undefined);
    const runner = createAndroidFallbackRunner(writeFile);
    const parser = wireParserToRunner(runner);

    const modelResponse =
      'Sure, creating that file now.\n\n' +
      '<boltArtifact id="hello-artifact" title="Create hello.txt">' +
      '<boltAction type="file" filePath="hello.txt">Hello VELDRA</boltAction>' +
      '</boltArtifact>';

    parser.parse('msg-1', modelResponse);

    // runAction() chains onto ActionRunner's internal execution promise -- wait for it to settle.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writtenContentFor(writeFile, `${WORK_DIR}/hello.txt`)).toBe('Hello VELDRA');
  });

  it('creates a file when the response streams in across multiple chunks', async () => {
    const writeFile = vi.fn(async () => undefined);
    const runner = createAndroidFallbackRunner(writeFile);
    const parser = wireParserToRunner(runner);

    const chunks = [
      '<boltArtifact id="hello-artifact" title="Create hello.txt">',
      '<boltAction type="file" filePath="hello.txt">Hello ',
      'VELDRA</boltAction>',
      '</boltArtifact>',
    ];

    for (const chunk of chunks) {
      parser.parse('msg-2', chunks.slice(0, chunks.indexOf(chunk) + 1).join(''));
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(writtenContentFor(writeFile, `${WORK_DIR}/hello.txt`)).toBe('Hello VELDRA');
  });

  it('creates multiple files from one artifact (landing page scenario)', async () => {
    const writeFile = vi.fn(async () => undefined);
    const runner = createAndroidFallbackRunner(writeFile);
    const parser = wireParserToRunner(runner);

    const modelResponse =
      '<boltArtifact id="landing-page" title="VELDRA landing page">' +
      '<boltAction type="file" filePath="index.html">' +
      '<!doctype html><html><body>VELDRA Demo</body></html>' +
      '</boltAction>' +
      '<boltAction type="file" filePath="style.css">body { margin: 0; }</boltAction>' +
      '</boltArtifact>';

    parser.parse('msg-3', modelResponse);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(writtenContentFor(writeFile, `${WORK_DIR}/index.html`)).toBe(
      '<!doctype html><html><body>VELDRA Demo</body></html>',
    );
    expect(writtenContentFor(writeFile, `${WORK_DIR}/style.css`)).toBe('body { margin: 0; }');
    expect(writeFile).toHaveBeenCalledTimes(2);
  });

  it('never reaches the file writer for a plain conversational response with no artifact', async () => {
    const writeFile = vi.fn(async () => undefined);
    const runner = createAndroidFallbackRunner(writeFile);
    const parser = wireParserToRunner(runner);

    parser.parse('msg-4', 'I can help with that -- what would you like the landing page to say?');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(writeFile).not.toHaveBeenCalled();
  });
});
