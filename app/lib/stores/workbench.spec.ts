import { describe, it, expect, afterEach } from 'vitest';
import { workbenchStore } from './workbench';

/**
 * Block 4 of the multi-file consistency mandate: proves the real, wired-up
 * `workbenchStore.setDocuments()` (the exact method Workbench.client.tsx calls on every
 * `files` change) actually threads `unsavedFiles` through to `EditorStore.setDocuments`,
 * not just that `EditorStore` behaves correctly in isolation (covered separately in
 * editor.spec.ts). Uses the real singleton, the same one the whole app shares.
 */
describe('workbenchStore.setDocuments (real singleton wiring)', () => {
  afterEach(() => {
    workbenchStore.files.set({});
    workbenchStore.unsavedFiles.set(new Set());
  });

  it('keeps an in-progress unsaved edit alive when an unrelated file write triggers a re-sync', () => {
    workbenchStore.files.set({
      '/home/project/index.html': { type: 'file', content: 'saved content', isBinary: false },
      '/home/project/style.css': { type: 'file', content: 'body {}', isBinary: false },
    });
    workbenchStore.setDocuments(workbenchStore.files.get());
    workbenchStore.setSelectedFile('/home/project/index.html');

    workbenchStore.setCurrentDocumentContent('unsaved in-progress edit');

    expect(workbenchStore.unsavedFiles.get().has('/home/project/index.html')).toBe(true);
    expect(workbenchStore.currentDocument.get()?.value).toBe('unsaved in-progress edit');

    // An unrelated file changes -- e.g. an agent action writing style.css in the background.
    workbenchStore.files.setKey('/home/project/style.css', {
      type: 'file',
      content: 'body { color: red; }',
      isBinary: false,
    });
    workbenchStore.setDocuments(workbenchStore.files.get());

    expect(workbenchStore.currentDocument.get()?.value).toBe('unsaved in-progress edit');
    expect(workbenchStore.unsavedFiles.get().has('/home/project/index.html')).toBe(true);
  });
});
