import { useStore } from '@nanostores/react';
import { computed } from 'nanostores';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import type { FileHistory } from '~/types/actions';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { useChatHistory } from '~/lib/persistence';
import { classNames } from '~/utils/classNames';
import { WORK_DIR } from '~/utils/constants';
import { SegmentedControl, type SegmentedControlOption } from '~/components/ui/SegmentedControl';
import { EditorPanel } from '~/components/workbench/EditorPanel';
import { DiffView } from '~/components/workbench/DiffView';
import { Preview } from '~/components/workbench/Preview';
import { FileTree } from '~/components/workbench/FileTree';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { MobileFileTreeDrawer } from '~/components/mobile/MobileFileTreeDrawer';
import type {
  OnChangeCallback as OnEditorChange,
  OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';

/**
 * AndroidWorkbenchScreen -- Android-first replacement for reusing the desktop
 * `Workbench.client.tsx` panel (which relies on `position:fixed` + `left:100%`
 * transitions and a fixed `--workbench-width`, none of which fit a full-screen
 * mobile tab). Mounted by AndroidShell as a normal in-flow tab content block,
 * the same pattern as its Chat/Settings tabs, instead of an overlay panel that
 * needed CSS `!important` overrides to behave like one.
 *
 * Files stays reachable via the existing `MobileFileTreeDrawer`-wrapped file
 * tree (EditorPanel already renders one for the Code segment; the Diff segment
 * gets its own trigger here) rather than duplicating a fifth top-level segment
 * -- the underlying file browser (search/folders/selection/empty state) is the
 * same, well-tested `FileTree` component either way.
 */

const WORKBENCH_SEGMENTS: SegmentedControlOption<WorkbenchViewType>[] = [
  { value: 'code', label: 'Code', icon: 'i-ph:code' },
  { value: 'diff', label: 'Diff', icon: 'i-ph:git-diff' },
  { value: 'preview', label: 'Preview', icon: 'i-ph:eye' },
];

interface AndroidWorkbenchScreenProps {
  isStreaming?: boolean;
  onBack: () => void;
}

export const AndroidWorkbenchScreen = memo(({ isStreaming, onBack }: AndroidWorkbenchScreenProps) => {
  const [fileHistory, setFileHistory] = useState<Record<string, FileHistory>>({});

  const selectedFile = useStore(workbenchStore.selectedFile);
  const currentDocument = useStore(workbenchStore.currentDocument);
  const unsavedFiles = useStore(workbenchStore.unsavedFiles);
  const files = useStore(workbenchStore.files);
  const selectedView = useStore(workbenchStore.currentView);
  const showTerminal = useStore(workbenchStore.showTerminal);
  const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
  const { exportChat } = useChatHistory();

  useEffect(() => {
    if (hasPreview) {
      workbenchStore.currentView.set('preview');
    }
  }, [hasPreview]);

  useEffect(() => {
    workbenchStore.setDocuments(files);
  }, [files]);

  const setSelectedView = useCallback((view: WorkbenchViewType) => {
    workbenchStore.currentView.set(view);
  }, []);

  const onEditorChange = useCallback<OnEditorChange>((update) => {
    workbenchStore.setCurrentDocumentContent(update.content);
  }, []);

  const onEditorScroll = useCallback<OnEditorScroll>((position) => {
    workbenchStore.setCurrentDocumentScrollPosition(position);
  }, []);

  const onFileSelect = useCallback((filePath: string | undefined) => {
    workbenchStore.setSelectedFile(filePath);
  }, []);

  const onFileSave = useCallback(() => {
    workbenchStore
      .saveCurrentDocument()
      .then(() => {
        workbenchStore.refreshAllPreviews();
      })
      .catch(() => {
        toast.error('Failed to update file content');
      });
  }, []);

  const onFileReset = useCallback(() => {
    workbenchStore.resetCurrentDocument();
  }, []);

  return (
    <div className="android-workbench-screen">
      <header className="android-workbench-header">
        <button className="android-workbench-back" onClick={onBack} aria-label="Back to chat">
          <div className="i-ph:arrow-left-bold" />
        </button>
        <h1 className="android-workbench-title">Workbench</h1>

        {selectedView === 'diff' && (
          <MobileFileTreeDrawer label="Files">
            <FileTree
              className="h-full"
              files={files}
              hideRoot
              unsavedFiles={unsavedFiles}
              fileHistory={fileHistory}
              rootFolder={WORK_DIR}
              selectedFile={selectedFile}
              onFileSelect={onFileSelect}
            />
          </MobileFileTreeDrawer>
        )}

        {selectedView === 'code' && <ExportChatButton exportChat={exportChat} />}

        <button
          className={classNames('android-workbench-terminal-toggle', { active: showTerminal })}
          onClick={() => workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get())}
          aria-label={showTerminal ? 'Hide terminal' : 'Show terminal'}
          aria-pressed={showTerminal}
        >
          <div className="i-ph:terminal" />
        </button>
      </header>

      <div className="android-workbench-segments-row">
        <SegmentedControl
          value={selectedView}
          onChange={setSelectedView}
          options={WORKBENCH_SEGMENTS}
          aria-label="Workbench view"
        />
      </div>

      <div className="android-workbench-content">
        {selectedView === 'code' && (
          <EditorPanel
            editorDocument={currentDocument}
            isStreaming={isStreaming}
            selectedFile={selectedFile}
            files={files}
            unsavedFiles={unsavedFiles}
            fileHistory={fileHistory}
            onFileSelect={onFileSelect}
            onEditorScroll={onEditorScroll}
            onEditorChange={onEditorChange}
            onFileSave={onFileSave}
            onFileReset={onFileReset}
          />
        )}
        {selectedView === 'diff' && <DiffView fileHistory={fileHistory} setFileHistory={setFileHistory} />}
        {selectedView === 'preview' && <Preview />}
      </div>
    </div>
  );
});
