// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORK_DIR } from '~/utils/constants';

/*
 * vi.mock factories are hoisted above regular const declarations, so referenced mocks must
 * themselves be created via vi.hoisted() -- a plain `const createFileMock = vi.fn()` below would
 * be undefined inside the factory at module-eval time.
 */
const { createFileMock, createFolderMock } = vi.hoisted(() => ({
  createFileMock: vi.fn().mockResolvedValue(true),
  createFolderMock: vi.fn().mockResolvedValue(true),
}));

vi.mock('~/lib/stores/workbench', () => ({
  workbenchStore: {
    createFile: createFileMock,
    createFolder: createFolderMock,
  },
}));

vi.mock('~/lib/stores/logs', () => ({
  logStore: {
    logWarning: vi.fn(),
    logError: vi.fn(),
  },
}));

/*
 * This jsdom version's Blob/File polyfill has neither arrayBuffer() nor text() (confirmed:
 * `typeof new Blob(['x']).arrayBuffer === 'undefined'` here, despite jsdom's changelog claiming
 * support since 16.5) -- but its FileReader implementation is complete. Both fileUtils.ts's
 * isBinaryFile() and workspaceFileImport.ts itself call file.arrayBuffer()/file.text(), so this
 * polyfill (scoped to this spec file only) backs them with FileReader instead of changing
 * production code to work around a test-environment gap.
 */
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(this);
    });
  };
}

if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function text(this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(this);
    });
  };
}

const { importFilesIntoWorkspace } = await import('./workspaceFileImport');

function makeTextFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/plain' });
}

function makeBinaryFile(name: string): File {
  return new File([new Uint8Array([0, 1, 2, 3, 255])], name, { type: 'application/octet-stream' });
}

describe('importFilesIntoWorkspace', () => {
  beforeEach(() => {
    createFileMock.mockClear();
    createFolderMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('imports flat text files with their name as the path', async () => {
    const result = await importFilesIntoWorkspace([makeTextFile('hello.txt', 'Hello VELDRA')], {
      stripTopLevelFolder: false,
    });

    expect(result).toEqual({ importedCount: 1, ignoredCount: 0, errorCount: 0 });
    expect(createFileMock).toHaveBeenCalledWith(`${WORK_DIR}/hello.txt`, 'Hello VELDRA');
  });

  it('imports binary files as Uint8Array content, not decoded text', async () => {
    const result = await importFilesIntoWorkspace([makeBinaryFile('icon.png')], { stripTopLevelFolder: false });

    expect(result.importedCount).toBe(1);
    expect(createFileMock).toHaveBeenCalledTimes(1);

    const [path, content] = createFileMock.mock.calls[0];
    expect(path).toBe(`${WORK_DIR}/icon.png`);
    expect(content).toBeInstanceOf(Uint8Array);
    expect(Array.from(content as Uint8Array)).toEqual([0, 1, 2, 3, 255]);
  });

  it('strips the top-level folder name when stripTopLevelFolder is set', async () => {
    const file = makeTextFile('App.tsx', 'export default function App() {}');
    Object.defineProperty(file, 'webkitRelativePath', { value: 'myproject/src/App.tsx' });

    await importFilesIntoWorkspace([file], { stripTopLevelFolder: true });

    expect(createFolderMock).toHaveBeenCalledWith(`${WORK_DIR}/src`);
    expect(createFileMock).toHaveBeenCalledWith(`${WORK_DIR}/src/App.tsx`, 'export default function App() {}');
  });

  it('ignores files matched by the standard ignore patterns (e.g. node_modules)', async () => {
    const ignored = makeTextFile('index.js', 'noop');
    Object.defineProperty(ignored, 'webkitRelativePath', { value: 'myproject/node_modules/pkg/index.js' });

    const kept = makeTextFile('README.md', '# hi');
    Object.defineProperty(kept, 'webkitRelativePath', { value: 'myproject/README.md' });

    const result = await importFilesIntoWorkspace([ignored, kept], { stripTopLevelFolder: true });

    expect(result).toEqual({ importedCount: 1, ignoredCount: 1, errorCount: 0 });
    expect(createFileMock).toHaveBeenCalledTimes(1);
    expect(createFileMock).toHaveBeenCalledWith(`${WORK_DIR}/README.md`, '# hi');
  });

  it('returns zero counts without calling createFile when nothing is importable', async () => {
    const ignored = makeTextFile('debug.log', 'noop');
    Object.defineProperty(ignored, 'webkitRelativePath', { value: 'proj/debug.log' });

    const result = await importFilesIntoWorkspace([ignored], { stripTopLevelFolder: true });

    expect(result).toEqual({ importedCount: 0, ignoredCount: 1, errorCount: 0 });
    expect(createFileMock).not.toHaveBeenCalled();
  });

  it('rejects selections over the MAX_FILES limit', async () => {
    const files = Array.from({ length: 1001 }, (_, i) => makeTextFile(`file${i}.txt`, 'x'));

    await expect(importFilesIntoWorkspace(files, { stripTopLevelFolder: false })).rejects.toThrow(/file limit/);
  });

  it('counts a createFile failure as an error without throwing', async () => {
    createFileMock.mockRejectedValueOnce(new Error('disk full'));

    const result = await importFilesIntoWorkspace([makeTextFile('a.txt', 'a'), makeTextFile('b.txt', 'b')], {
      stripTopLevelFolder: false,
    });

    expect(result).toEqual({ importedCount: 1, ignoredCount: 0, errorCount: 1 });
  });
});
