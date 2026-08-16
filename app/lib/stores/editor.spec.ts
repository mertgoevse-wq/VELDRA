import { describe, it, expect } from 'vitest';
import { EditorStore } from './editor';
import type { FilesStore, FileMap } from './files';

/**
 * Block 4 of the multi-file consistency mandate: `setDocuments(files)` runs on EVERY change
 * to `workbenchStore.files` (see Workbench.client.tsx's `useEffect(() => setDocuments(files),
 * [files])`), including a change to a file that isn't even the one currently open. Before this
 * fix, `setDocuments` rebuilt every open document's `value` unconditionally from the fresh
 * `dirent.content` -- so a user's in-progress, unsaved edit in file A was silently discarded
 * (reverted to A's last-saved content) whenever ANY file changed anywhere, e.g. an agent
 * writing an unrelated file B. Worse, `unsavedFiles` was never cleared, so the UI kept
 * claiming A was "modified" even though its actual editor content had just been rolled back.
 */

function fakeFilesStore(): FilesStore {
  return { getFile: () => undefined } as unknown as FilesStore;
}

describe('EditorStore.setDocuments', () => {
  it('preserves an in-progress unsaved edit when an unrelated file changes elsewhere', () => {
    const store = new EditorStore(fakeFilesStore());

    const files: FileMap = {
      '/home/project/index.html': { type: 'file', content: 'saved content', isBinary: false },
      '/home/project/style.css': { type: 'file', content: 'body {}', isBinary: false },
    };

    store.setDocuments(files);
    store.setSelectedFile('/home/project/index.html');
    store.updateFile('/home/project/index.html', 'unsaved in-progress edit');

    expect(store.documents.get()['/home/project/index.html'].value).toBe('unsaved in-progress edit');

    // An unrelated file (style.css) changes -- e.g. an agent writing it in the background.
    const filesAfterUnrelatedWrite: FileMap = {
      ...files,
      '/home/project/style.css': { type: 'file', content: 'body { color: red; }', isBinary: false },
    };

    store.setDocuments(filesAfterUnrelatedWrite, new Set(['/home/project/index.html']));

    // The unsaved edit must survive -- this is the exact bug: it was being silently reverted.
    expect(store.documents.get()['/home/project/index.html'].value).toBe('unsaved in-progress edit');

    // The unrelated file's fresh content must still come through normally.
    expect(store.documents.get()['/home/project/style.css'].value).toBe('body { color: red; }');
  });

  it("still refreshes a document with fresh content when it has NO unsaved edit (e.g. the agent edits a file the user has open but hasn't touched)", () => {
    const store = new EditorStore(fakeFilesStore());

    const files: FileMap = {
      '/home/project/index.html': { type: 'file', content: 'version 1', isBinary: false },
    };

    store.setDocuments(files);
    expect(store.documents.get()['/home/project/index.html'].value).toBe('version 1');

    const filesAfterAgentEdit: FileMap = {
      '/home/project/index.html': { type: 'file', content: 'version 2 from agent', isBinary: false },
    };

    // No unsavedFiles passed -- nothing is dirty, so the fresh content must win.
    store.setDocuments(filesAfterAgentEdit);

    expect(store.documents.get()['/home/project/index.html'].value).toBe('version 2 from agent');
  });

  it('preserves scroll position for an unsaved document the same way it already did for saved ones', () => {
    const store = new EditorStore(fakeFilesStore());

    const files: FileMap = {
      '/home/project/index.html': { type: 'file', content: 'saved content', isBinary: false },
    };

    store.setDocuments(files);
    store.setSelectedFile('/home/project/index.html');
    store.updateFile('/home/project/index.html', 'unsaved edit');
    store.updateScrollPosition('/home/project/index.html', { top: 42, left: 0 });

    store.setDocuments(files, new Set(['/home/project/index.html']));

    expect(store.documents.get()['/home/project/index.html'].scroll).toEqual({ top: 42, left: 0 });
    expect(store.documents.get()['/home/project/index.html'].value).toBe('unsaved edit');
  });
});
