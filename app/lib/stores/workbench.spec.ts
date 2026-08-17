import { describe, it, expect, afterEach, vi } from 'vitest';
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

/**
 * Proves the chat Stop button's real wiring: `abortAllActions()` used to only `console.warn`
 * (an explicit TODO stub) instead of ever calling into `ActionRunner`. This checks it now calls
 * the real `abortAll()` on every tracked artifact's runner, and still clears pending alerts.
 */
describe('workbenchStore.abortAllActions (Stop button wiring)', () => {
  afterEach(() => {
    workbenchStore.artifacts.set({});
    workbenchStore.actionAlert.set(undefined);
    workbenchStore.supabaseAlert.set(undefined);
  });

  it('calls the real ActionRunner.abortAll() on every artifact instead of only warning', () => {
    workbenchStore.addArtifact({ messageId: 'message-1', id: 'artifact-1', title: 'Artifact 1' });
    workbenchStore.addArtifact({ messageId: 'message-2', id: 'artifact-2', title: 'Artifact 2' });

    const artifact1 = workbenchStore.artifacts.get()['artifact-1'];
    const artifact2 = workbenchStore.artifacts.get()['artifact-2'];
    expect(artifact1).toBeDefined();
    expect(artifact2).toBeDefined();

    const abortAllSpy1 = vi.spyOn(artifact1!.runner, 'abortAll');
    const abortAllSpy2 = vi.spyOn(artifact2!.runner, 'abortAll');

    workbenchStore.actionAlert.set({
      type: 'error',
      title: 'title',
      description: 'description',
      content: 'content',
    } as any);

    workbenchStore.abortAllActions();

    expect(abortAllSpy1).toHaveBeenCalledOnce();
    expect(abortAllSpy2).toHaveBeenCalledOnce();
    expect(workbenchStore.actionAlert.get()).toBeUndefined();
  });
});
