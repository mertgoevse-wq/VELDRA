import { atom, computed, map, type MapStore, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import type { FileMap, FilesStore } from './files';
import { createScopedLogger } from '~/utils/logger';

export type EditorDocuments = Record<string, EditorDocument>;

type SelectedFile = WritableAtom<string | undefined>;

const logger = createScopedLogger('EditorStore');

export class EditorStore {
  #filesStore: FilesStore;

  selectedFile: SelectedFile = import.meta.hot?.data?.selectedFile ?? atom<string | undefined>();
  documents: MapStore<EditorDocuments> = import.meta.hot?.data?.documents ?? map({});

  currentDocument = computed([this.documents, this.selectedFile], (documents, selectedFile) => {
    if (!selectedFile) {
      return undefined;
    }

    return documents[selectedFile];
  });

  constructor(filesStore: FilesStore) {
    this.#filesStore = filesStore;

    if (import.meta.hot?.data) {
      import.meta.hot.data.documents = this.documents;
      import.meta.hot.data.selectedFile = this.selectedFile;
    }
  }

  /**
   * `unsavedFiles` identifies documents with a real in-progress user edit not yet reflected
   * in `files` (workbenchStore.unsavedFiles). This runs on EVERY change to the files map,
   * including one from a completely unrelated file (see workbench.ts's `files` subscription) --
   * without this guard, an agent writing any other file mid-edit would silently overwrite the
   * in-progress document's `value` back to its last-saved content, discarding unsaved typing
   * while still leaving it marked "unsaved" (the actual bug this guard fixes). A file NOT in
   * `unsavedFiles` always takes the fresh `dirent.content` -- that's how an externally-changed
   * file (e.g. the agent editing a file the user has open but hasn't touched) is meant to reach
   * the editor.
   */
  setDocuments(files: FileMap, unsavedFiles: ReadonlySet<string> = new Set()) {
    const previousDocuments = this.documents.value;

    this.documents.set(
      Object.fromEntries<EditorDocument>(
        Object.entries(files)
          .map(([filePath, dirent]) => {
            if (dirent === undefined || dirent.type !== 'file') {
              return undefined;
            }

            const previousDocument = previousDocuments?.[filePath];
            const hasUnsavedEdit = unsavedFiles.has(filePath) && previousDocument !== undefined;

            return [
              filePath,
              {
                value: hasUnsavedEdit ? previousDocument.value : dirent.content,
                filePath,
                isBinary: dirent.isBinary, // Add this line
                scroll: previousDocument?.scroll,
              },
            ] as [string, EditorDocument];
          })
          .filter(Boolean) as Array<[string, EditorDocument]>,
      ),
    );
  }

  setSelectedFile(filePath: string | undefined) {
    this.selectedFile.set(filePath);
  }

  updateScrollPosition(filePath: string, position: ScrollPosition) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    this.documents.setKey(filePath, {
      ...documentState,
      scroll: position,
    });
  }

  updateFile(filePath: string, newContent: string) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    // Check if the file is locked by getting the file from the filesStore
    const file = this.#filesStore.getFile(filePath);

    if (file?.isLocked) {
      logger.warn(`Attempted to update locked file: ${filePath}`);
      return;
    }

    /*
     * For scoped locks, we would need to implement diff checking here
     * to determine if the edit is modifying existing code or just adding new code
     * This is a more complex feature that would be implemented in a future update
     */

    const currentContent = documentState.value;
    const contentChanged = currentContent !== newContent;

    if (contentChanged) {
      this.documents.setKey(filePath, {
        ...documentState,
        value: newContent,
      });
    }
  }
}
